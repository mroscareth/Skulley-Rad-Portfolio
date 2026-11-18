import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { RUNAS, CUERPO } from './fonts.js'
import { rnd } from './GlitchTitle.jsx'

// Subtítulo de M.A.D.R.E., como los de "Watch the story" pero grandes para
// verse sin sonido: amarillos con tinta (rojos en la frase enojada), llegan
// en runas y se glitchean a letras.
const BLOQUES = '█▓▒░'
export function Subtitulo({ texto, durationInFrames, enojo = false, abajo = 0.055 }) {
  const f = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const vertical = height > width
  if (f < 0 || f >= durationInFrames) return null
  const runas = f < 12 || (f < 22 && rnd(7, f, 1) < 0.5)
  const rotas = f >= 12 && f < 24 ? 0.3 * (1 - (f - 12) / 12) : 0
  const txt = rotas ? [...texto].map((c, i) => (c !== ' ' && rnd(f, i, 3) < rotas ? BLOQUES[i % 4] : c)).join('') : texto
  const sale = durationInFrames - f
  const alfa = interpolate(f, [0, 3], [0, 1], { extrapolateRight: 'clamp' }) * interpolate(sale, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  const tiembla = f < 24 || enojo ? (rnd(9, f, 2) - 0.5) * (enojo ? 6 : 4) : 0
  const px = vertical ? width * 0.06 : height * 0.052
  const color = enojo ? '#ff2a1f' : '#f5ff00'
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: vertical ? height * 0.2 : height * abajo, opacity: alfa }}>
      <div style={{
        maxWidth: vertical ? width * 0.86 : width * 0.78, textAlign: 'center', fontFamily: runas ? `${RUNAS}, ${CUERPO}` : `${CUERPO}, sans-serif`,
        fontWeight: 700, fontSize: px, lineHeight: 1.18, color, transform: `translateX(${tiembla}px)`,
        WebkitTextStroke: `${px * 0.16}px #000`, paintOrder: 'stroke fill', textShadow: `0 ${px * 0.08}px 0 #000`,
        letterSpacing: runas ? 0 : '0.01em',
      }}>{txt}</div>
    </AbsoluteFill>
  )
}
