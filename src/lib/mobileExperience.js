import { useEffect, useState } from 'react'

// ¿Esta visita se lleva la versión de teléfono?
//
// El sitio completo monta dos contextos WebGL (la escena de home y el retrato),
// el personaje riggeado dos veces y el mundo entero alrededor. Un teléfono no
// lo sostiene, así que ahí servimos otro árbol: la home que se desarma con el
// scroll + los capítulos.
//
// Criterio (Oscar, 2026-10-30): teléfonos Y pantallas muy chicas se llevan esta
// versión; los iPads se quedan con la de escritorio, que ahí funciona bien.
//
//   1. Teléfono: puntero grueso + LADO CORTO <= 640 px. El lado corto y no el
//      ancho: un iPhone acostado mide 844×390 y tiene que seguir aquí.
//   2. Ventana chica: ancho <= 640 px, con cualquier puntero. Así una ventana
//      de escritorio angosta (o el resize) también cae aquí. Un iPad parado
//      mide 768 o más, así que no entra.
//
// Ya no se congela al cargar: `usePhoneExperience` escucha el cruce de los
// 640 px y App.jsx monta el otro árbol (con otra `key`, para que cada uno nazca
// limpio). Girar un teléfono no cambia nada: su lado corto sigue igual.
//
// `pointer: coarse` es lo que de verdad separa un teléfono de una tableta.
// `window.__isMobilePerf` (lo calcula el boot inline de index.html) NO sirve
// como criterio: su heurística incluye laptops con GPU integrada, que sí pueden
// con la experiencia completa.
//
// El mismo criterio vive en el boot inline de index.html (decide si precarga
// el HDRI): los dos tienen que cambiar juntos.

const PHONE_MAX_SIDE_PX = 640
const SMALL_MAX_WIDTH_PX = 640

function readOverride() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('full') === '1') return false
    if (q.get('mobile') === '1') return true
  } catch { /* URL rara: decide la pantalla */ }
  return null
}

// `?full=1` / `?mobile=1` se leen UNA vez, con la URL de llegada: al navegar
// dentro del sitio el query se pierde y la elección tiene que sostenerse.
const OVERRIDE = typeof window === 'undefined' ? null : readOverride()

function detect() {
  if (typeof window === 'undefined') return false
  if (OVERRIDE !== null) return OVERRIDE

  const width = window.innerWidth || 0
  if (width > 0 && width <= SMALL_MAX_WIDTH_PX) return true

  let coarse = false
  try {
    coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
  } catch { /* sin matchMedia: que mande el tamaño */ }
  if (!coarse) return false

  const shortSide = Math.min(width, window.innerHeight || 0)
  return shortSide > 0 && shortSide <= PHONE_MAX_SIDE_PX
}

/** True si en este momento toca la versión de teléfono. */
export function isPhoneExperience() {
  return detect()
}

/**
 * La misma pregunta, en vivo: cambia cuando la ventana cruza los 640 px de
 * ancho. Solo escucha ese cruce (matchMedia), no cada pixel del resize.
 */
export function usePhoneExperience() {
  const [phone, setPhone] = useState(detect)
  useEffect(() => {
    if (OVERRIDE !== null || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(`(max-width: ${SMALL_MAX_WIDTH_PX}px)`)
    const onChange = () => setPhone(detect())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

export default isPhoneExperience
