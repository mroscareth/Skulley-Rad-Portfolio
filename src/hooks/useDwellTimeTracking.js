import { useRef, useEffect, useCallback } from 'react'

// Section ID → analytics name.
const SECTION_NAMES = {
  home: 'home',
  section1: 'work',
  section2: 'about',
  section3: 'store',
  section4: 'contact',
  section5: 'blog',
}

// React-level section dwell-time tracker (no IntersectionObserver).
// Accumulates time per section id and flushes to /api/analytics.php every 30s + on unload.
// Pauses when the tab is hidden. Single source of truth for "how long did the user
// actually spend on this section".
//
// Caller: App.jsx, passing the current `section` id.
export default function useDwellTimeTracking(section) {
  const sectionStartRef = useRef(Date.now())
  const prevSectionRef = useRef(SECTION_NAMES[section] || section)
  const accumRef = useRef({}) // { sectionName: totalMs }

  const flush = useCallback(() => {
    // Opt-out del dueño: la bandera la resuelve el preámbulo de index.html a
    // partir de la cookie `mroscar_notrack`. Se checa acá y no al montar el
    // hook porque el toggle del CMS puede cambiarla sin recargar.
    if (typeof window !== 'undefined' && window.__madreNoTrack) return

    const accum = accumRef.current
    // Add current section's elapsed time
    const currentSection = prevSectionRef.current
    if (currentSection && sectionStartRef.current) {
      const elapsed = Date.now() - sectionStartRef.current
      if (elapsed > 500) {
        accum[currentSection] = (accum[currentSection] || 0) + elapsed
      }
    }

    const sections = []
    for (const id in accum) {
      if (accum[id] > 500) {
        sections.push({ section: id, duration_ms: Math.round(accum[id]) })
      }
    }
    if (!sections.length) return

    const sessionId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('_madre_sid') : null
    if (!sessionId) return

    try {
      const body = JSON.stringify({ session_id: sessionId, sections })
      const url = '/api/analytics.php?action=track_time'
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => { })
      }
    } catch { }

    // Reset accumulator and restart timer for current section
    accumRef.current = {}
    sectionStartRef.current = Date.now()
  }, [])

  // Track section changes: flush previous section's time to the accumulator.
  useEffect(() => {
    const prev = prevSectionRef.current
    const current = SECTION_NAMES[section] || section
    if (prev && prev !== current) {
      const elapsed = Date.now() - sectionStartRef.current
      if (elapsed > 500) {
        accumRef.current[prev] = (accumRef.current[prev] || 0) + elapsed
      }
    }
    sectionStartRef.current = Date.now()
    prevSectionRef.current = current
  }, [section])

  // Flush every 30s and on unload/pagehide.
  useEffect(() => {
    const interval = setInterval(flush, 30000)
    const onUnload = () => flush()
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('pagehide', onUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [flush])

  // Pause/resume on tab visibility.
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        const elapsed = Date.now() - sectionStartRef.current
        const sec = prevSectionRef.current
        if (sec && elapsed > 500) {
          accumRef.current[sec] = (accumRef.current[sec] || 0) + elapsed
        }
        sectionStartRef.current = 0
      } else {
        sectionStartRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [])
}
