// Sonidos del juego de home: las pisadas de Skulley y las esferas. Se sintetizan en
// vivo, como la carga de la patada, porque cada uno depende de lo que pasó:
//   - pisada: un toc de hueso, muy bajito, y un roce de ruido. Cada pie suena un poco
//     distinto y ninguna pisada es idéntica: con un clip el oído encuentra la repetición
//     a los dos pasos.
//   - choque entre esferas: dos parciales que no son armónicos, como una bola de billar.
//   - rebote en el piso: un "pom" de hule que cae de tono.
//   - patada: un golpe seco, más fuerte entre más carga llevaba.
//   - agarrar y soltar: una burbuja que sube y otra que baja; si la avientas, un soplo.
//   - entrar a su portal: tres notas de campana que suben. La esfera chica, que da más
//     puntos, suena más aguda.
//   - entrar al portal equivocado: dos notas apagadas que caen.
// La esfera chica suena más aguda que la grande, y la fuerza del golpe sube el volumen.
// Nada por debajo de ~250 Hz: las bocinas de laptop y celular no dan graves.
// Sale por el bus de los SFX (getSfxBus): respeta su volumen y su mute.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Los radios van de 0.18 a 0.55. Con la raíz el cambio se oye sin volverse caricatura.
const tonoDe = (radio) => clamp(Math.pow(0.35 / Math.max(0.05, radio), 0.6), 0.7, 1.6)
const varia = (rango) => 1 - rango + Math.random() * rango * 2

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function tono(ctx, out, t, { tipo = 'sine', de, a, pico, dur }) {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.setValueAtTime(de, t)
  o.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, 0.003, dur)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
  o.onended = () => { try { o.disconnect(); g.disconnect() } catch { } }
}

function ruido(ctx, out, t, { de, a, q, pico, dur }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(de, t)
  bp.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, 0.002, dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
  src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect() } catch { } }
}

function pisada(ctx, out, t, { derecha }) {
  const k = (derecha ? 1 : 0.93) * varia(0.04)
  const f = varia(0.15)
  tono(ctx, out, t, { tipo: 'triangle', de: 430 * k, a: 265 * k, pico: 0.1 * f, dur: 0.07 })
  ruido(ctx, out, t, { de: 1500 * k, a: 600, q: 0.9, pico: 0.06 * f, dur: 0.045 })
}

function choque(ctx, out, t, { fuerza, radio }) {
  const f = 1250 * tonoDe(radio) * varia(0.03)
  const largo = 0.05 + 0.05 * fuerza
  tono(ctx, out, t, { de: f * 1.03, a: f, pico: 0.05 + 0.2 * fuerza, dur: largo })
  tono(ctx, out, t, { de: f * 2.76, a: f * 2.7, pico: 0.02 + 0.08 * fuerza, dur: largo * 0.6 })
  ruido(ctx, out, t, { de: 3200, a: 2000, q: 1.2, pico: 0.03 + 0.1 * fuerza, dur: 0.012 })
}

function rebote(ctx, out, t, { fuerza, radio }) {
  const k = tonoDe(radio) * varia(0.03)
  tono(ctx, out, t, { de: 640 * k, a: 290 * k, pico: 0.05 + 0.2 * fuerza, dur: 0.09 })
  ruido(ctx, out, t, { de: 900 * k, a: 500, q: 1, pico: 0.02 + 0.06 * fuerza, dur: 0.03 })
}

function patada(ctx, out, t, { fuerza }) {
  tono(ctx, out, t, { tipo: 'triangle', de: 1000, a: 280, pico: 0.3 + 0.25 * fuerza, dur: 0.1 })
  ruido(ctx, out, t, { de: 2600, a: 800, q: 0.9, pico: 0.25 + 0.25 * fuerza, dur: 0.05 })
}

function agarra(ctx, out, t, { radio }) {
  const k = tonoDe(radio)
  tono(ctx, out, t, { de: 340 * k, a: 820 * k, pico: 0.16, dur: 0.09 })
  ruido(ctx, out, t, { de: 3000, a: 1800, q: 1.2, pico: 0.03, dur: 0.02 })
}

function suelta(ctx, out, t, { radio, lanzada }) {
  const k = tonoDe(radio)
  tono(ctx, out, t, { de: 700 * k, a: 330 * k, pico: 0.14, dur: 0.1 })
  if (lanzada > 0.05) ruido(ctx, out, t, { de: 500, a: 1500, q: 0.8, pico: 0.05 + 0.14 * lanzada, dur: 0.16 })
}

