/**
 * Local patched version of simple-reversible-audio-buffer-source-node
 *
 * FIX: The original library uses a ChannelMergerNode as the output node in
 * ReversibleAudioBufferSourceNode. A ChannelMergerNode treats each input as a
 * separate mono channel — when forwardNode/reverseNode connect to it without
 * specifying the input index, all stereo audio collapses to channel 0 (LEFT),
 * causing playback through only one speaker.
 *
 * The fix replaces the outer ChannelMergerNode with a GainNode, which
 * transparently passes through all channels and preserves stereo (or any
 * multi-channel layout).
 *
 * Original: https://github.com/andyGallagher/simple-reversible-audio-buffer-source-node
 * License: MIT
 */

// --- util.ts ---

const reverseAudioBuffer = (audioContext, audioBuffer) => {
  const numberOfChannels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const sampleRate = audioBuffer.sampleRate
  const reversedBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate)
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    const reversedChannelData = reversedBuffer.getChannelData(channel)
    for (let i = 0, j = channelData.length - 1; i < channelData.length; i++, j--) {
      reversedChannelData[i] = channelData[j]
    }
  }
  return reversedBuffer
}

const makePlaybackPositionChannelData = (audioBuffer) => {
  const length = audioBuffer.length
  const timeDataArray = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    timeDataArray[i] = i / length
  }
  return timeDataArray
}

const makeAudioBufferWithPlaybackPositionChannel = (audioContext, audioBuffer, playbackPositionChannelData) => {
  const audioBufferWithPlaybackPositionChannel = audioContext.createBuffer(
    audioBuffer.numberOfChannels + 1,
    audioBuffer.length,
    audioBuffer.sampleRate,
  )
  for (let index = 0; index < audioBuffer.numberOfChannels; index++) {
    const writeChannelData2 = audioBufferWithPlaybackPositionChannel.getChannelData(index)
    const readChannelData = audioBuffer.getChannelData(index)
    for (let i = 0; i < readChannelData.length; i++) {
      writeChannelData2[i] = readChannelData[i]
    }
  }
  const writeChannelData = audioBufferWithPlaybackPositionChannel.getChannelData(audioBuffer.numberOfChannels)
  for (let i = 0; i < playbackPositionChannelData.length; i++) {
    writeChannelData[i] = playbackPositionChannelData[i]
  }
  return audioBufferWithPlaybackPositionChannel
}

// --- playback-position-node.ts ---

class PlaybackPositionNodeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PlaybackPositionNodeError'
  }
}

class PlaybackPositionNode {
  context
  audioBuffer = null
  bufferSource = null
  bufferSourceOptions = {
    playbackRate: 1,
    detune: 0,
    onendedHandler: null,
  }
  splitter
  out
  analyser
  sampleHolder
  shouldCreatePlaybackPositionChannel

  isPlaying = false

  constructor(context, options) {
    this.context = context
    this.splitter = new ChannelSplitterNode(context)
    this.out = new ChannelMergerNode(context)
    this.sampleHolder = new Float32Array(1)
    this.analyser = new AnalyserNode(this.context)
    this.shouldCreatePlaybackPositionChannel = options?.shouldCreatePlaybackPositionChannel ?? true
  }

  set buffer(audioBuffer) {
    if (!this.shouldCreatePlaybackPositionChannel) {
      this.audioBuffer = audioBuffer
      return
    }
    const playbackPositionChannel = makePlaybackPositionChannelData(audioBuffer)
    const audioBufferWithPlaybackPositionChannel = makeAudioBufferWithPlaybackPositionChannel(
      this.context,
      audioBuffer,
      playbackPositionChannel,
    )
    this.audioBuffer = audioBufferWithPlaybackPositionChannel
  }

  detune(value) {
    this.bufferSourceOptions.detune = value
    if (this.bufferSource === null) return
    this.bufferSource.detune.value = value
  }

  playbackRate(rate) {
    this.bufferSourceOptions.playbackRate = rate
    if (this.bufferSource === null) return
    this.bufferSource.playbackRate.value = rate
  }

  // Get current progress between 0 and 1
  playbackPosition() {
    this.analyser?.getFloatTimeDomainData(this.sampleHolder)
    return this.sampleHolder[0]
  }

  start(when, offset) {
    if (this.audioBuffer === null) {
      throw new PlaybackPositionNodeError('No audio buffer set')
    }
    const audioBufferNumberOfChannels = this.audioBuffer.numberOfChannels - 1
    this.bufferSource = new AudioBufferSourceNode(this.context)
    this.bufferSource.buffer = this.audioBuffer
    this.bufferSource.playbackRate.value = this.bufferSourceOptions.playbackRate
    this.bufferSource.detune.value = this.bufferSourceOptions.detune
    this.bufferSource.onended = this.bufferSourceOptions.onendedHandler
    this.bufferSource.connect(this.splitter)
    for (let index = 0; index < audioBufferNumberOfChannels; index++) {
      this.splitter.connect(this.out, index, index)
    }
    this.bufferSource.start(when, offset)
    this.splitter.connect(this.analyser, audioBufferNumberOfChannels)
    this.isPlaying = true
  }

