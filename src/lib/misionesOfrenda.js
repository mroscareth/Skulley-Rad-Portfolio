// Las misiones de la ofrenda del Día de los Skulleys (Oscar, 2026-11-25; plan en features.md):
// cada objeto lo da alguien por algo que hiciste en el sitio. Al ganarlo queda en el inventario
// (conseguirOfrenda) y, cuando nadie está hablando, sale el toast con el objeto girando
// (ToastOfrenda.jsx, lo monta App al oír EVENTO_GANADA).
//
// Abiertas para todos desde el 2026-11-26 (`MISIONES_ABIERTAS` en ofrendas.js). Si se vuelven a cerrar,
// nadie gana nada en producción; ahí se pueden probar con `localStorage.skulley_misiones = '1'` ('0'
// las cierra también en desarrollo).
//
// Las misiones y cómo se sueltan, abajo ("las seis misiones").
// Sin three: lo leen App, DialogoMadre y el toast.

import { MISIONES_ABIERTAS, OFRENDAS, conseguirOfrenda, ofrendaPuesta, ofrendaEnMano } from './ofrendas.js'
import { avisarDron } from './droneNpc.js'
import { avisarArgus } from './argusNpc.js'
import { escuchar as escucharJuego } from './juegoEsferas.js'
import scoreStore from './scoreStore.js'
import { hablando } from './turnoGlobos.js'

export const EVENTO_GANADA = 'ofrenda-ganada'

export function misionesAbiertas() {
  if (MISIONES_ABIERTAS) return true
  try {
    const v = localStorage.getItem('skulley_misiones')
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* sin almacenamiento */ }
  return Boolean(import.meta.env?.DEV)
}

export const yaObtenida = (id) => ofrendaPuesta(id) || ofrendaEnMano(id)

/** Lo llama una misión al ganarse: Skulley la carga y sale el toast. */
export function ganarOfrenda(id) {
  if (!misionesAbiertas() || !OFRENDAS.some((o) => o.id === id)) return false
  if (!conseguirOfrenda(id)) return false
  try { window.dispatchEvent(new CustomEvent(EVENTO_GANADA, { detail: { id } })) } catch { /* sin window */ }
  return true
}

// ---------------------------------------------------------------- el inventario

