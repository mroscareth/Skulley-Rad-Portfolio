// Genera SKULLEYGLYPH desde las runas (src/lib/runeStrokes.js):
//   public/fonts/skulley-glyph/SkulleyGlyphVariable-{Light,Medium,Bold}.otf
//   public/fonts/skulley-glyph/SkulleyGlyphVariable.ttc   (los 3 pesos en un archivo)
//   public/fonts/skulley-glyph/SkulleyGlyphVariable.zip   (todo + README)
//   public/fonts/skulley-glyph/rune-atlas.png             (distancia de A–Z para los shaders)
// Uso: npm run gen:runes. Correrlo cada vez que cambie un trazo. RUNES_OUT manda
// todo a otra carpeta, para revisar sin tocar la fuente publicada.
//
// Desde la v2.2 (2026-11-10, ver typography.md) cada runa es la unión de los
// rectángulos que deja la pluma plana (penBoxes de runeBrush.js). De ahí sale
// un campo de distancia; los contornos de la fuente son su línea cero y el
// atlas guarda la distancia misma. Las runas van sueltas, en bloque, sin hilos
// entre ellas (la v2.1 los tenía); la única ligadura es LL / ll (liga). El
// espaciado es óptico: cada runa recorta su aire según lo hueca que es su silueta.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import JSZip from 'jszip'
import { penBoxes } from '../src/lib/runeBrush.js'
import { GLYPH_STROKES, UPPER, LIGATURES } from '../src/lib/runeStrokes.js'
import {
  ALPHABET_META, FONT_WEIGHTS, RUNE_ATLAS, LETTERS, DIGIT_CHARS, SYMBOL_CHARS, ACCENT_CHARS, EXTRA_CHARS, GLYPH_COUNT, fontFileName,
} from '../src/lib/runeAlphabet.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.RUNES_OUT ? path.resolve(ROOT, process.env.RUNES_OUT) : path.join(ROOT, 'public', ALPHABET_META.dir)

// ── Campo de distancia ───────────────────────────────────────────────────
// La pluma deja rectángulos [x, y, medio ancho, medio alto, giro, redondo]; los
// acentos más cortos son puntos redondos.
function boundsOf(boxes, margin) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y, bx, by] of boxes) {
    const r = Math.hypot(bx, by)
    x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r)
  }
  return { x0: x0 - margin, y0: y0 - margin, x1: x1 + margin, y1: y1 + margin }
}

// Distancia con signo (negativa adentro) en una rejilla; fuera de `band` vale band.
function distanceField(boxes, { x0, y0, w, h, ppu, band, center = 0 }) {
  const f = new Float32Array(w * h).fill(band)
  for (const [cx, cy, bx, by, ang = 0, round = false] of boxes) {
    const c = Math.cos(ang), s = Math.sin(ang), reach = Math.hypot(bx, by) + band
    const i0 = Math.max(0, Math.floor((cx - reach - x0) * ppu - center))
    const i1 = Math.min(w - 1, Math.ceil((cx + reach - x0) * ppu - center))
    const j0 = Math.max(0, Math.floor((cy - reach - y0) * ppu - center))
    const j1 = Math.min(h - 1, Math.ceil((cy + reach - y0) * ppu - center))
    for (let j = j0; j <= j1; j++) {
      const dy = y0 + (j + center) / ppu - cy
      const row = j * w
      for (let i = i0; i <= i1; i++) {
        const dx = x0 + (i + center) / ppu - cx
        let d
        if (round) d = Math.sqrt(dx * dx + dy * dy) - bx
        else {
          const u = Math.abs(dx * c + dy * s) - bx, v = Math.abs(-dx * s + dy * c) - by
          d = Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0)
        }
        if (d < f[row + i]) f[row + i] = d
      }
    }
  }
  return f
}

// Lo que ocupa un rectángulo de la pluma en un renglón horizontal.
function boxRow([cx, cy, bx, by, ang = 0, round = false], ry) {
  if (round) { const dy = Math.abs(ry - cy); if (dy >= bx) return null; const hw = Math.sqrt(bx * bx - dy * dy); return [cx - hw, cx + hw] }
  const c = Math.cos(ang), s = Math.sin(ang)
  const ux = c * bx, uy = s * bx, vx = -s * by, vy = c * by
  const P = [[cx + ux + vx, cy + uy + vy], [cx - ux + vx, cy - uy + vy], [cx - ux - vx, cy - uy - vy], [cx + ux - vx, cy + uy - vy]]
  let lo = Infinity, hi = -Infinity
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = P[k], [ex, ey] = P[(k + 1) % 4]
    if (ay === ey || (ay - ry) * (ey - ry) > 0) continue
    const x = ax + (ex - ax) * ((ry - ay) / (ey - ay))
    lo = Math.min(lo, x); hi = Math.max(hi, x)
  }
  return lo <= hi ? [lo, hi] : null
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
function outlineOf(boxes) {
  const bb = boundsOf(boxes, 3 / PPU)
  const w = Math.ceil((bb.x1 - bb.x0) * PPU) + 1, h = Math.ceil((bb.y1 - bb.y0) * PPU) + 1
  const f = distanceField(boxes, { x0: bb.x0, y0: bb.y0, w, h, ppu: PPU, band: 2.5 / PPU })
  const loops = contours(f, w, h, (gi, gj) => [bb.x0 + gi / PPU, bb.y0 + gj / PPU])
  return loops.map((l) => simplify(l, 0.006)).filter((l) => l.length > 2)
}

