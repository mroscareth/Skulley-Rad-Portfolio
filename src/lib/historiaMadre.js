import { lineasMadre } from './vozMadre.js'
import { cadenaCyberVox, VOZ_LIGERA } from './cyberVox.js'
import { NUMERITO } from './numeritoCabeza.js'
import { VOZ_VERSION } from './vozMadreVersion.js'

// "Conocer la historia": M.A.D.R.E. la cuenta sola, con su voz y subtítulos,
// dentro de barras de cine, con entrada de teatro y planos como de varias
// cámaras alrededor de Skulley. La usan el preloader de escritorio y la
// primera pantalla del teléfono (useHistoriaMadre); aquí van los tiempos, los
// planos, las voces y el armado.

// La entrada es de teatro (Oscar): se apagan las luces y queda Skulley a
// oscuras con su rim (APAGA_MS), un rato así, y en FOCO_MS se prende un foco
// desde arriba con el parpadeo de una lámpara que arranca (FOCO_PARPADEO:
// [ms después de prenderse, intensidad]). La cámara empieza a moverse cuando
// se prende. `AMBIENTE_OSCURO`: lo que queda de las luces; casi nada, para que
// el cuerpo no sea un hoyo negro sino rojo muy oscuro.
export const APAGA_MS = 450
export const FOCO_MS = 1600
export const FOCO_PARPADEO = [[0, 1], [60, 0.25], [130, 1], [200, 0.55], [260, 1]]
export const AMBIENTE_OSCURO = 0.05
// Cuánto después de prenderse el foco entra la esfera que le tumba la cabeza
// a Skulley (el numerito, lib/numeritoCabeza.js): primero el silencio del
// foco, luego el chiste.
export const NUMERITO_MS = 900
// El fondo mientras dura: a oscuras, junto con las luces.
export const OSCURO = '#040208'
// Cuándo sale el primer subtítulo (con el foco ya prendido) y cuánto dura cada
// uno: lo que se tarda en leerse, con un respiro entre uno y otro.
export const SUB_PRIMERA_MS = 2700
const SUB_BASE_MS = 1100
const SUB_POR_LETRA_MS = 55
const SUB_HUECO_MS = 320
export const SUB_SALE_MS = 280
// Cuánto se queda en runas cada subtítulo antes de glitchearse a letras.
export const SUB_RUNAS_MS = 380
// Lo que sigue la última toma después del último subtítulo.
const COLA_MS = 900
// Con voz, cada subtítulo dura lo que su audio más este respiro, y nunca
// menos de VOZ_MIN_MS. Lo más que se espera a que lleguen los audios: la
// línea que no llegue se lee sin voz, con la duración de lectura.
const VOZ_COLA_MS = 300
const VOZ_MIN_MS = 1500
export const VOZ_ESPERA_MS = 4000

