// Trazos de SKULLEYGLYPH: las 26 runas que eligió Oscar (2026-11-09), sus
// minúsculas, los números mayas, los signos y los acentos. Fuente única de
// scripts/gen-runes.mjs (fuente descargable + atlas de los shaders).
//
// Lenguaje: una figura centrada (ensō, copa, arco, triángulo, rombo, caja)
// con acentos de pincel (gota, pico de cresta, barra, gancho). Sin cruces en +.

import { Sw, Ri, Dr, Br, Bh, Hk, Cv, R, arc, triUp, triDown, diamond, box, capBox, rot180, mirrorX } from './runeBrush.js'

const P = Math.PI
const V = { r: R.v }
const J = { start: 'join' }
const sp = (x1, y1, x2, y2) => Dr(x1, y1, x2, y2, { r: R.v * 0.8, bend: 0.06 })            // pico de cresta
const crest = (y = 0) => [sp(0.9, y, 1.15, y + 1.3), sp(2, y - 0.2, 2, y + 1.2), sp(3.1, y, 2.85, y + 1.3)]
const enso = (cx, cy, rx, ry, o = V) => Cv(arc(cx, cy, rx, ry, -2.2, 5.6), o)

const W = [Dr(0.3, 0, 0.9, 1.4), Dr(1.8, 0, 2.2, 1.4), Dr(3.5, 0, 3.1, 1.4), Br([[0, 2.6], [4, 2.6], [1.2, 6]])]
const F = [Br([[0.4, 0.6], [3.6, 0.6], [3.6, 2.6], [0.6, 2.6]]), Dr(1, 3.4, 1.5, 5), Dr(2.5, 3.4, 3, 5)]

export const UPPER = {
  A: [triUp(0.3, 1.9, 3.7, 5.6), ...crest(0)],
  B: [sp(-0.3, 3.4, 0.1, 3.4), capBox(1, 1.2, 3, 5.4), sp(4.3, 3.4, 3.9, 3.4)],
  C: [box(0.5, 0.8, 3.5, 5.2), Dr(1.75, 2.2, 2.25, 3.8)],
  D: [Bh(0.3, 3.7, 0.9), enso(2, 3, 0.95, 1.05, { r: R.h * 1.2 }), Bh(0.3, 3.7, 5.1)],
  E: [Dr(2, -0.15, 2, 0.85), enso(2, 3, 1.15, 1.2), Dr(2, 6.15, 2, 5.15)],
  F,
  G: [triDown(0.4, 0.4, 3.6, 3.6), Hk([[2, 4.3], [2, 5.8]])],
  H: [Bh(0.3, 3.7, 0.9), Dr(1, 1.9, 1.5, 3.7), Dr(2.5, 1.9, 3, 3.7), Bh(0.3, 3.7, 5)],
  I: [Dr(1.75, 0.4, 2.25, 2.2), Cv(arc(2, 3.4, 1.25, 1.6, 0, P), V)],
  J: [enso(2, 1.7, 1.15, 1.25, { r: R.v * 0.9 }), Hk([[2, 3.4], [2, 5.5]])],
  K: [Hk([[0.4, 0.6], [2.2, 0.6], [2.2, 5.5]]), Ri(2.4, 2.6, 3.9, 4.6, J), Dr(3, 0, 3.6, 1.3)],
  L: [Cv([[0.3, 3.6], [1, 1.6], [2, 1.8], [2.2, 4], [3, 4.6], [3.7, 2.6]], V), Dr(3, 0.2, 3.5, 1.6)],
  M: rot180(W),
  N: [capBox(0.6, 0.5, 3.4, 4.3), Bh(0.2, 3.8, 5.4)],
  // La cabeza de Skulley: ensō con la cresta de tres picos.
  O: [enso(2, 3.9, 1.5, 1.7), Dr(0.95, 0, 1.2, 1.35, { r: R.v * 0.8 }), Dr(2, -0.2, 2, 1.25, { r: R.v * 0.8 }), Dr(3.05, 0, 2.8, 1.35, { r: R.v * 0.8 })],
  P: [Cv(arc(2, 2.6, 1.55, 1.9, P, P), V), Bh(0.3, 3.7, 3.9), Dr(1.75, 4.5, 2.25, 6)],
  Q: [enso(2, 3, 1.65, 2.45), Dr(1.1, 2.2, 1.4, 3.4), Dr(2.9, 2.2, 2.6, 3.4)],
  R: [triUp(0.6, 0.3, 3.4, 3.9), Dr(1.75, 4.3, 2.25, 6)],
  // El rayo del juego.
  S: [Br([[3.1, 0.2], [0.9, 3.1], [3.1, 3.1], [0.9, 5.9]], { fillet: 0.3 })],
  T: rot180(F),
  U: [Cv([[0.6, 0.4], [0.8, 4.2], [2, 5.5], [3.3, 4.4], [3.5, 0.6]], V), Dr(1.8, 1, 2.2, 2.6)],
  V: [sp(2, -0.2, 2, 1), triDown(0.4, 1.6, 3.6, 5.6)],
  W,
  X: [Dr(1, 0, 1.8, 1.5), Sw(4, 1.2, 0.6, 6, { bend: 0.4 }), Ri(0.4, 2.6, 3.8, 5.6)],
  Y: [Bh(0.3, 3.7, 0.6), triDown(0.6, 1.7, 3.4, 5.7)],
  Z: [sp(2, -0.3, 2, 0.6), diamond(2, 3, 1.3, 1.8), sp(2, 6.3, 2, 5.4)],
}