// ── Fuente ───────────────────────────────────────────────────────────────
const UNIT = 120          // unidades de la fuente por unidad de la runa
const area = (l) => l.reduce((s, [x, y], i) => { const [x2, y2] = l[(i + 1) % l.length]; return s + x * y2 - x2 * y }, 0) / 2
const insideLoop = ([px, py], l) => {
  let c = false
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Contornos a un Path de la fuente: Y hacia arriba, línea base en 0, x corrida.
function toPath(loops, dx) {
  const fontLoops = loops.map((l) => l.map(([x, y]) => [Math.round((x + dx) * UNIT), Math.round((6 - y) * UNIT)]))
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
  return p
}

// Márgenes ópticos: cada lado recorta su aire lo que la silueta ya trae hueco
// de ese lado, para que el espacio visual entre runas sea parejo.
const ROWS = Array.from({ length: 76 }, (_, i) => -0.5 + i * 0.1)
function sidebearings(boxes) {
  const L = ROWS.map(() => Infinity), Rt = ROWS.map(() => -Infinity)
  for (const b of boxes) ROWS.forEach((ry, k) => { const span = boxRow(b, ry); if (span) { L[k] = Math.min(L[k], span[0]); Rt[k] = Math.max(Rt[k], span[1]) } })
  const inkL = L.filter(isFinite), inkR = Rt.filter(isFinite)
  const minL = Math.min(...inkL), maxR = Math.max(...inkR)
  const hollowL = inkL.reduce((a, v) => a + v - minL, 0) / inkL.length
  const hollowR = inkR.reduce((a, v) => a + maxR - v, 0) / inkR.length
  const clamp = (v) => Math.min(0.5, Math.max(0.1, v))
  return { lsb: clamp(0.5 - 0.45 * hollowL), rsb: clamp(0.5 - 0.45 * hollowR) }
}

const glyphName = (ch) => `uni${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
const LIG_NAMES = { LL: 'L_L', ll: 'l_l' }

function buildFont(weight) {
  const notdef = new opentype.Path()
  notdef.moveTo(60, 0); notdef.lineTo(60, 720); notdef.lineTo(480, 720); notdef.lineTo(480, 0); notdef.close()
  notdef.moveTo(120, 60); notdef.lineTo(420, 60); notdef.lineTo(420, 660); notdef.lineTo(120, 660); notdef.close()
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 540, path: notdef }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: Math.round(2.4 * UNIT), path: new opentype.Path() }),
    new opentype.Glyph({ name: 'uni00A0', unicode: 0xa0, advanceWidth: Math.round(2.4 * UNIT), path: new opentype.Path() }),
  ]
  const entries = [
    ...Object.entries(GLYPH_STROKES).map(([ch, strokes]) => ({ name: glyphName(ch), unicode: ch.codePointAt(0), strokes })),
    ...Object.entries(LIGATURES).map(([key, strokes]) => ({ name: LIG_NAMES[key], strokes, components: [...key] })),
  ]
  for (const e of entries) {
    const boxes = penBoxes(e.strokes, weight.brush)
    const loops = outlineOf(boxes)
    const xs = loops.flat().map(([x]) => x)
    const { lsb, rsb } = sidebearings(boxes)
    const left = Math.min(...xs) - lsb, right = Math.max(...xs) + rsb
    glyphs.push(new opentype.Glyph({
      name: e.name, ...(e.unicode != null ? { unicode: e.unicode } : {}),
      advanceWidth: Math.round((right - left) * UNIT), path: toPath(loops, -left),
    }))
  }
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
  font.tables.gsub = buildGsub(glyphs, entries)
  return font
}

// GSUB: solo la ligadura LL / ll (liga).
function buildGsub(glyphs, entries) {
  const gid = new Map(glyphs.map((g, i) => [g.name, i]))
  const cov = (ids) => ({ format: 1, glyphs: [...ids].sort((a, b) => a - b) })
  const ligs = entries.filter((e) => e.components)
  const firsts = [...new Set(ligs.map((e) => gid.get(glyphName(e.components[0]))))].sort((a, b) => a - b)
  const langSys = { reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: [0] }
  return {
    version: 1,
    scripts: ['DFLT', 'latn'].map((tag) => ({ tag, script: { defaultLangSys: langSys, langSysRecords: [] } })),
    features: [{ tag: 'liga', feature: { featureParams: 0, lookupListIndexes: [0] } }],
    lookups: [{ lookupType: 4, lookupFlag: 0, subtables: [{
      substFormat: 1, coverage: cov(firsts),
      ligatureSets: firsts.map((first) => ligs.filter((e) => gid.get(glyphName(e.components[0])) === first)
        .map((e) => ({ ligGlyph: gid.get(e.name), components: e.components.slice(1).map((c) => gid.get(glyphName(c))) }))),
    }] }],
  }
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

WRITING
───────
• Every rune stands on its own, like a block seal: no threads between them.
• LL and ll become a rune of their own (ligature, liga).

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
    const f = distanceField(penBoxes(UPPER[letter], 1), { x0: -pad, y0: -pad, w: cw, h: ch, ppu, band: range, center: 0.5 })
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
