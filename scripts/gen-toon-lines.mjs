// gen-toon-lines.mjs
// Extrae las texturas del GLB del personaje (decodificando KTX2/Basis) y genera
// mapas de LINE-ART a partir del albedo y del normal-map, en espacio de textura
// (estáticos → sin los artefactos del edge-detection en runtime: no dependen de
// la luz ni del zoom). Base para el look Hi-Fi Rush: el line-art se compone
// (multiply) sobre el albedo del modelo y se re-exporta el GLB.
//
// El GLB usa Draco (mallas) + KHR_texture_basisu (texturas KTX2/ETC1S). Las
// texturas se decodifican con el basis_transcoder de three; las mallas no se
// tocan. También acepta --img <archivo.png|jpg> para correr sobre una textura
// suelta (el flujo recomendado si tienes el albedo fuente sin comprimir).
//
// Uso:
//   node scripts/gen-toon-lines.mjs [--glb public/character.glb] [--img file.png]
//        [--out scripts/toon-lines-out] [--blur 0.8] [--threshold 28] [--thickness 1]
//
// Tuning:
//   --blur      sube para menos ruido (más limpio), baja para más detalle fino
//   --threshold sube para menos líneas (solo bordes fuertes), baja para más
//   --thickness 1..3, engrosa las líneas

import sharp from 'sharp'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'

const require = createRequire(import.meta.url)

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

const GLB = resolve(arg('glb', 'public/character.glb'))
const IMG = arg('img', null)
const OUT = resolve(arg('out', 'scripts/toon-lines-out'))
const BLUR = parseFloat(arg('blur', '0.8'))
const THRESHOLD = parseInt(arg('threshold', '28'), 10)
const THICKNESS = Math.max(1, parseInt(arg('thickness', '1'), 10))

const LAPLACIAN = [-1, -1, -1, -1, 8, -1, -1, -1, -1]
const RGBA32 = 13

// --- Basis transcoder (vía vm: el archivo de three es CJS con export raro) ---
let _basis = null
async function getBasis() {
  if (_basis) return _basis
  const tpath = require.resolve('three/examples/jsm/libs/basis/basis_transcoder.js')
  const src = await readFile(tpath, 'utf8')
  const wasmBinary = await readFile(tpath.replace(/\.js$/, '.wasm'))
  const sm = { exports: {} }
  const ctx = {
    module: sm, exports: sm.exports, __filename: tpath, __dirname: dirname(tpath),
    require, process, console, Buffer, setTimeout, clearTimeout, URL, TextDecoder, TextEncoder, globalThis,
  }
  vm.createContext(ctx)
  vm.runInContext(src, ctx, { filename: tpath })
  const Module = await sm.exports({ wasmBinary })
  Module.initializeBasis()
  _basis = Module
  return Module
}

function decodeKTX2(Module, bytes) {
  const file = new Module.KTX2File(new Uint8Array(bytes))
  if (!file.isValid()) { file.close(); file.delete(); throw new Error('KTX2 inválido') }
  file.startTranscoding()
  const width = file.getWidth()
  const height = file.getHeight()
  const size = file.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32)
  const dst = new Uint8Array(size)
  const ok = file.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)
  file.close(); file.delete()
  if (!ok) throw new Error('transcode falló')
  return { data: Buffer.from(dst), width, height }
}