// Los planos, como si hubiera varias cámaras (Oscar): cada uno se mueve todo
// el rato de `desde` a `hasta`. Entra con `corte` (a negro, CORTE_SALE_MS +
// CORTE_ENTRA_MS) o `suave` (sigue desde donde se quedó el anterior). g: giro
// en radianes, z: zoom (1 = cuerpo entero), c: qué tanto sube a la cara (de
// panCara), x: paneo de lado, p: ángulo (positivo, desde arriba; negativo,
// contrapicado). El primero empieza con el foco y es abierto, para todo el
// numerito de Skulley: la cámara lo lleva siempre al centro (en el rig), con
// zoom menor que 1 para que los pies se vean arriba de los subtítulos, y casi
// no gira. Cuando se pone la cabeza se acerca a ella (`cabeza`, Oscar) y se
// queda cerca para el remate. Los demás caen
// después del numerito, al empezar un subtítulo y nunca a menos de
// MIN_PLANO_MS del anterior; si no caben todos (las voces de cada idioma duran
// distinto), se quedan los de menor `prioridad`. Antes iban amarrados a
// renglones fijos y, con el numerito largo, se empalmaban: un plano de 0.35 s
// y cortes a negro a media escena (Oscar: "están rotas").
export const PITCH_BASE = (16 * Math.PI / 180) * 0.4
export const TOMAS = [
  { prioridad: 0, entra: 'suave', desde: { g: 0, z: 0.9, c: 0, x: 0, p: PITCH_BASE }, hasta: { g: 0.05, z: 0.94, c: 0, x: 0, p: 0.13 }, cabeza: { z: 2.1, c: 1, p: 0.1 } },
  { prioridad: 4, entra: 'corte', desde: { g: 0.95, z: 1.4, c: 0.32, x: 0.04, p: -0.05 }, hasta: { g: 0.55, z: 1.6, c: 0.4, x: 0.02, p: -0.02 } },
  { prioridad: 2, entra: 'corte', desde: { g: 0.18, z: 3.1, c: 1, x: 0, p: 0.1 }, hasta: { g: -0.06, z: 3.6, c: 1, x: 0, p: 0.07 } },
  { prioridad: 3, entra: 'corte', desde: { g: -0.35, z: 1.15, c: 0.05, x: 0, p: 0.52 }, hasta: { g: 0.35, z: 1.3, c: 0.12, x: 0, p: 0.44 } },
  { prioridad: 5, entra: 'suave', hasta: { g: 1.3, z: 2.1, c: 0.65, x: 0.03, p: 0.05 } },
  { prioridad: 1, entra: 'corte', desde: { g: -0.25, z: 1.75, c: 0.42, x: 0, p: 0.09 }, hasta: { g: 0, z: 1, c: 0, x: 0, p: 0.13 } },
]
// Los mismos planos para una pantalla vertical: el cuadro es angosto, así que
// el abierto del numerito se aleja (zoom menor que 1) y los cercanos se
// acercan menos (en 3.1 la cara no cabía de lado a lado). Sin paneos de lado.
export const TOMAS_TELEFONO = [
  { prioridad: 0, entra: 'suave', desde: { g: 0, z: 0.7, c: 0, x: 0, p: PITCH_BASE }, hasta: { g: 0.05, z: 0.74, c: 0.05, x: 0, p: 0.13 }, cabeza: { z: 1.6, c: 1, p: 0.1 } },
  { prioridad: 4, entra: 'corte', desde: { g: 0.95, z: 1.25, c: 0.3, x: 0, p: -0.05 }, hasta: { g: 0.55, z: 1.4, c: 0.38, x: 0, p: -0.02 } },
  { prioridad: 2, entra: 'corte', desde: { g: 0.18, z: 2.3, c: 1, x: 0, p: 0.1 }, hasta: { g: -0.06, z: 2.7, c: 1, x: 0, p: 0.07 } },
  { prioridad: 3, entra: 'corte', desde: { g: -0.35, z: 1, c: 0.05, x: 0, p: 0.52 }, hasta: { g: 0.35, z: 1.12, c: 0.12, x: 0, p: 0.44 } },
  { prioridad: 5, entra: 'suave', hasta: { g: 1.3, z: 1.7, c: 0.6, x: 0, p: 0.05 } },
  { prioridad: 1, entra: 'corte', desde: { g: -0.25, z: 1.5, c: 0.42, x: 0, p: 0.09 }, hasta: { g: 0, z: 1, c: 0, x: 0, p: 0.13 } },
]
const MIN_PLANO_MS = 2500
export const CORTE_SALE_MS = 150
export const CORTE_ENTRA_MS = 260

// El paneo que deja la cara al centro: el rig pone el primer plano en headY,
// 0.21 del alto del personaje arriba de su centro, y el paneo va en altos del
// cuadro con zoom 1 (Skulley llena el 90 % de lo que queda entre las barras).
export const panCara = (barra) => 0.21 * 0.9 * (1 - 2 * barra)

export const suaveSeno = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)
export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
export const movimientoReducido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// ── La voz ────────────────────────────────────────────────────────────────
// Un audio fijo por línea (public/voz/madre/<voz>/<idioma>-NN.mp3, en el orden
// de lineasMadre), generado una vez con motores de voz neural gratis
// (scripts/voz-madre/) y al sonar la cadena robot ligera (VOZ_LIGERA). Inglés:
// Kokoro, voz Heart. Español: Chatterbox con acento mexicano (Oscar escogió
// las dos el 2026-11-11; la voz de Google del blog no pronunciaba bien y las
// otras sonaban torpes o a español gringo). Se piden al acercarse al botón (en
// el teléfono, al tocarlo) y se guardan para la siguiente vuelta. El
// AudioContext se crea hasta el clic, que es el gesto que lo deja sonar.
const VOZ_MADRE = { es: 'chatter-mx', en: 'kokoro-heart' }
// Con la huella de los audios en la URL: el CDN guarda los mp3 horas y, con el
// mismo nombre, servía los de antes después de regenerarlos.
function urlVoz(lang, n) {
  return `${import.meta.env.BASE_URL}voz/madre/${VOZ_MADRE[lang] || VOZ_MADRE.es}/${lang}-${String(n + 1).padStart(2, '0')}.mp3?v=${VOZ_VERSION}`
}
export function fuenteDeVoz(ctx, buffer, destino) {
  return cadenaCyberVox(ctx, buffer, limitador(ctx, destino), VOZ_LIGERA)
}

