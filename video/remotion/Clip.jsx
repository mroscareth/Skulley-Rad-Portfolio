import React from 'react'
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'

// Una toma grabada (4K, 60 fps) puesta en el cuadro: en horizontal llena la
// pantalla; en vertical se recorta alrededor de `foco` (0..1 del ancho de la
// toma). `zoom` acerca digitalmente (la toma es 4K, así que en 1080p un zoom
// de 2 sigue nítido) hacia `foco` / `focoY`; ambos se pueden animar con
// [inicio, fin] y `curva`.
const val = (v, p) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * p : v)

export function Clip({ src, desde, vel = 1, durationInFrames, foco = 0.5, focoV, focoY = 0.5, zoom = 1, zoomV, curva = 'inOut', espejo = false, filtro, fuente = [3840, 2160], encaja }) {
  const frame = useCurrentFrame()
  const vc = useVideoConfig()
  const fps = vc.fps
  const [width, height] = encaja || [vc.width, vc.height]
  const vertical = vc.height > vc.width
  const p = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: curva === 'lineal' ? Easing.linear : curva === 'out' ? Easing.out(Easing.cubic) : curva === 'in' ? Easing.in(Easing.cubic) : Easing.inOut(Easing.cubic),
  })
  const [SW, SH] = fuente
  const z = val(vertical && zoomV != null ? zoomV : zoom, p)
  const fx = val(vertical && focoV != null ? focoV : foco, p)
  const fy = val(focoY, p)
  // Escala base: cubrir el cuadro.
  const base = Math.max(width / SW, height / SH)
  const s = base * z
  const w = SW * s, h = SH * s
  // El foco queda al centro del cuadro, sin dejar ver orillas.
  let x = width / 2 - fx * w
  let y = height / 2 - fy * h
  x = Math.min(0, Math.max(width - w, x))
  y = Math.min(0, Math.max(height - h, y))
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <OffthreadVideo
        src={staticFile(`raw/${src}.mp4`)}
        trimBefore={Math.round(desde * fps)}
        playbackRate={vel}
        muted
        style={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: espejo ? 'scaleX(-1)' : undefined, filter: filtro }}
      />
    </AbsoluteFill>
  )
}
