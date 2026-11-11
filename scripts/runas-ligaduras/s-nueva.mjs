// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
// S desde cero (Oscar: "otra forma completamente distinta a lo que ya hayas
// creado"): sin rayo. Arcos, cuchillas y huecos como sus favoritas M N O P Q R,
// con el giro de una S.
const P = Math.PI
const hoja = (x1, y1, x2, y2, bend = 0.15) => Dr(x1, y1, x2, y2, { r: R.v, bend })
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
const S_OPC = {
  'S-α · Dos arcos encontrados': [Cv(arc(1.55, 2.15, 1.25, 1.5, P, P), { r: R.v }), Cv(arc(2.45, 3.85, 1.25, 1.5, 0, P), { r: R.v })],
  'S-β · Ensō con dos colas que giran': [Cv(arc(2, 3.0, 1.25, 1.4, -1.9, 5.0), { r: R.v }), hoja(1.15, 1.75, -0.1, 0.25, -0.1), hoja(2.85, 4.25, 4.1, 5.75, -0.1)],
  'S-γ · Arco con un tajo y un punto': [Cv(arc(2, 2.45, 1.7, 1.9, P, P), { r: R.v }), hoja(3.55, 2.6, 0.35, 5.6, 0.2), punto(3.2, 4.85)],
  'S-δ · Dos medias lunas en S': [hoja(3.7, 0.6, 0.5, 2.85, -0.85), hoja(0.3, 3.15, 3.5, 5.45, -0.85), punto(1.95, 2.85)],
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
const MNOPQR = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
const rows = [{ label: 'SKULLEYGLYPH · S desde cero', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-nueva.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
