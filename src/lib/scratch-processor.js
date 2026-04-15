// AudioWorklet processor para scratch de precisión.
// Mantiene un buffer PCM decodificado en memoria y avanza un "virtual playhead"
// (float, en samples) con rate variable — incluyendo negativo — sin stop/start
// de ningún AudioBufferSourceNode. Latencia = 1 audio quantum (~2.9ms a 44.1k).
//
// Protocolo de mensajes (main → worklet):
//   { type: 'loadBuffer', channels: Float32Array[], length, sampleRate }
//   { type: 'start', offsetSeconds }
//   { type: 'stop' }
//   { type: 'setRate', rate }              // rate signado, 0 = stop, <0 = reverse
//   { type: 'setScratching', scratching, rate? }
//   { type: 'setPlayhead', seconds }       // seek duro (puede producir click)
//
// Mensajes (worklet → main):
//   { type: 'playhead', seconds }          // ~30 Hz
//   { type: 'ended' }                      // una vez, al alcanzar el final

class ScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.channels = null
    this.numChannels = 0
    this.length = 0
    this.playhead = 0
    this.playing = false
    this.scratching = false
    this.targetRate = 1
    this.currentRate = 1
    this.ended = false
    this.sampleRateHz = sampleRate

    // Alphas de smoothing per-sample (one-pole).
    // Se calculan con: alpha = 1 - exp(-1 / (tau * fs))
    // tau pequeño = reacción rápida; tau grande = reacción suave.
    //   6ms scratch:  se siente como un plato con un poco de masa real —
    //                 responsivo pero sin ser grabby. El main thread envía
    //                 rate instantáneo, así que el smoothing vive acá.
    //   60ms release: inercia al soltar (el plato "vuelve a las RPM").
    //   0.3ms normal: tight lock en playback sin scratch.
    this.alphaScratch = this._tauToAlpha(0.006)
    this.alphaRelease = this._tauToAlpha(0.060)
    this.alphaNormal = this._tauToAlpha(0.0003)

    this.playheadReportCounter = 0
    this.playheadReportInterval = Math.max(1, Math.floor(this.sampleRateHz / 30))

    this.port.onmessage = (e) => this._onMessage(e.data)
  }

  _tauToAlpha(tauSec) {
    return 1 - Math.exp(-1 / Math.max(1e-6, tauSec * this.sampleRateHz))
  }

  _onMessage(msg) {
    if (!msg || !msg.type) return
    switch (msg.type) {
      case 'loadBuffer': {
        const chs = msg.channels || []
        const normalized = []
        for (let i = 0; i < chs.length; i++) {
          const c = chs[i]
          normalized.push(c instanceof Float32Array ? c : new Float32Array(c))
        }
        this.channels = normalized
        this.numChannels = normalized.length
        this.length = msg.length | 0
        this.playhead = 0
        this.ended = false
        this.playing = false
        this.currentRate = 1
        this.targetRate = 1
        break
      }
      case 'start': {
        if (!this.channels || this.length < 2) return
        const offs = (msg.offsetSeconds || 0) * this.sampleRateHz
        this.playhead = Math.max(0, Math.min(this.length - 2, offs))
        this.playing = true
        this.ended = false
        this.scratching = false
        this.targetRate = 1
        this.currentRate = 1
        break
      }
      case 'stop': {
        this.playing = false
        break
      }
      case 'setRate': {
        this.targetRate = Number.isFinite(msg.rate) ? msg.rate : 1
        break
      }
      case 'setScratching': {
        this.scratching = !!msg.scratching
        if (msg.rate !== undefined && Number.isFinite(msg.rate)) {
          this.targetRate = msg.rate
        } else if (!this.scratching) {
          // Al soltar scratch sin rate específico: target = 1
          this.targetRate = 1
        }
        break
      }
      case 'setPlayhead': {
        const pos = (msg.seconds || 0) * this.sampleRateHz
        this.playhead = Math.max(0, Math.min(this.length - 2, pos))
        this.ended = false
        break
      }
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    if (!out || !out.length) return true
    const frames = out[0].length
    const outChCount = out.length

    if (!this.playing || !this.channels || this.length < 2) {
      for (let c = 0; c < outChCount; c++) out[c].fill(0)
      return true
    }

    const srcChCount = this.numChannels
    const lastAnchor = this.length - 2

    // Escoge alpha según contexto:
    //  - scratch: alpha rápido para respuesta inmediata al puntero.
    //  - transitorio (rate lejos del target): alpha lento → inercia natural al soltar.
    //  - estable: alpha muy tight.
    const rateErr = Math.abs(this.targetRate - this.currentRate)
    const alpha = this.scratching
      ? this.alphaScratch
      : (rateErr > 0.002 ? this.alphaRelease : this.alphaNormal)

    for (let i = 0; i < frames; i++) {
      // Smooth per-sample
      this.currentRate += (this.targetRate - this.currentRate) * alpha

      // Clamp playhead para lectura segura
      let idx = this.playhead
      if (idx < 0) idx = 0
      else if (idx > lastAnchor) idx = lastAnchor
      const i0 = idx | 0
      const frac = idx - i0
      const i1 = i0 + 1

      // Lectura con interpolación lineal por canal
      for (let c = 0; c < outChCount; c++) {
        const src = this.channels[c < srcChCount ? c : srcChCount - 1]
        const s0 = src[i0]
        const s1 = src[i1]
        out[c][i] = s0 + (s1 - s0) * frac
      }

      // Avanzar playhead
      this.playhead += this.currentRate

      // Boundary handling
      if (this.playhead >= this.length - 1) {
        if (this.scratching) {
          // En scratch, clampea al final — no dispara ended
          this.playhead = this.length - 1
          this.currentRate = 0
        } else if (!this.ended) {
          this.ended = true
          this.playing = false
          this.port.postMessage({ type: 'ended' })
          this.port.postMessage({
            type: 'playhead',
            seconds: (this.length - 1) / this.sampleRateHz,
          })
          // Silencia el resto del frame
          for (let c = 0; c < outChCount; c++) {
            for (let j = i + 1; j < frames; j++) out[c][j] = 0
          }
          return true
        }
      } else if (this.playhead < 0) {
        // No permitimos cruzar antes del inicio
        this.playhead = 0
        if (this.currentRate < 0) this.currentRate = 0
      }
    }

    // Playhead report periódico al main thread
    this.playheadReportCounter += frames
    if (this.playheadReportCounter >= this.playheadReportInterval) {
      this.playheadReportCounter = 0
      this.port.postMessage({
        type: 'playhead',
        seconds: this.playhead / this.sampleRateHz,
      })
    }

    return true
  }
}

registerProcessor('scratch-processor', ScratchProcessor)
