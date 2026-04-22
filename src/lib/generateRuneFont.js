// Genera un font "Skulley Glyph Variable" como TrueType Collection (TTC).
//
// UN SOLO ARCHIVO contiene 3 weights (Light / Medium / Bold). Al instalar
// el .ttc, el SO expone la familia "Skulley Glyph Variable" con las 3
// variantes disponibles en el dropdown de weight de cualquier aplicación.
//
// Nota técnica: un VARIABLE FONT real (con axis wght interpolable 300→700
// en un solo glifo) requiere escribir tablas fvar/gvar a nivel binario,
// que opentype.js v1.x no soporta nativamente. El TTC es el equivalente
// práctico en formato estándar — mismo UX (una familia, múltiples pesos)
// en un solo archivo.
//
// Los glyphs cubren: A-Z, a-z (alias), 0-9, y 23 símbolos comunes.

import opentype from 'opentype.js'
import JSZip from 'jszip'
import { ALPHABET, ALL_GLYPHS, ALPHABET_META } from './runeAlphabet.js'

const EM_SIZE = 1000
const PADDING = 100
const ASCENDER = 850
const DESCENDER = -150
const ADVANCE_WIDTH = 1100

export const FONT_WEIGHTS = [
  { name: 'Light',  styleName: 'Light',  lineWidth: 45,  usWeightClass: 300 },
  { name: 'Medium', styleName: 'Medium', lineWidth: 85,  usWeightClass: 500 },
  { name: 'Bold',   styleName: 'Bold',   lineWidth: 145, usWeightClass: 700 },
]

function appendSegmentRect(path, seg, innerSize, lineWidth) {
  const mapX = (v) => PADDING + v * innerSize
  const mapY = (v) => EM_SIZE - (PADDING + v * innerSize) // flip Y
  const x1 = mapX(seg.x1), y1 = mapY(seg.y1)
  const x2 = mapX(seg.x2), y2 = mapY(seg.y2)
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.5) {
    const r = lineWidth / 2
    path.moveTo(x1 - r, y1 - r)
    path.lineTo(x1 + r, y1 - r)
    path.lineTo(x1 + r, y1 + r)
    path.lineTo(x1 - r, y1 + r)
    path.closePath()
    return
  }
  const nx = -dy / len
  const ny = dx / len
  const hw = lineWidth / 2
  const ax = x1 + nx * hw, ay = y1 + ny * hw
  const bx = x1 - nx * hw, by = y1 - ny * hw
  const cx = x2 - nx * hw, cy = y2 - ny * hw
  const dxp = x2 + nx * hw, dyp = y2 + ny * hw
  path.moveTo(ax, ay)
  path.lineTo(bx, by)
  path.lineTo(cx, cy)
  path.lineTo(dxp, dyp)
  path.closePath()
}

function buildGlyphPath(segments, lineWidth) {
  const path = new opentype.Path()
  const innerSize = EM_SIZE - PADDING * 2
  for (const seg of segments) appendSegmentRect(path, seg, innerSize, lineWidth)
  return path
}

