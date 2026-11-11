// La S y la K como un solo trazo (Oscar, 2026-11-10: "se ven como muchas líneas
// sobrepuestas"). La S: el rayo de un solo grosor, que solo se afila en la cola
// (la barra delgada entre dos diagonales gruesas dejaba una bola en cada
// esquina). La K: el gancho como una curva que sale del tallo, o sin gancho.
import { SKULLEYRAD, rasterize, sheet, BOLD, circlesWith, core } from './bench.mjs'
import { fieldJoined, spine2 } from './forms.mjs'
import { wordDuctus2, PAIR_ENTRY } from './ductus2.mjs'
import { R } from './brush3.mjs'

const K = 0.05
const S_UNO = (ss) => ss.map((s, i) => (i === 1 ? { ...s, r: R.v * 0.96 } : s))
const K_CURVA = (ss) => ss.map((s, i) => (i === 0 ? { ...s, hookStyle: 'curl' } : s))
const K_SIN = (ss) => ss.map((s, i) => (i === 0 ? { p: s.p } : s))
const VARIANTES = [
  { label: 'Hoy: la barra del rayo es más delgada que sus diagonales y el gancho de la K gira más cerrado que el pincel' },
  { label: '1 · Rayo de un solo grosor + gancho de una sola curva que sale del tallo', s: S_UNO, k: K_CURVA },
  { label: '2 · Rayo de un solo grosor + K sin gancho: el hilo entra al pie del tallo', s: S_UNO, k: K_SIN, entry: { stroke: 0, at: 'end', mode: 'smooth', arrive: [0.9, 0.42] } },
]
const ENTRY_HOY = { ...PAIR_ENTRY['S>K'] }

function sueltas(seq) {
  const cs = []
  ;[seq[0], seq[1]].forEach((g, i) => { for (const [x, y, r] of circlesWith(g.strokes, BOLD, spine2)) cs.push([x + i * 5.2, y, r]) })
  const ppu = 70, view = { x0: -0.7, y0: -0.9, x1: 10.0, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  return rasterize({ f: core.distanceField(cs, { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }), w, h }, ppu)
}

const rows = [{ label: 'SKULLEYGLYPH · la S y la K de un solo trazo', size: 32, bold: true, opacity: 1 }]
for (const v of VARIANTES) {
  const seq = SKULLEYRAD()
  if (v.s) seq[0] = { ...seq[0], strokes: v.s(seq[0].strokes) }
  if (v.k) seq[1] = { ...seq[1], strokes: v.k(seq[1].strokes) }
  PAIR_ENTRY['S>K'] = v.entry || ENTRY_HOY
  const w = wordDuctus2(seq, BOLD)
  const g = (n) => w.glyphs.find((x) => x.name === n)
  rows.push({ label: v.label, size: 22 })
  rows.push(sueltas(seq))
  rows.push(rasterize(fieldJoined(w, { x0: g('S').x0 - 0.4, y0: -1.4, x1: g('U').x1 + 0.3, y1: 7.2 }, 70, K * BOLD), 70))
}
PAIR_ENTRY['S>K'] = ENTRY_HOY
console.log(await sheet(rows, 's-k-arreglo.png', { pad: 40, gap: 18 }))
