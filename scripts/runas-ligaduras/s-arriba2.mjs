// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
// Segunda vuelta (Oscar: le gusta la S-2b pero "no queda con las demás, es
// completamente ancha"): toda plancha y sin aire. Las mismas formas, con el
// trazo más delgado y más espacio entre el arco y el rayo.
const S_OPC = {
  'S-2b (hoy)': [Cv([[0.3, 1.9], [0.9, 0.8], [2.2, 0.45], [3.65, 1.0]], { r: R.v, end: null, startTaper: 1.4 }), rayo([[3.65, 1.0], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]])],
  'S-2b-1 · Más delgada': [Cv([[0.3, 1.9], [0.9, 0.8], [2.2, 0.45], [3.65, 1.0]], { r: R.v * 0.72, end: null, startTaper: 1.4 }), rayo([[3.65, 1.0], [0.9, 3.2], [3.35, 3.2], [0.4, 5.5]], { r: R.v * 0.72 })],
  'S-2b-2 · Más delgada, con el arco más arriba y la barra más corta': [Cv([[0.35, 1.5], [0.95, 0.35], [2.2, 0.05], [3.6, 0.55]], { r: R.v * 0.7, end: null, startTaper: 1.3 }), rayo([[3.6, 0.55], [1.2, 3.25], [3.1, 3.25], [0.4, 5.55]], { r: R.v * 0.7 })],
  'S-2b-3 · El arco como cuchilla fina y el rayo delgado': [Cv([[0.3, 1.7], [0.95, 0.55], [2.25, 0.25], [3.6, 0.8]], { r: R.v * 0.55, end: null, startTaper: 1.6 }), rayo([[3.6, 0.8], [1.05, 3.2], [3.3, 3.2], [0.4, 5.55]], { r: R.v * 0.75 })],
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
const rows = [{ label: 'SKULLEYGLYPH · la S-2b con más aire', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-arriba2.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
