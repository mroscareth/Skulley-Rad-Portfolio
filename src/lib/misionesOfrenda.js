// Las misiones de la ofrenda del Día de los Skulleys (Oscar, 2026-11-25; plan en features.md):
// cada objeto lo da alguien por algo que hiciste en el sitio. Al ganarlo queda en el inventario
// (conseguirOfrenda) y, cuando nadie está hablando, sale el toast con el objeto girando
// (ToastOfrenda.jsx, lo monta App al oír EVENTO_GANADA).
//
// Abiertas para todos desde el 2026-11-26 (`MISIONES_ABIERTAS` en ofrendas.js). Si se vuelven a cerrar,
// nadie gana nada en producción; ahí se pueden probar con `localStorage.skulley_misiones = '1'` ('0'
// las cierra también en desarrollo).
//
// El iPad, por ver tres proyectos que te enseñó M.A.D.R.E. (las otras cinco, abajo). Al regresar de cada uno, quien lo
// abrió llama `comentarProyecto(slug)` (App al cerrar la ficha; DialogoMadre al cerrar la charla de
// uno de enlace): lo cuenta y le pide a ella que lo comente; desde el tercero, con `entrega`, y ella
// dice lo de la entrega en lugar del comentario y llama `alEmpezar` (DroneNPC). Si no puede hablar,
// no lo entrega y lo intenta con el siguiente.
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
// es lo que se lee en su lugar mientras no lo tienes (cómo se consigue, sin decirlo todo).
export const HISTORIAS = {
  ipad: {
    nombre: { es: 'iPad', en: 'iPad' },
    es: 'El primer sueldo de Skulley como diseñador se fue en un iPad, y desde entonces fue su herramienta favorita para dibujar.',
    en: "Skulley's first paycheck as a designer went on an iPad, and from then on it was his favorite drawing tool.",
    pista: { es: 'M.A.D.R.E. se lo da a quien vea con ella tres de sus proyectos.', en: 'M.A.D.R.E. gives it to whoever watches three of his projects with her.' },
  },
  leica: {
    nombre: { es: 'Cámara', en: 'Camera' },
    es: 'Con esta cámara Skulley aprendió a ver: encuadrar, esperar la luz y disparar una sola vez. Muchas de sus composiciones empezaron como fotos.',
    en: 'With this camera Skulley learned to see: frame it, wait for the light and shoot once. Many of his compositions started as photos.',
    pista: { es: 'Aparece cuando le tomas a Skulley un retrato en 4K desde el Inventario.', en: 'It shows up when you take a 4K portrait of Skulley from the Inventory.' },
  },
  album: {
    nombre: { es: 'Álbum', en: 'Album' },
    es: 'Aquí guardaba a su gente: su familia, sus amigos y quienes lo acompañaron desde el principio. Lo abría cuando se le olvidaba para quién hacía todo esto.',
    en: 'This is where he kept his people: his family, his friends and everyone who was there from the start. He opened it whenever he forgot who all of this was for.',
    pista: { es: 'Aparece cuando lees una de sus Memorias.', en: 'It shows up when you read one of his Memories.' },
  },
  teclado: {
    nombre: { es: 'Teclado', en: 'Keyboard' },
    es: 'Cuando ya no quería dibujar, Skulley componía. De estas 25 teclas salieron canciones que todavía suenan en el reproductor.',
    en: "When he didn't feel like drawing, Skulley wrote music. Songs that still play on the jukebox came out of these 25 keys.",
    pista: { es: 'Aparece cuando le rayas el disco al reproductor.', en: 'It shows up when you scratch the record on the player.' },
  },
  cerillos: {
    nombre: { es: 'Cerillos', en: 'Matches' },
    es: 'Se la regaló su novia y Skulley la guardó como un tesoro. Solo usó un cerillo: el que ves quemado.',
    en: 'His girlfriend gave it to him and Skulley kept it like a treasure. He only ever used one match: the burnt one.',
    pista: { es: 'Argus sabe algo de quien anda quemando los pétalos del camino.', en: 'Argus knows something about whoever keeps burning the petals on the path.' },
  },
  almohada: {
    nombre: { es: 'Almohada', en: 'Pillow' },
    es: 'Donde Skulley soñaba. Muchas de sus mejores ideas llegaron justo antes de quedarse dormido.',
    en: 'Where Skulley dreamed. Many of his best ideas showed up right before he fell asleep.',
    pista: { es: 'Argus la guarda para quien haga 1,000 puntos en una partida.', en: 'Argus keeps it for whoever scores 1,000 points in one game.' },
  },
}

// ---------------------------------------------------------------- el iPad: tres proyectos con M.A.D.R.E.

export const MISION_IPAD = { proyectos: 3 }
const LLAVE_IPAD = 'skulley_mision_ipad'

function leerVistos() {
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE_IPAD) || '[]')
    if (Array.isArray(g)) return new Set(g.filter((s) => typeof s === 'string'))
  } catch { /* sin almacenamiento */ }
  return new Set()
}
let vistos = leerVistos()

/** Un proyecto que ella te enseñó y ya cerraste. Regresa cuántos distintos van. */
export function proyectoVistoConMadre(slug) {
  if (!slug) return vistos.size
  vistos.add(String(slug))
  try { localStorage.setItem(LLAVE_IPAD, JSON.stringify([...vistos])) } catch { /* en memoria */ }
  return vistos.size
}