  stop() {
    if (!this.isPlaying) return
    if (this.bufferSource === null) {
      throw new PlaybackPositionNodeError('No audio buffer set')
    }
    this.bufferSource.stop()
    this.isPlaying = false
  }

  connect(destination, output, input) {
    if (destination instanceof AudioNode) {
      this.out.connect(destination, output, input)
      return destination
    } else if (destination instanceof AudioParam) {
      this.out.connect(destination, output)
    }
  }

  disconnect() {
    this.out.disconnect()
  }

  set onended(handler) {
    this.bufferSourceOptions.onendedHandler = handler
    if (this.bufferSource === null) return
    this.bufferSource.onended = handler
  }
}

// --- reversible-audio-buffer-source-node.ts ---

class ReversibleAudioBufferSourceNodeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ReversibleAudioBufferSourceNodeError'
  }
}

class ReversibleAudioBufferSourceNode {
  context
  maxDuration = null
  forwardNode
  reverseNode
  out
  onendedHandler = null
  direction = 'forward'

  constructor(context, options) {
    this.context = context
    this.forwardNode = new PlaybackPositionNode(context, options)
    this.reverseNode = new PlaybackPositionNode(context, options)

    // FIX: Use a GainNode instead of ChannelMergerNode.
    // A ChannelMergerNode treats each connected input as a single mono channel,
    // which collapses stereo to only the left channel.
    // A GainNode transparently passes all channels through, preserving stereo.
    this.out = new GainNode(context)

    this.forwardNode.connect(this.out)
    this.reverseNode.connect(this.out)
  }

  set buffer(buffer) {
    const computedBuffers = (() => {
      if (buffer instanceof AudioBuffer) {
        const reversedBuffer = reverseAudioBuffer(this.context, buffer)
        return { forward: buffer, reverse: reversedBuffer }
      }
      return buffer
    })()
    this.maxDuration = Math.max(computedBuffers.reverse.duration, computedBuffers.forward.duration)
    this.forwardNode.buffer = computedBuffers.forward
    this.reverseNode.buffer = computedBuffers.reverse
  }

  /** Utility method for determining the active node based on the current direction. */
  activeNode() {
    return this.direction === 'forward' ? this.forwardNode : this.reverseNode
  }

  detune(value) {
    this.forwardNode.detune(value)
    this.reverseNode.detune(value)
  }

  /** Manage which node is currently playing by toggling between sign. */
  playbackRate(rate) {
    const absRate = Math.abs(rate)
    this.forwardNode.playbackRate(absRate)
    this.reverseNode.playbackRate(absRate)
    const direction = rate < 0 ? 'reverse' : 'forward'
    if (this.maxDuration === null) {
      throw new ReversibleAudioBufferSourceNodeError('No audio buffer set')
    }
    if (this.direction === direction) return
    if (this.direction === 'forward' && direction === 'reverse') {
      const playbackPosition = this.forwardNode.playbackPosition()
      const reverseStartTime = Math.max(this.maxDuration - playbackPosition * this.maxDuration, 0)
      this.reverseNode.start(0, reverseStartTime)
      this.reverseNode.onended = () => { this.onendedHandler?.('reverse') }
      this.forwardNode.onended = null
      this.forwardNode.stop()
      this.direction = 'reverse'
    } else if (this.direction === 'reverse' && direction === 'forward') {
      const playbackPosition = this.reverseNode.playbackPosition()
      const forwardStartTime = Math.max(this.maxDuration - playbackPosition * this.maxDuration, 0)
      this.forwardNode.start(0, forwardStartTime)
      this.forwardNode.onended = () => { this.onendedHandler?.('forward') }
      this.reverseNode.onended = null
      this.reverseNode.stop()
      this.direction = 'forward'
    }
  }

  start(when, offset) {
    this.activeNode().start(when, offset)
  }

  stop() {
    this.activeNode().stop()
  }

  connect(destination, output, input) {
    if (destination instanceof AudioNode) {
      this.out.connect(destination, output, input)
      return destination
    } else if (destination instanceof AudioParam) {
      this.out.connect(destination, output)
    }
  }

  disconnect() {
    this.out.disconnect()
  }

  set onended(handler) {
    this.onendedHandler = handler
    this.activeNode().onended = () => { handler?.(this.direction) }
  }
}

export {
  PlaybackPositionNodeError,
  ReversibleAudioBufferSourceNode,
  ReversibleAudioBufferSourceNodeError,
  makeAudioBufferWithPlaybackPositionChannel,
  makePlaybackPositionChannelData,
  reverseAudioBuffer,
}
