// Atlas de distancia de las 26 runas para los shaders: la runa central de los
// portales, las que flotan alrededor y las del láser y la explosión del portal.
// Lo genera scripts/gen-runes.mjs desde el mismo pincel que la fuente.

import * as THREE from 'three'
import { RUNE_ATLAS, runeFileUrl } from './runeAlphabet.js'

let texture = null

/** La textura del atlas, una sola para todo el sitio. Mientras baja, las runas no se ven. */
export function getRuneAtlas() {
  if (texture) return texture
  texture = new THREE.TextureLoader().load(runeFileUrl(RUNE_ATLAS.file))
  texture.flipY = false
  texture.colorSpace = THREE.NoColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

const { cols, rows, cellW, cellH, pad, range } = RUNE_ATLAS
const f = (n) => n.toFixed(1)

// runeDist(cell, g): distancia con signo a la runa `cell` (A = 0 … Z = 25) en
// el punto `g` de su caja de 4 × 6 con la Y hacia abajo, en unidades de la
// runa; negativa adentro. Afuera de la casilla da la distancia máxima (el aire
// de cada casilla ya vale eso), así que basta con recortar la coordenada.
export const RUNE_ATLAS_GLSL = /* glsl */`
  uniform sampler2D uRuneAtlas;
  float runeDist(float cell, vec2 g) {
    vec2 local = clamp((g + ${f(pad)}) / vec2(${f(cellW)}, ${f(cellH)}), 0.0, 1.0);
    float c = floor(cell + 0.5);
    vec2 slot = vec2(mod(c, ${f(cols)}), floor(c / ${f(cols)}));
    float v = texture2D(uRuneAtlas, (slot + local) / vec2(${f(cols)}, ${f(rows)})).r;
    return (0.5 - v) * ${f(2 * range)};
  }
`