/** Ya toca que ella entregue el iPad (y todavía no lo tienes). */
export function entregaIpadLista() {
  return misionesAbiertas() && !yaObtenida('ipad') && vistos.size >= MISION_IPAD.proyectos
}

/** Regresaste de un proyecto que te enseñó M.A.D.R.E.: lo cuenta y ella lo comenta (o entrega el iPad). */
export function comentarProyecto(slug) {
  if (!slug) return
  proyectoVistoConMadre(slug)
  if (entregaIpadLista()) avisarDron({ comenta: slug, entrega: { id: 'ipad', vistos: vistos.size, alEmpezar: () => ganarOfrenda('ipad') } })
  else avisarDron({ comenta: slug })
}

// ---------------------------------------------------------------- las otras cinco (Oscar, 2026-11-26)
// Cada una se cumple con algo que ya existe en el sitio y la entrega quien la "vio":
//   cámara    bajar un wallpaper 4K del Inventario (DesktopWallpaper)        → M.A.D.R.E.
//   teclado   rayar el disco del reproductor (MusicPlayer)                   → M.A.D.R.E.
//   álbum     leer una de sus Memorias (Section5, el blog)                   → M.A.D.R.E.
//   cerillos  quemar pétalos con la bola de fuego (PetalosCamino)            → Argus
//   almohada  hacer `MISION.puntos` en una partida del trato                 → Argus
// Cumplida (`misionHecha`) se guarda en el navegador; la entrega llega después, cuando la home está libre
// y nadie habla: App llama `intentarEntrega` cada rato y le avisa a quien la da (`entrega: { id,
// alEmpezar }`). Ella vuela hacia Skulley; Argus no se mueve: se la da con Skulley cerca y, de lejos, lo
// llama (ZoidianNPC). Si no pueden hablar no pasa nada: se vuelve a intentar.

export const ENTREGA = { leica: 'madre', teclado: 'madre', album: 'madre', cerillos: 'argus', almohada: 'argus' }
export const MISION = {
  petalos: 30,       // pétalos prendidos (en total) para los cerillos
  puntos: 1000,      // puntos en una partida para la almohada
  leerS: 8,          // segundos con una memoria abierta para el álbum
  rayadoRad: Math.PI * 1.5, // lo que hay que mover el disco con la mano (radianes) para el teclado
  reintento: { madre: 15, argus: 4 }, // cada cuánto se vuelve a pedir la entrega (s)
}
export const EVENTO_HECHA = 'mision-ofrenda-hecha'
const LLAVE_HECHAS = 'skulley_misiones_hechas'

function leerHechas() {
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE_HECHAS) || '[]')
    if (Array.isArray(g)) return new Set(g.filter((id) => ENTREGA[id]))
  } catch { /* sin almacenamiento */ }
  return new Set()
}
let hechas = leerHechas()

/** Cumpliste lo que pide esa misión: queda pendiente de que te la entreguen. */
export function misionHecha(id) {
  if (!ENTREGA[id] || hechas.has(id) || !misionesAbiertas() || yaObtenida(id)) return false
  hechas.add(id)
  try { localStorage.setItem(LLAVE_HECHAS, JSON.stringify([...hechas])) } catch { /* en memoria */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_HECHA, { detail: { id } })) } catch { /* sin window */ }
  return true
}

/** La primera que esa persona ya te debe ('madre' | 'argus'), o null. */
export function entregaPendiente(quien) {
  if (!misionesAbiertas()) return null
  return OFRENDAS.find((o) => ENTREGA[o.id] === quien && hechas.has(o.id) && !yaObtenida(o.id))?.id ?? null
}

let quemados = 0
/** PetalosCamino: prendieron `n` pétalos más. */
export function petalosQuemados(n) {
  if (!n || hechas.has('cerillos')) return
  quemados += n
  if (quemados >= MISION.petalos) misionHecha('cerillos')
}

escucharJuego((tipo) => {
  if (tipo !== 'fin' && tipo !== 'tiempo') return
  if ((scoreStore.get() || 0) >= MISION.puntos) misionHecha('almohada')
})

const intento = {}
/** App, cada rato: si la home está libre (`puede`) y nadie habla, pide la siguiente entrega. */
export function intentarEntrega(puede) {
  if (!puede || !misionesAbiertas() || hablando()) return
  const ahora = performance.now() / 1000
  for (const quien of ['madre', 'argus']) {
    const id = entregaPendiente(quien)
    if (!id || ahora - (intento[id] ?? -Infinity) < MISION.reintento[quien]) continue
    intento[id] = ahora
    const entrega = { id, alEmpezar: () => ganarOfrenda(id) }
    if (quien === 'madre') avisarDron({ entrega })
    else avisarArgus({ entrega })
    return
  }
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__misiones = {
    ganar: ganarOfrenda,
    hecha: misionHecha,
    comentar: comentarProyecto,
    abiertas: misionesAbiertas,
    vistos: () => [...vistos],
    hechas: () => [...hechas],
    pendiente: entregaPendiente,
    quemados: () => quemados,
    olvidar() {
      vistos = new Set(); hechas = new Set(); quemados = 0
      try { localStorage.removeItem(LLAVE_IPAD); localStorage.removeItem(LLAVE_HECHAS) } catch { }
    },
  }
}
