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

import { MISIONES_ABIERTAS, OFRENDAS, conseguirOfrenda, ofrendaPuesta, ofrendaEnMano, fusionarOfrendas, EVENTO_OFRENDAS } from './ofrendas.js'
import { avisarDron } from './droneNpc.js'
import { argus, avisarArgus } from './argusNpc.js'
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
  avisarQuest()
  return true
}

// ---------------------------------------------------------------- el inventario

// Lo que dice cada objeto en el inventario (Inventario → Objetos, Oscar, 2026-11-25). La del iPad es
// de Oscar; las demás son borradores para que él las ajuste. Skulley ya no está: van en pasado. `pista`
// es lo que se lee en su lugar mientras no lo tienes y ya te lo soltaron: quién te lo da y qué hay que
// hacer, dicho claro (Oscar, 2026-11-26: las pistas veladas mandaban a donde no era). Si todavía no te
// lo sueltan, el inventario solo dice a quién preguntarle (ENTREGA).
export const HISTORIAS = {
  ipad: {
    nombre: { es: 'iPad', en: 'iPad' },
    es: 'El primer sueldo de Skulley como diseñador se fue en un iPad, y desde entonces fue su herramienta favorita para dibujar.',
    en: "Skulley's first paycheck as a designer went on an iPad, and from then on it was his favorite drawing tool.",
    pista: { es: 'M.A.D.R.E. te lo da cuando veas tres de sus proyectos con ella. Pregúntale por ellos.', en: 'M.A.D.R.E. gives it to you once you’ve seen three of his projects with her. Ask her about them.' },
  },
  leica: {
    nombre: { es: 'Cámara', en: 'Camera' },
    es: 'Con esta cámara Skulley aprendió a ver: encuadrar, esperar la luz y disparar una sola vez. Muchas de sus composiciones empezaron como fotos.',
    en: 'With this camera Skulley learned to see: frame it, wait for the light and shoot once. Many of his compositions started as photos.',
    pista: { es: 'M.A.D.R.E. te la da cuando le tomes un retrato en 4K al Skulley que manejas, con el botón Wallpaper 4K de aquí del inventario.', en: 'M.A.D.R.E. gives it to you once you take a 4K portrait of the Skulley you’re playing, with the Wallpaper 4K button right here in the inventory.' },
  },
  album: {
    nombre: { es: 'Álbum', en: 'Album' },
    es: 'Aquí guardaba a su gente: su familia, sus amigos y quienes lo acompañaron desde el principio. Lo abría cuando se le olvidaba para quién hacía todo esto.',
    en: 'This is where he kept his people: his family, his friends and everyone who was there from the start. He opened it whenever he forgot who all of this was for.',
    pista: { es: 'M.A.D.R.E. te lo da cuando leas lo que escribió de su gente, en el portal de Memorias.', en: 'M.A.D.R.E. gives it to you once you read what he wrote about his people, in the Memories portal.' },
  },
  teclado: {
    nombre: { es: 'Teclado', en: 'Keyboard' },
    es: 'Cuando ya no quería dibujar, Skulley componía. De estas 25 teclas salieron canciones que todavía suenan en el reproductor.',
    en: "When he didn't feel like drawing, Skulley wrote music. Songs that still play on the jukebox came out of these 25 keys.",
    pista: { es: 'M.A.D.R.E. te lo da cuando le hagas scratch a un disco en el reproductor de música (el botón de la nota, junto a tu retrato).', en: 'M.A.D.R.E. gives it to you once you scratch a record on the music player (the note button, next to your portrait).' },
  },
  cerillos: {
    nombre: { es: 'Cerillos', en: 'Matches' },
    es: 'Esta caja se la regaló su novia y Skulley la guardó como un tesoro. Solo usó un cerillo: el que ves quemado.',
    en: 'His girlfriend gave him this box and Skulley kept it like a treasure. He only ever used one match: the burnt one.',
    pista: { es: 'Argus te los da cuando quemes unos 30 pétalos de cempasúchil con tu bola de fuego.', en: 'Argus gives them to you once you burn about 30 marigold petals with your fireball.' },
  },
  almohada: {
    nombre: { es: 'Almohada', en: 'Pillow' },
    es: 'Donde Skulley soñaba. Muchas de sus mejores ideas llegaron justo antes de quedarse dormido.',
    en: 'Where Skulley dreamed. Many of his best ideas showed up right before he fell asleep.',
    pista: { es: 'Argus te la da cuando hagas mil puntos en una partida del juego de las esferas.', en: 'Argus gives it to you once you score a thousand points in one game of spheres.' },
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
// nadie habla, siempre en cinemática (Oscar: el texto en su viñeta "me pasó de noche"): App llama
// `intentarEntrega(puede, abrir)` cada rato y abre el diálogo de quien la da en modo 'entrega' (ella vuela
// frente a Skulley; el trato de Argus solo con Skulley junto a él, si no Argus lo llama en su globo,
// `llamaOfrenda` en ZoidianNPC). El diálogo llama `ganarOfrenda`. Si le preguntas antes, te la da ahí.

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
    avisarQuest()
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
  avisarQuest()
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

/** Regresaste de un proyecto que te enseñó M.A.D.R.E.: lo cuenta y ella lo comenta; con el tercero no lo
 * comenta: se abre su cinemática con el iPad (`intentarEntrega`). */
export function comentarProyecto(slug) {
  if (!slug) return
  proyectoVistoConMadre(slug)
  if (entregaPendiente('madre') !== 'ipad') avisarDron({ comenta: slug })
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

/** App, cada rato: si la home está libre (`puede`) y nadie habla, abre la cinemática de la siguiente
 * entrega (`abrir(quien, id)`). La de Argus solo con Skulley junto a él; si no, Argus lo llama. */
export function intentarEntrega(puede, abrir) {
  if (!puede || !misionesAbiertas() || hablando()) return
  const ahora = performance.now() / 1000
  for (const quien of Object.keys(ORDEN)) {
    const id = entregaPendiente(quien)
    if (!id || ahora - (intento[id] ?? -Infinity) < MISION.reintento[quien]) continue
    intento[id] = ahora
    if (quien === 'argus' && !argus.cerca) avisarArgus({ llamaOfrenda: true })
    else abrir?.(quien, id)
    return
  }
}

// ---------------------------------------------------------------- en la cuenta
// (Oscar, 2026-11-26: "deberían guardarse en su cuenta, para que si regresan desde otra PC puedan seguir la
// quest"). El progreso solo avanza (se suelta, se cumple, se gana, se pone), así que va como logros: una llave
// por paso y por objeto (`of_p_ipad`, `of_h_...`, `of_g_...`, `of_v_...`) y `of_final` con la cinemática
// vista. achievements.php acepta cualquier llave [a-z0-9_]{1,64} y Mi cuenta solo enseña las del catálogo.
// App, con los logros cargados (invitado o cuenta), suma los de la cuenta a lo de aquí (`fusionarQuest`) y
// sube lo de aquí que falte (`llavesQuest`); cada cambio avisa con EVENTO_QUEST para subirlo. Lo del
// invitado se migra solo al iniciar sesión (useAchievements).
export const EVENTO_QUEST = 'quest-ofrenda-cambio'
const PASO = { pedida: 'of_p_', hecha: 'of_h_', ganada: 'of_g_', puesta: 'of_v_' }
export const LLAVE_FINAL = 'of_final'
const LLAVE_FINAL_VISTO = 'skulley_final_ofrenda'
function avisarQuest() { try { window.dispatchEvent(new CustomEvent(EVENTO_QUEST)) } catch { /* sin window */ } }
if (typeof window !== 'undefined') {
  window.addEventListener(EVENTO_OFRENDAS, (e) => { if (!e?.detail?.fusion) avisarQuest() })
}

/** Las llaves de lo que se lleva aquí. */
export function llavesQuest() {
  const out = []
  for (const { id } of OFRENDAS) {
    if (pedidas.has(id)) out.push(PASO.pedida + id)
    if (hechas.has(id)) out.push(PASO.hecha + id)
    if (yaObtenida(id)) out.push(PASO.ganada + id)
    if (ofrendaPuesta(id)) out.push(PASO.puesta + id)
  }
  try { if (localStorage.getItem(LLAVE_FINAL_VISTO) === '1') out.push(LLAVE_FINAL) } catch { /* sin almacenamiento */ }
  return out
}

/** Lo que trae la cuenta se suma a lo de aquí (nunca quita). Regresa si cambió algo. */
export function fusionarQuest(llaves) {
  if (!llaves || typeof llaves.has !== 'function') return false
  let cambio = false
  const ganadas = []
  const puestasC = []
  for (const { id } of OFRENDAS) {
    if (llaves.has(PASO.pedida + id) && !pedidas.has(id)) { pedidas.add(id); cambio = true }
    if (llaves.has(PASO.hecha + id) && !hechas.has(id)) { hechas.add(id); cambio = true }
    if (llaves.has(PASO.puesta + id)) puestasC.push(id)
    else if (llaves.has(PASO.ganada + id)) ganadas.push(id)
  }
  if (cambio) { guardarLista(LLAVE_PEDIDAS, pedidas); guardarLista(LLAVE_HECHAS, hechas) }
  if (fusionarOfrendas({ ganadas, puestas: puestasC })) cambio = true
  if (llaves.has(LLAVE_FINAL)) {
    try {
      if (localStorage.getItem(LLAVE_FINAL_VISTO) !== '1') { localStorage.setItem(LLAVE_FINAL_VISTO, '1'); cambio = true }
    } catch { /* sin almacenamiento */ }
  }
  return cambio
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__misiones = {
    llaves: llavesQuest,
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
