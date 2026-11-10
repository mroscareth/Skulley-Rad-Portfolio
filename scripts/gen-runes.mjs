// Genera SKULLEYGLYPH desde el pincel (src/lib/runeStrokes.js):
//   public/fonts/skulley-glyph/SkulleyGlyphVariable-{Light,Medium,Bold}.otf
//   public/fonts/skulley-glyph/SkulleyGlyphVariable.ttc   (los 3 pesos en un archivo)
//   public/fonts/skulley-glyph/SkulleyGlyphVariable.zip   (todo + README)
//   public/fonts/skulley-glyph/rune-atlas.png             (distancia de A–Z para los shaders)
// Uso: npm run gen:runes. Correrlo cada vez que cambie un trazo.
//
// Cada runa es la unión de los círculos que va dejando el pincel. De ahí sale
// un campo de distancia; los contornos de la fuente son su línea cero y el
// atlas guarda la distancia misma.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import JSZip from 'jszip'
import { strokeSpine } from '../src/lib/runeBrush.js'
import { GLYPH_STROKES, UPPER } from '../src/lib/runeStrokes.js'
import {
  ALPHABET_META, FONT_WEIGHTS, RUNE_ATLAS, LETTERS, DIGIT_CHARS, SYMBOL_CHARS, ACCENT_CHARS, EXTRA_CHARS, GLYPH_COUNT, fontFileName,
} from '../src/lib/runeAlphabet.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', ALPHABET_META.dir)

// ── Campo de distancia ───────────────────────────────────────────────────
function circlesOf(strokes, weight) {
  const out = []
  for (const s of strokes) {
    const { pts, rad } = strokeSpine(s, { step: 0.03, weight })
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        // Entre dos muestras cabe más de un círculo cuando la punta es fina.
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
        const gap = Math.hypot(bx - ax, by - ay), rMin = Math.min(rad[i - 1], rad[i])
        const n = Math.ceil(gap / (0.4 * rMin))
        for (let k = 1; k < n; k++) {
          const t = k / n
          out.push([ax + (bx - ax) * t, ay + (by - ay) * t, rad[i - 1] + (rad[i] - rad[i - 1]) * t])
        }
      }
      out.push([pts[i][0], pts[i][1], rad[i]])
    }
  }
  return out
}

function boundsOf(circles, margin) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y, r] of circles) {
    x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r)
  }
  return { x0: x0 - margin, y0: y0 - margin, x1: x1 + margin, y1: y1 + margin }
}

// Distancia con signo (negativa adentro) en una rejilla; fuera de `band` vale band.
function distanceField(circles, { x0, y0, w, h, ppu, band, center = 0 }) {
  const f = new Float32Array(w * h).fill(band)
  for (const [cx, cy, r] of circles) {
    const reach = r + band
    const i0 = Math.max(0, Math.floor((cx - reach - x0) * ppu - center))
    const i1 = Math.min(w - 1, Math.ceil((cx + reach - x0) * ppu - center))
    const j0 = Math.max(0, Math.floor((cy - reach - y0) * ppu - center))
    const j1 = Math.min(h - 1, Math.ceil((cy + reach - y0) * ppu - center))
    for (let j = j0; j <= j1; j++) {
      const dy = y0 + (j + center) / ppu - cy
      const row = j * w
      for (let i = i0; i <= i1; i++) {
        const dx = x0 + (i + center) / ppu - cx
        const d = Math.sqrt(dx * dx + dy * dy) - r
        if (d < f[row + i]) f[row + i] = d
      }
    }
  }
  return f
}

