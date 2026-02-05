import React from 'react'

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

/**
 * GridRevealOverlay - Overlay de transición con retícula animada
 * 
 * SIMPLIFICADO: Usa CSS puro sin estado complejo.
 * La animación se controla directamente por las props phase y active.
 */
export default function GridRevealOverlay({
  active = false,
  phase = 'in', // 'in' = cubrir (0→1), 'out' = revelar (1→0)
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

  // Calcular grid
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

  // Cuando se activa, esperar un frame para que las celdas se monten
  // antes de iniciar la animación
  React.useEffect(() => {
    if (!active) {
      setReady(false)
      return
    }
    // Esperar 2 frames para que React monte las celdas
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setReady(true)
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [active, forceKey])

  // Notificar fin de fase
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
  // IN: celdas van a 1 (negro), OUT: celdas van a 0 (transparente)
  const targetOpacity = phase === 'in' ? 1 : 0

  const items = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols
      const v = (j + 0.5) / rows
      const dist = Math.sqrt((u - cx) ** 2 + (v - cy) ** 2) / Math.SQRT2
      const d = clamp01(dist)
      // IN: lejanas primero (1-d), OUT: cercanas primero (d)
      const radial = phase === 'in' ? (1.0 - d) : d
      const delay = Math.round(radial * delaySpanMs)

      items.push(
        <div
          key={`${forceKey}-${i}-${j}`}
          className="grid-reveal-cell"
          style={{
            background: '#000',
            // Cuando ready=false, las celdas están en su estado inicial (0 para IN, 1 para OUT)
            // Cuando ready=true, las celdas animan hacia el target
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
