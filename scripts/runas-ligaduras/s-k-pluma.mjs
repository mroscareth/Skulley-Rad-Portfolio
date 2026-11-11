// S y K nuevas con la pluma plana (Oscar, 2026-11-10): la referencia ahora son
// sus favoritas, M N O P Q R: masas anchas y sólidas, arcos y cuchillas. La S
// estaba muy angosta y la K "horrenda".
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER, P = Math.PI
const cuchilla = (x1, y1, x2, y2, bend = 0.15) => Dr(x1, y1, x2, y2, { r: R.v, bend })
const pico = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const S_OPC = {
  'S-1 · Rayo ancho': [pico(2.2, -0.35, 2.2, 0.85), Br([[3.75, 1.15], [0.65, 3.1], [3.35, 3.1], [0.3, 5.45]], { fillet: 0.75 })],
  'S-2 · Rayo con barra arriba': [Br([[0.35, 0.95], [3.65, 0.95], [0.9, 3.1], [3.35, 3.1], [0.4, 5.45]], { fillet: 0.6 })],
  'S-3 · Rayo en bloque con remates sesgados': [pico(1.0, -0.3, 1.25, 0.9), Br([[3.85, 0.85], [1.05, 3.05], [3.55, 3.05], [0.2, 5.55]], { end: null, fillet: 0.45, startTaper: 0.8, endTaper: 1.1 })],
}
const K_OPC = {
  'K-A · Arco con dos cuchillas que se abren abajo': [Cv(arc(2, 2.9, 1.75, 2.0, P, P), { r: R.v }), cuchilla(1.35, 3.0, 0.2, 5.6, -0.1), cuchilla(2.65, 3.0, 3.8, 5.6, 0.1)],
  'K-B · Ensō con dos tajos que salen de su lado': [Cv(arc(1.55, 3.0, 1.25, 1.45, -1.0, 4.9), { r: R.v }), cuchilla(2.55, 2.55, 4.0, 0.4, 0.12), cuchilla(2.55, 3.45, 4.0, 5.6, -0.12)],
  'K-C · Caja abierta y dos cuchillas en su boca': [Br([[3.2, 0.8], [0.4, 0.8], [0.4, 5.2], [3.2, 5.2]], { fillet: 0.5 }), cuchilla(1.4, 3.0, 3.9, 1.7, 0.1), cuchilla(1.4, 3.0, 3.9, 4.3, -0.1)],
  'K-D · Triángulo con un tajo que lo cruza': [closed([[0.3, 5.4], [2.0, 0.7], [3.7, 5.4]]), cuchilla(0.0, 2.0, 4.0, 4.4, 0.2)],
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
const MNOPQR = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
const rows = [{ label: 'SKULLEYGLYPH · S y K nuevas, junto a M N O P Q R', size: 30, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, ...MNOPQR, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y], 34))
}
for (const [label, K] of Object.entries(K_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([K, null, ...MNOPQR, null, U.S, K, U.U, S5.LIGATURES.LL, U.E, U.Y], 34))
}
console.log(await sheet(rows, 's-k-pluma.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