/** Construye un Font opentype para el weight dado. */
export function buildRuneFont({ lineWidth = 85, styleName = 'Medium', usWeightClass = 500 } = {}) {
  const notdefPath = new opentype.Path()
  notdefPath.moveTo(100, 100); notdefPath.lineTo(900, 100); notdefPath.lineTo(900, 900); notdefPath.lineTo(100, 900); notdefPath.closePath()
  notdefPath.moveTo(200, 200); notdefPath.lineTo(200, 800); notdefPath.lineTo(800, 800); notdefPath.lineTo(800, 200); notdefPath.closePath()

  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: ADVANCE_WIDTH, path: notdefPath }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: ADVANCE_WIDTH, path: new opentype.Path() }),
  ]
  // Todos los glyphs del alfabeto (A-Z + 0-9 + símbolos)
  for (const entry of ALL_GLYPHS) {
    glyphs.push(new opentype.Glyph({
      name: `uni${entry.code.toString(16).padStart(4, '0').toUpperCase()}`,
      unicode: entry.code,
      advanceWidth: ADVANCE_WIDTH,
      path: buildGlyphPath(entry.segments, lineWidth),
    }))
  }
  // a-z → alias a A-Z (mismo glifo)
  for (const entry of ALPHABET) {
    glyphs.push(new opentype.Glyph({
      name: `uni${(entry.code + 32).toString(16).padStart(4, '0').toUpperCase()}`,
      unicode: entry.code + 32,
      advanceWidth: ADVANCE_WIDTH,
      path: buildGlyphPath(entry.segments, lineWidth),
    }))
  }

  const font = new opentype.Font({
    familyName: ALPHABET_META.family,
    styleName,
    unitsPerEm: EM_SIZE,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs,
  })
  try {
    if (font.tables && font.tables.os2) font.tables.os2.usWeightClass = usWeightClass
  } catch {}
  return font
}

/* ────────────────────────────────────────────────────────────────────
   TTC WRAPPING — combina 3 TTFs en un único archivo .ttc.
   Formato TTC v1:
     offset 0:  u32 'ttcf' (0x74746366)
     offset 4:  u32 version (0x00010000)
     offset 8:  u32 numFonts
     offset 12: u32[numFonts] offsetTableOffsets
   Luego las fuentes individuales (con offsets absolutos dentro del archivo).
   ──────────────────────────────────────────────────────────────────── */

function alignTo(n, boundary = 4) {
  return Math.ceil(n / boundary) * boundary
}

/**
 * Empaca múltiples TTFs (ArrayBuffer cada uno) en un TrueType Collection.
 * Cada entrada tiene su propio OffsetTable + tables; el TTC solo agrupa.
 * Los offsets internos de cada fuente se reescriben a absolutos en el TTC.
 */
export function wrapInTTC(fontBuffers) {
  const headerSize = alignTo(12 + 4 * fontBuffers.length, 4)

  // Calcula offsets alineados a 4 bytes para cada font
  const fontOffsets = []
  let cursor = headerSize
  for (const buf of fontBuffers) {
    fontOffsets.push(cursor)
    cursor += alignTo(buf.byteLength, 4)
  }
  const total = cursor

  const out = new ArrayBuffer(total)
  const outBytes = new Uint8Array(out)
  const outView = new DataView(out)

  // Header
  outView.setUint32(0, 0x74746366, false) // 'ttcf'
  outView.setUint32(4, 0x00010000, false) // version 1.0
  outView.setUint32(8, fontBuffers.length, false)
  for (let i = 0; i < fontBuffers.length; i++) {
    outView.setUint32(12 + i * 4, fontOffsets[i], false)
  }

  // Copia cada font y reescribe offsets de su table directory
  for (let i = 0; i < fontBuffers.length; i++) {
    const src = new Uint8Array(fontBuffers[i])
    const base = fontOffsets[i]
    outBytes.set(src, base)
    // OffsetTable: sfntVersion(4) + numTables(2) + searchRange(2) + entrySelector(2) + rangeShift(2) = 12 bytes
    // Luego numTables entradas de 16 bytes: tag(4) + checksum(4) + offset(4) + length(4)
    const numTables = outView.getUint16(base + 4, false)
    for (let j = 0; j < numTables; j++) {
      const entryOff = base + 12 + j * 16
      const origOffset = outView.getUint32(entryOff + 8, false)
      outView.setUint32(entryOff + 8, origOffset + base, false)
    }
  }

  return out
}

