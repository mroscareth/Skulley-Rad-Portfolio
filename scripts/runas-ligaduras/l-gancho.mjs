// La L con los elementos de la LL-9 que eligió Oscar (2026-11-10): un solo
// gancho inclinado (bandera arriba, bajada delgada, pie que se clava en punta)
// y algún arreglo para que se sostenga sola.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
const gancho = (pts) => Br(pts, { end: null, fillet: 0.75, startTaper: 0.9, endTaper: 0.9 })
export const LL_9 = [gancho([[0.1, 1.3], [1.55, 0.8], [1.15, 4.55], [0.2, 5.3]]), gancho([[1.95, 1.75], [3.45, 1.2], [3.05, 4.95], [2.05, 5.6]]), punto(2.45, 3.2)]
const OPCIONES = {
  'L-G · Un gancho y el punto a un lado': [gancho([[0.35, 1.25], [2.45, 0.7], [2.0, 4.65], [0.5, 5.4]]), punto(3.05, 3.15)],
  'L-H · Un gancho con el punto en su hueco': [gancho([[0.8, 1.25], [3.05, 0.7], [2.6, 4.65], [0.9, 5.4]]), punto(1.25, 3.0)],
  'L-I · Un gancho con el pie hacia la derecha': [gancho([[0.3, 1.25], [2.25, 0.7], [1.8, 4.6], [3.65, 5.35]]), punto(0.65, 3.1)],
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
const rows = [{ label: 'SKULLEYGLYPH · L de un solo gancho (con la LL-9)', size: 30, bold: true, opacity: 1 }]
for (const [label, L] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([L, LL_9, null, U.S, U.K, U.U, LL_9, U.E, U.Y, null, U.B, U.E, L, U.A, null, U.O, L, U.E], 40))
}
console.log(await sheet(rows, 'l-gancho.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
