// La S-2 que eligió Oscar (rayo con barra arriba), con la parte de arriba
// naciendo en cuchilla o en arco en vez de plancha cortada (2026-11-10).
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Bh, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER
const rayo = (pts, o = {}) => Br(pts, { end: null, fillet: 0.6, endTaper: 1.0, ...o })
// S con bandera y espiral (Oscar: "otra forma completamente distinta a lo que ya hayas
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
// La S-π2 con la panza de abajo como un espiral corto (Oscar, 2026-11-10): la
// vuelta no se cierra, sigue hacia adentro y remata en punta cerca del centro.
// extra = cuánto más gira después de la vuelta; fin = qué tanto se cierra.
const espiral = (extra, fin, r = R.v, rx = 1.6, ry = 1.65) => Cv(Array.from({ length: 34 }, (_, i) => {
  const t = i / 33, sweep = 5.35 + extra, a = -1.25 + sweep * t
  const tIn = 5.0 / sweep, k = t < tIn ? 1 : 1 - (1 - fin) * ((t - tIn) / (1 - tIn))
  return [2.05 + rx * k * Math.cos(a), 3.75 + ry * k * Math.sin(a)]
}), { r })
const bandera = [Bh(0.35, 3.45, 0.95, { taper: 0.25 }), espina(0.45)]
const S_OPC = {
  'S-π2 (hoy)': [...bandera, Cv(arc(2.05, 3.75, 1.6, 1.65, -1.25, 5.35), { r: R.v })],
  'S-π4a · Espiral corto: entra un poco y remata en punta': [...bandera, espiral(1.4, 0.55)],
  'S-π4b · Espiral más enroscado': [...bandera, espiral(2.3, 0.38)],
  'S-π4c · Espiral que entra hasta el centro': [...bandera, espiral(3.1, 0.22)],
  'S-π4d · Espiral más delgado y abierto, para que se lea la vuelta': [...bandera, espiral(2.6, 0.3, R.v * 0.62, 1.75, 1.8)],
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
const rows = [{ label: 'SKULLEYGLYPH · S con bandera y espiral', size: 28, bold: true, opacity: 1 }]
for (const [label, S] of Object.entries(S_OPC)) {
  rows.push({ label, size: 20 })
  rows.push(palabra([S, null, S, U.K, U.U, S5.LIGATURES.LL, U.E, U.Y, null, ...MNOPQR], 34))
}
console.log(await sheet(rows, 's-espiral.png', { bg: [0, 0, 0], pad: 36, gap: 14 }))
