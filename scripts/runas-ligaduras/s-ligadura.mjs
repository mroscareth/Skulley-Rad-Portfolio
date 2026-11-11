// La ligadura de la S (pendiente 1 de typography.md). Oscar eligió la cola que
// da vuelta en la punta y la dibujó (2026-11-10): sale hacia arriba a la
// derecha en un arco bajo y entra al gancho de abajo del tallo de la K
// (DUCTUS.S y PAIR_ENTRY['S>K'] en ductus2.mjs).
import { SKULLEYRAD, rasterize, sheet, BOLD, MEDIUM, LIGHT } from './bench.mjs'
import { fieldJoined } from './forms.mjs'
import { wordDuctus2 } from './ductus2.mjs'

const K = 0.05
const w = wordDuctus2(SKULLEYRAD(), BOLD)
const g = (n) => w.glyphs.find((x) => x.name === n)
const rows = [
  { label: 'SKULLEYGLYPH · la ligadura de la S', size: 34, bold: true, opacity: 1 },
  { label: 'La cola del rayo da vuelta en la punta, sube en un arco bajo y entra al gancho de la K.', size: 22 },
  rasterize(fieldJoined(w, { x0: g('S').x0 - 0.4, y0: -1.4, x1: g('U').x1 + 0.3, y1: 7.2 }, 110, K * BOLD), 110),
  { label: 'SKULLEYRAD en Bold', size: 22 },
  rasterize(fieldJoined(w, { x0: -0.6, y0: -1.5, x1: w.width + 0.6, y1: 7.3 }, 44, K * BOLD), 44),
]
for (const [name, wt] of [['Medium', MEDIUM], ['Light', LIGHT]]) {
  const ww = wordDuctus2(SKULLEYRAD(), wt)
  rows.push({ label: `SKULLEYRAD en ${name}`, size: 22 })
  rows.push(rasterize(fieldJoined(ww, { x0: -0.6, y0: -1.5, x1: ww.width + 0.6, y1: 7.3 }, 34, K * wt), 34))
}
console.log(await sheet(rows, 's-ligadura.png', { pad: 44, gap: 26 }))
for (const t of w.threads.filter((t) => t.key === 'S>K')) console.log(t.key, 'rOut', t.rOut.toFixed(2), 'rIn', t.rIn.toFixed(2), 'P', t.P.map((v) => v.toFixed(2)), 'Q', t.Q.map((v) => v.toFixed(2)))
