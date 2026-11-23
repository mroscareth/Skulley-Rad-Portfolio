// Sonidos de los pétalos del camino escondido (home/PetalosCamino.jsx, 2026-11-22),
// sintetizados en vivo por el bus de los SFX (getSfxBus: respeta su volumen, su mute
// y la regla de la mezcla de lib/mezcla.js, los efectos por encima de la música):
//   - prenden: un "fuuump" de llama que agarra, más fuerte entre más pétalos prenden
//     de golpe (la bola de fuego prende decenas; la mecha, de uno en uno, ni suena).
//   - fuego: mientras algo arde, un siseo de brasa y chasquidos sueltos, más seguidos
//     entre más pétalos arden, del lado de la pantalla donde está el fuego.
//   - brotan: los pétalos nuevos que caen, un tintineo de campanitas en pentatónica,
//     una nota por pétalo con un respiro entre notas: con muchos, un arpegio que cae.
// Nada por debajo de ~250 Hz (las bocinas de laptop y celular no dan graves).

import { getSfxBus, getNoiseBuffer } from './sfx.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function ruido(ctx, out, t, { tipo = 'bandpass', de, a, q = 1, pico, ataque = 0.002, dur }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const f = ctx.createBiquadFilter()
  f.type = tipo
  f.Q.value = q
  f.frequency.setValueAtTime(de, t)
  f.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, ataque, dur)
  src.connect(f)
  f.connect(g)
  g.connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
  src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect() } catch { } }
}

function campana(ctx, out, t, { f, pico, dur }) {
  // Dos parciales (1 y 2.76, de campana chica) que se apagan a destiempo.
  for (const [k, p, d] of [[1, 1, 1], [2.76, 0.35, 0.45]]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f * k
    const g = ctx.createGain()
    env(g.gain, t, pico * p, 0.004, dur * d)
    o.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + dur * d + 0.02)
    o.onended = () => { try { o.disconnect(); g.disconnect() } catch { } }
  }
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
  const k = 0.55 + 0.45 * fuerza
  // La llama que agarra: un soplo que abre de lo opaco a lo brillante y se queda.
  ruido(ctx, out, t, { de: 380, a: 2400, q: 0.9, pico: 0.55 * k, ataque: 0.05, dur: 0.55 + 0.35 * fuerza })
  ruido(ctx, out, t + 0.02, { tipo: 'highpass', de: 2500, a: 5200, q: 0.5, pico: 0.16 * k, ataque: 0.08, dur: 0.7 + 0.4 * fuerza })
  // Y unos chasquidos de arranque.
  for (let i = 0; i < 3 + Math.round(4 * fuerza); i++) chasquido(ctx, out, t + 0.04 + Math.random() * 0.4, 0.25 + Math.random() * 0.35)
}

function chasquido(ctx, out, t, fuerza) {
  const dur = 0.004 + Math.random() * 0.012
  ruido(ctx, out, t, { de: 1800 + Math.random() * 3600, a: 1400 + Math.random() * 2000, q: 1.2 + Math.random() * 2, pico: 0.5 * fuerza, ataque: 0.0008, dur })
}

// Pentatónica mayor, arriba: suena a polvo mágico sin melodía.
const NOTAS = [1318.5, 1480, 1661.2, 1975.5, 2217.5, 2637, 2960]
function brota(ctx, out, t, { nota }) {
  const e = conEco(ctx, out)
  campana(ctx, e, t, { f: NOTAS[nota % NOTAS.length], pico: 0.28, dur: 0.55 })
}

