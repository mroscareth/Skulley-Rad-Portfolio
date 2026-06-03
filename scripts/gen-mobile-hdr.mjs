// Genera una versión reducida del HDRI para mobile (menos descarga + PMREM más
// barato al arrancar). Decodifica el .hdr Radiance (RGBE, new-RLE o flat),
// hace un box-downsample 2x en espacio float, y re-encodea como RGBE flat.
// El IBL es de baja frecuencia → bajar la resolución es visualmente nulo.
//
// Uso: node scripts/gen-mobile-hdr.mjs [in] [out] [downscaleFactor]
//   default: public/light.hdr -> public/light-mobile.hdr, factor 2
import fs from 'node:fs'

const IN = process.argv[2] || 'public/light.hdr'
const OUT = process.argv[3] || 'public/light-mobile.hdr'
const FACTOR = Math.max(2, parseInt(process.argv[4] || '2', 10))

function readHeader(buf) {
  let pos = 0
  let line = ''
  const lines = []
  // header termina en línea en blanco; luego viene la línea de resolución.
  while (pos < buf.length) {
    const c = buf[pos++]
    if (c === 0x0a) {
      if (line === '') break
      lines.push(line)
      line = ''
    } else {
      line += String.fromCharCode(c)
    }
  }
  // línea de resolución: "-Y H +X W"
  let res = ''
  while (pos < buf.length) {
    const c = buf[pos++]
    if (c === 0x0a) break
    res += String.fromCharCode(c)
  }
  const m = res.match(/-Y\s+(\d+)\s+\+X\s+(\d+)/)
  if (!m) throw new Error(`Unsupported resolution line (solo -Y +X): "${res}"`)
  return { headerLines: lines, height: parseInt(m[1], 10), width: parseInt(m[2], 10), dataStart: pos }
}

// Decodifica a Float32Array RGB (3 por pixel) en escala lineal Radiance.
function decode(buf, width, height, dataStart) {
  const out = new Float32Array(width * height * 3)
  let pos = dataStart
  const scanline = new Uint8Array(width * 4)

  const rgbe2float = (r, g, b, e, o) => {
    if (e === 0) { out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; return }
    const f = Math.pow(2, e - 136) // ldexp(1, e-128-8)
    out[o] = r * f
    out[o + 1] = g * f
    out[o + 2] = b * f
  }

  for (let y = 0; y < height; y++) {
    const b0 = buf[pos], b1 = buf[pos + 1], b2 = buf[pos + 2], b3 = buf[pos + 3]
    const isNewRLE = b0 === 2 && b1 === 2 && ((b2 << 8) | b3) === width && width >= 8 && width <= 0x7fff
    if (isNewRLE) {
      pos += 4
      for (let ch = 0; ch < 4; ch++) {
        let x = 0
        while (x < width) {
          let count = buf[pos++]
          if (count > 128) { // run
            count -= 128
            const val = buf[pos++]
            for (let i = 0; i < count; i++) scanline[(x++) * 4 + ch] = val
          } else { // literal
            for (let i = 0; i < count; i++) scanline[(x++) * 4 + ch] = buf[pos++]
          }
        }
      }
    } else {
      // flat: width pixels × 4 bytes seguidos
      for (let x = 0; x < width * 4; x++) scanline[x] = buf[pos++]
    }
    for (let x = 0; x < width; x++) {
      const s = x * 4
      rgbe2float(scanline[s], scanline[s + 1], scanline[s + 2], scanline[s + 3], (y * width + x) * 3)
    }
  }
  return out
}

function downsample(src, width, height, factor) {
  const dw = Math.max(1, Math.floor(width / factor))
  const dh = Math.max(1, Math.floor(height / factor))
  const out = new Float32Array(dw * dh * 3)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = 0; sy < factor; sy++) {
        const yy = y * factor + sy
        if (yy >= height) break
        for (let sx = 0; sx < factor; sx++) {
          const xx = x * factor + sx
          if (xx >= width) break
          const o = (yy * width + xx) * 3
          r += src[o]; g += src[o + 1]; b += src[o + 2]; n++
        }
      }
      const o = (y * dw + x) * 3
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n
    }
  }
  return { data: out, width: dw, height: dh }
}

// Encodea RGBE flat (sin RLE → simple y válido para RGBELoader de three).
function encode(data, width, height) {
  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`
  const headerBuf = Buffer.from(header, 'ascii')
  const body = Buffer.alloc(width * height * 4)
  let p = 0
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]
    const v = Math.max(r, g, b)
    if (v < 1e-32) { body[p++] = 0; body[p++] = 0; body[p++] = 0; body[p++] = 0; continue }
    // frexp: v = mant * 2^exp, mant en [0.5, 1)
    let exp = Math.ceil(Math.log2(v))
    let mant = v / Math.pow(2, exp)
    if (mant >= 1) { mant *= 0.5; exp += 1 }
    if (mant < 0.5) { mant *= 2; exp -= 1 }
    const scale = (mant * 256) / v
    body[p++] = Math.min(255, Math.floor(r * scale))
    body[p++] = Math.min(255, Math.floor(g * scale))
    body[p++] = Math.min(255, Math.floor(b * scale))
    body[p++] = exp + 128
  }
  return Buffer.concat([headerBuf, body])
}

const buf = fs.readFileSync(IN)
const { width, height, dataStart } = readHeader(buf)
console.log(`in:  ${width}x${height}  (${(buf.length / 1024).toFixed(0)} KB)`)
const floats = decode(buf, width, height, dataStart)
const ds = downsample(floats, width, height, FACTOR)
const out = encode(ds.data, ds.width, ds.height)
fs.writeFileSync(OUT, out)
console.log(`out: ${ds.width}x${ds.height}  (${(out.length / 1024).toFixed(0)} KB)  -> ${OUT}`)
