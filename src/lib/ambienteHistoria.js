// El fondo de "Conocer la historia" (Oscar, 2026-11-12): el tema de M.A.D.R.E.
// tocado al revés por dos voces que se contestan, y un ambiente de vacío, la
// infinidad del escenario, sin estorbarle a la voz.
//
// - El tema: el gancho de la canción "M.A.D.R.E." del reproductor del sitio
//   (do menor; sacado de su puente, ~74 s, y de ~28 s), para que después, al
//   oírla, le rime al usuario (idea de Oscar). La voz lenta dice la llamada y
//   la respuesta despacio; la rápida, una octava arriba, contesta con figuras
//   cortas del mismo tema, armónicas, como si se hablaran (Oscar).
// - Al revés (Oscar: que se note más): cada nota es una campana con un golpe
//   de martillo y su reverb larga, renderizada una vez y volteada. Crece desde
//   el silencio y se corta de golpe donde pegaba, con un sorbido al final: el
//   mismo "del más allá" que la voz (la reverb al revés de historiaMadre).
//   Suenan con el reloj del AudioContext, así que se pausan solas.
// - El vacío: un dron grave que respira (sus armónicos son lo que dan las
//   bocinas de laptop) y aire agudo, muy bajito.
//
// Va en el AudioContext de la voz y sale por su misma salida: la pausa de la
// historia (que suspende ese contexto) lo congela donde iba, y la bocina lo
// calla con la voz. Arranca con las luces apagadas y se apaga con un fundido
// al terminar o con Saltar.

import { getNoiseBuffer } from './sfx.js'

// Do menor, en Hz.
const N = {
  C5: 523.25, D5: 587.33, Eb5: 622.25, F5: 698.46, G5: 783.99, Ab5: 830.61, Bb5: 932.33,
  C6: 1046.5, D6: 1174.66, Eb6: 1244.51, F6: 1396.91, G6: 1567.98, Ab6: 1661.22, Bb6: 1864.66,
}
// La partitura, que se repite cada `vuelta` segundos: [cuándo pega (s), nota,
// voz]. Llamada lenta (sol fa si♭ sol la♭ sol mi♭), contesta la rápida (sube
// mi♭ fa sol la♭ y cae en sol); respuesta lenta (mi♭ re mi♭ fa sol), contesta
// la rápida bajando (sol la♭ sol fa mi♭) y la lenta remata en do.
const PARTITURA = {
  vuelta: 25,
  notas: [
    [0, N.G5, 'lenta'], [1.3, N.F5, 'lenta'], [2.6, N.Bb5, 'lenta'], [3.9, N.G5, 'lenta'],
    [5.2, N.Ab5, 'lenta'], [6.5, N.G5, 'lenta'], [7.8, N.Eb5, 'lenta'],
    [9.7, N.Eb6, 'rapida'], [9.92, N.F6, 'rapida'], [10.14, N.G6, 'rapida'], [10.36, N.Ab6, 'rapida'], [10.72, N.G6, 'rapida'],
    [12.2, N.Eb5, 'lenta'], [13.5, N.D5, 'lenta'], [14.8, N.Eb5, 'lenta'], [16.1, N.F5, 'lenta'], [17.4, N.G5, 'lenta'],
    [19.2, N.G6, 'rapida'], [19.42, N.Ab6, 'rapida'], [19.64, N.G6, 'rapida'], [19.86, N.F6, 'rapida'], [20.08, N.Eb6, 'rapida'],
    [21.4, N.C6, 'lenta'],
  ],
}
// `volumen`: el de todo. `entra` / `sale`: los fundidos, en segundos.
// `primera`: cuándo pega la primera nota. Cada voz: cuánto crece antes de
// pegar (`cola`, s), su volumen, los parciales de su campana [múltiplo,
// volumen, segundos en apagarse] (el 1.006 bate con la fundamental y la
// desafina un poco), el golpe de martillo (volumen y brillo: al revés es el
// sorbido del final) y su sala (segundos, brillo, seco y mojado). La lenta,
// larga y muy mojada: es la que más se oye al revés.
// `dron`: notas (Hz), hasta dónde deja pasar el filtro y cuánto lo mueve la
// respiración, y su volumen. `aire`: el ruido agudo.
const AMBIENTE = {
  volumen: 0.55, entra: 2.5, sale: 1.2, primera: 2.4,
  voces: {
    lenta: {
      cola: 4.6, volumen: 0.17,
      campana: [[1, 1, 3.2], [1.006, 0.45, 2.6], [2, 0.2, 1.4], [2.76, 0.14, 0.9], [5.4, 0.05, 0.4]],
      martillo: { volumen: 0.5, brillo: 3500 },
      sala: { dura: 4.2, brillo: 4500, seco: 0.22, mojado: 1.25 },
    },
    rapida: {
      cola: 1.3, volumen: 0.11,
      campana: [[1, 1, 0.9], [2, 0.3, 0.5], [3, 0.12, 0.35], [4.2, 0.05, 0.2]],
      martillo: { volumen: 0.35, brillo: 6000 },
      sala: { dura: 1.2, brillo: 6000, seco: 0.4, mojado: 0.9 },
    },
  },
  dron: { notas: [65.41, 98, 130.81], filtro: 380, respira: 140, ritmo: 0.05, volumen: 0.12 },
  aire: { centro: 6200, q: 0.7, volumen: 0.03, ritmo: 0.07 },
}