// ── Contornos (marching squares, adentro siempre a la izquierda) ─────────
function contours(f, w, h, toWorld) {
  const inside = (i, j) => f[j * w + i] < 0
  const val = (i, j) => f[j * w + i]
  const points = new Map()
  const edgePoint = (key, ia, ja, ib, jb) => {
    if (!points.has(key)) {
      const a = val(ia, ja), b = val(ib, jb), t = a / (a - b)
      points.set(key, toWorld(ia + (ib - ia) * t, ja + (jb - ja) * t))
    }
    return key
  }
  const next = new Map()
  const addSeg = (ka, kb, ref, pa, pb) => {
    // Orienta el segmento para que `ref` (un punto de adentro) quede a la izquierda.
    const [ax, ay] = pa, [bx, by] = pb
    const cross = (bx - ax) * (ref[1] - ay) - (by - ay) * (ref[0] - ax)
    if (cross < 0) next.set(ka, kb); else next.set(kb, ka)
  }
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = inside(i, j), b = inside(i + 1, j), c = inside(i + 1, j + 1), d = inside(i, j + 1)
      const n = a + b + c + d
      if (n === 0 || n === 4) continue
      const E = {
        T: () => edgePoint(`h${i},${j}`, i, j, i + 1, j),
        R: () => edgePoint(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1),
        B: () => edgePoint(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1),
        L: () => edgePoint(`v${i},${j}`, i, j, i, j + 1),
      }
      const corner = { a: [i, j, a, 'T', 'L'], b: [i + 1, j, b, 'T', 'R'], c: [i + 1, j + 1, c, 'R', 'B'], d: [i, j + 1, d, 'B', 'L'] }
      const cut = (k, refGrid) => {
        const [, , , e1, e2] = corner[k]
        const k1 = E[e1](), k2 = E[e2]()
        addSeg(k1, k2, refGrid, points.get(k1), points.get(k2))
      }
      const saddle = (a && c && !b && !d) || (b && d && !a && !c)
      if (saddle) {
        const centerIn = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 < 0
        const mid = toWorld(i + 0.5, j + 0.5)
        for (const k of ['a', 'b', 'c', 'd']) {
          const cin = corner[k][2]
          if (centerIn && !cin) cut(k, mid)                                   // se recorta la esquina de afuera
          if (!centerIn && cin) cut(k, toWorld(corner[k][0], corner[k][1]))   // se aísla la esquina de adentro
        }
        continue
      }
      // Un solo cruce: separa las esquinas de adentro de las de afuera.
      const crosses = []
      if (a !== b) crosses.push(E.T())
      if (b !== c) crosses.push(E.R())
      if (d !== c) crosses.push(E.B())
      if (a !== d) crosses.push(E.L())
      const inCorner = ['a', 'b', 'c', 'd'].find((k) => corner[k][2])
      addSeg(crosses[0], crosses[1], toWorld(corner[inCorner][0], corner[inCorner][1]), points.get(crosses[0]), points.get(crosses[1]))
    }
  }
  const loops = []
  const used = new Set()
  for (const start of next.keys()) {
    if (used.has(start)) continue
    const loop = []
    let k = start
    while (k && !used.has(k)) { used.add(k); loop.push(points.get(k)); k = next.get(k) }
    if (loop.length > 2) loops.push(loop)
  }
  return loops
}

// Ramer–Douglas–Peucker sobre un contorno cerrado.
function simplify(loop, tol) {
  const rdp = (pts) => {
    if (pts.length < 3) return pts
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]
    const L = Math.hypot(bx - ax, by - ay) || 1e-9
    let worst = 0, at = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L
      if (d > worst) { worst = d; at = i }
    }
    if (worst <= tol) return [pts[0], pts[pts.length - 1]]
    return [...rdp(pts.slice(0, at + 1)).slice(0, -1), ...rdp(pts.slice(at))]
  }
  // Parte el anillo en el punto más lejano del primero para que RDP tenga dos extremos.
  let far = 0, best = 0
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1])
    if (d > best) { best = d; far = i }
  }
  const a = rdp(loop.slice(0, far + 1)), b = rdp([...loop.slice(far), loop[0]])
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

const PPU = 36
function glyphOutline(strokes, weight) {
  const circles = circlesOf(strokes, weight)
  const bb = boundsOf(circles, 3 / PPU)
  const w = Math.ceil((bb.x1 - bb.x0) * PPU) + 1, h = Math.ceil((bb.y1 - bb.y0) * PPU) + 1
  const f = distanceField(circles, { x0: bb.x0, y0: bb.y0, w, h, ppu: PPU, band: 2.5 / PPU })
  const loops = contours(f, w, h, (gi, gj) => [bb.x0 + gi / PPU, bb.y0 + gj / PPU])
  return loops.map((l) => simplify(l, 0.006)).filter((l) => l.length > 2)
}

