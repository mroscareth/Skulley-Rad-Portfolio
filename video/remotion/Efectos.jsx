import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { rnd } from './GlitchTitle.jsx'

// Destello de color que se apaga en `dur` cuadros.
export function Destello({ color = '#ffffff', dur = 8, fuerza = 1 }) {
  const f = useCurrentFrame()
  const a = interpolate(f, [0, dur], [fuerza, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (a <= 0) return null
  return <AbsoluteFill style={{ background: color, opacity: a, mixBlendMode: color === '#ffffff' ? 'screen' : 'normal' }} />
}

// Barras de cine (la historia).
export function Barras({ alto = 0.11 }) {
  const { height, width } = useVideoConfig()
  const h = (height > width ? width * 0.2 : height * alto)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000' }} />
    </AbsoluteFill>
  )
}

// Rebanadas de glitch sobre la imagen en un corte: franjas que se corren de
// color (sin duplicar el video: son bandas de color con mezcla).
export function CorteGlitch({ dur = 10, seed = 3 }) {
  const f = useCurrentFrame()
  const { width, height } = useVideoConfig()
  if (f >= dur) return null
  const p = 1 - f / dur
  const bandas = []
  for (let i = 0; i < 9; i++) {
    if (rnd(seed, f, i) > 0.55 * p + 0.15) continue
    const y = rnd(seed, f, 20 + i) * height
    const h = 6 + rnd(seed, f, 40 + i) * height * 0.08
    const color = ['#ff2bd6', '#00e5ff', '#f5ff00', '#ffffff', '#000000'][Math.floor(rnd(seed, f, 60 + i) * 5)]
    const x = (rnd(seed, f, 80 + i) - 0.5) * width * 0.3
    bandas.push(<div key={i} style={{ position: 'absolute', left: x, top: y, width: width * (0.4 + rnd(seed, f, 90 + i)), height: h, background: color, mixBlendMode: color === '#000000' ? 'normal' : 'difference', opacity: 0.85 }} />)
  }
  return <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>{bandas}</AbsoluteFill>
}

// Oscurece la imagen detrás de un título.
export function Velo({ fuerza = 0.45, dur, entra = 4, sale = 6 }) {
  const f = useCurrentFrame()
  const e2 = Math.min(entra, Math.max(1, Math.floor(dur / 3)))
  const s2 = Math.min(sale, Math.max(1, Math.floor(dur / 3)))
  const a = interpolate(f, [0, e2, Math.max(e2 + 1, dur - s2), Math.max(e2 + 2, dur)], [0, fuerza, fuerza, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: '#000', opacity: a }} />
}