// Lo que dice cada objeto en el inventario (Inventario → Objetos, Oscar, 2026-11-25). La del iPad es
// de Oscar; las demás son borradores para que él las ajuste. Skulley ya no está: van en pasado. `pista`
// es lo que se lee en su lugar mientras no lo tienes y ya te lo soltaron: la pista, nunca una orden
// (Oscar). Si todavía no te lo sueltan, el inventario solo dice a quién preguntarle (ENTREGA).
export const HISTORIAS = {
  ipad: {
    nombre: { es: 'iPad', en: 'iPad' },
    es: 'El primer sueldo de Skulley como diseñador se fue en un iPad, y desde entonces fue su herramienta favorita para dibujar.',
    en: "Skulley's first paycheck as a designer went on an iPad, and from then on it was his favorite drawing tool.",
    pista: { es: 'Lo dejó entre sus proyectos. Decía que su trabajo se entiende mejor cuando alguien te lo enseña, uno por uno.', en: 'He left it among his projects. He used to say his work makes more sense when someone shows it to you, one by one.' },
  },
  leica: {
    nombre: { es: 'Cámara', en: 'Camera' },
    es: 'Con esta cámara Skulley aprendió a ver: encuadrar, esperar la luz y disparar una sola vez. Muchas de sus composiciones empezaron como fotos.',
    en: 'With this camera Skulley learned to see: frame it, wait for the light and shoot once. Many of his compositions started as photos.',
    pista: { es: 'Le encantaba que lo retrataran en grande, de esos retratos que se ponen de fondo de pantalla. Dicen que la cámara regresa con quien le toma uno así.', en: 'He loved big portraits, the kind you set as your wallpaper. They say the camera comes back to whoever takes one like that.' },
  },
  album: {
    nombre: { es: 'Álbum', en: 'Album' },
    es: 'Aquí guardaba a su gente: su familia, sus amigos y quienes lo acompañaron desde el principio. Lo abría cuando se le olvidaba para quién hacía todo esto.',
    en: 'This is where he kept his people: his family, his friends and everyone who was there from the start. He opened it whenever he forgot who all of this was for.',
    pista: { es: 'Guardaba las fotos de su gente junto a lo que escribía de ellos en sus Memorias.', en: 'He kept the photos of his people next to what he wrote about them in his Memories.' },
  },
  teclado: {
    nombre: { es: 'Teclado', en: 'Keyboard' },
    es: 'Cuando ya no quería dibujar, Skulley componía. De estas 25 teclas salieron canciones que todavía suenan en el reproductor.',
    en: "When he didn't feel like drawing, Skulley wrote music. Songs that still play on the jukebox came out of these 25 keys.",
    pista: { es: 'No suena desde que se fue. Cuando se aburría de la música, le rayaba los discos al reproductor: decía que así despertaban.', en: 'It hasn\'t made a sound since he left. When he got bored of music, he scratched the records on the player: he said it woke them up.' },
  },
  cerillos: {
    nombre: { es: 'Cerillos', en: 'Matches' },
    es: 'Se la regaló su novia y Skulley la guardó como un tesoro. Solo usó un cerillo: el que ves quemado.',
    en: 'His girlfriend gave it to him and Skulley kept it like a treasure. He only ever used one match: the burnt one.',
    pista: { es: 'Argus no se los da a cualquiera: solo a alguien que no le tenga miedo al fuego. Por ahí hay un caminito de pétalos que nadie se atreve a tocar.', en: 'Argus won\'t give them to just anybody: only to someone who isn\'t scared of fire. There\'s a little trail of petals out there nobody dares to touch.' },
  },
  almohada: {
    nombre: { es: 'Almohada', en: 'Pillow' },
    es: 'Donde Skulley soñaba. Muchas de sus mejores ideas llegaron justo antes de quedarse dormido.',
    en: 'Where Skulley dreamed. Many of his best ideas showed up right before he fell asleep.',
    pista: { es: 'Argus la guarda para quien juegue en serio: una partida de cuatro cifras, no menos.', en: 'Argus keeps it for someone who plays for real: a four-digit game, nothing less.' },
  },
}

// ---------------------------------------------------------------- las seis misiones
// (Oscar, 2026-11-26: "que las misiones te las den M.A.D.R.E. y Argus… que se las pidas en los diálogos
// y que te hablen un poco de ellas, que te vayan soltando una por una"; "no te deben decir haz esto,
// solo darte pistas… que digan que son objetos que Skulley atesoró y que seguro cumplen una función en
// algún lugar"). Cada quien tiene las suyas, en orden (`ORDEN`), y suelta una a la vez: en su diálogo
// ("¿Qué dejó Skulley?" con ella, "¿Tienes algo de Skulley?" con Argus) `pedirCosa(quien)` te cuenta de
// la siguiente con una pista y no suelta otra hasta que te entregue esa. Lo que se hace antes de que te
// la suelten no cuenta. Qué pide cada una (sin decirlo en el sitio: lo dicen las pistas):
//   iPad      ver con ella `MISION_IPAD.proyectos` proyectos distintos (los que te enseña)  → M.A.D.R.E.
//   cámara    bajar un wallpaper 4K del Inventario (DesktopWallpaper)                      → M.A.D.R.E.
//   teclado   rayar el disco del reproductor (MusicPlayer)                                 → M.A.D.R.E.
//   álbum     tener una memoria abierta `MISION.leerS` s (Section5, el blog)               → M.A.D.R.E.
//   cerillos  prender `MISION.petalos` pétalos con la bola de fuego (PetalosCamino)        → Argus
//   almohada  hacer `MISION.puntos` en una partida del trato                               → Argus
// Cumplida (`misionHecha`) se guarda en el navegador y la entrega llega sola cuando la home está libre y
// nadie habla: App llama `intentarEntrega` cada rato y le avisa a quien la da (`entrega: { id,
// alEmpezar }`). Ella vuela hacia Skulley; Argus no camina: te la da con Skulley cerca y, de lejos, lo
// llama (ZoidianNPC). Si le preguntas en su diálogo antes, te la da ahí mismo.

