// Sonido de la CARGA de la patada: algo que se estira (una liga, la cuerda
// de un arco). Se sintetiza en vivo con WebAudio en vez de un archivo porque
// tiene que seguir a la carga frame a frame:
//   - tensión: un tono grave que sube ~2 octavas con la carga, con un
//     temblor (vibrato) que crece, como algo a punto de soltarse;
//   - crujido: ruido filtrado a pulsos ("crrrk" de hule o cuerda), cada vez
//     más rápido y agudo;
//   - al llegar al 100 %, un "tin" corto.
// Al soltar se corta rápido: el golpe ya tiene sus propios sonidos.
// Sale por el bus de los SFX (getSfxBus): respeta su volumen y su mute.

import { getSfxBus } from './sfx.js'

let voice = null
const noiseByCtx = new WeakMap()

function noiseBuffer(ctx) {
  let buf = noiseByCtx.get(ctx)
  if (buf) return buf
  buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  noiseByCtx.set(ctx, buf)
  return buf
}

function ping(ctx, out) {
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(1320, t)
  o.frequency.exponentialRampToValueAtTime(1760, t + 0.08)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + 0.3)
  o.onended = () => { try { o.disconnect(); g.disconnect() } catch { } }
}

export function startKickChargeSound() {
  stopKickChargeSound(true)
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  try { if (ctx.state === 'suspended') ctx.resume().catch(() => { }) } catch { }
  const t = ctx.currentTime

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(0.1, t + 0.06)
  master.connect(out)

  // Tensión.
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 70
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 380
  bp.Q.value = 3
  const toneGain = ctx.createGain()
  toneGain.gain.value = 0.35
  osc.connect(bp)
  bp.connect(toneGain)
  toneGain.connect(master)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 4
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.7
  lfo.connect(lfoDepth)
  lfoDepth.connect(osc.frequency)

  // Crujido: el pulso cuadrado suma ±d a una ganancia base d → late de 0 a 2d.
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx)
  noise.loop = true
  const nbp = ctx.createBiquadFilter()
  nbp.type = 'bandpass'
  nbp.frequency.value = 900
  nbp.Q.value = 6
  const creak = ctx.createGain()
  creak.gain.value = 0.05
  const pulse = ctx.createOscillator()
  pulse.type = 'square'
  pulse.frequency.value = 7
  const pulseDepth = ctx.createGain()
  pulseDepth.gain.value = 0.05
  pulse.connect(pulseDepth)
  pulseDepth.connect(creak.gain)
  noise.connect(nbp)
  nbp.connect(creak)
  creak.connect(master)

  for (const node of [osc, lfo, noise, pulse]) node.start(t)
  voice = { ctx, out, master, osc, bp, toneGain, lfo, lfoDepth, noise, nbp, creak, pulse, pulseDepth, full: false }
}

export function updateKickChargeSound(charge) {
  const v = voice
  if (!v) return
  const c = Math.max(0, Math.min(1, Number(charge) || 0))
  const t = v.ctx.currentTime
  const k = 0.03
  try {
    const f = 70 * Math.pow(2, c * 2.3) // ~70 → ~345 Hz
    v.osc.frequency.setTargetAtTime(f, t, k)
    v.bp.frequency.setTargetAtTime(380 + 1500 * c, t, k)
    v.lfo.frequency.setTargetAtTime(4 + 7 * c, t, k)
    v.lfoDepth.gain.setTargetAtTime(f * (0.01 + 0.035 * c), t, k)
    v.toneGain.gain.setTargetAtTime(0.35 + 0.4 * c, t, k)
    const d = 0.04 + 0.22 * c
    v.creak.gain.setTargetAtTime(d, t, k)
    v.pulseDepth.gain.setTargetAtTime(d, t, k)
    v.pulse.frequency.setTargetAtTime(7 + 18 * c, t, k)
    v.nbp.frequency.setTargetAtTime(900 + 1800 * c, t, k)
    v.master.gain.setTargetAtTime(0.1 + 0.18 * c, t, 0.05)
  } catch { }
  // La carga da la vuelta (llena → sostiene → vuelve a cero): el "tin" suena
  // cada vez que llega arriba, no en cada frame que está arriba.
  if (c > 0.995 && !v.full) {
    v.full = true
    try { ping(v.ctx, v.out) } catch { }
  } else if (c < 0.9) {
    v.full = false
  }
}

export function stopKickChargeSound(immediate = false) {
  const v = voice
  if (!v) return
  voice = null
  try {
    const t = v.ctx.currentTime
    v.master.gain.cancelScheduledValues(t)
    v.master.gain.setValueAtTime(v.master.gain.value, t)
    v.master.gain.linearRampToValueAtTime(0, t + (immediate ? 0.02 : 0.07))
    for (const node of [v.osc, v.lfo, v.noise, v.pulse]) {
      try { node.stop(t + 0.1) } catch { }
    }
  } catch { }
  setTimeout(() => {
    for (const node of [v.osc, v.bp, v.toneGain, v.lfo, v.lfoDepth, v.noise, v.nbp, v.creak, v.pulse, v.pulseDepth, v.master]) {
      try { node.disconnect() } catch { }
    }
  }, 250)
}
