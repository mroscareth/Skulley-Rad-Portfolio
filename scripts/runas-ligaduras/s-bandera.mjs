// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Bh, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
// S con bandera y panza (Oscar: "otra forma completamente distinta a lo que ya hayas
// creado"): sin rayo. Arcos, cuchillas y huecos como sus favoritas M N O P Q R,
// con el giro de una S.
const P = Math.PI
const hoja = (x1, y1, x2, y2, bend = 0.15) => Dr(x1, y1, x2, y2, { r: R.v, bend })
const punto = (x, y) => Dr(x, y, x + 0.12, y + 0.25)
// Tercera vuelta (Oscar: "algo más rúnico", como M N O P Q R): bloques
// compactos como sellos, figura sólida y cuchillas acomodadas, con el giro de
// una S.
const esquina = (pts) => Br(pts, { fillet: 0.5 })
// Con la referencia de forma que mandó Oscar (2026-11-10): bandera gruesa
// arriba con una espina que sube en la orilla, y abajo una panza sólida con un
// hueco ovalado y una línea fina curva por dentro.
const espina = (x) => Dr(x, 1.15, x, -0.45, { r: R.v * 0.55, bend: 0 })
const S_OPC = {
  'S-π1 · Bandera con espina y panza con una línea por dentro': [Bh(0.35, 3.45, 0.95, { taper: 0.25 }), espina(0.45), Cv(arc(2.05, 3.75, 1.6, 1.65, -1.25, 5.35), { r: R.v }), Dr(1.05, 2.95, 1.35, 4.75, { r: R.v * 0.55, bend: -0.35 })],
  'S-π2 · Bandera con espina y panza limpia': [Bh(0.35, 3.45, 0.95, { taper: 0.25 }), espina(0.45), Cv(arc(2.05, 3.75, 1.6, 1.65, -1.25, 5.35), { r: R.v })],
  'S-π3 · Al revés: la espina a la derecha y la panza abierta del otro lado': [Bh(0.55, 3.65, 0.95, { taper: 0.25 }), espina(3.55), Cv(arc(1.95, 3.75, 1.6, 1.65, Math.PI + 1.25, -5.35), { r: R.v }), Dr(2.95, 2.95, 2.65, 4.75, { r: R.v * 0.55, bend: 0.35 })],
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
const rows = [{ label: 'SKULLEYGLYPH · S con bandera y panza', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-bandera.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