// ── Fuente ───────────────────────────────────────────────────────────────
const UNIT = 120          // unidades de la fuente por unidad de la runa
const SIDE = 0.45         // aire a cada lado, en unidades de la runa
const area = (l) => l.reduce((s, [x, y], i) => { const [x2, y2] = l[(i + 1) % l.length]; return s + x * y2 - x2 * y }, 0) / 2
const insideLoop = ([px, py], l) => {
  let c = false
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

function glyphFor(char, loops) {
  const xs = loops.flat().map(([x]) => x)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const shift = SIDE - minX
  // A la fuente: Y hacia arriba, línea base en 0.
  const fontLoops = loops.map((l) => l.map(([x, y]) => [Math.round((x + shift) * UNIT), Math.round((6 - y) * UNIT)]))
  const p = new opentype.Path()
  fontLoops.forEach((l, i) => {
    // Contornos de afuera en contra de las manecillas, hoyos al revés (CFF).
    const depth = fontLoops.filter((o, k) => k !== i && insideLoop(l[0], o)).length
    const ccw = area(l) > 0
    const pts = (depth % 2 === 0) === ccw ? l : [...l].reverse()
    p.moveTo(pts[0][0], pts[0][1])
    for (let k = 1; k < pts.length; k++) p.lineTo(pts[k][0], pts[k][1])
    p.close()
  })
  const code = char.codePointAt(0)
  return new opentype.Glyph({
    name: `uni${code.toString(16).toUpperCase().padStart(4, '0')}`,
    unicode: code,
    advanceWidth: Math.round((maxX - minX + 2 * SIDE) * UNIT),
    path: p,
  })
}

function buildFont(weight) {
  const notdef = new opentype.Path()
  notdef.moveTo(60, 0); notdef.lineTo(60, 720); notdef.lineTo(480, 720); notdef.lineTo(480, 0); notdef.close()
  notdef.moveTo(120, 60); notdef.lineTo(420, 60); notdef.lineTo(420, 660); notdef.lineTo(120, 660); notdef.close()
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 540, path: notdef }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: Math.round(2.4 * UNIT), path: new opentype.Path() }),
    new opentype.Glyph({ name: 'uni00A0', unicode: 0xa0, advanceWidth: Math.round(2.4 * UNIT), path: new opentype.Path() }),
  ]
  for (const [char, strokes] of Object.entries(GLYPH_STROKES)) glyphs.push(glyphFor(char, glyphOutline(strokes, weight.brush)))
  const font = new opentype.Font({
    familyName: ALPHABET_META.family,
    styleName: weight.styleName,
    designer: 'Oscar Moctezuma Rodríguez',
    designerURL: 'https://skulleyrad.com',
    manufacturer: 'Skulley Rad',
    manufacturerURL: 'https://skulleyrad.com',
    version: ALPHABET_META.version,
    description: ALPHABET_META.description,
    unitsPerEm: 1000,
    ascender: 960,
    descender: -240,
    glyphs,
  })
  if (font.tables?.os2) font.tables.os2.usWeightClass = weight.usWeightClass
  return font
}

// TrueType Collection: varias fuentes en un archivo; los offsets internos de
// cada una se reescriben a absolutos dentro del TTC.
function wrapInTTC(buffers) {
  const align = (n) => Math.ceil(n / 4) * 4
  const header = align(12 + 4 * buffers.length)
  const offsets = []
  let cursor = header
  for (const b of buffers) { offsets.push(cursor); cursor += align(b.byteLength) }
  const out = new ArrayBuffer(cursor)
  const bytes = new Uint8Array(out), view = new DataView(out)
  view.setUint32(0, 0x74746366); view.setUint32(4, 0x00010000); view.setUint32(8, buffers.length)
  buffers.forEach((b, i) => {
    view.setUint32(12 + i * 4, offsets[i])
    bytes.set(new Uint8Array(b), offsets[i])
    const numTables = view.getUint16(offsets[i] + 4)
    for (let t = 0; t < numTables; t++) {
      const at = offsets[i] + 12 + t * 16 + 8
      view.setUint32(at, view.getUint32(at) + offsets[i])
    }
  })
  return out
}

