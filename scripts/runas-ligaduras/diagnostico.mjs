// Diagnóstico: S y K sueltas, en grande, con el pincel de la v2.1 y el del
// prototipo, con el esqueleto encima para ver dónde se encima el trazo.
import { brush, strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { spine2 } from './forms.mjs'
const U = strokes.UPPER
const ppu = 120
function glyph(ss, spine) {
  const cs = circlesWith(ss, BOLD, spine)
  const view = { x0: -0.6, y0: -0.9, x1: 4.6, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const f = core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 })
  return rasterize({ f, w, h }, ppu)
}
const rows = [{ label: 'S y K sueltas · v2.1 (publicada) | prototipo (puntas nuevas)', size: 24 }]
for (const n of ['S', 'K']) {
  const a = glyph(U[n], brush.strokeSpine), b = glyph(U[n], spine2)
  const buf = Buffer.alloc((a.w * 2 + 30) * a.h * 3, 0)
  for (let y = 0; y < a.h; y++) {
    a.buf.copy(buf, (y * (a.w * 2 + 30)) * 3, y * a.w * 3, (y + 1) * a.w * 3)
    b.buf.copy(buf, (y * (a.w * 2 + 30) + a.w + 30) * 3, y * b.w * 3, (y + 1) * b.w * 3)
  }
  rows.push({ buf, w: a.w * 2 + 30, h: a.h })
}
console.log(await sheet(rows, 'diagnostico.png', { pad: 30, gap: 20 }))
