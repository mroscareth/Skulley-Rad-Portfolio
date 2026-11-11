// Las runas con la pluma plana: de cerca, las 26 y una palabra.
import { rasterize, sheet, BOLD, ROOT } from './bench.mjs'
import { pathToFileURL } from 'node:url'
const sharp = (await import(pathToFileURL(ROOT + '/node_modules/sharp/lib/index.js').href)).default
const NEGRO = { ink: [240, 240, 240], bg: [0, 0, 0] }
import { nibBoxes, nibField } from './pluma.mjs'
import * as S5 from './strokes5.mjs'
const CELL = 5.3
const pick = (n) => (n === 'LL' ? S5.LIGATURES.LL : S5.UPPER[n])
function fila(names, ppu) {
  const boxes = []
  names.forEach((n, i) => { for (const [x, y, bx, by, a, r] of nibBoxes(pick(n), BOLD)) boxes.push([x + i * CELL, y, bx, by, a, r]) })
  return rasterize(nibField(boxes, { x0: -0.9, y0: -1.0, x1: names.length * CELL - 0.7, y1: 7.1 }, ppu), ppu)
}
function palabra(names, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const n of names) {
    if (n === ' ') { x += 2; continue }
    const bs = nibBoxes(pick(n), BOLD)
    const left = Math.min(...bs.map(([bx, , w, hh]) => bx - Math.max(w, hh * 0.3))), right = Math.max(...bs.map(([bx, , w, hh]) => bx + Math.max(w, hh * 0.3)))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.0, x1: x, y1: 7.1 }, ppu), ppu, NEGRO)
}
const grupos = [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'LL', 'M'], ['N', 'O', 'P', 'Q', 'R', 'S', 'T'], ['U', 'V', 'W', 'X', 'Y', 'Z']]
// La referencia de Oscar arriba, en el mismo blanco sobre negro, para comparar parejo.
const refPath = process.env.REF
const rows = [{ label: refPath ? 'SKULLEYGLYPH · pluma plana, junto a la referencia' : 'SKULLEYGLYPH · pluma plana', size: 30, bold: true, opacity: 1 }]
if (refPath) { const { data, info } = await sharp(refPath).resize({ width: 900 }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); rows.push({ label: 'Referencia', size: 20 }); rows.push({ buf: data, w: info.width, h: info.height }) }
rows.push({ label: 'SKULLEYGLYPH', size: 20 })
rows.push(palabra(['S', 'K', 'U', 'LL', 'E', 'Y', ' ', 'R', 'A', 'D'], 52))
rows.push(palabra(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 40))
rows.push(palabra(['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'], 40))
rows.push(palabra(['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'], 40))
console.log(await sheet(rows, process.env.OUT || 'pluma.png', { bg: [0, 0, 0], pad: 36, gap: 18 }))
