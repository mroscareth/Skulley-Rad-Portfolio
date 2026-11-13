// El rearmado de Skulley en "Conocer la historia" (Oscar, 2026-11-12): después
// del rayo de M.A.D.R.E., con "Como sea" las piezas regresan a su lugar con un
// sonido casi celestial, como si ella pudiera romperlo y armarlo a placer. Un
// coro agudo que crece (ondas de sierra por dos formantes, con vibrato),
// campanitas que suben cada vez más seguido mientras se rebobina la caída,
// un barrido de brillo y, al quedar armado, un acorde de destello; todo con
// eco. Suena junto con la voz, así que el coro va arriba y bajito, y no hay
// nada debajo de ~400 Hz (bocinas de laptop y celular). Sintetizado por el bus
// de SFX (respeta volumen y mute).
// Al revés (Oscar, como las notas del fondo): se renderiza una vez, se voltea y
// se recorta; crece mientras las piezas siguen en el piso y el destello, que al
// revés es un corte seco, cae justo cuando Skulley queda armado. Después del
// corte quedan unas campanitas que se apagan.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

// `dura`: lo que tarda en armarse (la caída al revés más el vuelo final).
const REARME = { dura: 1.9, coro: 0.045, campanas: 0.07, destello: 0.09, eco: 0.34 }
// La mayor con novena, en registro alto: A4, E5, A5, B5, C#6.
const CORO = [440, 659.3, 880, 987.8, 1108.7]
// Pentatónica de la, de A5 a A7: sube sin desafinar nunca.
const CAMPANAS = [880, 987.8, 1108.7, 1318.5, 1480, 1760, 1975.5, 2217.5, 2637, 2960, 3520]

function suelta(nodos, t) {
  nodos[0].onended = () => { for (const n of nodos) { try { n.disconnect() } catch { } } }
  nodos[0].stop(t)
}

function eco(ctx, out) {
  // Dos retrasos cruzados que se apagan y se oscurecen: aire de catedral chica.
  const entrada = ctx.createGain()
  const salida = ctx.createGain()
  salida.gain.value = REARME.eco
  const a = ctx.createDelay(1)
  const b = ctx.createDelay(1)
  a.delayTime.value = 0.19
  b.delayTime.value = 0.31
  const fa = ctx.createGain()
  const fb = ctx.createGain()
  fa.gain.value = 0.38
  fb.gain.value = 0.38
  const oscuro = ctx.createBiquadFilter()
  oscuro.type = 'lowpass'
  oscuro.frequency.value = 5000
  entrada.connect(a)
  entrada.connect(b)
  a.connect(fa); fa.connect(b)
  b.connect(fb); fb.connect(a)
  a.connect(oscuro)
  b.connect(oscuro)
  oscuro.connect(salida)
  salida.connect(out)
  entrada.connect(out)
  return { entrada, apagar: (t) => setTimeout(() => { for (const n of [entrada, salida, a, b, fa, fb, oscuro]) { try { n.disconnect() } catch { } } }, Math.max(0, (t - ctx.currentTime) * 1000) + 4000) }
}

function coro(ctx, out, t, dura) {
  const fin = t + dura + 1.4
  const formantes = []
  for (const [hz, q] of [[1000, 3], [2600, 4]]) {
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = hz
    f.Q.value = q
    f.connect(out)
    formantes.push(f)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(REARME.coro, t + dura * 0.8)
  g.gain.setValueAtTime(REARME.coro, t + dura)
  g.gain.exponentialRampToValueAtTime(0.0001, fin)
  for (const f of formantes) g.connect(f)
  const vibrato = ctx.createOscillator()
  vibrato.frequency.value = 5.2
  const hondo = ctx.createGain()
  hondo.gain.value = 3
  vibrato.connect(hondo)
  vibrato.start(t)
  const nodos = [vibrato, hondo]
  for (const hz of CORO) {
    for (const desafina of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz
      o.detune.value = desafina
      hondo.connect(o.detune)
      o.connect(g)
      o.onended = () => { try { o.disconnect() } catch { } }
      o.start(t)
      o.stop(fin + 0.05)
      nodos.push(o)
    }
  }
  suelta([vibrato, hondo, g, ...formantes], fin + 0.1)
  return nodos
}

function campana(ctx, out, t, f, pico) {
  for (const [k, p, dur] of [[1, pico, 0.9], [2.76, pico * 0.25, 0.3]]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * k * (1 + (Math.random() - 0.5) * 0.004), t)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(p, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(out)
    o.start(t)
    suelta([o, g], t + dur + 0.05)
  }
}

function brillo(ctx, out, t, dura) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 6
  bp.frequency.setValueAtTime(2000, t)
  bp.frequency.exponentialRampToValueAtTime(9000, t + dura)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.035, t + dura * 0.85)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura + 0.5)
  src.connect(bp); bp.connect(g); g.connect(out)
  src.start(t)
  suelta([src, bp, g], t + dura + 0.6)
}

