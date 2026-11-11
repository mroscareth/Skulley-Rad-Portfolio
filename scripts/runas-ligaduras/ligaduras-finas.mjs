// Prueba de ligadura delgada (Oscar, 2026-11-10: piso, techo e hilo de pluma no
// funcionaron; "haz una prueba con la ligatura delgada, y si no funciona la
// hacemos sin ligaturas"). El hilo va fino de verdad, como línea, sin depender
// de la dirección de la pluma: se afila de la runa que sale a la que entra.
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import * as S5 from './strokes5.mjs'

const glifo = (ch) => (ch === 'Ł' ? S5.LIGATURES.LL : S5.UPPER[ch])
const sinAcentos = (ss) => ss.filter((s) => s.kind !== 'dot')

// Lo más bajo, lo más alto y la media altura de la figura, de cada lado.
function puertos(fig) {
  const bottom = Math.max(...fig.map(([, y, , h]) => y + h)), top = Math.min(...fig.map(([, y, , h]) => y - h))
  const mid = (top + bottom) / 2
  const der = (bs) => Math.max(...bs.map(([x, , w]) => x + w)), izq = (bs) => Math.min(...bs.map(([x, , w]) => x - w))
  const banda = (y0, y1) => fig.filter(([, y, , h]) => y + h >= y0 && y - h <= y1)
  const pie = banda(bottom - 0.25, bottom), cabeza = banda(top, top + 0.25), medio = banda(mid - 0.3, mid + 0.3)
  return {
    pie: { der: [der(pie), bottom - 0.35], izq: [izq(pie), bottom - 0.35] },
    medio: { der: [der(medio.length ? medio : fig), mid], izq: [izq(medio.length ? medio : fig), mid] },
    cabeza: { der: [der(cabeza), top + 0.35], izq: [izq(cabeza), top + 0.35] },
  }
}

// Hilo fino: una fila de puntos que adelgaza de r0 a r1.
function hilo([ax, ay], [bx, by], r0, r1) {
  const n = Math.max(8, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.02))
  return Array.from({ length: n + 1 }, (_, k) => { const t = k / n, r = r0 + (r1 - r0) * t; return [ax + (bx - ax) * t, ay + (by - ay) * t, r, r, 0, true] })
}

const SISTEMAS = {
  piso: { gap: 1.1, de: 'pie', a: 'pie', r: [0.09, 0.05] },
  medio: { gap: 1.1, de: 'medio', a: 'medio', r: [0.09, 0.05] },
  diagonal: { gap: 1.3, de: 'pie', a: 'cabeza', r: [0.1, 0.03] },
}

function palabra(texto, sis, ppu) {
  const S = SISTEMAS[sis]
  const boxes = []
  let x = 0, prev = null
  for (const ch of texto.replaceAll('LL', 'Ł')) {
    if (ch === ' ') { x += 2.2; prev = null; continue }
    const ss = glifo(ch)
    const todo = nibBoxes(ss, BOLD)
    const left = Math.min(...todo.map(([bx, , w, h, a, r]) => bx - (r ? w : Math.max(w, h * Math.abs(Math.sin(a || 0))))))
    const right = Math.max(...todo.map(([bx, , w, h, a, r]) => bx + (r ? w : Math.max(w, h * Math.abs(Math.sin(a || 0))))))
    const dx = x - left
    const mover = (bs) => bs.map(([bx, by, w, h, a, r]) => [bx + dx, by, w, h, a, r])
    boxes.push(...mover(todo))
    const p = puertos(mover(nibBoxes(sinAcentos(ss), BOLD)))
    if (prev && S) { const a = prev[S.de].der, b = p[S.a].izq; boxes.push(...hilo([a[0] - 0.15, a[1]], [b[0] + 0.15, b[1]], S.r[0] * BOLD, S.r[1] * BOLD)) }
    prev = p
    x += right - left + (S ? S.gap : 0.5)
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.1, x1: x, y1: 7.2 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}

const TEXTOS = ['SKULLEY RAD', 'OSCAR MOCTEZUMA', 'LA LLAMA EN LA CALLE']
const rows = [{ label: 'SKULLEYGLYPH · prueba de ligadura delgada', size: 28, bold: true, opacity: 1 }]
for (const [sis, label] of [[null, 'Sin ligar'], ['piso', 'Hilo fino por abajo, de pie a pie'], ['medio', 'Hilo fino a media altura'], ['diagonal', 'Hilo fino en diagonal, del pie de una runa a la cabeza de la siguiente']]) {
  rows.push({ label, size: 20 })
  for (const t of TEXTOS) rows.push(palabra(t, sis, 26))
}
console.log(await sheet(rows, 'ligaduras-finas.png', { bg: [0, 0, 0], pad: 36, gap: 10 }))
