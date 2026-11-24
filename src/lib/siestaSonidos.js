// Sonidos de la siesta de Skulley (lib/siestaSkulley.js), sintetizados en vivo por el bus de
// los SFX (getSfxBus: su volumen, su mute y la regla de la mezcla de lib/mezcla.js):
//   - la cobija aparece bajo el drone: un "plin" de campanitas que sube (M.A.D.R.E. la imprime);
//   - cae sobre él: un "fuf" de tela suave;
//   - la avienta al despertar: un zumbido de aire que sube;
//   - se va: un "puf" de polvo;
//   - el solo de guitarra: cada rasgueo de la Flying V (sonarRasgueo, con los cuadros de GUITARRA.rasgueos);
//   - dormido ronca (un ronquido de caricatura al inhalar y un silbidito al soltar el aire),
//     al nivel de la música: es continuo y no debe llamar la atención como los golpes.
// Nada por debajo de ~250 Hz (las bocinas de laptop y celular no dan graves).

import { getSfxBus, getNoiseBuffer } from './sfx.js'

const VOLUMEN = { aparece: 0.8, cae: 1, tirada: 0.8, puf: 0.9, ronca: 0.32, silba: 0.22, rasgueo: 0.9 }

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function bus() {
  const b = getSfxBus()
  if (!b || b.ctx.state !== 'running') return null
  return b
}

function suena(voz, nombre, duraMs = 1500) {
  const b = bus()
  if (!b) return
  try {
    const { ctx, out } = b
    const g = ctx.createGain()
    g.gain.value = VOLUMEN[nombre] ?? 1
    g.connect(out)
    voz(ctx, g, ctx.currentTime + 0.002)
    setTimeout(() => { try { g.disconnect() } catch { } }, duraMs)
  } catch { }
}

function tono(ctx, out, t, { tipo = 'sine', de, a, dur, pico, ataque = 0.005, filtro = 0 }) {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.setValueAtTime(de, t)
  o.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, ataque, dur)
  let f = null
  if (filtro) {
    f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = filtro
    o.connect(f)
    f.connect(g)
  } else o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.03)
  o.onended = () => { try { o.disconnect(); f?.disconnect(); g.disconnect() } catch { } }
}

// ruido por un pasabanda que barre de `de` a `a` Hz
function soplo(ctx, out, t, { de, a, q = 1.2, dur, pico, ataque = 0.03 }) {
  const n = ctx.createBufferSource()
  n.buffer = getNoiseBuffer(ctx)
  n.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(de, t)
  f.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, ataque, dur)
  n.connect(f)
  f.connect(g)
  g.connect(out)
  n.start(t, Math.random() * 0.5)
  n.stop(t + dur + 0.05)
  n.onended = () => { try { n.disconnect(); f.disconnect(); g.disconnect() } catch { } }
}

const PENTA = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093]

function aparece(ctx, out, t) {
  soplo(ctx, out, t, { de: 900, a: 2600, dur: 0.22, pico: 0.12, ataque: 0.01 })
  ;[0, 2, 4].forEach((k, i) => {
    const f = PENTA[k]
    tono(ctx, out, t + 0.05 + i * 0.07, { de: f, a: f, dur: 0.5, pico: 0.16, ataque: 0.004 })
    tono(ctx, out, t + 0.05 + i * 0.07, { de: f * 2.76, a: f * 2.76, dur: 0.22, pico: 0.05, ataque: 0.004 })
  })
}

function cae(ctx, out, t) {
  soplo(ctx, out, t, { de: 1400, a: 520, q: 0.8, dur: 0.42, pico: 0.42, ataque: 0.05 })
  tono(ctx, out, t + 0.02, { tipo: 'triangle', de: 420, a: 270, dur: 0.24, pico: 0.22, ataque: 0.02, filtro: 1600 })
}

function tirada(ctx, out, t) {
  soplo(ctx, out, t, { de: 500, a: 2400, q: 1.6, dur: 0.38, pico: 0.3, ataque: 0.04 })
}

function puf(ctx, out, t) {
  soplo(ctx, out, t, { de: 2600, a: 700, q: 0.7, dur: 0.3, pico: 0.38, ataque: 0.008 })
  tono(ctx, out, t, { tipo: 'triangle', de: 700, a: 300, dur: 0.12, pico: 0.14, ataque: 0.004 })
}

function ronca(ctx, out, t) {
  // un zumbido áspero (diente de sierra) que solo se oye en sus armónicos, con el aire encima
  const dur = 0.85
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(92, t)
  o.frequency.linearRampToValueAtTime(104, t + dur)
  const trem = ctx.createOscillator()
  trem.frequency.value = 23
  const tg = ctx.createGain()
  tg.gain.value = 0.5
  const am = ctx.createGain()
  am.gain.value = 0.5
  trem.connect(tg)
  tg.connect(am.gain)
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 620
  f.Q.value = 1.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(am)
  am.connect(f)
  f.connect(g)
  g.connect(out)
  o.start(t)
  trem.start(t)
  o.stop(t + dur + 0.05)
  trem.stop(t + dur + 0.05)
  o.onended = () => { try { o.disconnect(); trem.disconnect(); tg.disconnect(); am.disconnect(); f.disconnect(); g.disconnect() } catch { } }
  soplo(ctx, out, t, { de: 700, a: 900, q: 1, dur, pico: 0.12, ataque: dur * 0.5 })
}

