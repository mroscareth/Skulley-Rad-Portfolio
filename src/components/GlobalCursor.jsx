import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function GlobalCursor() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  // Estado de grab del top-down camera. '' = cursor normal (hand-pointer),
  // 'grab' = mano abierta (hover, listo para arrastrar), 'grabbing' = puño
  // cerrado (arrastrando). Lo dispara CameraController vía CustomEvent.
  const [grabState, setGrabState] = useState('')
  const coarse = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches
    } catch { return false }
  }, [])
  // Hotspot del cursor en píxeles del SVG (24x24 viewBox → 28x28 render).
  // Para hand-pointer (índice apuntando arriba) el hotspot es la punta.
  // Para grab/grabbing (centro de la palma) ajustamos al centro del icono.
  const hotspot = grabState ? { x: 14, y: 14 } : { x: 6, y: 0 }
  const hideUntilTsRef = useRef(0)

  useEffect(() => {
    if (coarse) return
    const html = document.documentElement
    html.classList.add('has-custom-cursor')
    const onMove = (e) => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // hide if the path contains a node with data-hide-cursor="true"
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
    const onGrab = (e) => {
      try {
        const s = e?.detail?.state || ''
        if (s === 'grab' || s === 'grabbing' || s === '') setGrabState(s)
      } catch { }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerenter', onEnter, { passive: true })
    window.addEventListener('pointerleave', onLeave, { passive: true })
    window.addEventListener('camera-grab', onGrab)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerenter', onEnter)
      window.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('camera-grab', onGrab)
      html.classList.remove('has-custom-cursor')
    }
  }, [coarse])

  // Asset del cursor: por defecto hand-pointer; en top-down hover = hand-grab;
  // en drag = hand-grabbing.
  const cursorSrc = grabState === 'grabbing' ? 'hand-grabbing.svg'
    : grabState === 'grab' ? 'hand-grab.svg'
    : 'hand-pointer.svg'

  if (coarse) return null
  return (
    <img
      src={`${import.meta.env.BASE_URL}${cursorSrc}`}
      alt=""
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






