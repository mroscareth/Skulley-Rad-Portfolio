// Instala "Skulley Glyph Variable" como fuente real del documento.
//
// Los archivos los genera scripts/gen-runes.mjs desde el pincel de las runas
// (public/fonts/skulley-glyph/). Antes la fuente se armaba en el navegador
// con opentype.js en cada visita; ahora son los mismos .otf que se descargan.
// Cualquier texto con RUNE_FONT_FAMILY se dibuja nativo: GPU, antialias, sin
// SVG por carácter.

import { ALPHABET_META, FONT_WEIGHTS, runeFileUrl, fontFileName } from './runeAlphabet.js'

const FAMILY = ALPHABET_META.family
const fallback = "'Luckiest Guy', 'Cascadia Code', monospace"

let installPromise = null
const extra = new Map()

const faceFor = (family, weight, descriptorWeight) => new FontFace(
  family,
  `url(${runeFileUrl(fontFileName(weight))}) format('opentype')`,
  { style: 'normal', weight: descriptorWeight, display: 'swap' },
)

/**
 * Pide el peso Medium (declarado con @font-face en index.css y precargado en
 * index.html) y espera a que cargue. Cubre cualquier grosor (100–900): un
 * texto en negrita sigue siendo la misma runa. Idempotente.
 */
export function installRuneFont() {
  if (installPromise) return installPromise
  installPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return false
    try {
      const faces = await document.fonts.load(`500 1em '${FAMILY}'`, 'A')
      return faces.length > 0
    } catch (err) {
      console.warn('[runeFont] install failed', err)
      installPromise = null
      return false
    }
  })()
  return installPromise
}

/**
 * font-family de un peso concreto (el códice de SKULLEYGLYPH enseña los tres).
 * Light y Bold se registran como familias aparte la primera vez que se piden.
 */
export function runeFontFamilyFor(weightName = 'Medium') {
  if (weightName === 'Medium' || typeof document === 'undefined' || typeof FontFace === 'undefined') return RUNE_FONT_FAMILY
  const family = `${FAMILY} ${weightName}`
  if (!extra.has(family)) {
    const w = FONT_WEIGHTS.find((x) => x.name === weightName)
    if (!w) return RUNE_FONT_FAMILY
    const face = faceFor(family, w, '100 900')
    document.fonts.add(face)
    extra.set(family, face.load().catch(() => {}))
  }
  return `'${family}', ${RUNE_FONT_FAMILY}`
}

/**
 * font-family listo para estilos inline. Cae a Luckiest Guy y a una mono si
 * la fuente aún no cargó.
 */
export const RUNE_FONT_FAMILY = `'${FAMILY}', ${fallback}`