// Minúsculas: la misma runa a la altura de la x, como en las fuentes rúnicas.
const toLower = (ss) => ss.map((s) => ({
  ...s,
  p: s.p.map(([x, y]) => [0.5 + x * 0.75, 1.5 + y * 0.75]),
  scale: (s.scale ?? 1) * 0.8,
  fillet: (s.fillet ?? 0.7) * 0.75,
  ...(s.bend != null ? { bend: s.bend * 0.75 } : {}),
  ...(s.end === 'hane' ? { hookLen: (s.hookLen ?? 1.15) * 0.75 } : {}),
}))
export const LOWER = Object.fromEntries(Object.entries(UPPER).map(([k, ss]) => [k.toLowerCase(), toLower(ss)]))

// Números mayas: gota = 1, barra = 5, ensō = 0. Las gotas se paran sobre la barra.
const drops = (n, base) => {
  const xs = { 1: [2], 2: [1.3, 2.7], 3: [0.8, 2, 3.2], 4: [0.55, 1.5, 2.5, 3.45] }[n] || []
  return xs.map((x) => Dr(x - 0.15, base - 1.7, x + 0.15, base - 0.2, { r: R.v * (n === 4 ? 0.78 : 0.9) }))
}
export const DIGITS = {
  0: [Cv(arc(2, 3.6, 1.6, 1.25, -2.2, 5.6), V)],
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [n, drops(n, 4.4)])),
  5: [Bh(0.3, 3.7, 4.6)],
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [n + 5, [...drops(n, 3.7), Bh(0.3, 3.7, 4.6)]])),
}

