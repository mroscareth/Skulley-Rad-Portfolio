// Las misiones de la ofrenda del Día de los Skulleys (Oscar, 2026-11-25; plan en features.md):
// cada objeto lo da alguien por algo que hiciste en la home. Al ganarlo, Skulley lo carga flotando
// sobre la cabeza (conseguirOfrenda, home/ObjetosOfrenda.jsx) y, cuando nadie está hablando, sale el
// toast con el objeto girando (ToastOfrenda.jsx, lo monta App al oír EVENTO_GANADA).
//
// Mientras `MISIONES_ABIERTAS` (ofrendas.js) sea false nadie gana nada en producción: no se promete
// lo que todavía no está completo. En desarrollo van abiertas, y en producción se pueden probar con
// `localStorage.skulley_misiones = '1'` ('0' las cierra también en desarrollo).
//
// Hoy: el iPad, por ver tres proyectos que te enseñó M.A.D.R.E. Al regresar de cada uno, quien lo
// abrió llama `comentarProyecto(slug)` (App al cerrar la ficha; DialogoMadre al cerrar la charla de
// uno de enlace): lo cuenta y le pide a ella que lo comente; desde el tercero, con `entrega`, y ella
// dice lo de la entrega en lugar del comentario y llama `alEmpezar` (DroneNPC). Si no puede hablar,
// no lo entrega y lo intenta con el siguiente.
// Sin three: lo leen App, DialogoMadre y el toast.

import { MISIONES_ABIERTAS, OFRENDAS, conseguirOfrenda, ofrendaPuesta, ofrendaEnMano } from './ofrendas.js'
import { avisarDron } from './droneNpc.js'

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
// de Oscar; las demás son borradores para que él las ajuste. Skulley ya no está: van en pasado.
export const HISTORIAS = {
  ipad: {
    nombre: { es: 'iPad', en: 'iPad' },
    es: 'El primer sueldo de Skulley como diseñador se fue en un iPad, y desde entonces fue su herramienta favorita para dibujar.',
    en: "Skulley's first paycheck as a designer went on an iPad, and from then on it was his favorite drawing tool.",
  },
  leica: {
    nombre: { es: 'Cámara', en: 'Camera' },
    es: 'Con esta cámara Skulley aprendió a ver: encuadrar, esperar la luz y disparar una sola vez. Muchas de sus composiciones empezaron como fotos.',
    en: 'With this camera Skulley learned to see: frame it, wait for the light and shoot once. Many of his compositions started as photos.',
  },
  album: {
    nombre: { es: 'Álbum', en: 'Album' },
    es: 'Aquí guardaba a su gente: su familia, sus amigos y quienes lo acompañaron desde el principio. Lo abría cuando se le olvidaba para quién hacía todo esto.',
    en: 'This is where he kept his people: his family, his friends and everyone who was there from the start. He opened it whenever he forgot who all of this was for.',
  },
  teclado: {
    nombre: { es: 'Teclado', en: 'Keyboard' },
    es: 'Cuando ya no quería dibujar, Skulley componía. De estas 25 teclas salieron canciones que todavía suenan en el reproductor.',
    en: "When he didn't feel like drawing, Skulley wrote music. Songs that still play on the jukebox came out of these 25 keys.",
  },
  cerillos: {
    nombre: { es: 'Cerillos', en: 'Matches' },
    es: 'Se la regaló su novia y Skulley la guardó como un tesoro. Solo usó un cerillo: el que ves quemado.',
    en: 'His girlfriend gave it to him and Skulley kept it like a treasure. He only ever used one match: the burnt one.',
  },
  almohada: {
    nombre: { es: 'Almohada', en: 'Pillow' },
    es: 'Donde Skulley soñaba. Muchas de sus mejores ideas llegaron justo antes de quedarse dormido.',
    en: 'Where Skulley dreamed. Many of his best ideas showed up right before he fell asleep.',
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

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__misiones = {
    ganar: ganarOfrenda,
    comentar: comentarProyecto,
    abiertas: misionesAbiertas,
    vistos: () => [...vistos],
    olvidar() { vistos = new Set(); try { localStorage.removeItem(LLAVE_IPAD) } catch { } },
  }
}