// Volumen de cada sonido, medido contra la música con ponderación K (la regla de
// lib/mezcla.js; la patada de referencia en +5 dB): prenden +5 (+7.8 con la bola más
// fuerte), brotan +3.8 como los bips de los diálogos, el fuego continuo al nivel de la
// música (+0.2 con 20 pétalos ardiendo, −3.9 con 3, +1.5 con 80). Pisarlos no suena:
// un roce de papel no le gustó a Oscar.
const VOLUMEN = { prenden: 0.9, fuego: 0.56, brota: 0.43 }
const ESPERA_MS = { prenden: 250, brota: 110 }
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
  if (donde?.pan && ctx.createStereoPanner) {
    p = ctx.createStereoPanner()
    p.pan.value = donde.pan
    g.connect(p)
    p.connect(out)
  } else g.connect(out)
  return { g, soltar: (ms) => setTimeout(() => { try { g.disconnect(); p?.disconnect() } catch { } }, ms) }
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
  suena(prenden, 'prenden', { fuerza: clamp(Math.log2(n) / 6, 0, 1) }, donde, 1600)
}

let notaSig = 0
/** Brotó un pétalo nuevo. */
export function sonarBrota(donde) {
  notaSig = (notaSig + 1 + Math.floor(Math.random() * 3)) % NOTAS.length
  suena(brota, 'brota', { nota: notaSig }, donde, 1600)
}

// El fuego: un siseo de fondo que sube y baja con lo que arde, más chasquidos que se
// programan cuadro por cuadro.
let fuego = null
let vigilante = 0
function apagarFuego() {
  const f = fuego
  if (!f) return
  fuego = null
  try {
    const t = f.src.context.currentTime
    f.s.g.gain.setTargetAtTime(0.0001, t, 0.12)
    f.src.stop(t + 0.6)
  } catch { }
  setTimeout(() => {
    try { f.src.disconnect(); f.hp.disconnect(); f.siseo.disconnect(); f.chasq.disconnect(); f.pan?.disconnect() } catch { }
    f.s.soltar(0)
  }, 700)
}
/** Cada cuadro: `n` pétalos ardiendo, `dt` en segundos, `donde` del centro del fuego.
 * Si deja de llamarse (la escena se pausa al ir a una sección), se apaga solo. */
export function sonarFuego(n, dt, donde) {
  clearTimeout(vigilante)
  if (fuego) vigilante = setTimeout(apagarFuego, 400)
  if (n <= 0 && !fuego) return
  const b = bus()
  if (!b) return
  const { ctx } = b
  const t = ctx.currentTime
  try {
    if (!fuego && n > 0) {
      const s = salida(b, 'fuego', null)
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
      const src = ctx.createBufferSource()
      src.buffer = getNoiseBuffer(ctx)
      src.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'bandpass'
      hp.frequency.value = 3800
      hp.Q.value = 0.6
      const siseo = ctx.createGain()
      siseo.gain.value = 0.0001
      src.connect(hp)
      hp.connect(siseo)
      const chasq = ctx.createGain()
      if (pan) { siseo.connect(pan); chasq.connect(pan); pan.connect(s.g) } else { siseo.connect(s.g); chasq.connect(s.g) }
      src.start(t)
      fuego = { s, src, hp, siseo, chasq, pan, apagando: 0 }
      vigilante = setTimeout(apagarFuego, 400)
    }
    if (!fuego) return
    const f = fuego
    const fuerza = clamp(Math.sqrt(n) / 6, 0, 1)
    const vol = donde?.vol ?? 1
    f.s.g.gain.setTargetAtTime(vol * VOLUMEN.fuego, t, 0.08)
    if (f.pan && donde?.pan != null) f.pan.pan.setTargetAtTime(donde.pan, t, 0.1)
    f.siseo.gain.setTargetAtTime(n > 0 ? 0.035 + 0.07 * fuerza : 0.0001, t, n > 0 ? 0.15 : 0.35)
    if (n > 0) {
      f.apagando = 0
      // Chasquidos: de ~4 por segundo con uno ardiendo a ~40 con muchos.
      const porS = 4 + 36 * fuerza
      let k = porS * dt
      while (k > 0) {
        if (Math.random() < k) chasquido(ctx, f.chasq, t + Math.random() * dt, 0.35 + Math.random() * 0.65 * (0.5 + 0.5 * fuerza))
        k -= 1
      }
    } else {
      f.apagando += dt
      if (f.apagando > 1.6) { clearTimeout(vigilante); apagarFuego() }
    }
  } catch { }
}

export const petalosVoces = { prenden, brota, chasquido, VOLUMEN }
