// L y LL nuevas (Oscar, 2026-11-10, con un recorte de la referencia: plancha
// gruesa con un extremo sesgado, poste delgado, punto redondo y unión con
// curva por dentro). La LL comparte la plancha entre dos postes.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
const camino = (pts, o = {}) => Br(pts, { end: null, fillet: 0.65, ...o })
const OPCIONES = {
  'L-D · Plancha sesgada y poste a la derecha, con punto': {
    L: [camino([[0.15, 4.95], [3.35, 4.95], [3.35, 0.5]], { startTaper: 1.2 }), punto(0.7, 2.7)],
    LL: [camino([[0.0, 4.95], [3.6, 4.95], [3.6, 0.5]], { startTaper: 1.2 }), camino([[2.0, 4.95], [2.0, 1.3]]), punto(0.55, 2.8)],
  },
  'L-E · Poste a la izquierda y plancha que remata sesgada, con punto': {
    L: [camino([[0.55, 0.5], [0.55, 4.95], [3.85, 4.95]], { endTaper: 1.2 }), punto(2.55, 2.2)],
    LL: [camino([[0.4, 0.5], [0.4, 4.95], [4.0, 4.95]], { endTaper: 1.2 }), camino([[2.0, 1.3], [2.0, 4.95]]), punto(3.1, 2.4)],
  },
  'L-F · Plancha sesgada y un tajo que sube, con punto': {
    L: [camino([[0.15, 4.95], [3.55, 4.95]], { startTaper: 1.2 }), Dr(3.45, 4.3, 0.85, 0.45, { r: R.v, bend: 0.35 }), punto(3.0, 1.0)],
    LL: [camino([[0.0, 4.95], [3.75, 4.95]], { startTaper: 1.2 }), Dr(3.65, 4.3, 1.55, 0.35, { r: R.v, bend: 0.3 }), Dr(2.2, 4.3, 0.2, 0.9, { r: R.v, bend: 0.3 }), punto(3.25, 0.95)],
  },
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
const rows = [{ label: 'SKULLEYGLYPH · L y LL nuevas', size: 30, bold: true, opacity: 1 }]
for (const [label, o] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([o.L, o.LL, null, U.S, U.K, U.U, o.LL, U.E, U.Y, null, o.L, U.A, U.L === o.L ? null : null].filter((g, i, a) => !(g === null && i === a.length - 1)), 46))
}
console.log(await sheet(rows, 'l-opciones2.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
