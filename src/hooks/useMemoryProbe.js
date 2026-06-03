import { useEffect, useRef } from 'react'

// Memory/resource probe (DIAGNÓSTICO, no es safety net — eso es useMemoryWatchdog).
// Apagado por default. Se enciende con ?debug=mem en la URL o
// localStorage.debug_mem=1. Cada SAMPLE_MS loguea la TENDENCIA con deltas vs la
// muestra anterior → lo que crece monotónicamente delata el leak:
//   - tex/geo/prog: recursos GPU vivos en el renderer (texturas, geometrías,
//     programas de shader). Si suben sin parar → leak de recursos Three.js.
//   - heap: JS heap (solo Chromium expone performance.memory).
//   - canvas: nº de <canvas> en el DOM → si sube, hay contextos WebGL
//     acumulándose (secciones que montan canvas y no se liberan).
//   - dom: nº de nodos del DOM → leak de nodos (listeners/overlays que no se
//     desmontan).
//   - listeners: estimación de listeners globales registrados (parcheamos
//     window.addEventListener para contar; solo en modo probe).
// Las muestras se guardan en window.__memProbe (con .dump() → console.table) por
// si querés inspeccionarlas en desktop tras reproducir el patrón.
//
// Params:
//   glRef: ref al renderer principal (mismo que useMemoryWatchdog).
const SAMPLE_MS = 15000

function probeEnabled() {
  try {
    if (typeof window === 'undefined') return false
    const qs = new URLSearchParams(window.location.search)
    if ((qs.get('debug') || '').split(',').includes('mem')) return true
    if (window.localStorage?.getItem('debug_mem') === '1') return true
  } catch { }
  return false
}

export default function useMemoryProbe({ glRef }) {
  const prevRef = useRef(null)
  const listenerCountRef = useRef(0)

  useEffect(() => {
    if (!probeEnabled()) return undefined

    // Contador de addEventListener globales (window/document) para detectar
    // listeners que se acumulan. Solo activo en modo probe; restauramos al salir.
    const targets = [window, document]
    const originals = []
    for (const tgt of targets) {
      const origAdd = tgt.addEventListener
      const origRemove = tgt.removeEventListener
      originals.push([tgt, origAdd, origRemove])
      tgt.addEventListener = function patchedAdd(...args) {
        listenerCountRef.current += 1
        return origAdd.apply(this, args)
      }
      tgt.removeEventListener = function patchedRemove(...args) {
        listenerCountRef.current = Math.max(0, listenerCountRef.current - 1)
        return origRemove.apply(this, args)
      }
    }

    // Persistencia: cada tick guardamos las últimas muestras en localStorage. Si
    // la pestaña truena (OOM), tras recargar siguen ahí → vemos la tendencia de
    // JUSTO ANTES del crash sin necesidad de inspector remoto conectado.
    const LS_KEY = 'mem_probe_log'
    const PERSIST_MAX = 80 // ~20 min de historia

    let previousSession = []
    try {
      const raw = window.localStorage?.getItem(LS_KEY)
      if (raw) previousSession = JSON.parse(raw) || []
    } catch { /* noop */ }

    const store = (window.__memProbe = window.__memProbe || {
      samples: [],
      previous: previousSession,
      dump() { try { console.table(this.samples) } catch { /* noop */ } },
      // Imprime la sesión ANTERIOR (la que terminó en crash). Útil tras recargar.
      last() { try { console.table(this.previous) } catch { /* noop */ } },
      clear() { try { window.localStorage?.removeItem(LS_KEY) } catch { /* noop */ } },
    })

    if (previousSession.length) {
      // eslint-disable-next-line no-console
      console.log(`[MemProbe] sesión anterior: ${previousSession.length} muestras persistidas. window.__memProbe.last() para ver la tendencia pre-crash.`)
    }

    const fmt = (cur, prev) => {
      const d = prev == null ? 0 : cur - prev
      const sign = d > 0 ? `+${d}` : `${d}`
      return `${cur} (${sign})`
    }

    const tick = () => {
      try {
        const info = glRef.current?.info
        const mem = info?.memory || {}
        const programs = Array.isArray(info?.programs) ? info.programs.length : 0
        const heap = (typeof performance !== 'undefined' && performance.memory)
          ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 0
        const canvases = document.getElementsByTagName('canvas').length
        const domNodes = document.getElementsByTagName('*').length
        const sample = {
          t: Math.round((store.samples.length * SAMPLE_MS) / 1000), // seg desde el 1er tick
          tex: mem.textures || 0,
          geo: mem.geometries || 0,
          prog: programs,
          heapMB: heap,
          canvas: canvases,
          dom: domNodes,
          listeners: listenerCountRef.current,
        }
        const p = prevRef.current
        // eslint-disable-next-line no-console
        console.log(
          `[MemProbe ${sample.t}s] tex ${fmt(sample.tex, p?.tex)} | geo ${fmt(sample.geo, p?.geo)} | `
          + `prog ${fmt(sample.prog, p?.prog)} | heap ${fmt(sample.heapMB, p?.heapMB)}MB | `
          + `canvas ${fmt(sample.canvas, p?.canvas)} | dom ${fmt(sample.dom, p?.dom)} | `
          + `listeners ${fmt(sample.listeners, p?.listeners)}`
        )
        store.samples.push(sample)
        if (store.samples.length > 500) store.samples.shift()
        prevRef.current = sample
        // Persistir las últimas PERSIST_MAX muestras (sobreviven al crash+reload).
        try {
          const tail = store.samples.slice(-PERSIST_MAX)
          window.localStorage?.setItem(LS_KEY, JSON.stringify(tail))
        } catch { /* quota/serialize noop */ }
      } catch { /* noop */ }
    }

    tick()
    const id = window.setInterval(tick, SAMPLE_MS)
    // eslint-disable-next-line no-console
    console.log('[MemProbe] activo — deltas cada 15s. window.__memProbe.dump() para tabla.')
    return () => {
      window.clearInterval(id)
      for (const [tgt, origAdd, origRemove] of originals) {
        tgt.addEventListener = origAdd
        tgt.removeEventListener = origRemove
      }
    }
  }, [glRef])
}
