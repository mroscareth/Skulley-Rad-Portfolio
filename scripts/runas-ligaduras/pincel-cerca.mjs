// S, K, J y G en grande: pincel del prototipo (arriba) contra el arreglado (abajo).
import { strokes, circlesWith, core, rasterize, sheet, BOLD } from './bench.mjs'
import { strokeSpine as antes } from './brush2.mjs'
import { strokeSpine as despues } from './brush3.mjs'
const U = strokes.UPPER
const ppu = 90, CELL = 5.0
function fila(names, spine) {
  const cs = []
  names.forEach((n, i) => { for (const [x, y, r] of circlesWith(U[n], BOLD, spine)) cs.push([x + i * CELL, y, r]) })
  const view = { x0: -0.8, y0: -0.9, x1: names.length * CELL - 0.6, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}
const g = ['S', 'K', 'J', 'G']
console.log(await sheet([{ label: 'Antes', size: 24 }, fila(g, antes), { label: 'Después', size: 24 }, fila(g, despues)], 'pincel-cerca.png', { pad: 30, gap: 18 }))
