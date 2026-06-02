// Babosas de slime — coleccionable oculto (reto de exploración). Hay 5 babosas
// escondidas por el sitio; juntarlas TODAS desbloquea la skin Green Slime
// (achievement 'skin_slime', el unlock real vive en App.jsx escuchando
// 'slime-slugs-changed').
//
// Patrón slot-único en localStorage, igual que useActiveDiscount: un Set de ids
// coleccionadas persistido como JSON array + CustomEvent para sync entre
// instancias/tabs. El progreso parcial NO migra entre dispositivos (solo local);
// el logro final sí migra vía useAchievements.

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'skulley_slime_slugs'
export const SLIME_SLUGS_EVENT = 'slime-slugs-changed'

// Las 5 ubicaciones (ids estables). NO documentar dónde está cada una en UI
// visible al usuario — es un reto.
export const SLUG_IDS = ['portal', 'about', 'work', 'wander', 'music']
export const SLUG_TOTAL = SLUG_IDS.length

function readSet() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    // Solo ids válidas conocidas.
    return new Set(arr.filter((id) => SLUG_IDS.includes(id)))
  } catch {
    return new Set()
  }
}

function writeSet(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch { }
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(SLIME_SLUGS_EVENT)) } catch { }
}

/** ids ya coleccionadas (Set). */
export function readCollected() {
  return readSet()
}

/** ¿ya se coleccionó esta babosa? */
export function hasSlug(id) {
  return readSet().has(id)
}

/** cuántas babosas lleva (0..5). */
export function getCount() {
  return readSet().size
}

/**
 * Marca una babosa como coleccionada. Devuelve true solo si era nueva (para
 * disparar SFX/toast una sola vez). Emite SLIME_SLUGS_EVENT en ese caso.
 */
export function collectSlug(id) {
  if (!SLUG_IDS.includes(id)) return false
  const set = readSet()
  if (set.has(id)) return false
  set.add(id)
  writeSet(set)
  emit()
  return true
}

/** Hook reactivo para la UI (progreso X/5 y estado de cada babosa). */
export function useSlimeSlugs() {
  const [collected, setCollected] = useState(() => readSet())

  useEffect(() => {
    const onStorage = (e) => { if (e.key === LS_KEY) setCollected(readSet()) }
    const onLocal = () => setCollected(readSet())
    window.addEventListener('storage', onStorage)
    window.addEventListener(SLIME_SLUGS_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SLIME_SLUGS_EVENT, onLocal)
    }
  }, [])

  const collect = useCallback((id) => collectSlug(id), [])

  return {
    collected,
    count: collected.size,
    total: SLUG_TOTAL,
    complete: collected.size >= SLUG_TOTAL,
    has: useCallback((id) => collected.has(id), [collected]),
    collect,
  }
}
