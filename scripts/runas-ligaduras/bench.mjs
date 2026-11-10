// Banco de pruebas de las ligaduras de SKULLEYGLYPH. No toca la fuente:
// dibuja palabras con el pincel real y las saca a PNG.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')
// Las imágenes salen a salida/ (ignorada en git).
export const OUT = path.join(HERE, 'salida')
fs.mkdirSync(OUT, { recursive: true })
const sharp = (await import(pathToFileURL(ROOT + '/node_modules/sharp/lib/index.js').href)).default
export const core = await import('./gen-core.mjs')
export const brush = await import(pathToFileURL(ROOT + '/src/lib/runeBrush.js').href)
export const strokes = await import(pathToFileURL(ROOT + '/src/lib/runeStrokes.js').href)

export const BOLD = 1.32, MEDIUM = 1, LIGHT = 0.72

// Unión suave de dos campos: redondea las soldaduras (k = tamaño del filete).
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }

/**
 * Pinta grupos de círculos [x, y, r] en un PNG.
 * layers: [{ body: [...], weld: [...] }] → campo = smin(min(body), min(weld), k)
 */
export function fieldOf({ body = [], weld = [] }, view, ppu, k = 0.2) {
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const band = 0.6
  const opts = { x0: view.x0, y0: view.y0, w, h, ppu, band, center: 0.5 }
  const fa = core.distanceField(body, opts)
  if (!weld.length) return { f: fa, w, h }
  const fb = core.distanceField(weld, opts)
  const f = new Float32Array(w * h)
  for (let i = 0; i < f.length; i++) f[i] = smin(fa[i], fb[i], k)
  return { f, w, h }
}

export function rasterize(field, ppu, { ink = [255, 255, 255], bg = [2, 45, 214] } = {}) {
  const { f, w, h } = field
  const buf = Buffer.alloc(w * h * 3)
  for (let i = 0; i < f.length; i++) {
    const a = Math.min(1, Math.max(0, 0.5 - f[i] * ppu))
    buf[i * 3] = Math.round(bg[0] + (ink[0] - bg[0]) * a)
    buf[i * 3 + 1] = Math.round(bg[1] + (ink[1] - bg[1]) * a)
    buf[i * 3 + 2] = Math.round(bg[2] + (ink[2] - bg[2]) * a)
  }
  return { buf, w, h }
}

export async function savePng(img, file) {
  await sharp(img.buf, { raw: { width: img.w, height: img.h, channels: 3 } }).png().toFile(path.join(OUT, file))
  return path.join(OUT, file)
}

/** Apila tiras (cada una {buf,w,h} o {label}) en una lámina. */
export async function sheet(rows, file, { bg = [2, 45, 214], pad = 40, gap = 28 } = {}) {
  const width = Math.max(...rows.filter((r) => r.w).map((r) => r.w)) + pad * 2
  const items = []
  let y = pad
  for (const r of rows) {
    if (r.label) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width - pad * 2}" height="${r.size ? r.size + 14 : 40}"><text x="0" y="${r.size ? r.size : 28}" font-family="Outfit, Arial, sans-serif" font-weight="${r.bold ? 700 : 500}" font-size="${r.size || 26}" fill="${r.color || '#ffffff'}" fill-opacity="${r.opacity ?? 0.85}">${r.label}</text></svg>`
      items.push({ input: Buffer.from(svg), left: pad, top: y })
      y += (r.size ? r.size + 14 : 40) + 6
    } else {
      items.push({ input: await sharp(r.buf, { raw: { width: r.w, height: r.h, channels: 3 } }).png().toBuffer(), left: pad, top: y })
      y += r.h + gap
    }
  }
  const height = y + pad - gap
  await sharp({ create: { width, height, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } } }).composite(items).png().toFile(path.join(OUT, file))
  return path.join(OUT, file)
}

// ── La palabra como sale HOY en la fuente (v2.1) ─────────────────────────
// Misma lógica que buildFont: avance por márgenes ópticos, hilo de salida y
// de entrada en glifos de ancho cero, y la entrada alta después de la S.
export function wordToday(seq, weight, spine = brush.strokeSpine) {
  const circlesOf = (ss) => circlesWith(ss, weight, spine)
  const out = { body: [], weld: [], bounds: [], width: 0 }
  let cursor = 0
  seq.forEach((g, i) => {
    const circles = circlesOf(g.strokes)
    const xs = circles.flatMap(([x, , r]) => [x - r, x + r])
    const { lsb, rsb } = core.sidebearings(circles)
    const left = Math.min(...xs) - lsb, right = Math.max(...xs) + rsb
    const dx = cursor - left
    const push = (cs) => { for (const [x, y, r] of cs) out.body.push([x + dx, y, r]) }
    push(circles)
    const ends = core.strokeEnds(g.strokes, weight)
    const prev = seq[i - 1], next = seq[i + 1]
    if (next) { const up = g.archUp; push(core.exitThread(core.exitEnd(ends), [right + 0.03, up ? core.ARCH_Y : core.PORT_Y], weight, up)) }
    if (prev) { const up = prev.archUp; push(core.entryThread([left - 0.03, up ? core.ARCH_Y : core.PORT_Y], core.entryEnd(ends), weight, up)) }
    out.bounds.push({ name: g.name, x0: cursor, x1: cursor + (right - left), dx, left, right })
    cursor += right - left
  })
  out.width = cursor
  return out
}

// Igual que circlesOf del generador, pero con el pincel que se le pase.
export function circlesWith(ss, weight, spine) {
  const out = []
  for (const s of ss) {
    const { pts, rad } = s.circles ? s.circles(weight) : spine(s, { step: 0.03, weight })
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
        const gap = Math.hypot(bx - ax, by - ay), rMin = Math.min(rad[i - 1], rad[i])
        const n = Math.ceil(gap / (0.4 * rMin))
        for (let k = 1; k < n; k++) { const t = k / n; out.push([ax + (bx - ax) * t, ay + (by - ay) * t, rad[i - 1] + (rad[i] - rad[i - 1]) * t]) }
      }
      out.push([pts[i][0], pts[i][1], rad[i]])
    }
  }
  return out
}

export const SKULLEYRAD = () => {
  const U = strokes.UPPER
  return [
    { name: 'S', strokes: U.S, archUp: true }, { name: 'K', strokes: U.K }, { name: 'U', strokes: U.U },
    { name: 'LL', strokes: strokes.LIGATURES.LL }, { name: 'E', strokes: U.E }, { name: 'Y', strokes: U.Y },
    { name: 'R', strokes: U.R }, { name: 'A', strokes: U.A }, { name: 'D', strokes: U.D },
  ]
}
export { fs, path }