/** Genera el TTC con los 3 weights y dispara download. */
export function downloadRuneVariableFont(filename) {
  const fonts = FONT_WEIGHTS.map((w) =>
    buildRuneFont({ lineWidth: w.lineWidth, styleName: w.styleName, usWeightClass: w.usWeightClass })
  )
  const buffers = fonts.map((f) => f.toArrayBuffer())
  const ttc = wrapInTTC(buffers)
  const blob = new Blob([ttc], { type: 'font/collection' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${ALPHABET_META.slug}.ttc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download individual de un OTF por weight (fallback / testing). */
export function downloadRuneFont(weight = FONT_WEIGHTS[1]) {
  const font = buildRuneFont({
    lineWidth: weight.lineWidth,
    styleName: weight.styleName,
    usWeightClass: weight.usWeightClass,
  })
  const arrayBuffer = font.toArrayBuffer()
  const blob = new Blob([arrayBuffer], { type: 'font/otf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ALPHABET_META.slug}-${weight.name}.otf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Genera un README.txt con instrucciones de instalación + info de la familia.
 * Lo incluimos en el ZIP para que el usuario tenga contexto al abrirlo.
 */
function buildReadmeText() {
  return `${ALPHABET_META.family} v${ALPHABET_META.version}
────────────────────────────────────────────────

${ALPHABET_META.description}

CONTENTS
────────
• ${ALPHABET_META.slug}.ttc              — OpenType Collection (3 weights in ONE file)
• ${ALPHABET_META.slug}-Light.otf        — Light  (weight 300)
• ${ALPHABET_META.slug}-Medium.otf       — Medium (weight 500)
• ${ALPHABET_META.slug}-Bold.otf         — Bold   (weight 700)

WHICH FILE SHOULD I USE?
────────────────────────
• If you just want to install and go: install the .ttc — one file,
  three weights, appears as a single family in any app.
• If your pipeline needs discrete files (web fonts, Figma assets,
  design tokens), use the individual .otf files.

HOW TO INSTALL
──────────────
• macOS: double-click the file → "Install Font" in Font Book.
• Windows: right-click → "Install" (or "Install for all users").
• Linux: copy to ~/.fonts/ and run fc-cache -fv

GLYPH COVERAGE
──────────────
• A-Z (26 letters, case-insensitive → same glyph)
• 0-9 (10 digits)
• 23 common symbols: ! " # $ % & ' ( ) * + , - . / : ; < = > ? @ _
• Space

Total: 69 distinct glyphs.

NOTES
─────
• This is a procedural rune alphabet. No semantic meaning — purely
  a visual language borrowed from the portals in the Skulley Rad universe.
• Lowercase letters render as the same glyph as uppercase (no case
  distinction in the rune system).
• Generated from the runic logic in-browser — the glyphs you see here
  are the same ones rendered by the portals' shaders.

CREDITS
───────
mroscar.xyz · Skulley Rad Portfolio
`
}

/**
 * Genera un ZIP con TODO: TTC + 3 OTFs individuales + README.
 * El user recibe un solo download y adentro tiene flexibilidad total.
 */
export async function downloadRuneFontZip() {
  const zip = new JSZip()

  // TTC (variable / collection)
  const ttcFonts = FONT_WEIGHTS.map((w) =>
    buildRuneFont({ lineWidth: w.lineWidth, styleName: w.styleName, usWeightClass: w.usWeightClass })
  )
  const ttcBuffers = ttcFonts.map((f) => f.toArrayBuffer())
  const ttc = wrapInTTC(ttcBuffers)
  zip.file(`${ALPHABET_META.slug}.ttc`, ttc)

  // Cada weight como OTF separado
  for (const w of FONT_WEIGHTS) {
    const font = buildRuneFont({ lineWidth: w.lineWidth, styleName: w.styleName, usWeightClass: w.usWeightClass })
    zip.file(`${ALPHABET_META.slug}-${w.name}.otf`, font.toArrayBuffer())
  }

  // README con instrucciones
  zip.file('README.txt', buildReadmeText())

  // Genera el ZIP como blob y dispara download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ALPHABET_META.slug}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
