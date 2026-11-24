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

// El rasgueo de la Flying V del solo (Oscar, 2026-11-23: "más de guitarra eléctrica, punk rock!"): power chords
// de tres cuerdas (raíz, quinta y octava, en la segunda octava como en el punk), una cuerda tras otra como un
// rasgueo de verdad (hacia abajo de la grave a la aguda; hacia arriba solo las dos agudas, más suave). Cada cuerda es
// una cuerda pulsada (Karplus-Strong, calculada al tocar: ~1 ms) y todas entran a un ampli saturado: graves
// recortados para que no retumbe, medios empujados, recorte duro con un poco de asimetría (como de bulbo) y un
// gabinete que se come la arenilla de arriba de 5 kHz; el clic de la púa entra también al ampli. `corto`: muteado
// con la palma (el "chug" del rasgueo rápido); `largo`: lo que sostienen el ¡zas! y el último acorde. La fundamental
// queda abajo de 250 Hz, pero la saturación la llena de armónicos de 300 Hz a 4 kHz: se oye en una laptop.
const POWER = { a: [110.0, 164.81, 220.0], b: [98.0, 146.83, 196.0], c: [123.47, 185.0, 246.94] }
// medido con ponderación K contra la música (-23.6 LUFS, regla de lib/mezcla.js): ver la nota de sonarRasgueo
const NIVEL_RASGUEO = 0.083
const MUTE_EXTRA = 1.32

function cuerda(ctx, f, dur, { brillo = 1, mute = false }) {
  const sr = ctx.sampleRate
  const n = Math.ceil(sr * dur)
  const buf = ctx.createBuffer(1, n, sr)
  const y = buf.getChannelData(0)
  const N = Math.max(2, Math.round(sr / f))
  // el ataque: ruido, más filoso entre más fuerte
  const a = 0.25 + 0.55 * Math.min(1, brillo)
  let p = 0
  for (let i = 0; i < N && i < n; i++) { p += (Math.random() * 2 - 1 - p) * a; y[i] = p }
  // la cuerda: cada vuelta se promedia (se opaca) y pierde un poco; muteada, se apaga en una décima de segundo
  const d = mute ? 0.93 : 0.9992
  const k = mute ? 0.35 : 0.5
  for (let i = N; i < n; i++) y[i] = d * ((1 - k) * y[i - N] + k * y[i - N - 1 < 0 ? 0 : i - N - 1])
  return buf
}

let curvaAmp = null
function ampli(ctx) {
  if (!curvaAmp) {
    curvaAmp = new Float32Array(2048)
    const G = 9
    for (let i = 0; i < 2048; i++) {
      const x = i / 1024 - 1
      curvaAmp[i] = (Math.tanh(G * x + 0.25) - Math.tanh(0.25)) / (1 + Math.tanh(0.25))
    }
  }
  const w = ctx.createWaveShaper()
  w.curve = curvaAmp
  w.oversample = '4x'
  return w
}

function filtro(ctx, tipo, f, q = 0.707, ganancia = 0) {
  const b = ctx.createBiquadFilter()
  b.type = tipo
  b.frequency.value = f
  b.Q.value = q
  b.gain.value = ganancia
  return b
}

// el rasgueo que suena: al rasguear otra vez, las cuerdas dejan de sonar (encimados, tres o cuatro amplis sumaban
// 10 dB y saturaban el bus)
const sonando = new WeakMap()

function rasgueo(ctx, out, t, { acorde = 'a', abajo = true, fuerza = 1, corto = false, largo = 0 }) {
  const notas = POWER[acorde] || POWER.a
  const previo = sonando.get(ctx)
  if (previo) {
    previo.gain.cancelScheduledValues(t)
    previo.gain.setTargetAtTime(0.0001, t, 0.015)
  }
  const dura = corto ? 0.2 : 0.7 + largo
  const mezcla = ctx.createGain()
  mezcla.gain.value = 0.42
  const cadena = [
    filtro(ctx, 'highpass', 95, 0.7),
    filtro(ctx, 'peaking', 850, 0.8, 7),
    ampli(ctx),
    filtro(ctx, 'highpass', 85, 0.7),
    filtro(ctx, 'peaking', 2400, 1.1, 3),
    filtro(ctx, 'lowpass', corto ? 3200 : 4800, 0.9),
    filtro(ctx, 'lowpass', 6500, 0.7),
  ]
  const g = ctx.createGain()
  sonando.set(ctx, g)
  const pico = NIVEL_RASGUEO * (corto ? MUTE_EXTRA : 1) * Math.min(1.3, fuerza) * (abajo ? 1 : 0.75)
  g.gain.setValueAtTime(pico, t)
  g.gain.setValueAtTime(pico, t + dura * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura)
  let antes = mezcla
  for (const nodo of cadena) { antes.connect(nodo); antes = nodo }
  antes.connect(g)
  g.connect(out)
  const cuerdas = abajo ? notas : notas.slice(1).reverse()
  const fuentes = []
  cuerdas.forEach((f, i) => {
    const src = ctx.createBufferSource()
    src.buffer = cuerda(ctx, f * (1 + (Math.random() - 0.5) * 0.003), dura + 0.05, { brillo: fuerza, mute: corto })
    const t0 = t + i * (abajo ? 0.011 : 0.008)
    src.connect(mezcla)
    src.start(t0)
    fuentes.push(src)
  })
  // el clic de la púa, también por el ampli (raspa)
  const pua = ctx.createBufferSource()
  pua.buffer = getNoiseBuffer(ctx)
  const bp = filtro(ctx, 'bandpass', 2600, 1.2)
  const pg = ctx.createGain()
  env(pg.gain, t, 0.5 * Math.min(1.2, fuerza), 0.002, 0.025)
  pua.connect(bp)
  bp.connect(pg)
  pg.connect(mezcla)
  pua.start(t, Math.random() * 0.5)
  pua.stop(t + 0.05)
  const soltar = () => { for (const nodo of [...fuentes, pua, bp, pg, mezcla, ...cadena, g]) { try { nodo.disconnect() } catch { } } }
  setTimeout(soltar, (dura + 0.25) * 1000)
}
if (import.meta.env.DEV && typeof window !== 'undefined') window.__rasgueo = rasgueo

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
    setTimeout(() => { try { g.disconnect() } catch { } }, 3200)
  } catch { }
}

export const sonarCobijaAparece = () => suena(aparece, 'aparece', 1200)
export const sonarCobijaCae = () => suena(cae, 'cae', 900)
export const sonarCobijaTirada = () => suena(tirada, 'tirada', 900)
export const sonarPuf = () => suena(puf, 'puf', 800)
export const sonarRonquido = () => suena(ronca, 'ronca', 1400)
export const sonarSilbido = () => suena(silba, 'silba', 1100)