const azarSemilla = (semilla) => () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }

// La sala: ruido que se apaga, distinto en cada canal, con semilla fija.
function impulsoSala(ctx, sala) {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * sala.dura)
  const buf = ctx.createBuffer(2, n, sr)
  const azar = azarSemilla(11)
  const a = Math.exp((-2 * Math.PI * sala.brillo) / sr)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let previo = 0
    for (let i = 0; i < n; i++) {
      const v = (azar() * 2 - 1) * Math.exp((-6 * i) / n)
      previo = (1 - a) * v + a * previo
      d[i] = previo
    }
  }
  return buf
}

// El golpe del martillo: un chasquido de ruido de 25 ms.
function martillo(ctx, m) {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * 0.025)
  const buf = ctx.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  const azar = azarSemilla(5)
  const a = Math.exp((-2 * Math.PI * m.brillo) / sr)
  let previo = 0
  for (let i = 0; i < n; i++) {
    previo = (1 - a) * (azar() * 2 - 1) + a * previo
    d[i] = previo * Math.exp((-5 * i) / n)
  }
  return buf
}

// Una campana con su martillo y su reverb, volteada.
async function notaAlReves(hz, voz, sr) {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Off) return null
  const v = AMBIENTE.voces[voz]
  const off = new Off(2, Math.ceil(sr * v.cola), sr)
  const suma = off.createGain()
  for (const [mult, vol, dura] of v.campana) {
    const o = off.createOscillator()
    o.frequency.value = hz * mult
    const g = off.createGain()
    g.gain.setValueAtTime(0.0001, 0)
    g.gain.exponentialRampToValueAtTime(vol, 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, dura)
    o.connect(g)
    g.connect(suma)
    o.start(0)
    o.stop(dura + 0.05)
  }
  const golpe = off.createBufferSource()
  golpe.buffer = martillo(off, v.martillo)
  const golpeG = off.createGain()
  golpeG.gain.value = v.martillo.volumen
  golpe.connect(golpeG)
  golpeG.connect(suma)
  golpe.start(0)
  const sala = off.createConvolver()
  sala.buffer = impulsoSala(off, v.sala)
  const seco = off.createGain()
  seco.gain.value = v.sala.seco
  const mojado = off.createGain()
  mojado.gain.value = v.sala.mojado
  suma.connect(seco)
  suma.connect(sala)
  sala.connect(mojado)
  seco.connect(off.destination)
  mojado.connect(off.destination)
  const buf = await off.startRendering()
  let pico = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    d.reverse()
    for (let i = 0; i < d.length; i++) pico = Math.max(pico, Math.abs(d[i]))
  }
  // Todas al mismo nivel, y los últimos milisegundos (el golpe, que ahora es
  // el final) se apagan para que no truene el corte.
  const k = pico > 0 ? 1 / pico : 1
  const cola = Math.floor(sr * 0.008)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const fin = d.length - i
      d[i] *= k * (fin < cola ? fin / cola : 1)
    }
  }
  return buf
}

// Las notas se renderizan una sola vez: un AudioBuffer sirve en cualquier
// contexto (se remuestrea al sonar), así que se pueden pedir antes de que
// exista el de la voz, que nace con el clic.
const SR = 44100
const clave = (hz, voz) => `${voz}:${hz}`
let notasPromesa = null
function notasListas() {
  if (!notasPromesa) {
    const unicas = [...new Map(PARTITURA.notas.map(([, hz, voz]) => [clave(hz, voz), [hz, voz]])).values()]
    notasPromesa = Promise.all(unicas.map(([hz, voz]) => notaAlReves(hz, voz, SR).then((b) => [clave(hz, voz), b])))
      .then((pares) => new Map(pares))
      .catch(() => new Map())
  }
  return notasPromesa
}

// Pide las notas antes (al acercarse al botón), para que la primera no espere.
export function prepararAmbiente() {
  try { notasListas() } catch { }
}

/**
 * Arranca el fondo en `ctx` hacia `destino`. Devuelve `detener()`, que lo
 * apaga con un fundido y suelta todo.
 */
