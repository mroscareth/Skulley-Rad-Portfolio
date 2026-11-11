// Rediseño de la K (Oscar, 2026-11-10: "de todas la que menos está en el estilo
// de las demás"). El lenguaje del alfabeto es una figura centrada con acentos
// de pincel; la K1 no tenía figura. Opciones que parten de una figura, varias
// de la "&lt;" de la runa nórdica de la K (Kaunan).
import { strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { strokeSpine, Br, Dr, Cv, R, arc, closed } from './brush3.mjs'
const U = strokes.UPPER, P = Math.PI
const sp = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const barra = (x) => Br([[x, 0.4], [x, 5.6]], { taper: 0.55 })

export const OPCIONES = {
  'K1 (hoy)': U.K,
  'K-A · Kaunan: la "&lt;" de un trazo con una gota adentro': [Br([[3.6, 0.5], [1.0, 3.0], [3.6, 5.5]], { fillet: 0.6 }), Dr(2.3, 3.0, 3.3, 3.0, { bend: 0, r: R.v * 0.85 })],
  'K-B · Barra y triángulo que apunta a ella': [barra(0.45), closed([[3.7, 0.6], [1.65, 3.0], [3.7, 5.4]])],
  'K-C · Barra y la "&lt;" de un trazo': [barra(0.45), Br([[3.75, 0.5], [1.75, 3.0], [3.75, 5.5]], { fillet: 0.6 })],
  'K-D · Triángulo con dos picos que lo enmarcan': [closed([[3.6, 0.6], [1.2, 3.0], [3.6, 5.4]]), sp(0.15, 0.9, 0.8, 2.05), sp(0.15, 5.1, 0.8, 3.95)],
  'K-E · Copa de lado con una gota adentro': [Cv(arc(3.5, 3.0, 2.3, 2.45, P * 0.5, P), { r: R.v }), Dr(2.2, 3.0, 3.3, 3.0, { bend: 0, r: R.v * 0.85 })],
}

const ppuBig = 64, ppuLine = 30
function render(cs, view, ppu) {
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}
function sola(ss) { return render(circlesWith(ss, BOLD, strokeSpine), { x0: -0.7, y0: -0.9, x1: 4.7, y1: 7.0 }, ppuBig) }
// La K entre runas reales, sueltas y con el mismo aire, para juzgar el estilo.
function linea(ks, palabra) {
  const cs = []; let x = 0
  for (const ch of palabra) {
    const ss = ch === 'K' ? ks : (ch === ' ' ? null : U[ch])
    if (!ss) { x += 2.2; continue }
    const mine = circlesWith(ss, BOLD, strokeSpine)
    const xs = mine.flatMap(([cx, , r]) => [cx - r, cx + r])
    const left = Math.min(...xs), right = Math.max(...xs)
    for (const [cx, cy, r] of mine) cs.push([cx - left + x, cy, r])
    x += right - left + 0.55
  }
  return render(cs, { x0: -0.5, y0: -0.9, x1: x, y1: 7.0 }, ppuLine)
}
function lado(a, b, gap = 40) {
  const h = Math.max(a.h, b.h), w = a.w + gap + b.w, buf = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) { buf[i * 3] = 2; buf[i * 3 + 1] = 45; buf[i * 3 + 2] = 214 }
  for (let y = 0; y < a.h; y++) a.buf.copy(buf, (y * w) * 3, y * a.w * 3, (y + 1) * a.w * 3)
  for (let y = 0; y < b.h; y++) b.buf.copy(buf, (y * w + a.w + gap) * 3, y * b.w * 3, (y + 1) * b.w * 3)
  return { buf, w, h }
}
const rows = [{ label: 'SKULLEYGLYPH · una K nueva, con figura y acentos como las demás', size: 32, bold: true, opacity: 1 }]
for (const [label, ks] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 22 })
  rows.push(lado(sola(ks), linea(ks, 'SKULLEY KAYAK')))
}
console.log(await sheet(rows, 'k-nueva.png', { pad: 40, gap: 22 }))
