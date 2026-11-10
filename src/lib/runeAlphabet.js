// SKULLEYGLYPH para el navegador: qué caracteres tienen runa, los archivos de
// la fuente y el atlas que leen los shaders. Los trazos viven en
// runeStrokes.js y solo los usa scripts/gen-runes.mjs (npm run gen:runes),
// que genera todo lo de public/fonts/skulley-glyph/.

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const DIGIT_CHARS = '0123456789'
export const SYMBOL_CHARS = '.,:;!¡?¿\'"()[]{}-_—/\\|+=<>«»*&%$#@~^`°…·€'
export const ACCENT_CHARS = 'ÁÉÍÓÚÜÑÇáéíóúüñçÀÈÌÒÙÂÊÎÔÛÄËÏÖàèìòùâêîôûäëïö'
// Las comillas tipográficas y el guion corto reusan la forma de su versión simple.
export const EXTRA_CHARS = '“”‘’–'

const entry = (char, extra) => ({ char, code: char.codePointAt(0), ...extra })
// `cell` = casilla de la letra en el atlas de los shaders (A = 0 … Z = 25).
export const ALPHABET = [...LETTERS].map((char, cell) => entry(char, { cell }))
export const NUMBERS = [...DIGIT_CHARS].map((char) => entry(char))
export const SYMBOLS = [...SYMBOL_CHARS].map((char) => entry(char))
export const ACCENTS = [...ACCENT_CHARS].map((char) => entry(char))

// char → entry, para saber si un carácter tiene runa en la fuente.
export const ALPHABET_MAP = {}
for (const e of ALPHABET) { ALPHABET_MAP[e.char] = e; ALPHABET_MAP[e.char.toLowerCase()] = e }
for (const e of [...NUMBERS, ...SYMBOLS, ...ACCENTS]) ALPHABET_MAP[e.char] = e
for (const ch of EXTRA_CHARS) ALPHABET_MAP[ch] = entry(ch)

export const GLYPH_COUNT = LETTERS.length * 2 + DIGIT_CHARS.length + SYMBOL_CHARS.length + ACCENT_CHARS.length + EXTRA_CHARS.length

/** Casilla del atlas de una letra (sin acento), o -1 si no es letra. */
export function runeCell(ch) {
  const base = String(ch || '').normalize('NFD').charAt(0).toUpperCase()
  return LETTERS.indexOf(base)
}

// Atlas de distancia de las 26 mayúsculas para los shaders (portales, láser).
// Cada casilla es la caja de la runa (4 × 6) con `pad` de aire; la distancia va
// en unidades de la runa, de -range (adentro) a +range (afuera).
export const RUNE_ATLAS = { file: 'rune-atlas.png', cols: 6, rows: 5, cellW: 6, cellH: 8, pad: 1, range: 1.5, ppu: 12 }

// Los tres pesos de la fuente: el mismo pincel, más delgado o más cargado.
export const FONT_WEIGHTS = [
  { name: 'Light', styleName: 'Light', usWeightClass: 300, brush: 0.72 },
  { name: 'Medium', styleName: 'Medium', usWeightClass: 500, brush: 1 },
  { name: 'Bold', styleName: 'Bold', usWeightClass: 700, brush: 1.32 },
]

export const ALPHABET_META = {
  name: 'Skulley Glyph Variable',
  family: 'Skulley Glyph Variable',
  slug: 'SkulleyGlyphVariable',
  version: '2.0',
  dir: 'fonts/skulley-glyph/',
  description: 'A rune alphabet painted with a single brush. Every stroke is one drop of ink, thick where it lands and sharp where it leaves, built from a short vocabulary: ensō rings, cups, triangles, diamonds and the three-spike crest of Skulley Rad. Uppercase and lowercase, Maya numerals, punctuation and accents.',
}

const BASE = import.meta.env?.BASE_URL || '/'
/** URL pública de un archivo de la familia (fuentes, ZIP, atlas). */
export const runeFileUrl = (file) => `${BASE}${ALPHABET_META.dir}${file}`
export const fontFileName = (weight) => `${ALPHABET_META.slug}-${weight.name}.otf`
