import React from 'react'

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

export default function GridRevealOverlay({
  active = false,
  phase = 'in', // 'in' | 'out'
  center = [0.5, 0.5], // UV [0..1] en viewport
  cellSize = 40, // px
  inDurationMs = 280,
  outDurationMs = 520,
  delaySpanMs = 420, // retardo máximo radial
  onPhaseEnd,
  forceKey, // para reiniciar transiciones
}) {
  const [cols, setCols] = React.useState(0)
  const [rows, setRows] = React.useState(0)
  const containerRef = React.useRef(null)
  const rafRef = React.useRef(null)

  const recomputeGrid = React.useCallback(() => {
    try {
      const w = Math.max(1, window.innerWidth)
      const h = Math.max(1, window.innerHeight)
      const c = Math.ceil(w / Math.max(8, cellSize))
      const r = Math.ceil(h / Math.max(8, cellSize))
      setCols(c)
      setRows(r)
    } catch {}
  }, [cellSize])

  React.useEffect(() => {
    recomputeGrid()
    const onR = () => recomputeGrid()
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [recomputeGrid])

  // Notificar fin de fase tras el máximo delay + duración
  React.useEffect(() => {
    if (!active) return
    const maxDim = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5) // ~0.707
    const total = (phase === 'in' ? inDurationMs : outDurationMs) + delaySpanMs
    const id = window.setTimeout(() => { try { onPhaseEnd && onPhaseEnd(phase) } catch {} }, total + 30)
    return () => window.clearTimeout(id)
  }, [active, phase, inDurationMs, outDurationMs, delaySpanMs, onPhaseEnd, forceKey])

  // Forzar el cambio de opacidad en el siguiente frame para disparar transiciones
  // (este efecto debe declararse ANTES de cualquier return para mantener el orden de hooks)
  const cellsCount = cols * rows
  React.useEffect(() => {
    if (!active) return
    if (!containerRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      try {
        const cells = containerRef.current.querySelectorAll('.grid-reveal-cell')
        cells.forEach((el) => {
          const target = Number(el.getAttribute('data-target') || '1')
          el.style.opacity = String(target)
        })
      } catch {}
    })
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, cellsCount, phase, forceKey])

  if (!active) return null

  const [cx, cy] = [clamp01(center[0]), clamp01(center[1])]
  const items = []
  const total = Math.max(1, cols * rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols
      const v = (j + 0.5) / rows
      const du = Math.abs(u - cx)
      const dv = Math.abs(v - cy)
      const dist = Math.sqrt(du * du + dv * dv) / Math.SQRT2 // 0..~0.707 -> normalizamos a 0..1 aprox
      // Para la fase de cubrir (IN): fuera -> dentro (celdas lejanas primero) => delay menor cuanto mayor es dist
      // Para la fase de descubrir (OUT): dentro -> fuera (celdas cercanas primero) => delay mayor cuanto mayor es dist
      const d = Math.max(0, Math.min(1, dist))
      const radial = phase === 'in' ? (1.0 - d) : d
      const delay = Math.round(radial * delaySpanMs)
      const base = phase === 'in' ? 0 : 1
      const target = phase === 'in' ? 1 : 0
      const dur = phase === 'in' ? inDurationMs : outDurationMs
      items.push(
        <div
          key={`${forceKey || 'k'}-${i}-${j}`}
          style={{
            background: '#000',
            opacity: phase === 'in' ? 0 : 1,
            transition: `opacity ${dur}ms ease`,
            transitionDelay: `${delay}ms`,
          }}
          className="grid-reveal-cell"
          data-base={base}
          data-target={target}
        />,
      )
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[90000] pointer-events-none"
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {items}
    </div>
  )
}