// La voz de M.A.D.R.E. llega del más allá: reverb al revés, como el efecto
// Supernatural de Edits que mandó Oscar ("se arrastra al principio, como si
// se cargara"). Medido en su video: antes de cada frase el sonido crece desde
// el silencio 350 a 450 ms, unos 14 dB cada 100 ms, hasta que entra la
// palabra (una voz normal arranca en 30 a 50 ms), y al terminar casi no queda
// cola; y suena un pico fijo en ~170 Hz y sus múltiplos aunque la entonación
// cambie (un resonador). Como cada línea es un audio fijo, se calcula al
// cargarla: se voltea, pasa por una reverb con esa caída y ese resonador, se
// vuelve a voltear y se le suma la voz seca. Así la cola queda ANTES de cada
// palabra. El audio crece `largo` segundos al principio (`adelanto`):
// armarHistoria lo arranca ese tanto antes que su subtítulo.
const PRE_REVERB = { largo: 0.55, caida: 16, nota: 170, realimenta: 0.9, brilloPeine: 1400, brilloSala: 2800, peine: 0.5, sala: 0.85, seco: 0.85, mojado: 1, pico: 0.9 }

function pasaBajos(x, hz, sr) {
  const a = Math.exp((-2 * Math.PI * hz) / sr)
  for (let i = 1; i < x.length; i++) x[i] = (1 - a) * x[i] + a * x[i - 1]
}
function energia(x) {
  let e = 0
  for (let i = 0; i < x.length; i++) e += x[i] * x[i]
  return Math.sqrt(e) || 1
}
// La reverb: un tren de ecos cada 1/`nota` s (el resonador) más ruido que cae
// `caida` por segundo (la sala), distinto en cada canal y con semilla fija.
function impulsoPreReverb(sr) {
  const n = Math.floor(sr * PRE_REVERB.largo)
  const peine = new Float32Array(n)
  for (let k = 1; ; k++) {
    const i = Math.round((k * sr) / PRE_REVERB.nota)
    if (i >= n) break
    peine[i] = Math.pow(PRE_REVERB.realimenta, k)
  }
  pasaBajos(peine, PRE_REVERB.brilloPeine, sr)
  const kp = PRE_REVERB.peine / energia(peine)
  let semilla = 7
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  return [0, 1].map(() => {
    const sala = new Float32Array(n)
    for (let i = 0; i < n; i++) sala[i] = (azar() * 2 - 1) * Math.exp((-PRE_REVERB.caida * i) / sr)
    pasaBajos(sala, PRE_REVERB.brilloSala, sr)
    const ks = PRE_REVERB.sala / energia(sala)
    for (let i = 0; i < n; i++) sala[i] = sala[i] * ks + peine[i] * kp
    return sala
  })
}
function rms(x) {
  let e = 0
  for (let i = 0; i < x.length; i++) e += x[i] * x[i]
  return Math.sqrt(e / (x.length || 1))
}
async function conPreReverb(ctx, buf) {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Off) return buf
  const sr = buf.sampleRate
  const ir = impulsoPreReverb(sr)
  const m = ir[0].length
  const n = buf.length
  const off = new Off(2, n + m, sr)
  const volteada = off.createBuffer(buf.numberOfChannels, n, sr)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    const v = volteada.getChannelData(c)
    for (let i = 0; i < n; i++) v[i] = d[n - 1 - i]
  }
  const impulso = off.createBuffer(2, m, sr)
  impulso.copyToChannel(ir[0], 0)
  impulso.copyToChannel(ir[1], 1)
  const reverb = off.createConvolver()
  reverb.normalize = false
  reverb.buffer = impulso
  const fuente = off.createBufferSource()
  fuente.buffer = volteada
  fuente.connect(reverb)
  reverb.connect(off.destination)
  fuente.start()
  const y = await off.startRendering()
  const sale = ctx.createBuffer(2, n + m, sr)
  let pico = 0
  for (let c = 0; c < 2; c++) {
    const yc = y.getChannelData(c)
    const d = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1))
    const o = sale.getChannelData(c)
    for (let k = 0; k < n + m; k++) {
      o[k] = PRE_REVERB.mojado * yc[n + m - 1 - k] + (k >= m ? PRE_REVERB.seco * d[k - m] : 0)
      if (Math.abs(o[k]) > pico) pico = Math.abs(o[k])
    }
  }
  // Igual de fuerte que la voz seca, sin pasarse de `pico`.
  const g = Math.min(rms(buf.getChannelData(0)) / (rms(sale.getChannelData(0)) || 1), PRE_REVERB.pico / (pico || 1))
  for (let c = 0; c < 2; c++) {
    const o = sale.getChannelData(c)
    for (let k = 0; k < o.length; k++) o[k] *= g
  }
  sale.adelanto = m / sr
  return sale
}

