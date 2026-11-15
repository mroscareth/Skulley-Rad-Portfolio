// Sonidos del juego de esferas (lib/juegoEsferas.js), sintetizados por el bus de
// los SFX como los de homeSounds.js (respetan su volumen y su mute):
//   - sube la racha: arpegio de campanitas que termina más agudo entre más alto
//     el multiplicador.
//   - se rompe la racha: un cristal que truena y una nota que cae.
//   - fiebre: barrido que sube con un acorde mayor que brilla.
//   - dorada que aparece: tintineo de monedas que sube; atrapada: fanfarria corta;
//     se escapa: soplo que se apaga; el portal la escupe: "boing" de rechazo.
//   - carambola: dos tacazos de billar y un "ding"; doblete: el ding doble.
//   - portal en llamas: llamarada que crece.
//   - reloj: un tic seco cada segundo en los últimos diez y una chicharra al final.
// Nada por debajo de ~250 Hz: las bocinas de laptop y celular no dan graves.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function nota(ctx, out, t, { f, f2 = f, tipo = 'sine', pico = 0.2, dur = 0.25 }) {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.setValueAtTime(f, t)
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, 0.004, dur)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.03)
  o.onended = () => { try { o.disconnect(); g.disconnect() } catch { } }
}

function soplo(ctx, out, t, { de, a, q = 0.8, pico = 0.2, dur = 0.3 }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(de, t)
  bp.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, 0.01, dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.03)
  src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect() } catch { } }
}

// Campana: fundamental y un parcial no armónico que se apaga antes.
function campana(ctx, out, t, f, pico = 0.18, dur = 0.5) {
  nota(ctx, out, t, { f, pico, dur })
  nota(ctx, out, t, { f: f * 2.76, pico: pico * 0.35, dur: dur * 0.5 })
}

function suena(voz, datos, vol = 1, largo = 1.6) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  if (ctx.state !== 'running') return
  try {
    const g = ctx.createGain()
    g.gain.value = vol
    g.connect(out)
    voz(ctx, g, ctx.currentTime + 0.002, datos)
    setTimeout(() => { try { g.disconnect() } catch { } }, largo * 1000)
  } catch { }
}

const DO = 523.25
const semis = (n) => DO * Math.pow(2, n / 12)

function subeRacha(ctx, out, t, { mult }) {
  // ×2: do-mi-sol; ×3: mi-sol-do; ×4: sol-do-mi, cada vez más brillante.
  const raiz = { 2: 0, 3: 4, 4: 7 }[mult] ?? 0
  ;[0, 4, 7, 12].forEach((s, i) => campana(ctx, out, t + i * 0.06, semis(raiz + s), 0.16 + i * 0.02, 0.45))
}

function rompeRacha(ctx, out, t) {
  soplo(ctx, out, t, { de: 6000, a: 2500, q: 1.5, pico: 0.25, dur: 0.18 })
  nota(ctx, out, t + 0.04, { f: 700, f2: 330, tipo: 'triangle', pico: 0.22, dur: 0.4 })
}

function fiebre(ctx, out, t) {
  soplo(ctx, out, t, { de: 400, a: 5000, q: 0.7, pico: 0.22, dur: 0.6 })
  ;[0, 4, 7, 12, 16].forEach((s, i) => campana(ctx, out, t + 0.3 + i * 0.05, semis(s + 7), 0.15, 0.9))
}

function doradaAparece(ctx, out, t) {
  ;[12, 16, 19, 24, 28].forEach((s, i) => campana(ctx, out, t + i * 0.05, semis(s), 0.11, 0.35))
}

function doradaAtrapada(ctx, out, t) {
  ;[0, 7, 12].forEach((s, i) => nota(ctx, out, t + i * 0.09, { f: semis(s + 5), tipo: 'square', pico: 0.09, dur: 0.18 }))
  ;[0, 4, 7, 12].forEach((s) => campana(ctx, out, t + 0.3, semis(s + 17), 0.12, 1.0))
}

