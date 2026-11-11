// K nueva, segunda tanda (Oscar, 2026-11-10): nada de K latina, 100 % runa, y
// de la familia del ensō (O, E) y del triángulo (A, V, R). Son combinaciones de
// esas figuras que ninguna otra runa usa, para que no se confunda con ellas.
import { strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { strokeSpine, Br, Dr, Cv, R, arc, closed, triUp, triDown } from './brush3.mjs'
const U = strokes.UPPER
const V = { r: R.v }
const enso = (cx, cy, rx, ry, o = V) => Cv(arc(cx, cy, rx, ry, -2.2, 5.6), o)
const sp = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const fino = (s, k = 0.62) => ({ ...s, r: R.h * k })

export const OPCIONES = {
  'K-1 · Ensō con un triángulo adentro': [enso(2, 3.1, 1.8, 2.0), fino(closed([[1.42, 3.8], [2, 2.6], [2.58, 3.8]]))],
  'K-2 · Ensō con gotas a los lados': [enso(2, 3.0, 1.1, 1.25), Dr(-0.25, 3.0, 0.55, 3.0, { bend: 0, r: R.v * 0.85 }), Dr(4.25, 3.0, 3.45, 3.0, { bend: 0, r: R.v * 0.85 })],
  'K-3 · Ensō con dos gotas que giran': [enso(2, 3.0, 1.4, 1.55), Dr(4.0, 0.4, 3.25, 1.45, { r: R.v * 0.85 }), Dr(0.0, 5.6, 0.75, 4.55, { r: R.v * 0.85 })],
  'K-4 · Reloj de arena: dos triángulos punta con punta': [triDown(0.5, 0.5, 3.5, 2.85), triUp(0.5, 3.15, 3.5, 5.5)],
  'K-5 · Triángulo con una gota adentro que sube': [triUp(0.25, 0.5, 3.75, 5.5), Dr(2, 2.95, 2, 4.55, { bend: 0, r: R.v * 0.8 })],
  'K-6 · Ensō sobre triángulo': [enso(2, 1.3, 0.95, 0.85, { r: R.v * 0.9 }), triDown(0.55, 3.25, 3.45, 5.7)],
  'K-7 · Triángulo hacia la derecha con cresta de lado': [closed([[1.25, 0.8], [3.75, 3.0], [1.25, 5.2]]), sp(-0.35, 1.85, 0.75, 2.2), sp(-0.45, 3.0, 0.75, 3.0), sp(-0.35, 4.15, 0.75, 3.8)],
}

const ppuBig = 60, ppuLine = 28
function render(cs, view, ppu) {
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}
const sola = (ss) => render(circlesWith(ss, BOLD, strokeSpine), { x0: -0.9, y0: -0.9, x1: 4.9, y1: 7.0 }, ppuBig)
function linea(ks, palabra) {
  const cs = []; let x = 0
  for (const ch of palabra) {
    if (ch === ' ') { x += 2.2; continue }
    const mine = circlesWith(ch === 'K' ? ks : U[ch], BOLD, strokeSpine)
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
const rows = [{ label: 'SKULLEYGLYPH · K 100 % runa, de la familia del ensō y del triángulo', size: 32, bold: true, opacity: 1 }]
for (const [label, ks] of Object.entries(OPCIONES)) {
  rows.push({ label, size: 22 })
  rows.push(lado(sola(ks), linea(ks, 'SKULLEY KAYAK OKER')))
}
console.log(await sheet(rows, 'k-nueva2.png', { pad: 40, gap: 20 }))
