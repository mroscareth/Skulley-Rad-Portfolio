// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
const S_OPC = {
  'S-2 (hoy)': [Br([[0.35, 0.95], [3.65, 0.95], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]], { fillet: 0.6 })],
  'S-2a · La barra nace en cuchilla desde arriba a la izquierda': [rayo([[0.15, 0.2], [1.35, 0.95], [3.65, 0.95], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]], { startTaper: 1.6, fillet: 0.9 })],
  'S-2b · Arriba un arco que cae hacia el rayo': [Cv([[0.3, 1.9], [0.9, 0.8], [2.2, 0.45], [3.65, 1.0]], { r: R.v, end: null, startTaper: 1.4 }), rayo([[3.65, 1.0], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]])],
  'S-2c · Una media luna filosa en lugar de la barra': [Dr(0.2, 1.35, 3.75, 0.7, { r: R.v, bend: -0.45 }), rayo([[3.6, 1.15], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]])],
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
const rows = [{ label: 'SKULLEYGLYPH · la S-2 con la parte de arriba en cuchilla o en arco (y la K-A)', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-arriba.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
