// Los sonidos de las ofrendas (Oscar, 2026-11-26: "necesitamos un sonido para el toast de cuando ganas
// un item, también de cuando lo pones en su lugar"):
//   - sonarObjetoGanado: el aviso de "¡Has obtenido…!" (ToastOfrenda). Un barrido que sube, un arpegio
//     de campanitas (el acorde de do, de abajo hacia arriba), un golpe de metales tibio con el acorde y un
//     trino de brillo que se queda en el eco.
//   - sonarOfrendaVuela: el objeto sale de Skulley y vuela a su lugar (ObjetosOfrenda, CAE.espera).
//   - sonarOfrendaPuesta: toca el piso con su rayo: un golpe hondo, una campanada y un acorde cálido que
//     crece y se apaga despacio, como un coro.
// Sintetizados por el bus de SFX (respetan volumen, la bocina y el refuerzo de mezcla.js) y nada debajo de
// ~110 Hz (las bocinas de laptop y teléfono no lo dan). Cada uno acepta un destino { ctx, out } para
// medirlo en un OfflineAudioContext contra la música (regla de mezcla de CLAUDE.md).

import { getSfxBus, getNoiseBuffer } from './sfx.js'

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function suelta(nodos, t) {
  nodos[0].onended = () => { for (const n of nodos) { try { n.disconnect() } catch { } } }
  nodos[0].stop(t)
}

// Campanita: fundamental más un parcial inarmónico (2.76×), como un vibráfono.
function campana(ctx, out, t, f, pico, largo = 0.7) {
  for (const [k, p, dur] of [[1, pico, largo], [2.76, pico * 0.25, largo * 0.35], [4.1, pico * 0.08, largo * 0.18]]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * k * (1 + (Math.random() - 0.5) * 0.004), t)
    const g = ctx.createGain()
    env(g.gain, t, p, 0.003, dur)
    o.connect(g); g.connect(out)
    o.start(t)
    suelta([o, g], t + dur + 0.05)
  }
}

// Una voz de "metales" o de coro: dientes de sierra un poco desafinados por un pasabajos.
function acorde(ctx, out, t, notas, { pico, ataque, dura, corte, abre = corte }) {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.8
  lp.frequency.setValueAtTime(corte, t)
  lp.frequency.exponentialRampToValueAtTime(abre, t + ataque + 0.05)
  lp.frequency.exponentialRampToValueAtTime(corte * 0.7, t + dura)
  const g = ctx.createGain()
  env(g.gain, t, pico, ataque, dura)
  lp.connect(g); g.connect(out)
  const oscs = []
  for (const f of notas) {
    for (const d of [-6, 5]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, t)
      o.detune.setValueAtTime(d, t)
      o.connect(lp)
      o.start(t)
      oscs.push(o)
    }
  }
  oscs[0].onended = () => { for (const n of [...oscs, lp, g]) { try { n.disconnect() } catch { } } }
  for (const o of oscs) o.stop(t + dura + 0.05)
}

function barrido(ctx, out, t, de, a, dur, pico, q = 5) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(de, t)
  bp.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(pico, t + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp); bp.connect(g); g.connect(out)
  src.start(t, Math.random() * 0.5)
  suelta([src, bp, g], t + dur + 0.05)
}

function eco(ctx, out, { tiempo = 0.16, vuelta = 0.3, corte = 4800, vive = 3200 } = {}) {
  const entrada = ctx.createGain()
  const delay = ctx.createDelay(0.6)
  delay.delayTime.value = tiempo
  const fb = ctx.createGain()
  fb.gain.value = vuelta
  const tono = ctx.createBiquadFilter()
  tono.type = 'lowpass'
  tono.frequency.value = corte
  entrada.connect(out)
  entrada.connect(delay)
  delay.connect(tono); tono.connect(fb); fb.connect(delay)
  tono.connect(out)
  setTimeout(() => { for (const n of [entrada, delay, fb, tono]) { try { n.disconnect() } catch { } } }, vive)
  return entrada
}

const destino = (d) => d || getSfxBus()

