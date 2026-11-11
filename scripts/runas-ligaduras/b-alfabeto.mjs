// El alfabeto completo con la B-3 y con la B-4, para verlas integradas (Oscar,
// 2026-11-10). Ya lleva la S-10b fija.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { B_OPC } from './b-nueva.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const pick = (id) => Object.entries(B_OPC).find(([k]) => k.startsWith(id))[1]
const OPC = {
  'Con la B-3 · óvalo con una plancha al centro': pick('B-3'),
  'Con la B-4 · dos triángulos apilados (ᛒ)': pick('B-4'),
}
function linea(texto, B, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const ch of texto.replaceAll('LL', 'Ł')) {
    if (ch === ' ') { x += 2.2; continue }
    const ss = ch === 'Ł' ? S5.LIGATURES.LL : ch === 'B' ? B : U[ch]
    const bs = nibBoxes(ss, BOLD)
    const ext = (sgn) => bs.map(([bx, , w, h, a, r]) => bx + sgn * (r ? w : Math.max(w, h * Math.abs(Math.sin(a || 0)))))
    const left = Math.min(...ext(-1)), right = Math.max(...ext(1))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.1, x1: x, y1: 7.2 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}
const rows = [{ label: 'SKULLEYGLYPH · el alfabeto con cada B', size: 28, bold: true, opacity: 1 }]
for (const [label, B] of Object.entries(OPC)) {
  rows.push({ label, size: 22 })
  for (const t of ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ', 'SKULLEY RAD BARBA']) rows.push(linea(t, B, 30))
}
console.log(await sheet(rows, 'b-alfabeto.png', { bg: [0, 0, 0], pad: 36, gap: 10 }))
