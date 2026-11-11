// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
// S en bloque, como sellos (Oscar: "otra forma completamente distinta a lo que ya hayas
// creado"): sin rayo. Arcos, cuchillas y huecos como sus favoritas M N O P Q R,
// con el giro de una S.
const P = Math.PI
const hoja = (x1, y1, x2, y2, bend = 0.15) => Dr(x1, y1, x2, y2, { r: R.v, bend })
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
// Tercera vuelta (Oscar: "algo más rúnico", como M N O P Q R): bloques
// compactos como sellos, figura sólida y cuchillas acomodadas, con el giro de
// una S.
const esquina = (pts) => Br(pts, { fillet: 0.5 })
const S_OPC = {
  'S-ι · Caja partida: dos esquinas que giran, con dos cuchillas': [esquina([[0.4, 3.05], [0.4, 0.9], [3.0, 0.9]]), esquina([[3.6, 2.95], [3.6, 5.1], [1.0, 5.1]]), hoja(3.15, 2.35, 3.75, 0.85, 0.12), hoja(0.85, 3.65, 0.25, 5.15, 0.12)],
  'S-ξ · Triángulos encontrados': [closed([[0.3, 0.6], [2.55, 0.6], [1.42, 2.95]]), closed([[1.45, 5.4], [3.7, 5.4], [2.58, 3.05]])],
  'S-ο · Ensō partido en dos, con cuchillas en sus huecos': [Cv(arc(2, 3.0, 1.6, 1.9, 2.75, 2.45), { r: R.v }), Cv(arc(2, 3.0, 1.6, 1.9, -0.4, 2.45), { r: R.v }), hoja(3.0, 1.75, 3.9, 0.3, 0.1), hoja(1.0, 4.25, 0.1, 5.7, 0.1)],
  'S-κ · Arco y copa en bloque, con lados rectos': [Br([[0.35, 3.0], [0.35, 1.5], [0.9, 0.85], [2.35, 0.85], [2.9, 1.5], [2.9, 2.6]], { fillet: 0.55 }), Br([[3.65, 3.0], [3.65, 4.5], [3.1, 5.15], [1.65, 5.15], [1.1, 4.5], [1.1, 3.4]], { fillet: 0.55 })],
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
const rows = [{ label: 'SKULLEYGLYPH · S en bloque, como sellos', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-bloque.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
