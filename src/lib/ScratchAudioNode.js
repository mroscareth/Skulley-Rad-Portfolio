// Wrapper que carga el AudioWorklet scratch-processor y expone una API
// compatible (en lo esencial) con el viejo ReversibleAudioBufferSourceNode:
//   new ScratchAudioNode(ctx)
//   .setBuffer(audioBuffer)
//   .connect(destination)   .disconnect()
//   .start(when, offsetSeconds)  .stop()
//   .playbackRate(rate)          // acepta rate signado
//   .setScratching(bool, rate?)  // entra/sale de modo scratch con smoothing distinto
//   .onended = fn                // dispara una sola vez al llegar al final
//   .onplayhead = fn(seconds)    // ~30 Hz
//   .getCurrentTime()            // última posición reportada
//
// Internamente NO usa AudioBufferSourceNode — por eso no tiene glitches,
// ni latencia de re-start, ni clicks al cambiar de dirección.

import processorUrl from './scratch-processor.js?url'

const loadedContexts = new WeakSet()
const inflightLoads = new WeakMap()

export async function ensureScratchWorkletLoaded(ctx) {
  if (!ctx || typeof ctx.audioWorklet?.addModule !== 'function') {
    throw new Error('AudioWorklet not supported in this AudioContext')
  }
  if (loadedContexts.has(ctx)) return
  let pending = inflightLoads.get(ctx)
  if (!pending) {
    pending = ctx.audioWorklet.addModule(processorUrl).then(() => {
      loadedContexts.add(ctx)
      inflightLoads.delete(ctx)
    }).catch((err) => {
      inflightLoads.delete(ctx)
      throw err
    })
    inflightLoads.set(ctx, pending)
  }
  return pending
}

export class ScratchAudioNode {
  constructor(ctx) {
    if (!loadedContexts.has(ctx)) {
      throw new Error('ScratchAudioNode: worklet not loaded — call ensureScratchWorkletLoaded(ctx) first')
    }
    this.ctx = ctx
    this.node = new AudioWorkletNode(ctx, 'scratch-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
    this._currentTime = 0
    this._duration = 0
    this._endedFired = false
    this._stopped = false
    this.onended = null
    this.onplayhead = null

    this.node.port.onmessage = (e) => {
      const m = e.data
      if (!m) return
      if (m.type === 'playhead') {
        this._currentTime = m.seconds || 0
        const cb = this.onplayhead
        if (typeof cb === 'function') {
          try { cb(this._currentTime) } catch { /* ignore */ }
        }
      } else if (m.type === 'ended') {
        if (this._endedFired || this._stopped) return
        this._endedFired = true
        const cb = this.onended
        if (typeof cb === 'function') {
          try { cb() } catch { /* ignore */ }
        }
      }
    }
  }

  // Copia los samples del AudioBuffer a Float32Arrays frescos y los
  // transfiere al worklet (zero-copy). No detacha el AudioBuffer original.
  setBuffer(audioBuffer) {
    const nCh = audioBuffer.numberOfChannels
    const length = audioBuffer.length
    const channels = []
    const transfer = []
    for (let c = 0; c < nCh; c++) {
      const copy = new Float32Array(length)
      copy.set(audioBuffer.getChannelData(c))
      channels.push(copy)
      transfer.push(copy.buffer)
    }
    this._duration = audioBuffer.duration
    this._endedFired = false
    this._stopped = false
    this.node.port.postMessage(
      { type: 'loadBuffer', channels, length, sampleRate: audioBuffer.sampleRate },
      transfer,
    )
  }

  // `when` se ignora (el worklet arranca al recibir el mensaje, latencia 1 quantum).
  start(_when = 0, offsetSeconds = 0) {
    this._endedFired = false
    this._stopped = false
    this.node.port.postMessage({ type: 'start', offsetSeconds: offsetSeconds || 0 })
  }

  stop() {
    this._stopped = true
    try { this.node.port.postMessage({ type: 'stop' }) } catch { /* ignore */ }
  }

  playbackRate(rate) {
    this.node.port.postMessage({ type: 'setRate', rate })
  }

  setScratching(scratching, rate) {
    this.node.port.postMessage({ type: 'setScratching', scratching, rate })
  }

  setPlayhead(seconds) {
    this.node.port.postMessage({ type: 'setPlayhead', seconds })
  }

  getCurrentTime() {
    return this._currentTime
  }

  get duration() {
    return this._duration
  }

  connect(destination, output, input) {
    if (destination && typeof destination === 'object' && 'numberOfInputs' in destination) {
      this.node.connect(destination, output, input)
      return destination
    }
    if (destination && typeof destination === 'object' && 'value' in destination) {
      this.node.connect(destination, output)
      return destination
    }
    return destination
  }

  disconnect() {
    try { this.node.disconnect() } catch { /* ignore */ }
  }
}
