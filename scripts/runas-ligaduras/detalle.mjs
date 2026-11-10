import { SKULLEYRAD, rasterize, savePng, sheet, BOLD } from './bench.mjs'
import { fieldJoined } from './forms.mjs'
import { wordDuctus2 } from './ductus2.mjs'
const K = 0.05
const w = wordDuctus2(SKULLEYRAD(), BOLD)
const ppu = 56
console.log(await savePng(rasterize(fieldJoined(w, { x0: -0.6, y0: -1.4, x1: w.width + 0.6, y1: 7.4 }, ppu, K * BOLD), ppu), 'palabra.png'))
const g = (n) => w.glyphs.find((x) => x.name === n)
const zp = 100, rows = []
for (const [a, b] of [['K', 'LL'], ['LL', 'Y'], ['Y', 'A'], ['A', 'D']]) rows.push(rasterize(fieldJoined(w, { x0: g(a).x0 - 0.3, y0: -1.2, x1: g(b).x1 + 0.3, y1: 7.0 }, zp, K * BOLD), zp))
console.log(await sheet(rows, 'detalle.png', { pad: 16, gap: 14 }))
for (const t of w.threads) console.log(t.key, 'rOut', t.rOut.toFixed(2), 'rIn', t.rIn.toFixed(2))
