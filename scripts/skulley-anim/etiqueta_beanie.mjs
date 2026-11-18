// La etiqueta tejida del dobladillo del beanie: blanca, con SKULLEYRAD en SKULLEYGLYPH (la fuente
// publicada, con su ligadura LL) en negro y una costura alrededor. beanie.py la empaca en el .blend.
//   node scripts/skulley-anim/etiqueta_beanie.mjs [texto] [peso] [salida.png]
//     por omisión SKULLEYRAD, Bold, Character/assets/beanie_etiqueta.png (la carpeta de trabajo del .blend)
// La proporción es la de la etiqueta en el dobladillo (ANCHO_ET : ALTO_ET de beanie.py).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ASSETS = path.resolve(ROOT, '..', 'Character', 'assets')
const args = process.argv.slice(2)
const texto = (args[0] || 'SKULLEYRAD').toUpperCase()
const peso = args[1] || 'Bold'
const salida = args[2] || path.join(ASSETS, 'beanie_etiqueta.png')

const W = 1120, H = 400
const font = opentype.loadSync(path.join(ROOT, 'public', 'fonts', 'skulley-glyph', `SkulleyGlyphVariable-${peso}.otf`))
const opciones = { features: { liga: true }, kerning: true }
// el texto a lo ancho (84 %), centrado por su tinta
const prueba = font.getPath(texto, 0, 0, 100, opciones).getBoundingBox()
const tam = 100 * Math.min((W * 0.8) / (prueba.x2 - prueba.x1), (H * 0.5) / (prueba.y2 - prueba.y1))
const camino = font.getPath(texto, 0, 0, tam, opciones)
const caja = camino.getBoundingBox()
const dx = (W - (caja.x2 - caja.x1)) / 2 - caja.x1
const dy = (H - (caja.y2 - caja.y1)) / 2 - caja.y1
camino.fill = '#111114'
const costura = 22
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f2f0ea"/>
  <rect x="${costura}" y="${costura}" width="${W - 2 * costura}" height="${H - 2 * costura}" fill="none"
        stroke="#b9b6ad" stroke-width="7" stroke-dasharray="26 16" stroke-linecap="round"/>
  <g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">${camino.toSVG(2)}</g>
</svg>`
await sharp(Buffer.from(svg)).png().toFile(salida)
console.log(JSON.stringify({ texto, peso, W, H, salida }))