export const ORDEN = { madre: ['ipad', 'leica', 'teclado', 'album'], argus: ['cerillos', 'almohada'] }
export const ENTREGA = Object.fromEntries(Object.entries(ORDEN).flatMap(([q, ids]) => ids.map((id) => [id, q])))
export const MISION_IPAD = { proyectos: 3 }
export const MISION = {
  petalos: 30,       // pétalos prendidos (en total) para los cerillos
  puntos: 1000,      // puntos en una partida para la almohada ("una partida de cuatro cifras")
  leerS: 8,          // segundos con una memoria abierta para el álbum
  rayadoRad: Math.PI * 1.5, // lo que hay que mover el disco con la mano (radianes) para el teclado
  reintento: { madre: 15, argus: 4 }, // cada cuánto se vuelve a pedir la entrega (s)
}
export const EVENTO_HECHA = 'mision-ofrenda-hecha'
export const EVENTO_PEDIDA = 'mision-ofrenda-pedida'
const LLAVE_PEDIDAS = 'skulley_misiones_pedidas'
const LLAVE_HECHAS = 'skulley_misiones_hechas'
const LLAVE_IPAD = 'skulley_mision_ipad'

function leerLista(llave, valida) {
  try {
    const g = JSON.parse(localStorage.getItem(llave) || '[]')
    if (Array.isArray(g)) return new Set(g.filter(valida))
  } catch { /* sin almacenamiento */ }
  return new Set()
}
const guardarLista = (llave, set) => { try { localStorage.setItem(llave, JSON.stringify([...set])) } catch { /* en memoria */ } }

let pedidas = leerLista(LLAVE_PEDIDAS, (id) => ENTREGA[id])
let hechas = leerLista(LLAVE_HECHAS, (id) => ENTREGA[id])
let vistos = leerLista(LLAVE_IPAD, (s) => typeof s === 'string')

/** Ya te la soltaron y todavía no la tienes: lo que hagas cuenta. */
export const misionActiva = (id) => misionesAbiertas() && pedidas.has(id) && !yaObtenida(id)
export const misionPedida = (id) => pedidas.has(id)

/**
 * Le preguntaste por las cosas de Skulley a `quien` ('madre' | 'argus'). Regresa qué te dice:
 *   { tipo: 'entrega', id }                ya cumpliste la que tenías: te la da (y ya es tuya)
 *   { tipo: 'pista', id, nueva, primera }  te cuenta de la que va (`nueva` si apenas te la suelta;
 *                                          `primera` si es la primera vez que te habla de ellas)
 *   { tipo: 'fin', otro }                  ya te dio todas (`otro`: el otro todavía tiene alguna)
 */
export function pedirCosa(quien) {
  const ids = ORDEN[quien] || []
  if (!misionesAbiertas()) return { tipo: 'fin', otro: false }
  const lista = entregaPendiente(quien)
  if (lista) { ganarOfrenda(lista); return { tipo: 'entrega', id: lista } }
  const va = ids.find((id) => pedidas.has(id) && !yaObtenida(id))
  if (va) return { tipo: 'pista', id: va, nueva: false, primera: false }
  const sigue = ids.find((id) => !pedidas.has(id) && !yaObtenida(id))
  if (sigue) {
    const primera = !ids.some((id) => pedidas.has(id) || yaObtenida(id))
    pedidas.add(sigue)
    guardarLista(LLAVE_PEDIDAS, pedidas)
    if (sigue === 'ipad') { vistos = new Set(); guardarLista(LLAVE_IPAD, vistos) }
    try { window.dispatchEvent(new CustomEvent(EVENTO_PEDIDA, { detail: { id: sigue } })) } catch { /* sin window */ }
    return { tipo: 'pista', id: sigue, nueva: true, primera }
  }
  const otro = Object.keys(ORDEN).some((q) => q !== quien && ORDEN[q].some((id) => !yaObtenida(id)))
  return { tipo: 'fin', otro }
}

