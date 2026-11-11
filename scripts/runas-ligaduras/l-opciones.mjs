// L y LL más rectas (Oscar, 2026-11-10: "que no sean wavy, sino un poco más
// rectas"), pintadas con la pluma plana.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, R } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const gota = Dr(3, 0.2, 3.5, 1.6)
const apila = (pts) => [
  Br(pts.map(([x, y]) => [x, 1.2 + (y - 1.5) * 0.62]), { fillet: 0.2, r: R.v * 0.9 }),
  Br(pts.map(([x, y]) => [x, 3.9 + (y - 1.5) * 0.62]), { fillet: 0.2, r: R.v * 0.9 }),
  Dr(3.1, -0.1, 3.5, 1, { r: R.v * 0.85 }),
]
const FORMAS = {
  'L-A · La onda de hoy, en tramos rectos': [[0.3, 3.6], [1.0, 1.5], [2.1, 1.5], [2.1, 4.5], [3.0, 4.5], [3.7, 2.4]],
  'L-B · Escalón: plancha arriba, bajada y plancha abajo': [[0.3, 1.5], [2.0, 1.5], [2.0, 4.6], [3.7, 4.6]],
  'L-C · Plancha, diagonal y plancha': [[0.3, 1.5], [1.6, 1.5], [2.4, 4.6], [3.7, 4.6]],
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
const rows = [{ label: 'SKULLEYGLYPH · L y LL más rectas', size: 30, bold: true, opacity: 1 },
  { label: 'Hoy: la onda', size: 20 }, palabra([U.L, S5.LIGATURES.LL, null, U.S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y], 46)]
for (const [label, pts] of Object.entries(FORMAS)) {
  const L = [Br(pts, { fillet: 0.25 }), gota], LL = apila(pts)
  rows.push({ label, size: 20 })
  rows.push(palabra([L, LL, null, U.S, U.K, U.U, LL, U.E, U.Y], 46))
}
console.log(await sheet(rows, 'l-opciones.png', { bg: [0, 0, 0], pad: 36, gap: 16 }))