// El nivel de cada uno, medido con ponderación K contra la música (~-23.6 LUFS, mezcla.js) con la cadena
// del bus (volumen 0.5, refuerzo y limitador): el aviso y la puesta como la patada (+5 dB), el vuelo un
// poco abajo (es la transición).
export const NIVEL_OFRENDA = { ganado: 0.75, vuela: 4, puesta: 1.5 }
function salida(bus, nivel, vive) {
  const g = bus.ctx.createGain()
  g.gain.value = nivel
  g.connect(bus.out)
  setTimeout(() => { try { g.disconnect() } catch { } }, vive)
  return { ctx: bus.ctx, out: g }
}

// do mayor: G5 C6 E6 G6 y el acorde arriba
const ARPEGIO = [784, 1047, 1319, 1568]
const BRILLO = [2093, 2349, 2637, 3136, 2637, 3136]

/** El aviso de objeto ganado. */
export function sonarObjetoGanado(d = null) {
  const b0 = destino(d)
  if (!b0) return
  const bus = salida(b0, NIVEL_OFRENDA.ganado, 4000)
  try {
    const { ctx } = bus
    const t = ctx.currentTime + 0.02
    const out = eco(ctx, bus.out)
    barrido(ctx, out, t, 700, 5200, 0.34, 0.05)
    ARPEGIO.forEach((f, i) => campana(ctx, out, t + 0.06 + i * 0.075, f, 0.11, 0.6))
    const tc = t + 0.06 + ARPEGIO.length * 0.075 + 0.02
    acorde(ctx, out, tc, [523, 659, 784], { pico: 0.05, ataque: 0.02, dura: 0.75, corte: 1400, abre: 3200 })
    for (const f of [1047, 1319, 1568, 2093]) campana(ctx, out, tc, f, 0.07, 1.2)
    BRILLO.forEach((f, i) => campana(ctx, out, tc + 0.12 + i * 0.065, f, 0.03, 0.35))
  } catch { /* sin audio */ }
}

/** El objeto sale de Skulley y vuela a su lugar (`dura`: lo que tarda en llegar, s). */
export function sonarOfrendaVuela(dura = 0.6, d = null) {
  const b0 = destino(d)
  if (!b0) return
  const bus = salida(b0, NIVEL_OFRENDA.vuela, 3000)
  try {
    const { ctx } = bus
    const t = ctx.currentTime + 0.01
    const out = eco(ctx, bus.out, { tiempo: 0.11, vuelta: 0.22, vive: 2000 })
    barrido(ctx, out, t, 420, 3400, dura, 0.07, 4)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(620, t)
    o.frequency.exponentialRampToValueAtTime(1500, t + dura)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.03, t + dura * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dura + 0.08)
    o.connect(g); g.connect(out)
    o.start(t)
    suelta([o, g], t + dura + 0.12)
  } catch { /* sin audio */ }
}

/** La ofrenda toca el piso en su lugar. */
export function sonarOfrendaPuesta(d = null) {
  const b0 = destino(d)
  if (!b0) return
  const bus = salida(b0, NIVEL_OFRENDA.puesta, 5000)
  try {
    const { ctx } = bus
    const t = ctx.currentTime + 0.01
    // el golpe: un tono que cae (de 230 a 120 Hz) con un empujón de ruido apagado
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(230, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.28)
    const g = ctx.createGain()
    env(g.gain, t, 0.32, 0.006, 0.42)
    o.connect(g); g.connect(bus.out)
    o.start(t)
    suelta([o, g], t + 0.5)
    const src = ctx.createBufferSource()
    src.buffer = getNoiseBuffer(ctx)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const gn = ctx.createGain()
    env(gn.gain, t, 0.16, 0.003, 0.14)
    src.connect(lp); lp.connect(gn); gn.connect(bus.out)
    src.start(t, Math.random() * 0.5)
    suelta([src, lp, gn], t + 0.2)
    // la campanada y el coro, con eco largo
    const out = eco(ctx, bus.out, { tiempo: 0.21, vuelta: 0.34, corte: 3600, vive: 4200 })
    campana(ctx, out, t + 0.01, 659, 0.1, 1.6)
    campana(ctx, out, t + 0.01, 988, 0.06, 1.3)
    acorde(ctx, out, t + 0.04, [392, 523, 659], { pico: 0.045, ataque: 0.32, dura: 2.0, corte: 900, abre: 2200 })
  } catch { /* sin audio */ }
}