/** Cumpliste lo que pide esa misión (solo cuenta si ya te la soltaron): queda pendiente de entrega. */
export function misionHecha(id) {
  if (!ENTREGA[id] || hechas.has(id) || !misionActiva(id)) return false
  hechas.add(id)
  guardarLista(LLAVE_HECHAS, hechas)
  try { window.dispatchEvent(new CustomEvent(EVENTO_HECHA, { detail: { id } })) } catch { /* sin window */ }
  return true
}

/** La primera que esa persona ya te debe ('madre' | 'argus'), o null. */
export function entregaPendiente(quien) {
  if (!misionesAbiertas()) return null
  return (ORDEN[quien] || []).find((id) => hechas.has(id) && pedidas.has(id) && !yaObtenida(id)) ?? null
}

// el iPad: los proyectos que ella te enseñó (DialogoMadre, App al cerrar la ficha)
/** Un proyecto que ella te enseñó y ya cerraste. Regresa cuántos distintos van. */
export function proyectoVistoConMadre(slug) {
  if (!slug || !misionActiva('ipad')) return vistos.size
  vistos.add(String(slug))
  guardarLista(LLAVE_IPAD, vistos)
  if (vistos.size >= MISION_IPAD.proyectos) misionHecha('ipad')
  return vistos.size
}

const intento = {}

/** Regresaste de un proyecto que te enseñó M.A.D.R.E.: lo cuenta y ella lo comenta (o, con el tercero, te
 * da el iPad en lugar del comentario). */
export function comentarProyecto(slug) {
  if (!slug) return
  proyectoVistoConMadre(slug)
  if (entregaPendiente('madre') === 'ipad') {
    // que `intentarEntrega` no lo pida encima mientras ella lo dice aquí
    intento.ipad = performance.now() / 1000
    avisarDron({ comenta: slug, entrega: { id: 'ipad', vistos: vistos.size, alEmpezar: () => ganarOfrenda('ipad') } })
  } else avisarDron({ comenta: slug })
}

let quemados = 0
/** PetalosCamino: prendieron `n` pétalos más (solo cuentan con la misión de los cerillos activa). */
export function petalosQuemados(n) {
  if (!n || hechas.has('cerillos') || !misionActiva('cerillos')) return
  quemados += n
  if (quemados >= MISION.petalos) misionHecha('cerillos')
}

escucharJuego((tipo) => {
  if (tipo !== 'fin' && tipo !== 'tiempo') return
  if ((scoreStore.get() || 0) >= MISION.puntos) misionHecha('almohada')
})

/** App, cada rato: si la home está libre (`puede`) y nadie habla, pide la siguiente entrega. */
export function intentarEntrega(puede) {
  if (!puede || !misionesAbiertas() || hablando()) return
  const ahora = performance.now() / 1000
  for (const quien of Object.keys(ORDEN)) {
    const id = entregaPendiente(quien)
    if (!id || ahora - (intento[id] ?? -Infinity) < MISION.reintento[quien]) continue
    intento[id] = ahora
    const entrega = { id, vistos: MISION_IPAD.proyectos, alEmpezar: () => ganarOfrenda(id) }
    if (quien === 'madre') avisarDron({ entrega })
    else avisarArgus({ entrega })
    return
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__misiones = {
    ganar: ganarOfrenda,
    pedir: pedirCosa,
    hecha: misionHecha,
    comentar: comentarProyecto,
    abiertas: misionesAbiertas,
    activa: misionActiva,
    vistos: () => [...vistos],
    pedidas: () => [...pedidas],
    hechas: () => [...hechas],
    pendiente: entregaPendiente,
    quemados: () => quemados,
    olvidar() {
      vistos = new Set(); hechas = new Set(); pedidas = new Set(); quemados = 0
      try { [LLAVE_IPAD, LLAVE_HECHAS, LLAVE_PEDIDAS].forEach((k) => localStorage.removeItem(k)) } catch { }
    },
  }
}
