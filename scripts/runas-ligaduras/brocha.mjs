// Estudio de la brocha (Oscar, 2026-11-10): la misma escritura con el pincel de
// hoy, uno caligráfico (referencia 1), uno geométrico (referencia 2) y una
// mezcla. Runas sueltas, sin hilos: aquí solo se juzga el trazo.
import { strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { strokeSpine, setStyle } from './brush4.mjs'
const U = strokes.UPPER
const glyphOf = (ch) => (ch === 'Ł' ? strokes.LIGATURES.LL : U[ch])
function linea(texto, ppu, gap = 0.55) {
  const cs = []; let x = 0
  for (const ch of texto) {
    if (ch === ' ') { x += 2.0; continue }
    const mine = circlesWith(glyphOf(ch), BOLD, strokeSpine)
    const xs = mine.flatMap(([cx, , r]) => [cx - r, cx + r])
    const left = Math.min(...xs), right = Math.max(...xs)
    for (const [cx, cy, r] of mine) cs.push([cx - left + x, cy, r])
    x += right - left + gap
  }
  const view = { x0: -0.5, y0: -1.0, x1: x, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}
const ESTILOS = [
  ['hoy', 'Hoy: la punta se queda gruesa casi hasta el final y cae en cuña'],
  ['gradual', 'Hoy con las puntas arregladas: colas largas que se vuelven hilo, sin tocar nada más'],
  ['caligrafico', 'Caligráfico (referencia 1): colas largas que se vuelven hilo, más contraste y un lado del trazo casi recto'],
  ['geometrico', 'Geométrico (referencia 2): un solo grosor y remates redondos'],
  ['hibrido', 'Mezcla: cuerpos de un solo grosor con colas largas y graduales'],
]
const rows = [{ label: 'SKULLEYGLYPH · estudio de la brocha', size: 32, bold: true, opacity: 1 }]
for (const [id, label] of ESTILOS) {
  setStyle(id)
  rows.push({ label, size: 22 })
  rows.push(linea('VSEAO', 74, 0.8))
  rows.push(linea('SKUŁEYRAD WIZARD', 30))
}
setStyle('hoy')
console.log(await sheet(rows, 'brocha.png', { pad: 40, gap: 16 }))
