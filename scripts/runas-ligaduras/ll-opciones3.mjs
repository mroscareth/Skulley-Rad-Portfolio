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
// Tercera tanda (Oscar, con un recorte de letra tipo gótica como referencia de
// forma, no de estilo): trazos inclinados con ganchos curvos, arranques y
// remates filosos y piezas que encajan. La pluma plana se queda igual.
const gancho = (pts) => Br(pts, { end: null, fillet: 0.75, startTaper: 0.9, endTaper: 0.9 })
const OPCIONES = {
  'LL-9 · Dos ganchos inclinados, uno junto al otro': [
    gancho([[0.1, 1.3], [1.55, 0.8], [1.15, 4.55], [0.2, 5.3]]),
    gancho([[1.95, 1.75], [3.45, 1.2], [3.05, 4.95], [2.05, 5.6]]),
    punto(2.45, 3.2),
  ],
  'LL-10 · Un solo trazo: baja, se apoya, sube y vuelve a bajar': [
    Br([[0.1, 1.3], [1.4, 0.85], [1.0, 4.7], [1.9, 5.25], [3.55, 1.0], [3.15, 4.85], [2.35, 5.55]], { end: null, fillet: 0.6, startTaper: 0.9, endTaper: 0.9 }),
    punto(0.45, 3.2),
  ],
  'LL-11 · Un techo y dos ganchos que se abren': [
    Br([[0.1, 1.15], [3.85, 0.75]], { end: null, startTaper: 1.0, endTaper: 0.7 }),
    gancho([[1.4, 1.35], [1.0, 4.6], [0.05, 5.3]]),
    gancho([[3.0, 1.2], [2.6, 4.7], [3.85, 5.45]]),
    punto(1.95, 3.2),
  ],
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
const rows = [{ label: 'SKULLEYGLYPH · LL de trazos libres (con la L-D)', size: 30, bold: true, opacity: 1 }]
for (const [label, LL] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([L_D, LL, null, U.S, U.K, U.U, LL, U.E, U.Y, null, U.B, U.E, L_D, U.A], 44))
}
console.log(await sheet(rows, 'll-opciones3.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
