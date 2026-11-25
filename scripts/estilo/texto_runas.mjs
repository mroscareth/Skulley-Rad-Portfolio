// Un texto escrito con la fuente SKULLEYGLYPH, como polígonos para pintarlo en Blender o en PIL
// (Oscar, 2026-11-24: los grafitis del Estudio). Lo arma opentype.js con la fuente publicada y la
// ligadura de la doble L (PIL sin raqm no la arma).
//
//   node scripts/estilo/texto_runas.mjs "Skulley Was here!" [Bold|Medium|Light] > grafiti.json
//
// Sale { texto, peso, ancho, alto, lazos: [[[x, y], ...], ...] } con la y hacia abajo, en unidades
// del em (1 = el tamaño de la fuente), la línea base en y = 0. Los lazos se rellenan par-impar
// (los huecos van adentro de su figura).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const texto = process.argv[2] || 'Skulley Was here!'
const peso = process.argv[3] || 'Bold'
const archivo = path.join(aqui, '../../public/fonts/skulley-glyph', `SkulleyGlyphVariable-${peso}.otf`)
const buf = fs.readFileSync(archivo)
const fuente = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

const ruta = fuente.getPath(texto, 0, 0, 1, { features: { liga: true, rlig: true } })
const lazos = []
let lazo = null
let x0 = 0, y0 = 0
const N = 10
for (const c of ruta.commands) {
  if (c.type === 'M') { if (lazo && lazo.length > 2) lazos.push(lazo); lazo = [[c.x, c.y]]; x0 = c.x; y0 = c.y }
  else if (c.type === 'L') lazo.push([c.x, c.y])
  else if (c.type === 'Q') {
    const [px, py] = lazo[lazo.length - 1]
    for (let i = 1; i <= N; i++) { const t = i / N, u = 1 - t; lazo.push([u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y]) }
  } else if (c.type === 'C') {
    const [px, py] = lazo[lazo.length - 1]
    for (let i = 1; i <= N; i++) {
      const t = i / N, u = 1 - t
      lazo.push([u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y])
    }
  } else if (c.type === 'Z') { if (lazo && lazo.length > 2) lazos.push(lazo); lazo = null; void x0; void y0 }
}
if (lazo && lazo.length > 2) lazos.push(lazo)

const xs = lazos.flat().map(([x]) => x), ys = lazos.flat().map(([, y]) => y)
const r4 = (n) => +n.toFixed(4)
const liga = fuente.stringToGlyphs(texto, { features: { liga: true } }).some((g) => /_/.test(g.name || ''))
process.stdout.write(JSON.stringify({
  texto, peso, ligadura: liga,
  x0: r4(Math.min(...xs)), x1: r4(Math.max(...xs)), y0: r4(Math.min(...ys)), y1: r4(Math.max(...ys)),
  lazos: lazos.map((l) => l.map(([x, y]) => [r4(x), r4(y)])),
}) + '\n')
