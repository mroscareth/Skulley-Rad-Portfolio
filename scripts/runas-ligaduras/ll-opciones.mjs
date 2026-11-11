// LL nuevas a partir de la L-D que eligió Oscar (2026-11-10): plancha que
// arranca sesgada, poste a la derecha con curva por dentro y un punto.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
const camino = (pts, o = {}) => Br(pts, { end: null, fillet: 0.65, ...o })
export const L_D = [camino([[0.15, 4.95], [3.35, 4.95], [3.35, 0.5]], { startTaper: 1.2 }), punto(0.7, 2.7)]
const OPCIONES = {
  'LL-1 · Copa: la plancha con un poste en cada lado y el punto adentro': [camino([[0.35, 0.9], [0.35, 4.95], [3.65, 4.95], [3.65, 0.5]]), punto(1.9, 2.5)],
  'LL-2 · Escalera: dos escalones de la L, uno arriba y otro abajo': [camino([[0.05, 2.25], [1.85, 2.25], [1.85, 0.3]], { startTaper: 0.9 }), camino([[1.15, 4.95], [3.8, 4.95], [3.8, 2.6]], { startTaper: 1.0 }), punto(0.45, 4.3)],
  'LL-3 · Doble plancha: dos planchas sesgadas y un solo poste': [camino([[0.15, 4.95], [3.45, 4.95], [3.45, 0.5]], { startTaper: 1.2 }), camino([[0.95, 2.2], [3.45, 2.2]], { startTaper: 1.0 }), punto(0.55, 3.55)],
  'LL-4 · Dos puntos: la misma L con dos puntos': [camino([[0.15, 4.95], [3.35, 4.95], [3.35, 0.5]], { startTaper: 1.2 }), punto(0.55, 2.7), punto(1.55, 2.7)],
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
const rows = [{ label: 'SKULLEYGLYPH · LL nuevas (con la L-D)', size: 30, bold: true, opacity: 1 }]
for (const [label, LL] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([L_D, LL, null, U.S, U.K, U.U, LL, U.E, U.Y, null, U.B, U.E, L_D, U.A], 44))
}
console.log(await sheet(rows, 'll-opciones.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
