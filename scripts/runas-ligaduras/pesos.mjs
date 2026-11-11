// Los tres pesos de la pluma (Light, Medium, Bold), en grande, para ver si se
// distinguen. FONT_WEIGHTS da el multiplicador de cada uno.
import { pathToFileURL } from 'node:url'
import { rasterize, sheet, ROOT } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import * as S5 from './strokes5.mjs'
const { FONT_WEIGHTS } = await import(pathToFileURL(ROOT + '/src/lib/runeAlphabet.js').href)
const glifo = (ch) => (ch === 'Ł' ? S5.LIGATURES.LL : S5.UPPER[ch])
function linea(texto, weight, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const ch of texto.replaceAll('LL', 'Ł')) {
    if (ch === ' ') { x += 2.2; continue }
    const bs = nibBoxes(glifo(ch), weight)
    const ext = (sgn) => bs.map(([bx, , w, h, a, r]) => bx + sgn * (r ? w : Math.max(w, h * Math.abs(Math.sin(a || 0)))))
    const left = Math.min(...ext(-1)), right = Math.max(...ext(1))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.1, x1: x, y1: 7.2 }, ppu), ppu, { ink: [240, 240, 240], bg: [2, 45, 214] })
}
const PESOS = process.env.PESOS ? JSON.parse(process.env.PESOS) : FONT_WEIGHTS.map((w) => [w.name, w.brush])
const rows = [{ label: 'SKULLEYGLYPH · los tres pesos de la pluma', size: 28, bold: true, opacity: 1 }]
for (const [name, k] of PESOS) { rows.push({ label: `${name} (×${k})`, size: 20 }); rows.push(linea('SKULLEY RAD', k, 40)); rows.push(linea('OSCAR MOCTEZUMA', k, 24)) }
console.log(await sheet(rows, process.env.OUT || 'pesos.png', { bg: [2, 45, 214], pad: 36, gap: 12 }))
