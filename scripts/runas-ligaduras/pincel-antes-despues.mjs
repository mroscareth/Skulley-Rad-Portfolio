// Las 26 runas (y la doble L) con el pincel del prototipo (brush2) contra el
// arreglado (brush3), en Bold, para ver que el arreglo no rompe otra cosa.
import { pathToFileURL } from 'node:url'
import { strokes, circlesWith, core, rasterize, sheet, BOLD, ROOT } from './bench.mjs'
import { strokeSpine as antes } from './brush2.mjs'
import { strokeSpine as despues } from './brush3.mjs'
const U = strokes.UPPER
const ppu = 40, CELL = 5.3
function fila(names, spine) {
  const cs = []
  names.forEach((n, i) => {
    const ss = n === 'LL' ? strokes.LIGATURES.LL : U[n]
    for (const [x, y, r] of circlesWith(ss, BOLD, spine)) cs.push([x + i * CELL, y, r])
  })
  const view = { x0: -0.8, y0: -0.9, x1: names.length * CELL - 0.8, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}
const grupos = [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'LL', 'M'], ['N', 'O', 'P', 'Q', 'R', 'S', 'T'], ['U', 'V', 'W', 'X', 'Y', 'Z']]
const rows = [{ label: 'SKULLEYGLYPH · el pincel arreglado, en las 26 runas (Bold)', size: 30, bold: true, opacity: 1 }]
for (const g of grupos) {
  rows.push({ label: `${g.join(' ')} · antes`, size: 20, opacity: 0.6 })
  rows.push(fila(g, antes))
  rows.push({ label: `${g.join(' ')} · después`, size: 20 })
  rows.push(fila(g, despues))
}
console.log(await sheet(rows, 'pincel-antes-despues.png', { pad: 36, gap: 14 }))
