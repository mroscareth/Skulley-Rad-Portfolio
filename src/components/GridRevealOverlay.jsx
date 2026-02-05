import React from 'react'

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

/**
 * GridRevealOverlay - Animated grid transition overlay
 * 
 * SIMPLIFIED: Uses pure CSS without complex state.
 * Animation is controlled directly by the phase and active props.
 */
export default function GridRevealOverlay({
  active = false,
  phase = 'in', // 'in' = cover (0→1), 'out' = reveal (1→0)
  center = [0.5, 0.5],
  cellSize = 40,
  gap = 0,
  inDurationMs = 280,
  outDurationMs = 520,
  delaySpanMs = 420,
  onPhaseEnd,
  forceKey,
}) {
  const [cols, setCols] = React.useState(0)
  const [rows, setRows] = React.useState(0)
  const [ready, setReady] = React.useState(false)

  // Calculate grid
  React.useEffect(() => {
    const recompute = () => {
      const w = Math.max(1, window.innerWidth)
      const h = Math.max(1, window.innerHeight)
      setCols(Math.ceil(w / Math.max(8, cellSize)))
      setRows(Math.ceil(h / Math.max(8, cellSize)))
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [cellSize])

  // When activated, wait one frame for cells to mount
  // before starting the animation
  React.useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }
    // Wait 2 frames for React to mount cells
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setReady(true)
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [active, forceKey])

  // Notify phase end
  React.useEffect(() => {
    if (!active || !ready) return
    const dur = phase === 'in' ? inDurationMs : outDurationMs
    const total = dur + delaySpanMs
    const id = window.setTimeout(() => {
      try { onPhaseEnd?.(phase) } catch {}
    }, total + 50)
    return () => window.clearTimeout(id)
  }, [active, ready, phase, inDurationMs, outDurationMs, delaySpanMs, onPhaseEnd, forceKey])

  if (!active) return null

  const [cx, cy] = [clamp01(center[0]), clamp01(center[1])]
  const dur = phase === 'in' ? inDurationMs : outDurationMs
  // IN: cells go to 1 (black), OUT: cells go to 0 (transparent)
  const targetOpacity = phase === 'in' ? 1 : 0

  const items = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols
      const v = (j + 0.5) / rows
      const dist = Math.sqrt((u - cx) ** 2 + (v - cy) ** 2) / Math.SQRT2
      const d = clamp01(dist)
      // IN: far first (1-d), OUT: near first (d)
      const radial = phase === 'in' ? (1.0 - d) : d
      const delay = Math.round(radial * delaySpanMs)

      items.push(
        <div
          key={`${forceKey}-${i}-${j}`}
          className="grid-reveal-cell"
          style={{
            background: '#000',
            // When ready=false, cells are in initial state (0 for IN, 1 for OUT)
            // When ready=true, cells animate toward target
            opacity: ready ? targetOpacity : (phase === 'in' ? 0 : 1),
            transition: ready ? `opacity ${dur}ms ease` : 'none',
            transitionDelay: ready ? `${delay}ms` : '0ms',
          }}
        />,
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200000] pointer-events-none"
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {items}
    </div>
  )
}
