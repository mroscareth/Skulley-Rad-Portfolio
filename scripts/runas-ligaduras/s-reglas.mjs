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

export const S_OPC = {
  // El rayo de la primera S, hecho de planchas: tres planchas gruesas en
  // escalón unidas por diagonales finas (las da la pluma), con un pico arriba.
  'S-4 · El rayo, hecho de tres planchas en escalón': [pico(2.6, -0.45, 2.6, 0.75), Br([[3.75, 1.0], [1.45, 1.0], [0.4, 3.0], [3.6, 3.0], [2.55, 5.05], [0.25, 5.05]], { fillet: 0.35 })],
  // Una caja (como la N) con dos cuchillas que salen de sus paredes en giro:
  // el hueco queda con la forma de la S.
  'S-5 · Caja con dos cuchillas que salen de sus paredes en giro': [closed([[0.35, 0.7], [3.65, 0.7], [3.65, 5.3], [0.35, 5.3]]), gota(3.45, 2.25, 1.15, 2.25, 0), gota(0.55, 3.75, 2.85, 3.75, 0)],
  // Un óvalo (como la O y la Q) con una sola cuchilla curva adentro que se
  // enrosca: el eco del espiral que te gustó.
  'S-6 · Óvalo con una cuchilla que se enrosca adentro': [ovalo(2, 3.0, 1.7, 2.45), gota(1.0, 2.0, 2.55, 3.75, -0.95)],
  // La S-4 cerrada: el rayo de planchas como figura, con el hueco en zigzag.
  'S-7 · Escalones cerrados: el rayo como bloque': [closed([[1.3, 0.75], [3.75, 0.75], [2.95, 2.75], [3.7, 2.75], [2.7, 5.25], [0.25, 5.25], [1.05, 3.25], [0.3, 3.25]])],
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
const rows = [{ label: 'SKULLEYGLYPH · la S con las reglas, que se siga leyendo como S (con la K-2 y la L-1)', size: 26, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, ...FAV, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y], 36))
}
console.log(await sheet(rows, 's-reglas.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
