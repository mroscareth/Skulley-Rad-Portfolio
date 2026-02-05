import React from 'react'

export default function MobileJoystick({ bottomPx = 140, leftPx = 16, radius = 64, centerX = false, style: styleOverride = null, className = '' }) {
  const padRef = React.useRef(null)
  const knobRef = React.useRef(null)
  const activeRef = React.useRef(false)
  const centerRef = React.useRef({ x: 0, y: 0 })
  const dirRef = React.useRef({ up: false, down: false, left: false, right: false })

  const setKeys = React.useCallback((u, d, l, r) => {
    const prev = dirRef.current
    const emit = (type, key) => {
      try { window.dispatchEvent(new KeyboardEvent(type, { key })) } catch {}
    }
    if (u !== prev.up) emit(u ? 'keydown' : 'keyup', 'w')
    if (d !== prev.down) emit(d ? 'keydown' : 'keyup', 's')
    if (l !== prev.left) emit(l ? 'keydown' : 'keyup', 'a')
    if (r !== prev.right) emit(r ? 'keydown' : 'keyup', 'd')
    dirRef.current = { up: u, down: d, left: l, right: r }
  }, [])

  const reset = React.useCallback(() => {
    setKeys(false, false, false, false)
    if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%) translate(0px, 0px)'
  }, [setKeys])

  React.useEffect(() => () => reset(), [reset])

  const updateFromPoint = React.useCallback((clientX, clientY) => {
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    centerRef.current = { x: cx, y: cy }
    const dx = clientX - cx
    const dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) // x-right, y-down
    const maxR = radius * 0.8
    const clamped = dist > maxR ? maxR : dist
    const kx = Math.cos(angle) * clamped
    const ky = Math.sin(angle) * clamped
    if (knobRef.current) knobRef.current.style.transform = `translate(-50%, -50%) translate(${kx}px, ${ky}px)`
    // Analog vector (global) for smooth Player consumption (x: right+, y: down+)
    try {
      const nx = (clamped > 0 ? (kx / maxR) : 0)
      const ny = (clamped > 0 ? (ky / maxR) : 0)
      // publish normalized vector and magnitude
      // positive y is screen-down; Player inverts Y axis for z-forward
      // Note: key fallback is also maintained for compatibility
      // eslint-disable-next-line no-underscore-dangle
      window.__joystick = { active: true, x: nx, y: ny, mag: Math.min(1, clamped / maxR), ts: performance.now() }
    } catch {}
    // Map to 8 directions but emit 4 booleans as fallback
    const dead = 10
    const up = dy < -dead
    const down = dy > dead
    const left = dx < -dead
    const right = dx > dead
    setKeys(up, down, left, right)
  }, [radius, setKeys])

  const baseSize = { width: `${radius * 2}px`, height: `${radius * 2}px` }
  const padStyle = styleOverride
    ? { ...baseSize, ...(styleOverride || {}) }
    : (centerX
      ? { ...baseSize, left: '50%', transform: 'translateX(-50%)', bottom: `${bottomPx}px` }
      : { ...baseSize, left: `${leftPx}px`, bottom: `${bottomPx}px` })

  return (
    <div
      ref={padRef}
      className={`fixed z-[12000] select-none touch-none ${className || ''}`}
      style={padStyle}
      onPointerDown={(e) => {
        activeRef.current = true
        try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch {}
        updateFromPoint(e.clientX, e.clientY)
        e.preventDefault()
      }}
      onPointerMove={(e) => {
        if (!activeRef.current) return
        updateFromPoint(e.clientX, e.clientY)
        e.preventDefault()
      }}
      onPointerUp={(e) => {
        activeRef.current = false
        try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
        reset()
        try { window.__joystick = { active: false, x: 0, y: 0, mag: 0, ts: performance.now() } } catch {}
        e.preventDefault()
      }}
      onPointerCancel={(e) => {
        activeRef.current = false
        reset()
        try { window.__joystick = { active: false, x: 0, y: 0, mag: 0, ts: performance.now() } } catch {}
        e.preventDefault()
      }}
    >
      <div
        className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm border border-white/15"
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
      />
      <div
        ref={knobRef}
        className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/60 border border-white/80"
        style={{ transform: 'translate(-50%, -50%) translate(0px, 0px)', boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}
      />
    </div>
  )
}


