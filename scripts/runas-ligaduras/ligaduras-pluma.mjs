// Ligaduras con la pluma plana (Oscar, 2026-11-10). Con la punta plana un hilo
// horizontal sale grueso, como plancha, y uno diagonal sale fino, sin forzarlo.
// Tres sistemas que salen solos de la figura de cada runa (sin contar acentos):
//   piso   se unen por abajo, de pie a pie (como el árabe)
//   techo  se unen por arriba, de cabeza a cabeza (como el devanagari)
//   hilo   del pie de una a la cabeza de la siguiente, en diagonal fina
import { rasterize, sheet, BOLD } from './bench.mjs'
import { nibBoxes, nibField } from './pluma.mjs'
import { Br } from './brush5.mjs'
import * as S5 from './strokes5.mjs'

const GAP = 0.8
const glifo = (ch) => (ch === 'Ł' ? S5.LIGATURES.LL : S5.UPPER[ch])
const sinAcentos = (ss) => ss.filter((s) => s.kind !== 'dot')
const extremos = (bs) => ({
  left: Math.min(...bs.map(([x, , w, h, a]) => x - Math.max(w, h * Math.abs(Math.sin(a || 0))))),
  right: Math.max(...bs.map(([x, , w, h, a]) => x + Math.max(w, h * Math.abs(Math.sin(a || 0))))),
})

// Puntos de unión de una runa ya colocada: lo más bajo y lo más alto de su
// figura, del lado derecho (salida) y del izquierdo (entrada).
function puertos(fig) {
  const bottom = Math.max(...fig.map(([, y, , h]) => y + h)), top = Math.min(...fig.map(([, y, , h]) => y - h))
  const pie = fig.filter(([, y, , h]) => y + h >= bottom - 0.2), cabeza = fig.filter(([, y, , h]) => y - h <= top + 0.2)
  const der = (bs) => Math.max(...bs.map(([x, , w]) => x + w)), izq = (bs) => Math.min(...bs.map(([x, , w]) => x - w))
  return { pie: { der: [der(pie), bottom - 0.55], izq: [izq(pie), bottom - 0.55] }, cabeza: { der: [der(cabeza), top + 0.55], izq: [izq(cabeza), top + 0.55] } }
}

export function palabraLigada(texto, sistema, ppu) {
  const boxes = []
  let x = 0, prev = null
  for (const ch of texto.replaceAll('LL', 'Ł')) {
    if (ch === ' ') { x += 2.2; prev = null; continue }
    const ss = glifo(ch)
    const todo = nibBoxes(ss, BOLD), fig = nibBoxes(sinAcentos(ss), BOLD)
    const { left, right } = extremos(todo)
    const dx = x - left
    const mover = (bs) => bs.map(([bx, by, w, h, a, r]) => [bx + dx, by, w, h, a, r])
    boxes.push(...mover(todo))
    const p = puertos(mover(fig))
    if (prev && sistema) {
      const [a, b] = sistema === 'piso' ? [prev.pie.der, p.pie.izq] : sistema === 'techo' ? [prev.cabeza.der, p.cabeza.izq] : [prev.pie.der, p.cabeza.izq]
      boxes.push(...nibBoxes([Br([[a[0] - 0.3, a[1]], [b[0] + 0.3, b[1]]], { end: null })], BOLD))
    }
    prev = p
    x += right - left + (sistema ? GAP : 0.5)
  }
  return rasterize(nibField(boxes, { x0: -0.5, y0: -1.1, x1: x, y1: 7.2 }, ppu), ppu, { ink: [240, 240, 240], bg: [0, 0, 0] })
}

const TEXTOS = ['SKULLEY RAD', 'OSCAR MOCTEZUMA', 'LA LLAMA EN LA CALLE']
const SISTEMAS = [
  [null, 'Sin ligar (hoy)'],
  ['piso', 'Piso corrido: se unen por abajo, de pie a pie (como el árabe)'],
  ['techo', 'Techo corrido: se unen por arriba, de cabeza a cabeza (como el devanagari)'],
  ['hilo', 'Hilo diagonal: del pie de una runa a la cabeza de la siguiente'],
]
const rows = [{ label: 'SKULLEYGLYPH · propuestas de ligadura con la pluma plana', size: 28, bold: true, opacity: 1 }]
for (const [sis, label] of SISTEMAS) {
  rows.push({ label, size: 20 })
  for (const t of TEXTOS) rows.push(palabraLigada(t, sis, 26))
}
console.log(await sheet(rows, 'ligaduras-pluma.png', { bg: [0, 0, 0], pad: 36, gap: 10 }))
