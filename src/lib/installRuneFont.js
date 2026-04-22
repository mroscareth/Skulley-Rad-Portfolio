// Instala "Skulley Glyph Variable" como font REAL en el documento (en memoria).
//
// En vez de renderizar cada glyph como SVG inline (costoso cuando hay muchos
// en pantalla — marquee con cientos de caracteres), generamos el OTF en memoria
// UNA VEZ al boot, lo inyectamos via FontFace API, y luego cualquier texto con
// `font-family: 'Skulley Glyph Variable'` renderiza NATIVO → GPU-accelerated,
// subpixel AA, selectable, y sin sobrecarga por-caracter en el DOM.

import { buildRuneFont } from './generateRuneFont.js'

let installPromise = null

/**
 * Instala el font. Idempotente — llamar múltiples veces devuelve la misma
 * promise. Resuelve cuando el font está ready para usarse.
 */
export function installRuneFont() {
  if (installPromise) return installPromise
  installPromise = (async () => {
    try {
      // Medium weight como default. Los 3 weights los podemos instalar si
      // hace falta — por ahora uno alcanza para los usos internos.
      const font = buildRuneFont({ lineWidth: 85, styleName: 'Medium', usWeightClass: 500 })
      const buffer = font.toArrayBuffer()
      const blob = new Blob([buffer], { type: 'font/otf' })
      const url = URL.createObjectURL(blob)
      // FontFace API (Chromium, Firefox, Safari modernos)
      if (typeof FontFace !== 'undefined' && typeof document !== 'undefined' && document.fonts) {
        const face = new FontFace('Skulley Glyph Variable', `url(${url}) format('opentype')`, {
          style: 'normal',
          weight: '500',
          display: 'swap',
        })
        await face.load()
        document.fonts.add(face)
      } else if (typeof document !== 'undefined') {
        // Fallback ancient — inyecta @font-face via <style>
        const style = document.createElement('style')
        style.textContent = `@font-face { font-family: 'Skulley Glyph Variable'; src: url(${url}) format('opentype'); font-display: swap; }`
        document.head.appendChild(style)
      }
      return true
    } catch (err) {
      console.warn('[runeFont] install failed', err)
      installPromise = null
      return false
    }
  })()
  return installPromise
}

/**
 * CSS font-family string listo para usar en styles inline.
 * Fallback a Luckiest Guy (que tiene glyphs amplios) y system mono por si
 * el font no cargó aún.
 */
export const RUNE_FONT_FAMILY = "'Skulley Glyph Variable', 'Luckiest Guy', 'Cascadia Code', monospace"
