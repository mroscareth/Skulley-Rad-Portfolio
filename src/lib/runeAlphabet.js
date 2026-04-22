// Alfabeto rúnico SkulleyRad — un glifo único por letra A-Z.
//
// Estrategia: iteramos seeds hasta encontrar uno que produzca una runa
// "legible" (≥3 segmentos no colapsados Y con cierta diversidad visual).
// La semilla de búsqueda por letra usa charCode + prefijo, lo que da un
// mapping determinista y reproducible.

import { runeSegments, runeComplexity } from './runes.js'

// Busca el mejor seed para un charCode dado que cumpla criterios mínimos.
// Empieza en charCode * 17 y prueba 500 variaciones, quedándose con el
// primero que cumpla complejidad ≥ minSegs.
function findSeedFor(charCode, minSegs = 3) {
  const baseSeed = charCode * 17
  for (let off = 0; off < 500; off++) {
    const seed = baseSeed + off * 7
    const segs = runeSegments(seed)
    if (runeComplexity(segs) >= minSegs) return seed
  }
  // Fallback: devuelve algo aunque sea pobre
  return baseSeed
}

// Construye un entry desde un charCode con seed buscado.
function buildEntry(code, minSegs = 3) {
  const char = String.fromCharCode(code)
  const seed = findSeedFor(code, minSegs)
  const segments = runeSegments(seed)
  return { char, code, seed, segments }
}

// A-Z (26 letras)
export const ALPHABET = Array.from({ length: 26 }, (_, i) => buildEntry(65 + i, 3))

// 0-9 (10 números) — con minSegs=2 porque algunos números se ven bien con
// composiciones más simples que las letras.
export const NUMBERS = Array.from({ length: 10 }, (_, i) => buildEntry(48 + i, 2))

// Símbolos comunes — punctuación, operadores, delimitadores.
const SYMBOL_CODES = [
  33,  // !
  34,  // "
  35,  // #
  36,  // $
  37,  // %
  38,  // &
  39,  // '
  40,  // (
  41,  // )
  42,  // *
  43,  // +
  44,  // ,
  45,  // -
  46,  // .
  47,  // /
  58,  // :
  59,  // ;
  60,  // <
  61,  // =
  62,  // >
  63,  // ?
  64,  // @
  95,  // _
]
export const SYMBOLS = SYMBOL_CODES.map((code) => buildEntry(code, 2))

// Lista combinada — útil para generación de font (todos los glyphs).
export const ALL_GLYPHS = [...ALPHABET, ...NUMBERS, ...SYMBOLS]

// Map para lookup rápido char → entry. Incluye lowercase mapping a la misma
// letra mayúscula para letras.
export const ALPHABET_MAP = ALL_GLYPHS.reduce((acc, entry) => {
  acc[entry.char] = entry
  return acc
}, {})
// Add lowercase aliases (a-z map to same glyph as A-Z)
for (const entry of ALPHABET) {
  ALPHABET_MAP[entry.char.toLowerCase()] = entry
}

// Metadatos del alfabeto / font family.
export const ALPHABET_META = {
  name: 'Skulley Glyph Variable',
  family: 'Skulley Glyph Variable',
  // ID corto sin espacios para nombres de archivo.
  slug: 'SkulleyGlyphVariable',
  version: '1.0',
  description: 'A procedural rune alphabet generated from geometric line segments on a 4×4 grid. Each letter maps to one deterministic glyph. No semantic meaning — purely visual language of the Skulley Rad portals.',
}
