import { useEffect, useRef } from 'react'

// Periodic memory/resource watchdog for the WebGL scene.
// Checks JS heap + three.js textures/geometries every 60s; if they exceed
// the very high thresholds it re-enters degraded mode. degradedMode is now
// the default (always on) for smooth performance, so this is a safety net
// in case something toggled it off.
//
// Params:
//   glRef: ref to the renderer (r3f Canvas gives us this via onCreated).
//   setDegradedMode: setter from App state.
export default function useMemoryWatchdog({ glRef, setDegradedMode }) {
  const degradeCountRef = useRef(0)

  useEffect(() => {
    const tick = () => {
      try {
        const info = glRef.current?.info?.memory
        const heap = (typeof performance !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0
        const heapMB = heap ? Math.round(heap / (1024 * 1024)) : 0
        const textures = info?.textures || 0
        const geometries = info?.geometries || 0
        // Very high thresholds - only activate in extreme cases
        const HEAP_HIGH = 2000 // MB - degrade threshold
        const TEX_HIGH = 8000  // textures to degrade
        const GEO_HIGH = 6000  // geometries to degrade

        if (import.meta.env?.DEV && (heapMB > 500 || textures > 100 || geometries > 100)) {
          // eslint-disable-next-line no-console
          console.log('[Perf] Memory status:', { heapMB, textures, geometries })
        }

        setDegradedMode((prev) => {
          if (prev) return true // already degraded, stay there
          const shouldDegrade = (heapMB > HEAP_HIGH) || (textures > TEX_HIGH) || (geometries > GEO_HIGH)
          if (shouldDegrade) {
            degradeCountRef.current = 3
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.log('[Perf] Re-entering degraded mode:', { heapMB, textures, geometries })
            }
            return true
          }
          return false
        })
      } catch { }
    }
    const id = window.setInterval(tick, 60000) // every 60s - don't check too frequently
    return () => window.clearInterval(id)
  }, [glRef, setDegradedMode])
}