// Signos: el mismo pincel con la forma que se reconoce, porque sirven para leer.
const period = Dr(1.75, 4.4, 2.25, 5.6)
const comma = Sw(2.4, 4.4, 1.5, 6.4, { bend: 0.15 })
const exclam = [Sw(2, 0.1, 2, 3.9, { bend: 0.08 }), period]
const question = [Cv([[0.7, 1.5], [1.5, 0.3], [3, 0.4], [3.2, 1.8], [2, 2.9], [2, 3.9]], V), period]
const paren = [Cv([[2.9, -0.3], [1.5, 1.6], [1.2, 3.2], [1.5, 4.9], [2.9, 6.6]], V)]
const bracket = [Br([[3, -0.3], [1.3, -0.3], [1.3, 6.4], [3, 6.4]])]
const brace = [Cv([[3, -0.3], [1.9, 0.3], [1.9, 2.6], [1, 3.1], [1.9, 3.7], [1.9, 6], [3, 6.5]], { r: R.h })]
const chev = [Br([[3.4, 1.2], [0.8, 3.2], [3.4, 5.2]])]
const guil = [Br([[2.1, 1.8], [0.5, 3.2], [2.1, 4.6]], { r: R.h }), Br([[3.7, 1.8], [2.1, 3.2], [3.7, 4.6]], { r: R.h })]
const tick = (x) => Sw(x, 0, x - 0.5, 1.6, { bend: 0.1, r: R.v * 0.85 })
export const SYMBOLS = {
  '.': [period], ',': [comma], ':': [Dr(1.75, 1.6, 2.25, 2.8), period], ';': [Dr(1.75, 1.6, 2.25, 2.8), comma],
  '!': exclam, '¡': rot180(exclam), '?': question, '¿': rot180(question),
  "'": [tick(2.3)], '"': [tick(1.5), tick(3.1)],
  '(': paren, ')': mirrorX(paren), '[': bracket, ']': mirrorX(bracket), '{': brace, '}': mirrorX(brace),
  '-': [Bh(0.8, 3.3, 3.2)], '_': [Bh(0, 4.2, 6.2)], '—': [Bh(-0.5, 4.5, 3.2)],
  '/': [Sw(3.6, -0.2, 0.4, 6.4, { bend: 0.1 })], '\\': [Sw(0.4, -0.2, 3.6, 6.4, { bend: -0.1 })], '|': [Sw(2, -0.3, 2, 6.6, { bend: 0.05 })],
  '+': [Bh(0.6, 3.4, 3.1), Sw(2, 1.6, 2, 4.7, { bend: 0.05 })], '=': [Bh(0.5, 3.5, 2.3), Bh(0.5, 3.5, 4.1)],
  '<': chev, '>': mirrorX(chev), '«': guil, '»': mirrorX(guil),
  '*': [Dr(2, 2.7, 2, 0.9), Dr(1.7, 3.2, 0.4, 4.2), Dr(2.3, 3.2, 3.6, 4.2)],
  '&': [Cv([[3.8, 5.8], [1.3, 2.9], [1.3, 1.2], [2.3, 0.4], [3.1, 1.2], [2.7, 2.5], [0.7, 4], [0.7, 5.3], [1.9, 6], [3.2, 5.1], [3.7, 3.8]], V)],
  '%': [Dr(0.8, 0.4, 1.2, 1.8), Sw(3.6, 0, 0.4, 6, { bend: 0.1 }), Dr(2.8, 4.2, 3.2, 5.6)],
  '$': [Cv([[3.3, 1.4], [2.2, 0.8], [0.9, 1.4], [1.1, 2.7], [2.9, 3.4], [3.1, 4.7], [1.8, 5.3], [0.6, 4.7]], V), Sw(2.1, -0.4, 2, 6.5, { bend: 0.05, r: R.h })],
  '#': [Sw(1.9, 0.4, 1.2, 5.8, { bend: 0, r: R.h * 1.1 }), Sw(3.4, 0.4, 2.7, 5.8, { bend: 0, r: R.h * 1.1 }), Bh(0.3, 3.9, 2.2), Bh(0.1, 3.7, 4)],
  '@': [Cv([[2.9, 2.6], [2.1, 2.2], [1.4, 3], [1.6, 4.1], [2.6, 4.1], [2.9, 3], [3, 4.3], [3.8, 4.1], [4, 3], [3.4, 1.1], [2, 0.6], [0.6, 1.4], [0, 3.2], [0.6, 5], [2, 5.8], [3.4, 5.4]], { r: R.h * 1.15 })],
  '~': [Cv([[0.4, 3.7], [1.2, 2.8], [2.1, 3.3], [2.9, 3.8], [3.6, 2.9]], { r: R.h * 1.1 })],
  '^': [Br([[0.8, 2.2], [2, 0.4], [3.2, 2.2]], { r: R.h })], '`': [Sw(1.3, 0, 2.3, 1.3, { bend: -0.1, r: R.v * 0.8 })],
  '°': [Cv(arc(2, 1.3, 0.9, 0.9, -2.2, 5.6), { r: R.h })], '…': [Dr(0.5, 4.4, 0.9, 5.6), Dr(1.75, 4.4, 2.25, 5.6), Dr(3.1, 4.4, 3.5, 5.6)],
  '·': [Dr(1.75, 2.6, 2.25, 3.6)],
  '€': [Cv(arc(2.3, 3, 1.6, 2.5, -0.75, -4.8), V), Bh(0, 2.6, 2.5, { r: R.h * 0.9 }), Bh(0, 2.4, 3.8, { r: R.h * 0.9 })],
}
// Comillas tipográficas y guiones: la misma forma que su versión simple.
Object.assign(SYMBOLS, { '“': SYMBOLS['"'], '”': SYMBOLS['"'], '‘': SYMBOLS["'"], '’': SYMBOLS["'"], '–': SYMBOLS['-'] })