function readme() {
  const s = ALPHABET_META.slug
  return `${ALPHABET_META.family} v${ALPHABET_META.version}
────────────────────────────────────────────────

${ALPHABET_META.description}

CONTENTS
────────
• ${s}.ttc              OpenType Collection (3 weights in one file)
• ${s}-Light.otf        Light  (weight 300)
• ${s}-Medium.otf       Medium (weight 500)
• ${s}-Bold.otf         Bold   (weight 700)

WHICH FILE SHOULD I USE?
────────────────────────
• To install and go: the .ttc. One file, three weights, one family.
• For web fonts, Figma or design tokens: the individual .otf files.

HOW TO INSTALL
──────────────
• macOS: double-click the file, then "Install Font" in Font Book.
• Windows: right-click, then "Install" (or "Install for all users").
• Linux: copy to ~/.fonts/ and run fc-cache -fv

GLYPH COVERAGE (${GLYPH_COUNT} glyphs)
──────────────
• A–Z: 26 runes.
• a–z: the same runes at x-height.
• 0–9: Maya numerals. A drop is one, a bar is five, the ensō is zero.
• Symbols: ${SYMBOL_CHARS}
• Typographic quotes and en dash: ${EXTRA_CHARS}
• Accents: ${ACCENT_CHARS}

CREDITS
───────
Designed by Oscar Moctezuma Rodríguez.
skulleyrad.com
`
}

// ── Atlas PNG (escala de grises, 8 bits) ─────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function png(width, height, gray) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

function buildAtlas() {
  const { cols, rows, cellW, cellH, pad, range, ppu } = RUNE_ATLAS
  const cw = cellW * ppu, ch = cellH * ppu
  const W = cols * cw, H = rows * ch
  const gray = new Uint8Array(W * H)
  ;[...LETTERS].forEach((letter, cell) => {
    const f = distanceField(circlesOf(UPPER[letter], 1), { x0: -pad, y0: -pad, w: cw, h: ch, ppu, band: range, center: 0.5 })
    const ox = (cell % cols) * cw, oy = Math.floor(cell / cols) * ch
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const v = Math.min(1, Math.max(0, 0.5 - f[j * cw + i] / (2 * range)))
        gray[(oy + j) * W + ox + i] = Math.round(v * 255)
      }
    }
  })
  return png(W, H, gray)
}

// ── Main ─────────────────────────────────────────────────────────────────
const t0 = Date.now()
fs.mkdirSync(OUT, { recursive: true })
const fonts = FONT_WEIGHTS.map((w) => ({ w, buffer: buildFont(w).toArrayBuffer() }))
const zip = new JSZip()
for (const { w, buffer } of fonts) {
  fs.writeFileSync(path.join(OUT, fontFileName(w)), Buffer.from(buffer))
  zip.file(fontFileName(w), buffer)
}
const ttc = wrapInTTC(fonts.map((f) => f.buffer))
fs.writeFileSync(path.join(OUT, `${ALPHABET_META.slug}.ttc`), Buffer.from(ttc))
zip.file(`${ALPHABET_META.slug}.ttc`, ttc)
zip.file('README.txt', readme())
fs.writeFileSync(path.join(OUT, `${ALPHABET_META.slug}.zip`), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }))
fs.writeFileSync(path.join(OUT, RUNE_ATLAS.file), buildAtlas())

const kb = (f) => `${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`
console.log(`[gen-runes] ${GLYPH_COUNT} glifos · ${((Date.now() - t0) / 1000).toFixed(1)} s`)
for (const f of fs.readdirSync(OUT)) console.log(`  ${f}  ${kb(f)}`)
// Comprueba que la cobertura del navegador y la de la fuente coinciden.
const covered = new Set(Object.keys(GLYPH_STROKES))
const expected = [...LETTERS, ...LETTERS.toLowerCase(), ...DIGIT_CHARS, ...SYMBOL_CHARS, ...ACCENT_CHARS, ...EXTRA_CHARS]
const missing = expected.filter((c) => !covered.has(c))
if (missing.length) { console.error(`[gen-runes] faltan trazos para: ${missing.join(' ')}`); process.exit(1) }
