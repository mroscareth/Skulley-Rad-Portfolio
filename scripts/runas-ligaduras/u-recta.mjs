// La U más recta (Oscar, 2026-11-10: "creo que es demasiado curva"). Conserva
// su idea, una copa con su gota adentro, con lados rectos y esquinas como las
// de las favoritas M N O P Q R.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const gota = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.9, bend: 0.06 })
const copa = (pts, fillet = 0.6) => Br(pts, { end: null, fillet })

export const U_OPC = {
  'U (hoy)': U.U,
  'U-1 · Copa recta: lados rectos y fondo plano': [copa([[0.55, 0.5], [0.55, 5.3], [3.45, 5.3], [3.45, 0.5]]), gota(2.0, 1.1, 2.0, 3.1)],
  'U-2 · Copa que se abre: más ancha arriba': [copa([[0.2, 0.5], [0.95, 5.3], [3.05, 5.3], [3.8, 0.5]]), gota(2.0, 1.1, 2.0, 3.1)],
  'U-3 · Copa recta con pestañas arriba': [copa([[0.0, 0.7], [0.7, 0.7], [0.7, 5.3], [3.3, 5.3], [3.3, 0.7], [4.0, 0.7]], 0.45), gota(2.0, 1.3, 2.0, 3.3)],
}

function palabra(glyphs, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const ss of glyphs) {
    if (!ss) { x += 2; continue }
    const bs = nibBoxes(ss, BOLD)
    const left = Math.min(...bs.map(([bx, , w, hh]) => bx - Math.max(w, hh * 0.3))), right = Math.max(...bs.map(([bx, , w, hh]) => bx + Math.max(w, hh * 0.3)))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.0, x1: x, y1: 7.1 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}
const FAV = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
const rows = [{ label: 'SKULLEYGLYPH · la U más recta', size: 28, bold: true, opacity: 1 }]
for (const [label, g] of Object.entries(U_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([g, null, ...FAV, null, U.S, U.K, g, S5.LIGATURES.LL, U.E, U.Y], 36))
}
console.log(await sheet(rows, 'u-recta.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
