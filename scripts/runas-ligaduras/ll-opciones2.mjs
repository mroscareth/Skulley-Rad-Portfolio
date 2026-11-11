// LL nuevas a partir de la L-D que eligió Oscar (2026-11-10): plancha que
// arranca sesgada, poste a la derecha con curva por dentro y un punto.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
const camino = (pts, o = {}) => Br(pts, { end: null, fillet: 0.65, ...o })
export const L_D = [camino([[0.15, 4.95], [3.35, 4.95], [3.35, 0.5]], { startTaper: 1.2 }), punto(0.7, 2.7)]
// Segunda tanda (Oscar: "parecen letras de israelí"): plancha gruesa con poste
// delgado en escuadra es como se construye la escritura hebrea. La referencia no
// se ve así porque usa diagonales, cuchillas curvas, puntos y curvas; con eso va.
const losa = (x1) => camino([[0.15, 4.95], [x1, 4.95]], { startTaper: 1.2 })
const OPCIONES = {
  'LL-5 · Dos medias lunas que suben de la plancha': [losa(3.1), Dr(3.15, 4.35, 0.55, 0.55, { bend: -1.0, r: R.v }), Dr(2.35, 4.2, 1.25, 1.75, { bend: -0.55, r: R.v * 0.75 }), punto(3.25, 1.15)],
  'LL-6 · La L con un tajo que la cruza': [camino([[0.15, 4.95], [3.35, 4.95], [3.35, 0.5]], { startTaper: 1.2 }), Dr(0.35, 0.85, 4.05, 3.75, { bend: 0.3, r: R.v }), punto(0.7, 3.4)],
  'LL-7 · Plancha y una luna que la cubre': [losa(3.6), Dr(0.25, 3.35, 3.75, 1.05, { bend: -1.25, r: R.v }), punto(2.1, 3.5)],
  'LL-8 · Plancha y dos tajos paralelos': [losa(3.75), Dr(3.65, 4.3, 1.55, 0.35, { r: R.v, bend: 0.3 }), Dr(2.2, 4.3, 0.2, 0.9, { r: R.v, bend: 0.3 }), punto(3.25, 0.95)],
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
const rows = [{ label: 'SKULLEYGLYPH · LL nuevas sin postes (con la L-D)', size: 30, bold: true, opacity: 1 }]
for (const [label, LL] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([L_D, LL, null, U.S, U.K, U.U, LL, U.E, U.Y, null, U.B, U.E, L_D, U.A], 44))
}
console.log(await sheet(rows, 'll-opciones2.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
