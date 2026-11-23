// Sonidos de los pétalos del camino escondido (home/PetalosCamino.jsx, 2026-11-22),
// sintetizados en vivo por el bus de los SFX (getSfxBus: respeta su volumen, su mute
// y la regla de la mezcla de lib/mezcla.js, los efectos por encima de la música).
// El fuego es de caricatura y todo con tonos (Oscar escogió esta entre tres muestras;
// la primera versión, de ruido filtrado, "se escucha como ruido"):
//   - prenden: un "fwoomp" (diente de sierra que sube con un golpe encima), más
//     fuerte entre más pétalos prenden de golpe (la bola de fuego prende decenas; la
//     mecha, de uno en uno, no lo dispara).
//   - fuego: mientras algo arde, lenguas de llama que hacen "blub" (triángulos que
//     caen de tono con un vibrato rápido) y algún pop, más seguidas entre más pétalos
//     arden, del lado de la pantalla donde está el fuego.
//   - polvo: un golpecito agudo que cae, cuando un pétalo se deshace.
//   - brotan: los pétalos nuevos que caen, un tintineo de campanitas en pentatónica,
//     una nota por pétalo con un respiro entre notas: con muchos, un arpegio que cae.
// Pisarlos no suena (un roce de papel no le gustó a Oscar).
// Nada por debajo de ~250 Hz (las bocinas de laptop y celular no dan graves).

import { getSfxBus } from './sfx.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const R = Math.random

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

// Un oscilador con su envolvente; `vib` (Hz) a `vibF` le da el temblor de la llama y
// `filtro` lo redondea con un pasa bajos.
function tono(ctx, out, t, { tipo = 'sine', de, a, dur, pico, ataque = 0.005, vib = 0, vibF = 0, filtro = 0 }) {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.setValueAtTime(de, t)
  o.frequency.exponentialRampToValueAtTime(a, t + dur)
  const nodos = [o]
  if (vib) {
    const l = ctx.createOscillator()
    l.frequency.value = vibF
    const lg = ctx.createGain()
    lg.gain.value = vib
    l.connect(lg)
    lg.connect(o.frequency)
    l.start(t)
    l.stop(t + dur + 0.03)
    nodos.push(l, lg)
  }
  const g = ctx.createGain()
  env(g.gain, t, pico, ataque, dur)
  if (filtro) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = filtro
    o.connect(f)
    f.connect(g)
    nodos.push(f)
  } else o.connect(g)
  g.connect(out)
  nodos.push(g)
  o.start(t)
  o.stop(t + dur + 0.03)
  o.onended = () => { for (const n of nodos) { try { n.disconnect() } catch { } } }
}

function campana(ctx, out, t, { f, pico, dur }) {
  // Dos parciales (1 y 2.76, de campana chica) que se apagan a destiempo.
  for (const [k, p, d] of [[1, 1, 1], [2.76, 0.35, 0.45]]) tono(ctx, out, t, { de: f * k, a: f * k, dur: dur * d, pico: pico * p, ataque: 0.004 })
}

function conEco(ctx, out, tiempo = 0.11, vuelta = 0.38, dura = 1400) {
  const entrada = ctx.createGain()
  const retraso = ctx.createDelay(0.5)
  retraso.delayTime.value = tiempo
  const v = ctx.createGain()
  v.gain.value = vuelta
  const humedo = ctx.createGain()
  humedo.gain.value = 0.45
  entrada.connect(out)
  entrada.connect(retraso)
  retraso.connect(v)
  v.connect(retraso)
  retraso.connect(humedo)
  humedo.connect(out)
  setTimeout(() => { try { entrada.disconnect(); retraso.disconnect(); v.disconnect(); humedo.disconnect() } catch { } }, dura)
  return entrada
}

// `fuerza` 0 a 1.
function prenden(ctx, out, t, { fuerza }) {
  const k = 0.6 + 0.4 * fuerza
  tono(ctx, out, t, { tipo: 'sawtooth', de: 260, a: 600, dur: 0.32 + 0.12 * fuerza, pico: 0.28 * k, ataque: 0.03, filtro: 1800 })
  tono(ctx, out, t, { de: 400, a: 260, dur: 0.25, pico: 0.32 * k, ataque: 0.004 })
}

// Una lengua de llama: "blub". `k` 0 a 1 la sube.
function lengua(ctx, out, t, k) {
  const f = 260 + R() * 170
  tono(ctx, out, t, { tipo: 'triangle', de: f, a: f * (0.75 + R() * 0.2), dur: 0.1 + R() * 0.08, pico: 0.2 * k, ataque: 0.012, vib: f * 0.12, vibF: 22 + R() * 10, filtro: 1500 })
  if (R() < 0.25) tono(ctx, out, t + 0.03, { de: 900 + R() * 300, a: 420, dur: 0.035, pico: 0.16 * k, ataque: 0.002 })
}

