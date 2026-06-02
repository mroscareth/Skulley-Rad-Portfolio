import { useEffect, useRef, useState } from 'react'

// Tracker para la skin Hologram: visitar las 5 secciones de contenido y
// permanecer >= 15s CONTINUOS en cada una. Independiente de useDwellTimeTracking
// (ese es analytics y se resetea cada 30s). Persistimos las secciones ya
// "completadas" en localStorage; al juntar las 5 se llama onComplete().
//
//   useSectionVisitTracking(section, () => unlock('skin_hologram'))

const LS_KEY = 'skulley_holo_sections'
export const HOLO_SECTIONS = ['section1', 'section2', 'section3', 'section4', 'section5']
export const HOLO_EVENT = 'holo-sections-changed'
const REQUIRED = HOLO_SECTIONS
const DWELL_MS = 15000
// Dwell por sección. Contacto (section4) no tiene mucho que explorar → basta
// con visitarla un momento (corto), no 15s. Las sub-rutas (work/proyecto,
// blog/post) cuentan solas porque `section` se mantiene en el padre.
const DWELL_OVERRIDE = { section4: 2000 }

function readSet() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return new Set(Array.isArray(arr) ? arr.filter((s) => REQUIRED.includes(s)) : [])
  } catch {
    return new Set()
  }
}

function writeSet(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch { }
  try { window.dispatchEvent(new CustomEvent(HOLO_EVENT)) } catch { }
}

/** Set de secciones ya completadas (>=15s). Para mostrar progreso en la UI. */
export function readVisitedSections() {
  return readSet()
}

/** Hook reactivo: { visited:Set, has(id), count } para la tarjeta del logro. */
export function useHoloSections() {
  const [visited, setVisited] = useState(() => readSet())
  useEffect(() => {
    const onStorage = (e) => { if (e.key === LS_KEY) setVisited(readSet()) }
    const onLocal = () => setVisited(readSet())
    window.addEventListener('storage', onStorage)
    window.addEventListener(HOLO_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(HOLO_EVENT, onLocal)
    }
  }, [])
  return { visited, count: visited.size, total: HOLO_SECTIONS.length, has: (id) => visited.has(id) }
}

export default function useSectionVisitTracking(section, onComplete) {
  const cbRef = useRef(onComplete)
  cbRef.current = onComplete
  const timerRef = useRef(null)

  useEffect(() => {
    const have = readSet()
    if (have.size >= REQUIRED.length) return // ya completo → no más timers
    if (!REQUIRED.includes(section)) return // home / section6 no cuentan
    if (have.has(section)) return // esta sección ya está marcada

    // Arranca el timer; si cambias de sección antes, el cleanup lo cancela
    // (debe ser permanencia continua). Contacto usa un dwell corto.
    const dwell = DWELL_OVERRIDE[section] ?? DWELL_MS
    timerRef.current = setTimeout(() => {
      const set = readSet()
      set.add(section)
      writeSet(set)
      if (REQUIRED.every((s) => set.has(s))) {
        try { cbRef.current?.() } catch { }
      }
    }, dwell)

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
  }, [section])
}