export function iniciarAmbiente(ctx, destino) {
  if (!ctx || !destino) return { detener() { } }
  const t0 = ctx.currentTime
  const total = ctx.createGain()
  // En línea recta: la exponencial desde casi cero se quedaba muda el primer
  // segundo y medio, y el vacío tiene que llegar con las luces apagándose.
  total.gain.setValueAtTime(0, t0)
  total.gain.linearRampToValueAtTime(AMBIENTE.volumen, t0 + AMBIENTE.entra)
  total.connect(destino)
  const fuentes = []
  const nodos = [total]
  const alta = (n) => { nodos.push(n); return n }

  // El dron: respira con un filtro que abre y cierra despacio (do, sol, do).
  const D = AMBIENTE.dron
  const filtro = alta(ctx.createBiquadFilter())
  filtro.type = 'lowpass'
  filtro.frequency.value = D.filtro
  filtro.Q.value = 0.8
  const respira = alta(ctx.createOscillator())
  respira.frequency.value = D.ritmo
  const cuanto = alta(ctx.createGain())
  cuanto.gain.value = D.respira
  respira.connect(cuanto)
  cuanto.connect(filtro.frequency)
  const dron = alta(ctx.createGain())
  dron.gain.value = D.volumen
  filtro.connect(dron)
  dron.connect(total)
  fuentes.push(respira)
  D.notas.forEach((hz, i) => {
    const o = alta(ctx.createOscillator())
    o.type = 'sawtooth'
    o.frequency.value = hz
    o.detune.value = (i - 1) * 6
    const g = alta(ctx.createGain())
    g.gain.value = 1 / D.notas.length
    o.connect(g)
    g.connect(filtro)
    fuentes.push(o)
  })

  // El aire: ruido agudo que va y viene.
  const A = AMBIENTE.aire
  const ruido = alta(ctx.createBufferSource())
  ruido.buffer = getNoiseBuffer(ctx)
  ruido.loop = true
  const banda = alta(ctx.createBiquadFilter())
  banda.type = 'bandpass'
  banda.frequency.value = A.centro
  banda.Q.value = A.q
  const aire = alta(ctx.createGain())
  aire.gain.value = A.volumen
  const ola = alta(ctx.createOscillator())
  ola.frequency.value = A.ritmo
  const olaG = alta(ctx.createGain())
  olaG.gain.value = A.volumen * 0.7
  ola.connect(olaG)
  olaG.connect(aire.gain)
  ruido.connect(banda)
  banda.connect(aire)
  aire.connect(total)
  fuentes.push(ruido, ola)

  for (const f of fuentes) f.start(t0)

  // La partitura, con el reloj del contexto: si se suspende (pausa), no avanza
  // y no se programan más. Cada nota arranca `cola` antes de su tiempo, para
  // que pegue justo en él.
  const salidas = {}
  for (const [voz, v] of Object.entries(AMBIENTE.voces)) {
    salidas[voz] = alta(ctx.createGain())
    salidas[voz].gain.value = v.volumen
    salidas[voz].connect(total)
  }
  const P = PARTITURA
  let i = 0
  let mapa = null
  let vivo = true
  notasListas().then((m) => { mapa = m })
  const cuando = (k) => t0 + AMBIENTE.primera + Math.floor(k / P.notas.length) * P.vuelta + P.notas[k % P.notas.length][0]
  const programar = () => {
    if (!vivo || !mapa) return
    for (;;) {
      const [, hz, voz] = P.notas[i % P.notas.length]
      const empieza = cuando(i) - AMBIENTE.voces[voz].cola
      if (empieza > ctx.currentTime + 0.6) break
      const buf = mapa.get(clave(hz, voz))
      // La que ya debía ir creciendo (las primeras) entra a media subida.
      if (buf && cuando(i) > ctx.currentTime + 0.05) {
        const desde = Math.max(empieza, ctx.currentTime)
        const s = ctx.createBufferSource()
        s.buffer = buf
        s.connect(salidas[voz])
        s.start(desde, desde - empieza)
        s.onended = () => { try { s.disconnect() } catch { } }
        fuentes.push(s)
      }
      i += 1
    }
  }
  const reloj = setInterval(programar, 200)

  return {
    detener() {
      if (!vivo) return
      vivo = false
      clearInterval(reloj)
      const t = ctx.currentTime
      try {
        total.gain.cancelScheduledValues(t)
        total.gain.setValueAtTime(Math.max(0.0001, total.gain.value), t)
        total.gain.exponentialRampToValueAtTime(0.0001, t + AMBIENTE.sale)
      } catch { }
      // Suelta todo después del fundido (con reloj de pared: si el contexto
      // está suspendido, igual se desconecta).
      setTimeout(() => {
        for (const f of fuentes) { try { f.stop() } catch { } }
        for (const n of nodos) { try { n.disconnect() } catch { } }
      }, (AMBIENTE.sale + 0.3) * 1000)
    },
  }
}
