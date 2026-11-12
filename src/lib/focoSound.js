// El foco de teatro de la historia del preloader de escritorio (Oscar): al
// prenderse, el golpe del interruptor de una lámpara grande, el zumbido de la
// corriente que sigue el parpadeo de la luz y un "tin" de filamento cuando
// agarra; al apagarse, el golpe y el zumbido que cae mientras se enfría.
// Sintetizado por el bus de los SFX (respeta su volumen y su mute). El zumbido
// es de 120 Hz pero en diente de sierra y por un pasabanda: lo que se oye son
// sus armónicos, que las bocinas de laptop sí dan.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

function golpe(ctx, out, t, fuerza) {
  // El clac metálico del interruptor.
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.setValueAtTime(3200, t)
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.06)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5 * fuerza, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  src.connect(bp)
  bp.connect(g)
  g.connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + 0.12)
  // El cuerpo del golpe: un toc que cae.
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(420, t)
  o.frequency.exponentialRampToValueAtTime(190, t + 0.12)
  const go = ctx.createGain()
  go.gain.setValueAtTime(0.0001, t)
  go.gain.exponentialRampToValueAtTime(0.4 * fuerza, t + 0.004)
  go.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  o.connect(go)
  go.connect(out)
  o.start(t)
  o.stop(t + 0.18)
  o.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); o.disconnect(); go.disconnect() } catch { } }
}

// El zumbido eléctrico, con su volumen en `puntos` ([segundos, nivel]) y una
// caída de tono opcional al final (apagado).
function zumbido(ctx, out, t, puntos, { cae = false } = {}) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(120, t)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 720
  bp.Q.value = 2.2
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  for (const [s, v] of puntos) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + s)
  const fin = puntos[puntos.length - 1][0]
  if (cae) o.frequency.exponentialRampToValueAtTime(70, t + fin)
  o.connect(bp)
  bp.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + fin + 0.05)
  o.onended = () => { try { o.disconnect(); bp.disconnect(); g.disconnect() } catch { } }
}

function tin(ctx, out, t) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(2600, t)
  o.frequency.exponentialRampToValueAtTime(2350, t + 0.5)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + 0.6)
  o.onended = () => { try { o.disconnect(); g.disconnect() } catch { } }
}

// `parpadeo`: el mismo [ms, intensidad] con que parpadea la luz, para que el
// zumbido tiemble con ella.
export function playFocoPrende(parpadeo = [[0, 1]]) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  const t = ctx.currentTime + 0.01
  golpe(ctx, out, t, 1)
  const puntos = parpadeo.map(([ms, v]) => [ms / 1000 + 0.003, 0.14 * v])
  const ultimo = puntos[puntos.length - 1][0]
  // Después de agarrar, el zumbido baja a un rumor y se apaga al calentarse.
  puntos.push([ultimo + 0.25, 0.06], [ultimo + 1.6, 0.0001])
  zumbido(ctx, out, t, puntos)
  tin(ctx, out, t + ultimo)
}

export function playFocoApaga() {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  const t = ctx.currentTime + 0.01
  golpe(ctx, out, t, 0.75)
  zumbido(ctx, out, t, [[0.004, 0.09], [0.5, 0.0001]], { cae: true })
}
