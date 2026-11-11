// Revisión del alfabeto contra las reglas de M N O P Q R (Oscar, 2026-11-10):
// 1) figura grande y cerrada; 2) de pie y de frente; 3) peso arriba y abajo;
// 4) acentos cortos, verticales, aparte y simétricos; 5) un solo hueco.
// Arreglo mínimo: cada runa conserva su idea y solo se corrige la regla que
// rompe. Ya cumplen A C E M N O P Q R U V W Y Z y las nuevas K L S; la H se
// queda (planchas y acentos simétricos, como la N).
import { rasterize, sheet, BOLD, strokes as V21 } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Bh, Dr, Cv, R, arc, closed, box, triDown, rot180 } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER, P = Math.PI
const sp = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
const ovalo = (cx, cy, rx, ry, r = R.v) => Cv(arc(cx, cy, rx, ry, -P / 2, 2 * P + 0.55, 30), { r })

const F2 = [closed([[0.4, 0.6], [3.6, 0.6], [3.6, 2.7], [0.4, 2.7]]), Dr(1, 3.4, 1.5, 5), Dr(2.5, 3.4, 3, 5)]
export const NUEVAS = {
  B: { por: 'la caja se cierra (abierta se leía como la ח hebrea)', g: [sp(-0.3, 3.4, 0.1, 3.4), box(1, 1.2, 3, 5.4), sp(4.3, 3.4, 3.9, 3.4)] },
  D: { por: 'el ojo crece hasta tocar las dos barras: una sola figura', g: [Bh(0.2, 3.8, 0.9), ovalo(2, 3.0, 1.4, 1.85), Bh(0.2, 3.8, 5.1)] },
  F: { por: 'el corchete se cierra en caja; las dos gotas siguen abajo', g: F2 },
  G: { por: 'el gancho se vuelve una gota, como la de la R', g: [triDown(0.4, 0.4, 3.6, 3.6), Dr(1.75, 4.1, 2.25, 5.8)] },
  I: { por: 'el cuenco se cierra con una plancha arriba', g: [Dr(1.75, 0.35, 2.25, 2.1), closed(arc(2, 2.75, 1.6, 2.3, 0, P, 14))] },
  J: { por: 'el gancho se vuelve una gota bajo el óvalo', g: [ovalo(2, 1.85, 1.3, 1.35), Dr(2, 3.75, 2, 5.7)] },
  T: { por: 'igual que la F, de cabeza', g: rot180(F2) },
  X: { por: 'las diagonales cruzadas se vuelven dos triángulos que se tocan', g: [closed([[0.2, 0.8], [1.95, 3.0], [0.2, 5.2]]), closed([[3.8, 0.8], [2.05, 3.0], [3.8, 5.2]])] },
}

function palabra(glyphs, ppu, gap = 0.5) {
  const boxes = []; let x = 0
  for (const ss of glyphs) {
    if (!ss) { x += 2; continue }
    const bs = nibBoxes(ss, BOLD)
    const left = Math.min(...bs.map(([bx, , w, hh]) => bx - Math.max(w, hh * 0.3))), right = Math.max(...bs.map(([bx, , w, hh]) => bx + Math.max(w, hh * 0.3)))
    for (const [bx, by, w, h, a, r] of bs) boxes.push([bx - left + x, by, w, h, a, r])
    x += right - left + gap
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.0, x1: x, y1: 7.1 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}
const DIM = { ink: [110, 110, 110], bg: [0, 0, 0] }
const rows = [{ label: 'SKULLEYGLYPH · revisión contra las reglas de M N O P Q R', size: 28, bold: true, opacity: 1 },
  { label: 'Cada runa: la v2.1 publicada (izquierda) y la corregida (derecha)', size: 20, opacity: 0.7 }]
const nombres = Object.keys(NUEVAS)
for (let i = 0; i < nombres.length; i += 2) {
  const par = nombres.slice(i, i + 2)
  rows.push({ label: par.map((n) => `${n} · ${NUEVAS[n].por}`).join('     |     '), size: 18 })
  const gl = []
  par.forEach((n, k) => { if (k) gl.push(null, null); gl.push(V21.UPPER[n], null, NUEVAS[n].g) })
  rows.push(palabra(gl, 40))
}
const final = (n) => (NUEVAS[n] ? NUEVAS[n].g : U[n])
rows.push({ label: 'El alfabeto con los arreglos', size: 22 })
for (const fila of [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'], ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']]) rows.push(palabra(fila.map(final), 36))
rows.push({ label: 'SKULLEY RAD · OSCAR', size: 20 })
rows.push(palabra([final('S'), final('K'), final('U'), S5.LIGATURES.LL, final('E'), final('Y'), null, final('R'), final('A'), final('D'), null, final('O'), final('S'), final('C'), final('A'), final('R')], 34))
console.log(await sheet(rows, 'revision.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