function polvo(ctx, out, t) {
  tono(ctx, out, t, { de: 1200 + R() * 300, a: 560, dur: 0.07, pico: 0.1, ataque: 0.003 })
}

// Pentatónica mayor, arriba: suena a polvo mágico sin melodía.
const NOTAS = [1318.5, 1480, 1661.2, 1975.5, 2217.5, 2637, 2960]
function brota(ctx, out, t, { nota }) {
  const e = conEco(ctx, out)
  campana(ctx, e, t, { f: NOTAS[nota % NOTAS.length], pico: 0.28, dur: 0.55 })
}

// Volumen de cada sonido, medido contra la música con ponderación K (la regla de
// lib/mezcla.js; la patada de referencia en +5 dB). Ver los números en CLAUDE.md, Audio.
const VOLUMEN = { prenden: 1, fuego: 1, polvo: 1, brota: 0.43 }
const ESPERA_MS = { prenden: 250, polvo: 70, brota: 110 }
const ultimo = {}

function bus() {
  const b = getSfxBus()
  // Sin un gesto el contexto sigue suspendido; no se reanuda aquí (se amontonarían).
  if (!b || b.ctx.state !== 'running') return null
  return b
}

function salida(b, nombre, donde) {
  const { ctx, out } = b
  const g = ctx.createGain()
  g.gain.value = (donde?.vol ?? 1) * (VOLUMEN[nombre] ?? 1)
  let p = null
  if (ctx.createStereoPanner) {
    p = ctx.createStereoPanner()
    p.pan.value = donde?.pan || 0
    g.connect(p)
    p.connect(out)
  } else g.connect(out)
  return { g, p, soltar: (ms) => setTimeout(() => { try { g.disconnect(); p?.disconnect() } catch { } }, ms) }
}

function suena(voz, nombre, datos, donde, duraMs = 1500) {
  const espera = ESPERA_MS[nombre]
  if (espera) {
    const ahora = performance.now()
    if (ahora - (ultimo[nombre] || 0) < espera) return
    ultimo[nombre] = ahora
  }
  const b = bus()
  if (!b) return
  try {
    const s = salida(b, nombre, donde)
    voz(b.ctx, s.g, b.ctx.currentTime + 0.002, datos)
    s.soltar(duraMs)
  } catch { }
}

/** Prendieron `n` pétalos de golpe. `donde` = { vol, pan } (ubicarSonido). */
export function sonarPrenden(n, donde) {
  if (n < 3) return
  suena(prenden, 'prenden', { fuerza: clamp(Math.log2(n) / 6, 0, 1) }, donde, 900)
}

/** Un pétalo se deshizo en polvo. */
export function sonarPolvo(donde) {
  suena(polvo, 'polvo', null, donde, 400)
}

let notaSig = 0
/** Brotó un pétalo nuevo. */
export function sonarBrota(donde) {
  notaSig = (notaSig + 1 + Math.floor(R() * 3)) % NOTAS.length
  suena(brota, 'brota', { nota: notaSig }, donde, 1600)
}

// El fuego que sigue ardiendo: lenguas programadas en el reloj del contexto, más
// seguidas entre más arde. `pasoFuego` lo usa igual el juego y la medición.
function pasoFuego(ctx, f, n, dt, t) {
  if (n <= 0) { f.sig = 0; return }
  const fuerza = clamp(Math.sqrt(n) / 6, 0, 1)
  const k = 0.55 + 0.45 * fuerza
  if (!f.sig || f.sig < t) f.sig = t + 0.02
  while (f.sig < t + dt) {
    lengua(ctx, f.out, f.sig, k)
    f.sig += 0.06 + R() * 0.1 / Math.max(0.3, fuerza)
  }
}

let fuego = null
let vigilante = 0
function apagarFuego() {
  const f = fuego
  if (!f) return
  fuego = null
  f.s.soltar(600)
}
/** Cada cuadro: `n` pétalos ardiendo, `dt` en segundos, `donde` del centro del fuego.
 * Si deja de llamarse (la escena se pausa al ir a una sección), se apaga solo. */
export function sonarFuego(n, dt, donde) {
  clearTimeout(vigilante)
  if (n <= 0) { apagarFuego(); return }
  const b = bus()
  if (!b) return
  const { ctx } = b
  const t = ctx.currentTime
  try {
    if (!fuego) {
      const s = salida(b, 'fuego', donde)
      fuego = { s, out: s.g, sig: 0 }
    }
    const f = fuego
    f.s.g.gain.setTargetAtTime((donde?.vol ?? 1) * VOLUMEN.fuego, t, 0.08)
    if (f.s.p && donde?.pan != null) f.s.p.pan.setTargetAtTime(donde.pan, t, 0.1)
    pasoFuego(ctx, f, n, dt, t)
    vigilante = setTimeout(apagarFuego, 400)
  } catch { }
}

export const petalosVoces = { prenden, lengua, polvo, brota, pasoFuego, VOLUMEN }
