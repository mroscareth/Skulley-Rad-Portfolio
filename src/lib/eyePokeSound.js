// Sonidos del easter egg de picarle los ojos a Skulley (preloader). Antes
// reciclaba clips del sitio (click, punch, sparkleBom); estos se sintetizan en
// vivo con WebAudio y cada uno está hecho para su acción:
//   - piquete: "boink" de hule. Un tono que cae rápido de agudo a grave, con
//     un chasquido húmedo de ruido encima. El segundo piquete suena 4
//     semitonos más arriba: el ojo se va tensando hacia el tercero.
//   - se salta: "¡plop!" de corcho (chasquido seco y un tono que sube de
//     golpe) y un silbato de caída que baja durante ~1 s, lo que tarda el ojo
//     en salir de cuadro.
//   - reaparece: tres notas que suben, como el enemigo de videojuego que
//     respawnea, encima del parpadeo.
// Nada por debajo de ~250 Hz: las bocinas de laptop y celular no dan graves.
// Sale por el bus de los SFX (getSfxBus): respeta su volumen y su mute.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

// Envolvente percusiva: sube en `attack` y cae exponencial hasta `end`.
function env(param, t, peak, attack, end) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(peak, t + attack)
  param.exponentialRampToValueAtTime(0.0001, t + end)
}

function disconnectOnEnd(source, nodes) {
  source.onended = () => {
    for (const n of nodes) { try { n.disconnect() } catch { } }
  }
}

function noiseBurst(ctx, out, t, { from, to, q, peak, dur }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, peak, 0.003, dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(out)
  // Cada chasquido arranca en otro punto del ruido: así no suenan idénticos.
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
  disconnectOnEnd(src, [src, bp, g])
}

function poke(ctx, out, t, n = 1) {
  const k = Math.pow(2, ((Math.max(1, n) - 1) * 4) / 12)
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(820 * k, t)
  o.frequency.exponentialRampToValueAtTime(250 * k, t + 0.11)
  const g = ctx.createGain()
  env(g.gain, t, 0.55, 0.004, 0.17)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + 0.2)
  disconnectOnEnd(o, [o, g])
  noiseBurst(ctx, out, t, { from: 2600, to: 900, q: 1.4, peak: 0.35, dur: 0.06 })
}

function pop(ctx, out, t) {
  noiseBurst(ctx, out, t, { from: 3200, to: 1800, q: 0.8, peak: 0.6, dur: 0.035 })
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(380, t)
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.05)
  const g = ctx.createGain()
  env(g.gain, t, 0.5, 0.004, 0.11)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + 0.13)
  disconnectOnEnd(o, [o, g])

  // Silbato de caída. El vibrato se va cerrando para que abajo no se oiga
  // como sirena (18 Hz de vaivén son 1 % arriba y 6 % abajo).
  const s = t + 0.09
  const FALL = 1.0
  const w = ctx.createOscillator()
  w.type = 'sine'
  w.frequency.setValueAtTime(1500, s)
  w.frequency.exponentialRampToValueAtTime(280, s + FALL)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 7
  const depth = ctx.createGain()
  depth.gain.setValueAtTime(20, s)
  depth.gain.exponentialRampToValueAtTime(5, s + FALL)
  lfo.connect(depth)
  depth.connect(w.frequency)
  const wg = ctx.createGain()
  wg.gain.setValueAtTime(0.0001, s)
  wg.gain.exponentialRampToValueAtTime(0.24, s + 0.04)
  wg.gain.setValueAtTime(0.24, s + FALL - 0.25)
  wg.gain.exponentialRampToValueAtTime(0.0001, s + FALL)
  w.connect(wg)
  wg.connect(out)
  w.start(s)
  lfo.start(s)
  w.stop(s + FALL + 0.02)
  lfo.stop(s + FALL + 0.02)
  disconnectOnEnd(w, [w, lfo, depth, wg])
}

function respawn(ctx, out, t) {
  // Onda cuadrada de 8 bits, con un paso bajo para que no raspe.
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3500
  lp.connect(out)
  const notes = [659.25, 880, 1318.5] // mi, la, mi
  const nodes = [lp]
  let last = null
  notes.forEach((f, i) => {
    const s = t + i * 0.075
    const len = i === notes.length - 1 ? 0.22 : 0.07
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, s)
    g.gain.exponentialRampToValueAtTime(0.13, s + 0.005)
    g.gain.setValueAtTime(0.13, s + len * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, s + len)
    o.connect(g)
    g.connect(lp)
    o.start(s)
    o.stop(s + len + 0.02)
    nodes.push(o, g)
    last = o
  })
  disconnectOnEnd(last, nodes)
}

function play(voice, ...args) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  try { if (ctx.state === 'suspended') ctx.resume().catch(() => { }) } catch { }
  try { voice(ctx, out, ctx.currentTime + 0.005, ...args) } catch { }
}

export const playEyePoke = (n) => play(poke, n)
export const playEyePop = () => play(pop)
export const playEyeRespawn = () => play(respawn)

// Para afinarlos sin jugar: se pueden renderizar en un OfflineAudioContext.
export const eyeSoundVoices = { poke, pop, respawn }