// --- GLB mínimo ---
async function parseGLB(path) {
  const buf = await readFile(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('No es GLB')
  const length = buf.readUInt32LE(8)
  let offset = 12, gltf = null, bin = null
  while (offset < length) {
    const cl = buf.readUInt32LE(offset), ct = buf.readUInt32LE(offset + 4)
    const d = buf.subarray(offset + 8, offset + 8 + cl)
    if (ct === 0x4e4f534a) gltf = JSON.parse(d.toString('utf8'))
    else if (ct === 0x004e4942) bin = d
    offset += 8 + cl
  }
  return { gltf, bin }
}

function rawImageBytes(gltf, bin, glbPath, imageIndex) {
  const image = gltf.images[imageIndex]
  if (!image) return null
  if (image.uri) {
    if (image.uri.startsWith('data:')) return Promise.resolve(Buffer.from(image.uri.split(',')[1], 'base64'))
    return readFile(resolve(dirname(glbPath), decodeURIComponent(image.uri)))
  }
  const bv = gltf.bufferViews[image.bufferView]
  const start = bv.byteOffset || 0
  return Promise.resolve(bin.subarray(start, start + bv.byteLength))
}

// Devuelve una instancia sharp lista (decodifica KTX2 si hace falta).
async function toSharp(gltf, bin, glbPath, imageIndex) {
  const image = gltf.images[imageIndex]
  const bytes = await rawImageBytes(gltf, bin, glbPath, imageIndex)
  if (!bytes) return null
  if (image.mimeType === 'image/ktx2' || image.mimeType === 'image/basis') {
    const Module = await getBasis()
    const { data, width, height } = decodeKTX2(Module, bytes)
    return sharp(data, { raw: { width, height, channels: 4 } })
  }
  return sharp(Buffer.from(bytes))
}

// Líneas NEGRAS sobre BLANCO (multiply-ready).
async function edgesToLines(sharpInput) {
  // sharpInput puede reusarse: tomamos su PNG buffer primero.
  const png = await sharpInput.png().toBuffer()
  let pipe = sharp(png).flatten({ background: '#808080' }).greyscale()
  if (BLUR > 0) pipe = pipe.blur(BLUR)
  pipe = pipe.convolve({ width: 3, height: 3, kernel: LAPLACIAN }).threshold(THRESHOLD)
  for (let i = 1; i < THICKNESS; i += 1) pipe = pipe.blur(1).threshold(40)
  return pipe.negate().png().toBuffer()
}

async function runOnImageFile(path) {
  await mkdir(OUT, { recursive: true })
  const s = sharp(await readFile(resolve(path)))
  await s.clone().png().toFile(join(OUT, 'input.png'))
  const lines = await edgesToLines(s.clone())
  await writeFile(join(OUT, 'input_lines.png'), lines)
  console.log('Líneas generadas →', join(OUT, 'input_lines.png'))
}

async function runOnGLB() {
  await mkdir(OUT, { recursive: true })
  const { gltf, bin } = await parseGLB(GLB)
  if (!gltf?.images?.length) { console.log('Sin imágenes en', GLB); return }

  const roleByImage = new Map()
  const setRole = (texIndex, role) => {
    const tex = gltf.textures?.[texIndex]
    if (!tex) return
    const src = tex.source ?? tex.extensions?.KHR_texture_basisu?.source
    if (src == null) return
    if (!roleByImage.has(src)) roleByImage.set(src, new Set())
    roleByImage.get(src).add(role)
  }
  for (const mat of gltf.materials || []) {
    setRole(mat.pbrMetallicRoughness?.baseColorTexture?.index, 'albedo')
    setRole(mat.normalTexture?.index, 'normal')
  }

  let firstAlbedo = null, firstNormal = null
  for (let i = 0; i < gltf.images.length; i += 1) {
    const roleSet = roleByImage.get(i) || new Set()
    const role = roleSet.has('albedo') ? 'albedo' : roleSet.has('normal') ? 'normal' : 'other'
    const base = `img${i}_${role}`
    let s
    try { s = await toSharp(gltf, bin, GLB, i) } catch (e) { console.log(`img${i}: ${e.message}`); continue }
    if (!s) continue
    await s.clone().png().toFile(join(OUT, `${base}.png`))
    console.log(`extraída: ${base}.png (${[...roleSet].join('+') || 'sin rol'})`)
    // Generamos líneas de toda imagen (si no hay rol, la tratamos como color).
    const lines = await edgesToLines(s.clone())
    await writeFile(join(OUT, `${base}_lines.png`), lines)
    console.log(`  líneas: ${base}_lines.png`)
    if (role !== 'normal' && !firstAlbedo) firstAlbedo = lines
    if (role === 'normal' && !firstNormal) firstNormal = lines
  }

  if (firstAlbedo && firstNormal) {
    const meta = await sharp(firstAlbedo).metadata()
    const nResized = await sharp(firstNormal).resize(meta.width, meta.height).toBuffer()
    const combined = await sharp(firstAlbedo).composite([{ input: nResized, blend: 'multiply' }]).png().toBuffer()
    await writeFile(join(OUT, 'combined_lines.png'), combined)
    console.log('combinada: combined_lines.png')
  }
  console.log('\nListo →', OUT)
  console.log('Componé (multiply) el que más te guste sobre el albedo del modelo y re-exportá el GLB.')
}

async function main() {
  if (IMG) await runOnImageFile(IMG)
  else await runOnGLB()
}

main().catch((e) => { console.error(e); process.exit(1) })
