import React, { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { RUNAS, LETRAS } from './fonts.js'

// Título brutalista del spot: cada renglón de orilla a orilla, llega escrito
// en SKULLEYGLYPH, se rompe (bloques █▓▒░, rebanadas corridas, fantasmas en
// magenta y amarillo, temblor) y queda en Luckiest Guy, con tinta negra y
// sombra dura de caricatura. Como el glitch de los títulos del sitio
// (useGlitchRunas / GlitchName), a escala de pantalla completa.

const BLOQUES = '█▓▒░'
export const rnd = (a, b = 0, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

let lienzo = null
const medir = (texto, fuente, px = 200) => {
  if (!lienzo) lienzo = document.createElement('canvas').getContext('2d')
  lienzo.font = `${px}px ${fuente}`
  const m = lienzo.measureText(texto)
  return { w: m.actualBoundingBoxRight + m.actualBoundingBoxLeft, left: m.actualBoundingBoxLeft, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent }
}

const romper = (texto, prob, seed) => [...texto].map((c, i) => (c !== ' ' && rnd(seed, i, 7) < prob ? BLOQUES[Math.floor(rnd(seed, i, 9) * 4)] : c)).join('')

// Estado del glitch en el cuadro f (de dur cuadros).
function fase(f, dur, seed, entra, sinSalida) {
  const salida = dur - f
  if (!sinSalida && salida <= 7) {
    const p = 1 - salida / 7
    return { runas: rnd(seed, f, 3) < 0.55, rotas: 0.45 * p, temblor: 18 * p, rgb: 34 * p, rebanadas: p, escala: 1, alfa: salida <= 1 ? 0 : 1, aplasta: salida <= 3 ? Math.max(0.05, salida / 3) : 1 }
  }
  const g = f - entra
  if (g < 4) return { runas: true, rotas: 0, temblor: 14, rgb: 26, rebanadas: 0.8, escala: interpolate(g, [0, 4], [1.35, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp' }), alfa: g < 0 ? 0 : 1 }
  if (g < 12) return { runas: true, rotas: 0, temblor: 3, rgb: 5, rebanadas: 0, escala: 1, alfa: 1 }
  if (g < 30) {
    const p = (g - 12) / 18
    const letras = rnd(seed, f, 1) < 0.15 + 0.9 * p
    return { runas: !letras, rotas: 0.5 * (1 - p), temblor: 12 * (1 - p) + 2, rgb: 24 * (1 - p) + 3, rebanadas: 1 - p, escala: 1 + 0.04 * (1 - p) * (rnd(seed, f, 2) - 0.5), alfa: 1 }
  }
  const chispa = (f + seed * 13) % 53 < 2
  return { runas: false, rotas: chispa ? 0.15 : 0, temblor: chispa ? 6 : 0, rgb: chispa ? 12 : 0, rebanadas: chispa ? 0.5 : 0, escala: 1, alfa: 1 }
}

/**
 * lineas: renglones (cada uno de orilla a orilla). colores: color por renglón.
 * ancla: 'centro' | 'arriba' | 'abajo'. escalon: cuadros entre renglón y renglón.
 */
export function GlitchTitle({
  lineas, durationInFrames, color = '#ffffff', tinta = '#0b0b0b', fondo = null, margen = 0.04,
  ancla = 'centro', interlinea = 0.025, seed = 1, colores = null, maxAlto = 0.86, escalon = 3, anchoMax = 1, adelanto = 0, sinSalida = false,
}) {
  const frame = useCurrentFrame() + adelanto
  const { width, height } = useVideoConfig()
  const disponible = width * (1 - margen * 2) * anchoMax

  const medidas = useMemo(() => lineas.map((l) => {
    const L = medir(l, LETRAS)
    const R = medir(l, RUNAS)
    const px = (200 * disponible) / L.w
    return { px, L, R, alto: ((L.asc + L.desc) * px) / 200 }
  }), [lineas.join('|'), disponible])

  if (frame - adelanto < 0 || frame - adelanto >= durationInFrames) return null
  const gap = height * interlinea
  let total = medidas.reduce((s, m) => s + m.alto, 0) + gap * (lineas.length - 1)
  const k = Math.min(1, (height * maxAlto) / total)
  total *= k
  let y = ancla === 'arriba' ? height * 0.07 : ancla === 'abajo' ? height * 0.93 - total : (height - total) / 2

  return (
    <AbsoluteFill style={{ background: fondo || 'transparent' }}>
      {medidas.map((m, i) => {
        const st = fase(frame, durationInFrames + adelanto, seed + i * 7, i * escalon, sinSalida)
        const px = m.px * k
        const alto = m.alto * k
        const top = y
        y += alto + gap * k
        if (!st.alfa) return null
        const texto = st.rotas ? romper(lineas[i], st.rotas, seed * 31 + frame + i) : lineas[i]
        const M = st.runas ? m.R : m.L
        const anchoL = (m.L.w * px) / 200
        const sx = st.runas ? m.L.w / m.R.w : 1
        const tintaAlto = ((M.asc + M.desc) * px) / 200
        const bx = (M.left * px) / 200
        const by = (alto - tintaAlto) / 2 + (M.asc * px) / 200
        const fill = colores?.[i] || color
        const sw = Math.max(5, px * 0.05)
        const sombra = Math.max(6, px * 0.045)
        const sh = (j) => (st.temblor ? (rnd(seed + i, frame, 40 + j) - 0.5) * 2 * st.temblor : 0)
        const tr = `translate(${sh(0)}px, ${sh(1)}px) scale(${st.escala}, ${(st.aplasta ?? 1) * st.escala})`
        const svg = (key, { relleno = fill, trazo = tinta, grosor = sw, dx = 0, dy = 0, clip, opacidad = 1 } = {}) => (
          <div key={key} style={{ position: 'absolute', left: (width - anchoL) / 2, top, width: anchoL, height: alto, transform: `${tr} translate(${dx}px, ${dy}px)`, transformOrigin: 'center', clipPath: clip, opacity: opacidad }}>
            <svg width={anchoL} height={alto} style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}>
              <text
                x={0} y={by} transform={`translate(${bx * sx} 0) scale(${sx} 1)`}
                fontFamily={`${st.runas ? RUNAS : LETRAS}, ${LETRAS}`} fontSize={px}
                fill={relleno} stroke={trazo} strokeWidth={grosor} strokeLinejoin="round" paintOrder="stroke"
              >{texto}</text>
            </svg>
          </div>
        )
        const capas = [svg('sombra', { relleno: tinta, dx: sombra, dy: sombra })]
        if (st.rgb) {
          capas.push(svg('mag', { relleno: '#ff2bd6', trazo: 'none', dx: -st.rgb, opacidad: 0.92 }))
          capas.push(svg('ama', { relleno: '#00e5ff', trazo: 'none', dx: st.rgb, opacidad: 0.85 }))
        }
        if (st.rebanadas > 0.05) {
          let acc = 0
          for (let s = 0; s < 6 && acc < 100; s++) {
            const h = s === 5 ? 100 - acc : 8 + rnd(seed + i, frame, 60 + s) * 24
            const dx = (rnd(seed + i, frame, 80 + s) - 0.5) * 2 * 70 * st.rebanadas
            capas.push(svg('r' + s, { dx, clip: `inset(${acc}% -30% ${Math.max(0, 100 - acc - h)}% -30%)` }))
            acc += h
          }
        } else capas.push(svg('principal'))
        return <React.Fragment key={i}>{capas}</React.Fragment>
      })}
    </AbsoluteFill>
  )
}
