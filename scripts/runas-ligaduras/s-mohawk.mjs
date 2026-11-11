// La S con las reglas de M N O P Q R, pero que se siga leyendo como S (Oscar,
// 2026-11-10: "LA S NO ME CONVENCE" con el hexágono y el paralelogramo, que
// eran 100 % runa y ya no decían S). Cada opción va junto a las favoritas y
// dentro de SKULLEY con la K-2 y la L-1 ya fijas.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER, P = Math.PI
const gota = (x1, y1, x2, y2, bend = 0.06) => Dr(x1, y1, x2, y2, { r: R.v * 0.9, bend })
const pico = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const ovalo = (cx, cy, rx, ry) => Cv(arc(cx, cy, rx, ry, -P / 2, 2 * P + 0.55, 30), { r: R.v })

// La S-4 con el mohawk de Skulley arriba (Oscar, 2026-11-10): las tres cuchillas
// de la cresta de la O.
const mohawk = (cx, y) => [Dr(cx - 1.05, y, cx - 0.8, y + 1.35, { r: R.v * 0.8 }), Dr(cx, y - 0.2, cx, y + 1.25, { r: R.v * 0.8 }), Dr(cx + 1.05, y, cx + 0.8, y + 1.35, { r: R.v * 0.8 })]
const rayo = (ys) => Br([[3.75, ys[0]], [1.45, ys[0]], [0.4, ys[1]], [3.6, ys[1]], [2.55, ys[2]], [0.25, ys[2]]], { fillet: 0.35 })
export const S_OPC = {
  'S-4 (sin mohawk)': [pico(2.6, -0.45, 2.6, 0.75), rayo([1.0, 3.0, 5.05])],
  'S-4m1 · El cuerpo como está y el mohawk encima de la plancha de arriba': [...mohawk(2.6, -0.65), rayo([1.0, 3.0, 5.05])],
  'S-4m2 · El cuerpo más bajo, con el mohawk en la misma altura que el de la O': [...mohawk(2.55, 0.0), rayo([1.95, 3.6, 5.25])],
  'S-4m3 · Como la m2, con el mohawk centrado en la runa': [...mohawk(2.0, 0.0), rayo([1.95, 3.6, 5.25])],
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
const FAV = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
const rows = [{ label: 'SKULLEYGLYPH · la S-4 con el mohawk de Skulley', size: 26, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, ...FAV, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y], 36))
}
console.log(await sheet(rows, 's-mohawk.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
