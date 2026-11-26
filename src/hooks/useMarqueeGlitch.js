import { useEffect } from 'react'
import { useGlitchRunas } from './useGlitchRunas.js'

// El easter egg de las runas (useGlitchRunas) en los marquees. El marquee no
// recibe el puntero (pointer-events: none): si lo recibiera, la rueda sobre él
// ya no movería la sección de abajo. Así que el clic se atrapa en window y se
// compara contra la tira del marquee, y solo cuenta si debajo no hay nada que
// también responda al clic.
const RESPONDE = 'a,button,input,textarea,select,label,summary,[role="button"],[role="dialog"],[contenteditable="true"]'

// Al pararse en un portal el marquee entra en runas y, ya leído, se glitchea solo a letras y regresa
// (Oscar, 2026-11-25: "que el usuario vea el efecto y alcance a ver runas", y luego "que cambien más
// rápido al principio"). Cuenta desde que llega al portal: el marquee tarda ~450 ms en entrar, así que
// las runas se ven completas ~0.6 s.
export const AUTO_GLITCH_MS = 1050

/**
 * Devuelve la fase del glitch (null = runas). Un marquee que no deba glitchear
 * (la sección 6 sin abrir) lleva data-sin-glitch dentro. `autoClave`: el portal donde está parado
 * (null si no): cada vez que cambia a uno, el glitch sale solo una vez, sin el hechizo.
 */
export function useMarqueeGlitch({ activo, marqueeRef, zonaRef, autoClave = null }) {
  const { fase, disparar } = useGlitchRunas(activo)

  useEffect(() => {
    if (!activo || !autoClave) return undefined
    const id = setTimeout(() => {
      const el = marqueeRef.current
      if (!el || el.querySelector('[data-sin-glitch]')) return
      disparar({ conSonido: false })
    }, AUTO_GLITCH_MS)
    return () => clearTimeout(id)
  }, [activo, autoClave, disparar, marqueeRef])

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