function doradaEscapa(ctx, out, t) {
  soplo(ctx, out, t, { de: 3000, a: 500, q: 0.9, pico: 0.2, dur: 0.5 })
  nota(ctx, out, t, { f: semis(19), f2: semis(7), pico: 0.1, dur: 0.5 })
}

function doradaNo(ctx, out, t) {
  nota(ctx, out, t, { f: 420, f2: 900, tipo: 'triangle', pico: 0.18, dur: 0.12 })
  nota(ctx, out, t + 0.12, { f: 900, f2: 380, tipo: 'triangle', pico: 0.16, dur: 0.22 })
}

function tacazo(ctx, out, t) {
  nota(ctx, out, t, { f: 2400, f2: 1600, tipo: 'sine', pico: 0.22, dur: 0.05 })
  soplo(ctx, out, t, { de: 4000, a: 2000, q: 2, pico: 0.12, dur: 0.04 })
}

function carambola(ctx, out, t) {
  tacazo(ctx, out, t)
  tacazo(ctx, out, t + 0.09)
  campana(ctx, out, t + 0.2, semis(24), 0.16, 0.6)
}

function doblete(ctx, out, t) {
  campana(ctx, out, t, semis(19), 0.16, 0.5)
  campana(ctx, out, t + 0.12, semis(24), 0.18, 0.7)
}

function fuegoPortal(ctx, out, t) {
  soplo(ctx, out, t, { de: 300, a: 2200, q: 0.6, pico: 0.3, dur: 0.7 })
  soplo(ctx, out, t + 0.2, { de: 1800, a: 700, q: 0.8, pico: 0.18, dur: 0.6 })
}

// Oleada: dos silbidos que caen (las esferas que bajan del cielo) y dos
// golpecitos de hule al llegar.
function oleada(ctx, out, t) {
  nota(ctx, out, t, { f: 1800, f2: 520, tipo: 'sine', pico: 0.12, dur: 0.55 })
  nota(ctx, out, t + 0.12, { f: 2100, f2: 600, tipo: 'sine', pico: 0.1, dur: 0.55 })
  nota(ctx, out, t + 0.62, { f: 520, f2: 300, tipo: 'triangle', pico: 0.2, dur: 0.12 })
  nota(ctx, out, t + 0.74, { f: 600, f2: 320, tipo: 'triangle', pico: 0.18, dur: 0.12 })
}

function tic(ctx, out, t, { ultimo }) {
  nota(ctx, out, t, { f: ultimo ? 1500 : 1100, tipo: 'square', pico: 0.06, dur: 0.05 })
}

function chicharra(ctx, out, t) {
  nota(ctx, out, t, { f: 330, tipo: 'sawtooth', pico: 0.12, dur: 0.75 })
  nota(ctx, out, t, { f: 336, tipo: 'sawtooth', pico: 0.12, dur: 0.75 })
}

export const playSubeRacha = (mult) => suena(subeRacha, { mult }, 1.1)
export const playRompeRacha = () => suena(rompeRacha, {}, 1)
export const playFiebre = () => suena(fiebre, {}, 1.2, 2)
export const playDoradaAparece = () => suena(doradaAparece, {}, 1)
export const playDoradaAtrapada = () => suena(doradaAtrapada, {}, 1.2, 2)
export const playDoradaEscapa = () => suena(doradaEscapa, {}, 1)
export const playDoradaNo = () => suena(doradaNo, {}, 1)
export const playCarambola = () => suena(carambola, {}, 1.1)
export const playDoblete = () => suena(doblete, {}, 1.1)
export const playFuegoPortal = () => suena(fuegoPortal, {}, 1)
export const playOleada = () => suena(oleada, {}, 1, 1.2)
export const playTic = (ultimo = false) => suena(tic, { ultimo }, 1, 0.4)
export const playChicharra = () => suena(chicharra, {}, 1, 1.2)