function silba(ctx, out, t) {
  tono(ctx, out, t, { de: 980, a: 1500, dur: 0.6, pico: 0.2, ataque: 0.12 })
  soplo(ctx, out, t, { de: 1800, a: 2400, q: 2, dur: 0.6, pico: 0.06, ataque: 0.1 })
}

// El rasgueo de la Flying V del solo: un acorde de quinta (fundamental, quinta y octava, más la quinta de arriba)
// de dientes de sierra, cuerda por cuerda con un respiro (hacia abajo de la grave a la aguda, hacia arriba al
// revés), por una distorsión suave y un pasabanda, con el clic de la púa. `corto`: apagado con la palma (el rasgueo
// rápido); `largo`: lo que vibra el ¡zas! y el último acorde. Nada debajo de ~200 Hz (A3 y G3 de fundamental).
const ACORDES = { a: [220.0, 329.63, 440.0, 659.26], b: [196.0, 293.66, 392.0, 587.33], c: [246.94, 369.99, 493.88, 739.99] }
let curvaDist = null
function distorsion(ctx) {
  if (!curvaDist) {
    curvaDist = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = i / 512 - 1
      curvaDist[i] = Math.tanh(4.5 * x) / Math.tanh(4.5)
    }
  }
  const w = ctx.createWaveShaper()
  w.curve = curvaDist
  w.oversample = '2x'
  return w
}

function rasgueo(ctx, out, t, { acorde = 'a', abajo = true, fuerza = 1, corto = false, largo = 0 }) {
  const notas = ACORDES[acorde] || ACORDES.a
  const dura = corto ? 0.14 : 0.42 + largo
  const dist = distorsion(ctx)
  const pre = ctx.createGain()
  pre.gain.value = 0.55
  const banda = ctx.createBiquadFilter()
  banda.type = 'lowpass'
  banda.frequency.setValueAtTime(corto ? 1800 : 3400, t)
  banda.frequency.exponentialRampToValueAtTime(corto ? 900 : 1500, t + dura)
  const graves = ctx.createBiquadFilter()
  graves.type = 'highpass'
  graves.frequency.value = 170
  const g = ctx.createGain()
  const pico = 0.32 * Math.min(1.3, fuerza) * (abajo ? 1 : 0.8)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(pico, t + 0.006)
  g.gain.exponentialRampToValueAtTime(pico * (corto ? 0.15 : 0.45), t + (corto ? 0.07 : 0.18))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura)
  pre.connect(dist)
  dist.connect(banda)
  banda.connect(graves)
  graves.connect(g)
  g.connect(out)
  const orden = abajo ? notas : [...notas].reverse()
  const oscs = []
  orden.forEach((f, k) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004)
    const og = ctx.createGain()
    const t0 = t + k * (abajo ? 0.009 : 0.007)
    og.gain.setValueAtTime(0.0001, t0)
    og.gain.exponentialRampToValueAtTime(0.25, t0 + 0.004)
    o.connect(og)
    og.connect(pre)
    o.start(t0)
    o.stop(t + dura + 0.05)
    oscs.push(o, og)
  })
  // el clic de la púa
  soplo(ctx, out, t, { de: 4200, a: 2600, q: 1.4, dur: 0.03, pico: 0.12 * fuerza, ataque: 0.002 })
  const soltar = () => { for (const n of [...oscs, pre, dist, banda, graves, g]) { try { n.disconnect() } catch { } } }
  setTimeout(soltar, (dura + 0.2) * 1000)
}

// la guitarra cae del cielo: un silbido que baja (lo que tarda en caer, ~0.53 s) y, al cacharla, un golpe sordo
// con las cuerdas que zumban
function silbaCae(ctx, out, t) {
  tono(ctx, out, t, { de: 2100, a: 520, dur: 0.55, pico: 0.16, ataque: 0.08 })
  soplo(ctx, out, t, { de: 2600, a: 900, q: 2.5, dur: 0.55, pico: 0.05, ataque: 0.1 })
}
function cacha(ctx, out, t) {
  tono(ctx, out, t, { tipo: 'triangle', de: 330, a: 250, dur: 0.12, pico: 0.3, ataque: 0.003, filtro: 1400 })
  soplo(ctx, out, t, { de: 1200, a: 500, q: 0.9, dur: 0.12, pico: 0.25, ataque: 0.004 })
  for (const f of [220, 330, 440]) tono(ctx, out, t + 0.01, { tipo: 'sawtooth', de: f, a: f * 0.99, dur: 0.6, pico: 0.03, ataque: 0.01, filtro: 1800 })
}

export const sonarCaeGuitarra = () => suena(silbaCae, 'silba', 900)
export const sonarCachaGuitarra = () => suena(cacha, 'cae', 1000)

export const sonarRasgueo = (r) => {
  const b = bus()
  if (!b) return
  try {
    const g = b.ctx.createGain()
    g.gain.value = VOLUMEN.rasgueo
    g.connect(b.out)
    rasgueo(b.ctx, g, b.ctx.currentTime + 0.002, r || {})
    setTimeout(() => { try { g.disconnect() } catch { } }, 2600)
  } catch { }
}

export const sonarCobijaAparece = () => suena(aparece, 'aparece', 1200)
export const sonarCobijaCae = () => suena(cae, 'cae', 900)
export const sonarCobijaTirada = () => suena(tirada, 'tirada', 900)
export const sonarPuf = () => suena(puf, 'puf', 800)
export const sonarRonquido = () => suena(ronca, 'ronca', 1400)
export const sonarSilbido = () => suena(silba, 'silba', 1100)