// Todo entra a un limitador: la cadena robot sube la señal y algún golpe se
// pasaba de 1.0. Uno por salida y se queda armado: la bocina y la pausa le
// llegan igual que a la voz.
const limitadores = new WeakMap()
function limitador(ctx, destino) {
  let entrada = limitadores.get(destino)
  if (entrada) return entrada
  entrada = ctx.createDynamicsCompressor()
  entrada.threshold.value = -6
  entrada.knee.value = 0
  entrada.ratio.value = 20
  entrada.attack.value = 0.002
  entrada.release.value = 0.12
  const recorte = ctx.createGain()
  recorte.gain.value = 0.88
  entrada.connect(recorte)
  recorte.connect(destino)
  limitadores.set(destino, entrada)
  return entrada
}

let ctxVoz = null
export function contextoVoz() {
  if (!ctxVoz) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) { try { ctxVoz = new Ctx() } catch { } }
  }
  if (ctxVoz?.state === 'suspended') ctxVoz.resume().catch(() => { })
  return ctxVoz
}
// El que ya existe, sin crearlo (crearlo fuera de un gesto lo deja mudo).
export const contextoVozActual = () => ctxVoz

const voces = new Map()
function pedirVoz(lang, n) {
  const k = urlVoz(lang, n)
  let v = voces.get(k)
  if (!v) {
    v = {
      bytes: fetch(k).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
      buffer: null,
    }
    voces.set(k, v)
  }
  return v
}
export function pedirVoces(lang) {
  lineasMadre(lang).flat().forEach((_, n) => pedirVoz(lang, n))
}
export function bufferDeVoz(lang, n, ctx) {
  const k = urlVoz(lang, n)
  const v = pedirVoz(lang, n)
  if (!v.buffer) {
    // Si no llegó, se olvida para pedirla otra vez en la siguiente vuelta.
    v.buffer = v.bytes
      .then((b) => (b ? ctx.decodeAudioData(b.slice(0)) : null))
      .then((buf) => (buf ? conPreReverb(ctx, buf).catch(() => buf) : null))
      .catch(() => null)
      .then((buf) => { if (!buf) voces.delete(k); return buf })
  }
  return v.buffer
}

// Las líneas de M.A.D.R.E. repartidas en los planos y en el tiempo. Con voz,
// cada línea dura lo que su audio (`vocesPlan`, buffers o null). `inicio`:
// cuándo sale la primera desde el clic (más tarde si los audios tardaron); la
// cámara empieza a moverse SUB_PRIMERA_MS antes.
export function armarHistoria(lang, vocesPlan = [], inicio = SUB_PRIMERA_MS, tomas = TOMAS) {
  const lineas = []
  let t = inicio
  lineasMadre(lang).flat().forEach((texto, n) => {
    const voz = vocesPlan[n] || null
    // La reverb al revés crece antes de la voz: el audio arranca ese tanto
    // antes que su subtítulo (`vozDesde`), en el hueco entre líneas.
    const adelanto = voz ? ((voz.adelanto || 0) / VOZ_LIGERA.velocidad) * 1000 : 0
    const dura = voz
      ? Math.max(VOZ_MIN_MS, (voz.duration / VOZ_LIGERA.velocidad) * 1000 - adelanto + VOZ_COLA_MS)
      : SUB_BASE_MS + texto.length * SUB_POR_LETRA_MS
    lineas.push({ texto, desde: t, hasta: t + dura, voz, vozDesde: t - adelanto })
    t += dura + SUB_HUECO_MS
  })
  const total = t - SUB_HUECO_MS + COLA_MS
  // Cada plano empieza en el hueco antes de su línea; el primero, con el foco.
  const arranque = Math.max(0, inicio - SUB_PRIMERA_MS) + FOCO_MS
  // El primer corte, en cuanto acaba el numerito (arranca a reloj desde el
  // clic, no con la voz); los demás, al empezar un subtítulo.
  const huecos = [FOCO_MS + NUMERITO_MS + NUMERITO.fin * 1000 + 400]
  for (const l of lineas) {
    const c = l.desde - SUB_HUECO_MS / 2
    if (c >= huecos[huecos.length - 1] + MIN_PLANO_MS && c <= total - MIN_PLANO_MS * 0.6) huecos.push(c)
  }
  const resto = tomas.slice(1)
  const quedan = new Set([...resto].sort((a, b) => a.prioridad - b.prioridad).slice(0, huecos.length))
  const elegidos = resto.filter((toma) => quedan.has(toma))
  // El primer elegido entra al acabar el numerito y los demás en los últimos
  // huecos: así el abierto final siempre cierra la historia.
  const inicios = [huecos[0], ...huecos.slice(1).slice(-(elegidos.length - 1) || huecos.length)]
  const planos = [
    { ...tomas[0], inicio: arranque },
    ...elegidos.map((toma, i) => ({ ...toma, inicio: inicios[i] })),
  ]
  planos.forEach((plano, k) => {
    plano.fin = k + 1 < planos.length ? planos[k + 1].inicio : total
    if (k > 0 && plano.entra === 'suave') plano.desde = planos[k - 1].hasta
  })
  return { lineas, planos, total }
}
