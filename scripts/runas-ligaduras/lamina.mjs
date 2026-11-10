// Lámina 3: el ductus de cada runa (orden, dirección, entrada y salida) y la
// palabra unida siguiéndolo.
import { pathToFileURL } from 'node:url'
import { SKULLEYRAD, wordToday, fieldOf, rasterize, sheet, core, circlesWith, BOLD, MEDIUM, LIGHT, ROOT, HERE, path } from './bench.mjs'
import { fieldJoined, measure, spine2 } from './forms.mjs'
import { wordDuctus2 as wordDuctus, DUCTUS, exitOf, entryOf } from './ductus2.mjs'
const sharp = (await import(pathToFileURL(ROOT + '/node_modules/sharp/lib/index.js').href)).default
const K = 0.05
const BG = [2, 45, 214]

// ── Ductus: las 9 runas sueltas, esqueleto en blanco, marcas tenues ──────
async function ductusChart(weight, ppu) {
  const seq = SKULLEYRAD()
  const gap = 1.3
  let cursor = 0
  const items = seq.map((g) => { const m = measure(g.strokes, weight); const it = { g, m, dx: cursor - m.left }; cursor += m.right - m.left + gap; return it })
  const W = cursor - gap
  const view = { x0: -0.9, y0: -1.3, x1: W + 0.9, y1: 7.6 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const opts = { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }
  const skel = [], marks = []
  for (const it of items) {
    const du = DUCTUS[it.g.name]
    const sh = (ss) => circlesWith(ss, weight, spine2).map(([x, y, r]) => [x + it.dx, y, r])
    skel.push(...sh(du.order.map((i) => it.g.strokes[i])))
    marks.push(...sh((du.marks || []).map((i) => it.g.strokes[i])))
  }
  const fs = core.distanceField(skel, opts), fm = core.distanceField(marks, opts)
  const buf = Buffer.alloc(w * h * 3)
  const mark = [122, 150, 240]
  for (let i = 0; i < w * h; i++) {
    const as = Math.min(1, Math.max(0, 0.5 - fs[i] * ppu)), am = Math.min(1, Math.max(0, 0.5 - fm[i] * ppu)) * (1 - as)
    for (let c = 0; c < 3; c++) buf[i * 3 + c] = Math.round(BG[c] * (1 - as - am) + 255 * as + mark[c] * am)
  }
  // Flechas del recorrido, números, entrada (verde) y salida (magenta).
  const X = (x) => ((x - view.x0) * ppu).toFixed(1), Y = (y) => ((y - view.y0) * ppu).toFixed(1)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><marker id="ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#0a0510"/></marker></defs>`
  for (const it of items) {
    const du = DUCTUS[it.g.name]
    du.order.forEach((si, k) => {
      const { pts } = spine2(it.g.strokes[si], { step: 0.03, weight })
      const p = pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1).map(([x, y]) => `${X(x + it.dx)},${Y(y)}`).join(' ')
      svg += `<polyline points="${p}" fill="none" stroke="#0a0510" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ar)" opacity="0.85"/>`
      const [sx, sy] = pts[0]
      svg += `<circle cx="${X(sx + it.dx)}" cy="${Y(sy)}" r="13" fill="#f5ff00" stroke="#0a0510" stroke-width="2"/><text x="${X(sx + it.dx)}" y="${(+Y(sy) + 6).toFixed(1)}" text-anchor="middle" font-family="Outfit, Arial" font-weight="700" font-size="17" fill="#0a0510">${k + 1}</text>`
    })
    if (du.entry) { const e = entryOf(it.g.strokes[du.entry.stroke], du.entry); svg += `<circle cx="${X(e.p[0] + it.dx)}" cy="${Y(e.p[1])}" r="8" fill="#39ff14" stroke="#0a0510" stroke-width="2" transform="translate(-20,-16)"/>` }
    if (du.exit && du.joins !== false) {
      const p = exitOf(it.g.strokes[du.exit.stroke], du.exit).p
      svg += `<circle cx="${X(p[0] + it.dx)}" cy="${Y(p[1])}" r="9" fill="#e600ff" stroke="#ffffff" stroke-width="2"/>`
    }
    if (du.joins === false) svg += `<text x="${X(it.m.right + it.dx - 0.2)}" y="${Y(6.9)}" text-anchor="end" font-family="Outfit, Arial" font-weight="600" font-size="17" fill="#ffffff" fill-opacity="0.8">no se une</text>`
  }
  svg += '</svg>'
  const out = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { buf: out.data, w, h }
}

const hoy = wordToday(SKULLEYRAD(), BOLD)
const nue = wordDuctus(SKULLEYRAD(), BOLD)
const ppu = 52
const Wmax = Math.max(hoy.width, nue.width)
const viewOf = (w) => ({ x0: -0.6 - (Wmax - w.width) / 2, y0: -1.5, x1: w.width + 0.6 + (Wmax - w.width) / 2, y1: 7.3 })
const g = (n) => nue.glyphs.find((x) => x.name === n)
const zp = 74
const rows = [
  { label: 'SKULLEYGLYPH · ligaduras por ductus, con grosor continuo', size: 34, bold: true, opacity: 1 },
  { label: 'Cómo se escribe cada runa: números = orden de los trazos, flechas = dirección del pincel.', size: 22 },
  { label: 'Verde = donde cae el pincel (entra el hilo). Magenta = donde se levanta (sale el hilo). Tenue = marcas que se ponen al final, sin hilo.', size: 22 },
  await ductusChart(BOLD, 44),
  { label: 'Hoy (v2.1)', size: 22 },
  rasterize(fieldOf(hoy, viewOf(hoy), ppu), ppu),
  { label: 'Propuesta: el hilo arranca con el grosor con que termina la runa y llega con el grosor con que empieza la siguiente.', size: 22 },
  rasterize(fieldJoined(nue, viewOf(nue), ppu, K * BOLD), ppu),
  { label: 'Detalle: el apretón de la K se suelta y sube a la U · la punta de la U baja a la doble L · el remate de la onda se vuelve hilo hasta el anillo', size: 20 },
  rasterize(fieldJoined(nue, { x0: g('K').x0 - 0.3, y0: -1.2, x1: g('E').x1 + 0.3, y1: 7.0 }, zp, K * BOLD), zp),
  { label: 'Detalle: el anillo se desprende hacia la Y · la barra de la Y baja a la R · la gota de la R se arrastra a la A · la base de la A sigue a la D', size: 20 },
  rasterize(fieldJoined(nue, { x0: g('E').x0 - 0.3, y0: -1.2, x1: g('D').x1 + 0.3, y1: 7.0 }, zp, K * BOLD), zp),
]
for (const [name, wt, p] of [['Medium', MEDIUM, 34], ['Light', LIGHT, 34]]) {
  const w = wordDuctus(SKULLEYRAD(), wt)
  rows.push({ label: `Propuesta en ${name}`, size: 20 })
  rows.push(rasterize(fieldJoined(w, { x0: -0.6, y0: -1.5, x1: w.width + 0.6, y1: 7.3 }, p, K * wt), p))
}
console.log(await sheet(rows, 'lamina.png', { pad: 44, gap: 30 }))