// Acentos: el mismo pincel, más chico y delgado que los picos de las runas.
const MARKS = {
  acute: (T) => [Sw(2.7, T - 1.5, 1.8, T - 0.3, { bend: 0.08, r: R.v * 0.7 })],
  grave: (T) => [Sw(1.3, T - 1.5, 2.2, T - 0.3, { bend: -0.08, r: R.v * 0.7 })],
  circ: (T) => [Br([[1, T - 0.25], [2, T - 1.3], [3, T - 0.25]], { r: R.h * 0.9 })],
  diaer: (T) => [Dr(1.2, T - 1.2, 1.3, T - 0.35, { r: R.v * 0.6 }), Dr(2.8, T - 1.2, 2.7, T - 0.35, { r: R.v * 0.6 })],
  tilde: (T) => [Cv([[0.7, T - 0.45], [1.4, T - 1.2], [2.6, T - 0.6], [3.3, T - 1.3]], { r: R.h * 0.9 })],
  cedilla: () => [Cv([[2.1, 6], [2.6, 6.6], [2.2, 7.2], [1.4, 7.1]], { r: R.h * 0.9 })],
}
// Arriba de la runa más alta (las de cresta suben el acento para no encimarse).
const top = (ss) => Math.min(...ss.flatMap((s) => s.p.map(([, y]) => y))) - 0.15
const ACC = {
  á: ['a', 'acute'], é: ['e', 'acute'], í: ['i', 'acute'], ó: ['o', 'acute'], ú: ['u', 'acute'],
  à: ['a', 'grave'], è: ['e', 'grave'], ì: ['i', 'grave'], ò: ['o', 'grave'], ù: ['u', 'grave'],
  â: ['a', 'circ'], ê: ['e', 'circ'], î: ['i', 'circ'], ô: ['o', 'circ'], û: ['u', 'circ'],
  ä: ['a', 'diaer'], ë: ['e', 'diaer'], ï: ['i', 'diaer'], ö: ['o', 'diaer'], ü: ['u', 'diaer'],
  ñ: ['n', 'tilde'], ç: ['c', 'cedilla'],
}
export const ACCENTED = {}
for (const [ch, [base, mark]] of Object.entries(ACC)) {
  const lo = LOWER[base], up = UPPER[base.toUpperCase()]
  ACCENTED[ch] = [...lo, ...MARKS[mark](Math.min(1.25, top(lo) - 0.2))]
  ACCENTED[ch.toUpperCase()] = [...up, ...MARKS[mark](Math.min(0, top(up) - 0.25))]
}

// Todo lo que lleva la fuente.
export const GLYPH_STROKES = { ...UPPER, ...LOWER, ...DIGITS, ...SYMBOLS, ...ACCENTED }
