import { useEffect } from 'react'
import { useGlitchRunas } from './useGlitchRunas.js'

// El easter egg de las runas (useGlitchRunas) en los marquees. El marquee no
// recibe el puntero (pointer-events: none): si lo recibiera, la rueda sobre él
// ya no movería la sección de abajo. Así que el clic se atrapa en window y se
// compara contra la tira del marquee, y solo cuenta si debajo no hay nada que
// también responda al clic.
const RESPONDE = 'a,button,input,textarea,select,label,summary,[role="button"],[role="dialog"],[contenteditable="true"]'

/**
 * Devuelve la fase del glitch (null = runas). Un marquee que no deba glitchear
 * (la sección 6 sin abrir) lleva data-sin-glitch dentro.
 */
export function useMarqueeGlitch({ activo, marqueeRef, zonaRef }) {
  const { fase, disparar } = useGlitchRunas(activo)

  useEffect(() => {
    if (!activo) return undefined
    const onClick = (e) => {
      if (e.button !== 0) return
      const el = marqueeRef.current
      if (!el || el.querySelector('[data-sin-glitch]')) return
      const tira = el.querySelector('.title-banner')
      if (!tira) return
      const r = tira.getBoundingClientRect()
      const m = el.getBoundingClientRect()
      const { clientX: x, clientY: y } = e
      if (y < Math.max(0, r.top) || y > r.bottom || x < m.left || x > m.right) return
      const abajo = e.target
      if (!(abajo instanceof Element) || abajo.closest(RESPONDE)) return
      if (abajo.tagName !== 'CANVAS' && !zonaRef?.current?.contains(abajo)) return
      disparar()
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [activo, disparar, marqueeRef, zonaRef])

  return fase
}
