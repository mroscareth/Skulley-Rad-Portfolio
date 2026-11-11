// Los números mayas con la pluma (gota = 1, barra = 5, ensō = 0), hoy contra
// una propuesta descartada (Oscar, 2026-11-10: "los números están bien así") con las reglas de M N O P Q R: la gota de pie se vuelve un punto
// redondo (con la pluma vertical salía como rayita) y el cero, un óvalo cerrado.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const P = Math.PI

// Puntos un poco más chicos que el de siempre: en el 4 se tocaban.
const punto = (x, y) => Dr(x, y - 0.12, x, y + 0.12, { r: R.v * 0.95 * 0.75 })
const fila = (n, y) => ({ 1: [2], 2: [1.3, 2.7], 3: [0.8, 2, 3.2], 4: [0.55, 1.5, 2.5, 3.45] }[n] || []).map((x) => punto(x, y))
const barra = (y) => Br([[0.3, y], [3.7, y]], { end: null })
const ovalo = (cx, cy, rx, ry) => Cv(arc(cx, cy, rx, ry, -P / 2, 2 * P + 0.55, 30), { r: R.v })
export const NUEVOS = {
  0: [ovalo(2, 3.6, 1.6, 1.3)],
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [n, fila(n, 3.8)])),
  5: [barra(4.6)],
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [n + 5, [...fila(n, 3.2), barra(4.6)]])),
}

function linea(glyphs, ppu, gap = 0.6) {
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
const D = '0123456789'.split('')
const U = S5.UPPER
const rows = [{ label: 'SKULLEYGLYPH · los números con la pluma', size: 28, bold: true, opacity: 1 },
  { label: 'Hoy: 0 1 2 3 4 5 6 7 8 9', size: 20 }, linea(D.map((d) => S5.DIGITS[d]), 36),
  { label: 'Propuesta: el uno es un punto redondo, el cero un óvalo cerrado', size: 20 }, linea(D.map((d) => NUEVOS[d]), 36),
  { label: 'Junto a letras: 2026 · R 9 · O 0', size: 20 },
  linea([NUEVOS[2], NUEVOS[0], NUEVOS[2], NUEVOS[6], null, U.R, NUEVOS[9], null, U.O, NUEVOS[0]], 36)]
console.log(await sheet(rows, 'numeros.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
