// La construcción arreglada (brush5 + strokes5) contra la de hoy, en las 26
// runas, con la brocha de hoy: aquí solo se juzga que cada runa se lea como
// trazos limpios, no el estilo de la brocha.
import { strokes, circlesWith, core, rasterize, sheet, smin, BOLD } from './bench.mjs'
import { strokeSpine as antes } from './brush2.mjs'
import { strokeSpine as despues } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const CERCA = !!process.env.CERCA
const ppu = CERCA ? 78 : 40, CELL = 5.3, WELD = 0.14
const pick = (set, n) => (n === 'LL' ? set.LIGATURES.LL : set.UPPER[n])
function fila(names, set, spine, weld) {
  const view = { x0: -0.8, y0: -0.9, x1: names.length * CELL - 0.8, y1: 7.0 }
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const opts = { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }
  const shift = (cs, i) => cs.map(([x, y, r]) => [x + i * CELL, y, r])
  let f = null
  names.forEach((n, i) => {
    const ss = pick(set, n)
    if (!weld) { const g = core.distanceField(shift(circlesWith(ss, BOLD, spine), i), opts); f = f ? f.map((v, k) => Math.min(v, g[k])) : g; return }
    // Cada trazo con su campo y las uniones fundidas: los trazos de una misma
    // runa se sueldan con un filete en vez de un pliegue.
    // Solo se sueldan los trazos que de verdad se encuentran; los acentos que
    // flotan (picos, gotas) siguen sueltos.
    const sets = ss.map((st) => circlesWith([st], BOLD, spine))
    const touch = (A, B) => A.some(([ax, ay, ar], ia) => ia % 3 === 0 && B.some(([bx, by, br], ib) => ib % 3 === 0 && Math.hypot(ax - bx, ay - by) < ar + br - 0.02))
    const fields = sets.map((cs) => core.distanceField(shift(cs, i), opts))
    let gf = fields[0], joined = [sets[0]]
    for (let j = 1; j < sets.length; j++) {
      const weldIt = joined.some((A) => touch(A, sets[j]))
      gf = gf.map((v, k) => (weldIt ? smin(v, fields[j][k], WELD) : Math.min(v, fields[j][k])))
      joined.push(sets[j])
    }
    f = f ? f.map((v, k) => Math.min(v, gf[k])) : gf
  })
  return rasterize({ f, w, h }, ppu)
}
const grupos = CERCA ? [['S', 'A', 'V', 'C'], ['Z', 'F', 'B', 'G']] : [['A', 'B', 'C', 'D', 'E', 'F', 'G'], ['H', 'I', 'J', 'K', 'L', 'LL', 'M'], ['N', 'O', 'P', 'Q', 'R', 'S', 'T'], ['U', 'V', 'W', 'X', 'Y', 'Z']]
const rows = [{ label: 'SKULLEYGLYPH · cada runa de trazos limpios (misma brocha de hoy)', size: 30, bold: true, opacity: 1 }]
for (const g of grupos) {
  rows.push({ label: `${g.join(' ')} · hoy`, size: 20, opacity: 0.6 })
  rows.push(fila(g, strokes, antes, false))
  rows.push({ label: `${g.join(' ')} · construcción arreglada`, size: 20 })
  rows.push(fila(g, S5, despues, true))
}
console.log(await sheet(rows, CERCA ? 'construccion-cerca.png' : 'construccion.png', { pad: 36, gap: 14 }))