function portalBien(ctx, out, t, { radio }) {
  const k = radio <= 0.28 ? 1.335 : radio <= 0.42 ? 1 : 0.75
  ;[659.25, 987.77, 1318.5].forEach((f, i) => {
    const nota = t + i * 0.07
    const dur = i === 2 ? 0.32 : 0.14
    tono(ctx, out, nota, { de: f * k, a: f * k, pico: 0.17, dur })
    tono(ctx, out, nota, { de: f * k * 2, a: f * k * 2, pico: 0.05, dur: dur * 0.6 })
  })
  ruido(ctx, out, t, { de: 4000, a: 6500, q: 2, pico: 0.02, dur: 0.3 })
}

function portalMal(ctx, out, t) {
  // Onda cuadrada con un paso bajo: apagada, para que no suene a castigo. En modo
  // libre caen esferas a los portales solas todo el tiempo.
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  lp.connect(out)
  tono(ctx, lp, t, { tipo: 'square', de: 415, a: 370, pico: 0.12, dur: 0.09 })
  tono(ctx, lp, t + 0.1, { tipo: 'square', de: 311, a: 262, pico: 0.12, dur: 0.2 })
}

// Volumen de cada sonido, para afinar la mezcla sin tocar las voces.
const VOLUMEN = { pisada: 2.2, choque: 3.5, rebote: 2.4, patada: 1.3, agarra: 1.7, suelta: 1.7, portal: 1.5 }

// Muchas esferas pueden chocar en el mismo cuadro: sin esto un montón suena a metralla.
const ESPERA_MS = { choque: 35, rebote: 45 }
const ultimo = {}

// `donde` = { vol, pan }, ver ubicarSonido.
function suena(voz, nombre, datos, donde) {
  const espera = ESPERA_MS[nombre]
  if (espera) {
    const ahora = performance.now()
    if (ahora - (ultimo[nombre] || 0) < espera) return
    ultimo[nombre] = ahora
  }
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  // Antes de que alguien toque la página el contexto sigue suspendido; aquí no se
  // reanuda: estos sonidos no vienen de un gesto, y se acumularían para sonar juntos.
  if (ctx.state !== 'running') return
  try {
    const g = ctx.createGain()
    g.gain.value = (donde?.vol ?? 1) * (VOLUMEN[nombre] ?? 1)
    let fin = g
    let p = null
    if (donde?.pan && ctx.createStereoPanner) {
      p = ctx.createStereoPanner()
      p.pan.value = donde.pan
      g.connect(p)
      fin = p
    }
    fin.connect(out)
    voz(ctx, g, ctx.currentTime + 0.002, datos)
    setTimeout(() => { try { g.disconnect(); p?.disconnect() } catch { } }, 700)
  } catch { }
}

// Lo lejano se oye menos y del lado donde pasó. `derecha` es el eje X de la cámara.
export function ubicarSonido(dx, dz, derecha) {
  const d = Math.hypot(dx, dz)
  return {
    vol: 1 / (1 + (d / 16) * (d / 16)),
    pan: clamp((dx * derecha.x + dz * derecha.z) / 9, -0.7, 0.7),
  }
}

export const playFootstep = (derecha) => suena(pisada, 'pisada', { derecha })
export const playOrbHit = (fuerza, radio, donde) => suena(choque, 'choque', { fuerza, radio }, donde)
export const playOrbBounce = (fuerza, radio, donde) => suena(rebote, 'rebote', { fuerza, radio }, donde)
export const playOrbKick = (fuerza) => suena(patada, 'patada', { fuerza })
// Es el aviso del juego: aunque el portal esté lejos, se tiene que oír.
export const playOrbPortal = (acierto, radio, donde) => suena(
  acierto ? portalBien : portalMal,
  'portal',
  { radio },
  { ...donde, vol: Math.max(0.5, donde?.vol ?? 1) },
)
export const playOrbGrab = (radio) => suena(agarra, 'agarra', { radio })
export const playOrbDrop = (radio, lanzada) => suena(suelta, 'suelta', { radio, lanzada })

// Para afinarlos sin jugar: se pueden renderizar en un OfflineAudioContext.
export const homeSoundVoices = { pisada, choque, rebote, patada, agarra, suelta, portalBien, portalMal }
