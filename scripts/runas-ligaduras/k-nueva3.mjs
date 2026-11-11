// K nueva, tercera tanda (Oscar, 2026-11-10): nada de K latina, 100 % runa, y
// de la familia del ensō (O, E) y del triángulo (A, V, R). Son combinaciones de
// esas figuras que ninguna otra runa usa, para que no se confunda con ellas.
import { strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { strokeSpine, Br, Dr, Cv, R, arc, closed, triUp, triDown } from './brush3.mjs'
const U = strokes.UPPER
const V = { r: R.v }
const enso = (cx, cy, rx, ry, o = V) => Cv(arc(cx, cy, rx, ry, -2.2, 5.6), o)
const sp = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const fino = (s, k = 0.62) => ({ ...s, r: R.h * k })

// Espiral de un solo trazo: de afuera hacia adentro, afilándose al final.
const espiral = (turns = 1.12, r0 = 1.9, r1 = 0.4) => Cv(Array.from({ length: 26 }, (_, i) => { const t = i / 25, a = -2.0 + t * turns * 2 * Math.PI, r = r0 - (r0 - r1) * t; return [2 + r * Math.cos(a), 3 + r * 1.08 * Math.sin(a)] }), { r: R.v * 0.82 })

export const OPCIONES = {
  'K-8 · Espiral de un solo trazo': [espiral()],
  'K-9 · Ensō doble: uno grande y uno chico abiertos al revés': [enso(2, 3.0, 1.8, 2.0), Cv(arc(2, 3.0, 0.72, 0.82, -2.2 + Math.PI, 5.6), { r: R.h * 0.75 })],
  'K-10 · Ojo: ensō abierto a la derecha con una gota que entra': [Cv(arc(2, 3.0, 1.6, 1.8, 0.6, 5.1), V), Dr(4.0, 3.0, 2.15, 3.0, { bend: 0, r: R.v * 0.9 })],
  'K-11 · Triángulo con un ensō adentro': [triUp(0.0, 0.3, 4.0, 5.6), fino(enso(2, 4.05, 0.48, 0.48), 0.62)],
  'K-12 · Moño: dos triángulos que se tocan de lado': [closed([[0.15, 0.9], [1.92, 3.0], [0.15, 5.1]]), closed([[3.85, 0.9], [2.08, 3.0], [3.85, 5.1]])],
  'K-13 · Triángulo con cuernos': [triDown(0.75, 1.7, 3.25, 5.6), Dr(-0.1, 0.15, 0.7, 1.45, { r: R.v * 0.8, bend: -0.25 }), Dr(4.1, 0.15, 3.3, 1.45, { r: R.v * 0.8, bend: 0.25 })],
  'K-14 · Cerradura: ensō sobre un triángulo que sube': [enso(2, 1.25, 0.85, 0.8, { r: R.v * 0.9 }), triUp(0.45, 2.95, 3.55, 5.6)],
  'K-15 · Ensō con un triángulo que lo corona': [fino(triUp(0.95, -0.2, 3.05, 1.25), 0.85), enso(2, 3.65, 1.55, 1.65)],
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
console.log(await sheet(rows, 'k-nueva3.png', { pad: 40, gap: 20 }))
