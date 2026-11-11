// S, K, L y LL rehechas con las reglas de las favoritas de Oscar, M N O P Q R
// (2026-11-10): 1) una figura grande y cerrada que llena la caja; 2) de pie y
// de frente; 3) peso arriba y abajo, lados delgados (lo da la pluma); 4) acentos
// cortos, verticales, aparte de la figura y acomodados con simetría; 5) un solo
// hueco sencillo. Cada una usa una figura que ninguna otra runa tiene.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br, Dr, Cv, R, arc, closed } from './brush5.mjs'
import * as S5 from './strokes5.mjs'
const U = S5.UPPER, P = Math.PI
const gota = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.9, bend: 0.06 })
const pico = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })
// Óvalo cerrado (sin la abertura del ensō).
const ovalo = (cx, cy, rx, ry) => Cv(arc(cx, cy, rx, ry, -P / 2, 2 * P + 0.55, 30), { r: R.v })
// Cúpula cerrada por una base recta, como una P sin su barra suelta.
const cupula = (y0, y1) => closed([[0.4, y1], ...arc(2, y0 + 1.9, 1.6, 1.9, P, P, 12), [3.6, y1]])

export const S_OPC = {
  // El giro de la S está en los acentos: uno arriba a la derecha y otro abajo a
  // la izquierda, donde la S empieza y termina.
  'S-1 · Paralelogramo, con un pico arriba a la derecha y otro abajo a la izquierda': [closed([[0.3, 1.1], [2.75, 1.1], [3.7, 4.9], [1.25, 4.9]]), pico(3.2, -0.6, 3.0, 0.9), pico(0.8, 6.6, 1.0, 5.1)],
  'S-2 · Hexágono, con los picos en giro': [closed([[1.05, 0.95], [2.95, 0.95], [3.9, 3.0], [2.95, 5.05], [1.05, 5.05], [0.1, 3.0]]), pico(3.3, -0.65, 3.05, 0.8), pico(0.7, 6.65, 0.95, 5.2)],
  'S-3 · Óvalo con una media luna adentro que le da la curva de la S': [ovalo(2, 3.0, 1.75, 2.45), Dr(1.25, 1.65, 2.75, 4.35, { r: R.v * 0.85, bend: -0.55 })],
}
export const K_OPC = {
  'K-1 · La K-A cerrada: cúpula con base y dos gotas abajo': [cupula(0.6, 3.85), gota(1.3, 4.35, 1.05, 5.85), gota(2.7, 4.35, 2.95, 5.85)],
  'K-2 · Escudo con dos cuernos': [closed([[0.4, 1.0], [3.6, 1.0], [3.6, 3.1], [2.0, 5.55], [0.4, 3.1]]), pico(0.7, -0.45, 1.0, 0.85), pico(3.3, -0.45, 3.0, 0.85)],
  'K-3 · Trapecio ancho arriba con dos gotas abajo': [closed([[0.2, 0.7], [3.8, 0.7], [2.95, 4.0], [1.05, 4.0]]), gota(1.4, 4.45, 1.2, 5.9), gota(2.6, 4.45, 2.8, 5.9)],
}
// La LL es la L con el acento doble, o la figura doble.
export const L_OPC = {
  'L-1 · Montículo con una gota adentro (LL: dos gotas)': {
    L: [closed([[1.15, 0.9], [2.85, 0.9], [3.8, 5.3], [0.2, 5.3]]), gota(2.0, 2.3, 2.0, 4.3)],
    LL: [closed([[1.15, 0.9], [2.85, 0.9], [3.8, 5.3], [0.2, 5.3]]), gota(1.55, 2.5, 1.4, 4.35), gota(2.45, 2.5, 2.6, 4.35)],
  },
  'L-2 · Pilar con una gota abajo (LL: dos pilares)': {
    L: [closed([[0.95, 0.5], [3.05, 0.5], [3.05, 4.35], [0.95, 4.35]]), gota(2.0, 4.75, 2.0, 6.05)],
    LL: [closed([[0.15, 0.5], [3.85, 0.5], [3.85, 4.35], [0.15, 4.35]]), Br([[2.0, 0.75], [2.0, 4.1]], { end: null, r: R.v }), gota(1.05, 4.75, 1.0, 6.05), gota(2.95, 4.75, 3.0, 6.05)],
  },
  'L-3 · Bloque con un pico arriba (LL: dos bloques, como escalones)': {
    L: [closed([[0.85, 1.85], [3.15, 1.85], [3.8, 5.3], [0.2, 5.3]]), pico(2.0, 0.15, 2.0, 1.45)],
    LL: [closed([[0.2, 3.35], [3.8, 3.35], [3.8, 5.35], [0.2, 5.35]]), closed([[0.85, 0.75], [3.15, 0.75], [3.15, 2.75], [0.85, 2.75]])],
  },
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

const FAV = ['M', 'N', 'O', 'P', 'Q', 'R'].map((n) => U[n])
// Cada opción suelta, junto a las favoritas y dentro de SKULLEY con las demás
// opciones que recomiendo (S-2, K-1, L-1).
const REC = { S: S_OPC['S-2 · Hexágono, con los picos en giro'], K: K_OPC['K-1 · La K-A cerrada: cúpula con base y dos gotas abajo'], L: L_OPC['L-1 · Montículo con una gota adentro (LL: dos gotas)'] }
const skulley = ({ S = REC.S, K = REC.K, L = REC.L }) => [S, K, U.U, L.LL, U.E, U.Y]
const rows = [{ label: 'SKULLEYGLYPH · S, K, L y LL con las reglas de M N O P Q R', size: 28, bold: true, opacity: 1 }]
const PPU = 34
for (const [label, g] of Object.entries(S_OPC)) { rows.push({ label, size: 20 }); rows.push(palabra([g, null, ...FAV, null, ...skulley({ S: g })], PPU)) }
for (const [label, g] of Object.entries(K_OPC)) { rows.push({ label, size: 20 }); rows.push(palabra([g, null, ...FAV, null, ...skulley({ K: g })], PPU)) }
for (const [label, o] of Object.entries(L_OPC)) { rows.push({ label, size: 20 }); rows.push(palabra([o.L, o.LL, null, ...FAV, null, ...skulley({ L: o })], PPU)) }
console.log(await sheet(rows, 'reglas.png', { bg: [0, 0, 0], pad: 36, gap: 12 }))
