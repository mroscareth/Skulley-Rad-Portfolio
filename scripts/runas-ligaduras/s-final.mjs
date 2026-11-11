// Últimas propuestas de S (Oscar, 2026-11-10: "no estoy muy convencido de la S").
// La S-4 es la única runa de diagonales largas y sin figura; estas conservan el
// mohawk de Skulley y van de pie, con lados verticales y esquinas como las de
// M N O P Q R. Cada una junto a las favoritas y dentro de SKULLEY.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, R, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const mohawk = (cx, y = 0) => [Dr(cx - 1.05, y, cx - 0.8, y + 1.35, { r: R.v * 0.8 }), Dr(cx, y - 0.2, cx, y + 1.25, { r: R.v * 0.8 }), Dr(cx + 1.05, y, cx + 0.8, y + 1.35, { r: R.v * 0.8 })]
const gota = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.9, bend: 0.06 })
const planchas = (fillet) => Br([[3.65, 1.95], [0.4, 1.95], [0.4, 3.6], [3.6, 3.6], [3.6, 5.25], [0.35, 5.25]], { fillet })

export const S_OPC = {
  'S-4m2 (hoy)': U.S,
  'S-8 · S cuadrada: tres planchas con lados verticales, esquinas como la N': [...mohawk(2.0), planchas(0.5)],
  'S-9 · S redonda: las mismas planchas con esquinas muy redondas, como la O y la P': [...mohawk(2.0), planchas(1.05)],
  'S-10 · Caja girada: una caja con la tapa corrida a la derecha y la base a la izquierda': [...mohawk(2.3), closed([[0.75, 1.95], [3.25, 1.95], [3.25, 5.25], [0.75, 5.25]]), Br([[2.6, 1.95], [3.95, 1.95]], { end: null }), Br([[0.05, 5.25], [1.4, 5.25]], { end: null })],
  'S-11 · S cuadrada con gotas en giro en vez del mohawk': [planchas(0.5), gota(3.35, 2.55, 3.35, 3.2), gota(0.65, 4.65, 0.65, 4.0)],
}

function palabra(glyphs, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const ss of glyphs) {
    if (!ss) { x += 2; continue }
    const bs = nibBoxes(ss, BOLD)
    const ext = (sgn) => bs.map(([bx, , w, h, a, r]) => bx + sgn * (r ? w : Math.max(w, h * Math.abs(Math.sin(a || 0)))))
    const left = Math.min(...ext(-1)), right = Math.max(...ext(1))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.1, x1: x, y1: 7.2 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}
const FAV = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
const rows = [{ label: 'SKULLEYGLYPH · últimas propuestas de S', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, ...FAV, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, U.O, S, U.C, U.A, U.R], 30))
}
console.log(await sheet(rows, 's-final.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