// El sonido de frente, en `ctx` hacia `out`, empezando en `t`.
function armar(ctx, out, t) {
  const d = REARME.dura
  const salida = eco(ctx, out)
  coro(ctx, salida.entrada, t, d)
  brillo(ctx, salida.entrada, t, d)
  // Cada vez más seguido, como la caída al revés que se acelera.
  CAMPANAS.forEach((f, i) => {
    const x = (i + 1) / CAMPANAS.length
    campana(ctx, salida.entrada, t + d * Math.pow(x, 0.6) * 0.92, f, REARME.campanas * (0.6 + 0.4 * x))
  })
  // Armado: el destello.
  for (const [f, k] of [[1760, 1], [2217.5, 0.8], [2637, 0.7], [3520, 0.45]]) campana(ctx, salida.entrada, t + d, f, REARME.destello * k)
  salida.apagar(t + d)
}

// ── Al revés ──────────────────────────────────────────────────────────────
// `cola`: cuánto se renderiza después del destello (sus campanas y el eco);
// `despues`: lo que se deja sonar después del corte, con `fundido` al final.
const AL_REVES = { sr: 44100, cola: 3.4, despues: 0.7, fundido: 0.5, estimado: 2600 }
let alReves = null
let golpeListo = null
function renderAlReves() {
  if (alReves) return alReves
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Off) return Promise.resolve(null)
  const { sr } = AL_REVES
  const t0 = 0.02
  const off = new Off(2, Math.ceil(sr * (t0 + REARME.dura + AL_REVES.cola)), sr)
  armar(off, off.destination, t0)
  alReves = off.startRendering().then((buf) => {
    const n = buf.length
    let pico = 0
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c)
      d.reverse()
      for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(d[i]))
    }
    // Volteado, el destello queda en n − (t0 + dura); antes de él solo
    // silencio que se recorta.
    const corte = Math.floor(n - (t0 + REARME.dura) * sr)
    let desde = 0
    const izq = buf.getChannelData(0)
    while (desde < corte && Math.abs(izq[desde]) < pico * 0.002) desde += 1
    const hasta = Math.min(n, corte + Math.floor(AL_REVES.despues * sr))
    const fundido = Math.floor(AL_REVES.fundido * sr)
    const sale = new AudioBuffer({ length: hasta - desde, numberOfChannels: buf.numberOfChannels, sampleRate: sr })
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c)
      const o = sale.getChannelData(c)
      for (let i = 0; i < o.length; i++) {
        const resta = o.length - i
        o[i] = d[desde + i] * (resta < fundido ? resta / fundido : 1)
      }
    }
    golpeListo = (corte - desde) / sr
    return { buffer: sale, golpe: golpeListo }
  }).catch(() => null)
  return alReves
}

// Se pide antes (al acercarse al botón), para que esté listo a tiempo.
export function prepararRearme() {
  try { renderAlReves() } catch { }
}
// Cuánto antes del armado tiene que arrancar (ms).
export function rearmeAdelantoMs() {
  return golpeListo != null ? golpeListo * 1000 : AL_REVES.estimado
}

// `hastaGolpeMs`: en cuánto queda armado Skulley; el corte cae ahí. Si ya
// debía ir sonando, entra a media subida.
export function playRearme(hastaGolpeMs = rearmeAdelantoMs()) {
  const bus = getSfxBus()
  if (!bus) return
  const pedido = performance.now()
  renderAlReves().then((r) => {
    if (!r) return
    const { ctx, out } = bus
    const falta = hastaGolpeMs / 1000 - (performance.now() - pedido) / 1000
    if (falta < -0.2) return
    const arranca = ctx.currentTime + Math.max(0, falta - r.golpe)
    const desde = Math.max(0, r.golpe - Math.max(0, falta))
    const s = ctx.createBufferSource()
    s.buffer = r.buffer
    s.connect(out)
    s.onended = () => { try { s.disconnect() } catch { } }
    s.start(arranca, desde)
  })
}
