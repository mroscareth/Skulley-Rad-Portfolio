// La B nueva (Oscar, 2026-11-10: "desentona mucho"). La de hoy es una caja
// angosta con dos puntos sueltos a los lados, como dominó. Opciones con las
// reglas de M N O P Q R; cada una junto a las favoritas y dentro de palabras.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Cv, R, arc, box, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER, P = Math.PI
const plancha = (x0, x1, y) => Br([[x0, y], [x1, y]], { end: null })
const ovalo = (cx, cy, rx, ry) => Cv(arc(cx, cy, rx, ry, -P / 2, 2 * P + 0.55, 30), { r: R.v })

export const B_OPC = {
  'B (hoy)': U.B,
  'B-1 · Hexágono: los picos de los lados pasan a ser parte de la figura': [closed([[1.0, 0.9], [3.0, 0.9], [3.95, 3.0], [3.0, 5.1], [1.0, 5.1], [0.05, 3.0]])],
  'B-2 · Caja con una plancha al centro (dos panzas)': [box(0.5, 0.8, 3.5, 5.2), plancha(0.6, 3.4, 3.0)],
  'B-3 · Óvalo con una plancha al centro': [ovalo(2.0, 3.0, 1.65, 2.3), plancha(0.45, 3.55, 3.0)],
  'B-4 · Dos triángulos apilados, como la runa nórdica de la B (ᛒ)': [closed([[0.6, 0.6], [3.5, 1.8], [0.95, 3.0], [3.5, 4.2], [0.6, 5.4]])],
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
const w = (txt, B) => [...txt].map((c) => (c === ' ' ? null : c === 'B' ? B : U[c]))
const rows = [{ label: 'SKULLEYGLYPH · la B nueva', size: 28, bold: true, opacity: 1 }]
for (const [label, B] of Object.entries(B_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([B, null, ...FAV, null, ...w('BARBA', B), null, ...w('BEBO', B)], 30))
}
console.log(await sheet(rows, 'b-nueva.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
