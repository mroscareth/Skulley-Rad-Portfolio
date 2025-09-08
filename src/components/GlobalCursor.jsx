import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function GlobalCursor() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const coarse = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches
    } catch { return false }
  }, [])
  const hotspot = { x: 6, y: 0 }
  const hideUntilTsRef = useRef(0)

  useEffect(() => {
    if (coarse) return
    const html = document.documentElement
    html.classList.add('has-custom-cursor')
    const onMove = (e) => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // ocultar si el path contiene un nodo con data-hide-cursor="true"
      try {
        const path = e.composedPath ? e.composedPath() : (e.path || [])
        const inHiddenZone = Array.isArray(path) && path.some((n) => {
          try { return n && n.getAttribute && n.getAttribute('data-hide-cursor') === 'true' } catch { return false }
        })
        setVisible(!inHiddenZone)
      } catch { setVisible(true) }
      setPos({ x: e.clientX || 0, y: e.clientY || 0 })
    }
    const onEnter = () => setVisible(true)
    const onLeave = () => setVisible(false)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerenter', onEnter, { passive: true })
    window.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerenter', onEnter)
      window.removeEventListener('pointerleave', onLeave)
      html.classList.remove('has-custom-cursor')
    }
  }, [coarse])

  if (coarse) return null
  return (
    <img
      src={`${import.meta.env.BASE_URL}hand-pointer.svg`}
      alt="cursor"
      aria-hidden
      style={{
        position: 'fixed',
        left: `${Math.max(0, pos.x - hotspot.x)}px`,
        top: `${Math.max(0, pos.y - hotspot.y)}px`,
        width: '28px',
        height: '28px',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 999999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 100ms linear',
        imageRendering: 'crisp-edges',
      }}
      draggable={false}
    />
  )
}


