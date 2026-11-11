import { useLayoutEffect } from 'react'

// Tope del cuerpo del título, en fracción del ancho de pantalla. Sin tope, una
// palabra corta ("WORK") se medía para llenar todo el ancho y quedaba de un
// tamaño absurdo; con él, los títulos cortos respiran.
const TOPE_TITULO = 0.3

/**
 * Cada título llena el ancho de su columna —con el padding del sitio, nunca
 * fuera de pantalla— midiendo la línea más larga con la fuente real.
 *
 * Antes era una fórmula (96vw / letras × 0.58) que suponía un ancho promedio
 * por letra de Luckiest Guy; con letras anchas se pasaba y "WORK" se salía
 * por la derecha. Ahora se mide la tinta de cada línea en un canvas 2D
 * (actualBoundingBox, que incluye lo que la letra sobresale de su avance) y se
 * escala para caber. Vuelve a medir al cargar la fuente y al cambiar el ancho.
 *
 * Lo usan la home de teléfono (MobileScrollHome) y el preloader de scroll de
 * escritorio (DesktopScrollPreloader). Mide cada `selector` dentro de la raíz
 * contra su `data-texto` (renglones con \n); con `data-texto-glitch` deja en
 * `--glitch-cuerpo` el cuerpo en que caben todas las palabras del glitch.
 */
export default function useTitulosAjustados(raizRef, deps, { selector = '.msh-title', tope = TOPE_TITULO } = {}) {
  useLayoutEffect(() => {
    const raiz = raizRef.current
    if (!raiz) return undefined
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return undefined
    let vivo = true

    const ajustar = () => {
      if (!vivo) return
      const maximo = window.innerWidth * tope
      raiz.querySelectorAll(selector).forEach((h) => {
        const ancho = h.clientWidth
        if (!ancho) return
        ctx.font = `100px ${getComputedStyle(h).fontFamily}`
        const cuerpo = (texto) => {
          let mayor = 1
          for (const linea of texto.split('\n')) {
            const m = ctx.measureText(linea)
            const tinta = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0)
            mayor = Math.max(mayor, tinta, m.width)
          }
          // 0.97: margen para el redondeo del navegador al pintar.
          return Math.min(maximo, (ancho / mayor) * 100 * 0.97)
        }
        h.style.fontSize = `${cuerpo(h.dataset.texto || h.textContent || '')}px`
        // El nombre de la portada, mientras se rompe: el cuerpo en que caben
        // todas las palabras del glitch (la más ancha es MOCTE█UMA).
        if (h.dataset.textoGlitch) h.style.setProperty('--glitch-cuerpo', `${cuerpo(h.dataset.textoGlitch)}px`)
      })
    }

    ajustar()
    document.fonts?.ready?.then(() => ajustar())
    window.addEventListener('resize', ajustar)
    return () => {
      vivo = false
      window.removeEventListener('resize', ajustar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
