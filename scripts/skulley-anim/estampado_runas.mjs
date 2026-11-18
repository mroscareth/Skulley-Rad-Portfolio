// Estampados del hoodie en SKULLEYGLYPH (la fuente publicada, con su ligadura LL), blanco sobre
// transparente, para que hoodie.py los ponga en la tela.
//   node scripts/skulley-anim/estampado_runas.mjs [texto] [peso] [salida.png]
//     una línea; por omisión SKULLEYRAD, Bold, Character/assets/hoodie_estampado_runas.png (las mangas)
//   node scripts/skulley-anim/estampado_runas.mjs --anillo [texto] [peso] [salida.png]
//     el texto en un círculo, como el anillo de la pantalla de carga (ui/CargandoAnillo.jsx: radio 104
//     en una caja de 260, letra de 38, la frase con " · " llenando la vuelta con textLength y
//     lengthAdjust="spacing", en el sentido del reloj y con las letras hacia afuera; girado para que
//     el punto quede abajo, a las 6);
//     por omisión PUNKS NOT DEAD, Bold, Character/assets/hoodie_espalda_anillo.png (la espalda)
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ASSETS = path.resolve(ROOT, '..', 'Character', 'assets')
const args = process.argv.slice(2)
const anillo = args[0] === '--anillo'
if (anillo) args.shift()
const texto = (args[0] || (anillo ? 'PUNKS NOT DEAD' : 'SKULLEYRAD')).toUpperCase()
const peso = args[1] || 'Bold'
const salida = args[2] || path.join(ASSETS, anillo ? 'hoodie_espalda_anillo.png' : 'hoodie_estampado_runas.png')

const font = opentype.loadSync(path.join(ROOT, 'public', 'fonts', 'skulley-glyph', `SkulleyGlyphVariable-${peso}.otf`))
const opciones = { features: { liga: true }, kerning: true }

let svg, w, h, glifos
if (!anillo) {
  glifos = font.stringToGlyphs(texto, opciones)
  const TAM = 600
  const camino = font.getPath(texto, 0, 0, TAM, opciones)
  const caja = camino.getBoundingBox()
  const aire = TAM * 0.08
  w = Math.ceil(caja.x2 - caja.x1 + 2 * aire); h = Math.ceil(caja.y2 - caja.y1 + 2 * aire)
  camino.fill = '#ffffff'
  svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${caja.x1 - aire} ${caja.y1 - aire} ${w} ${h}">${camino.toSVG(2)}</svg>`
} else {
  // el radio del anillo de carga, a 4×. Alla la palabra va dos veces; aqui la frase va una sola, con la
  // letra del tamaño que llena la vuelta igual de parejo (LLENA de la vuelta, el resto es espaciado)
  const E = 4, R = 104 * E, LLENA = 0.86
  const frase = `${texto} · `
  glifos = font.stringToGlyphs(frase, opciones)
  const largo = 2 * Math.PI * R - 6 * E
  const natural = glifos.reduce((a, g) => a + g.advanceWidth, 0) / font.unitsPerEm
  const TAM = LLENA * largo / natural
  const CAJA = Math.ceil(2 * (R + TAM * 1.15)), c = CAJA / 2
  const escala = TAM / font.unitsPerEm
  const avances = glifos.map((g) => g.advanceWidth * escala)
  const total = avances.reduce((a, b) => a + b, 0)
  const extra = (largo - total) / glifos.length
  // el anillo se gira para que el punto de la frase quede abajo, a las 6 (Oscar)
  const mitades = []
  { let s = 0; avances.forEach((a) => { mitades.push(s + a / 2); s += a + extra }) }
  const iPunto = glifos.findIndex((g) => g.unicode === 0xb7)
  const giro = iPunto >= 0 ? 1.5 * Math.PI - mitades[iPunto] / R : 0
  let s = 0
  const partes = []
  glifos.forEach((g, i) => {
    const mitad = s + avances[i] / 2
    const phi = mitad / R + giro
    const px = c - R * Math.cos(phi), py = c - R * Math.sin(phi)
    const alfa = Math.atan2(-Math.cos(phi), Math.sin(phi)) * 180 / Math.PI
    const d = g.getPath(0, 0, TAM).toPathData(2)
    if (d) partes.push(`<path fill="#ffffff" transform="translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${alfa.toFixed(3)}) translate(${(-avances[i] / 2).toFixed(2)},0)" d="${d}"/>`)
    s += avances[i] + extra
  })
  w = h = CAJA
  svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CAJA}" height="${CAJA}" viewBox="0 0 ${CAJA} ${CAJA}">${partes.join('')}</svg>`
}
await sharp(Buffer.from(svg)).png().toFile(salida)
console.log(JSON.stringify({ anillo, texto, peso, glifos: glifos.length, nombres: glifos.map((g) => g.name), w, h, salida }))
