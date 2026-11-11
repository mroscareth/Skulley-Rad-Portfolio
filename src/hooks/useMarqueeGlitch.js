import { useCallback, useEffect, useRef, useState } from 'react'
import { playHechizo } from '../lib/hechizoSound.js'

// Easter egg de los marquees (Oscar, 2026-11-10): un clic los glitchea de las
// runas a Luckiest Guy, la tipografía de antes, y al rato regresan igual, con un
// sonido de hechizo. El glitch es el del título del preloader (GlitchName):
// tiembla y las letras se rompen en bloques █▓▒░. Cada fase es un render; nada
// corre por cuadro.
//
// El marquee no recibe el puntero (pointer-events: none): si lo recibiera, la
// rueda sobre él ya no movería la sección de abajo. Así que el clic se atrapa en
// window y se compara contra la tira del marquee, y solo cuenta si debajo no hay
// nada que también responda al clic.
const BLOQUES = '█▓▒░'
// [ms desde el clic, letras, rotas, tiembla]
const IDA = [[0, false, true, true], [80, true, true, true], [170, true, true, true], [260, true, false, true], [420, true, false, false]]
const SOSTIENE_MS = 2800
const VUELTA = [[0, true, true, true], [80, false, true, true], [170, false, true, true], [260, false, false, true], [420, null]]
const RESPONDE = 'a,button,input,textarea,select,label,summary,[role="button"],[role="dialog"],[contenteditable="true"]'

export function romperTexto(texto) {
  return [...texto].map((c) => (c !== ' ' && Math.random() < 0.35 ? BLOQUES[Math.floor(Math.random() * BLOQUES.length)] : c)).join('')
}

/**
 * fase es null (runas) o { letras, rotas, tiembla }. Un marquee que no deba
 * glitchear (la sección 6 sin abrir) lleva data-sin-glitch dentro.
 */
export function useMarqueeGlitch({ activo, marqueeRef, zonaRef }) {
  const [fase, setFase] = useState(null)
  const timers = useRef([])
  const limpia = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => limpia, [])
  useEffect(() => { if (!activo) { limpia(); setFase(null) } }, [activo])

  const disparar = useCallback(() => {
    if (!activo || timers.current.length) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const pasos = quieto
      ? [[0, true, false, false], [SOSTIENE_MS, null]]
      : [...IDA, ...VUELTA.map(([t, ...r]) => [t + SOSTIENE_MS, ...r])]
    for (const [t, letras, rotas, tiembla] of pasos) {
      timers.current.push(setTimeout(() => {
        setFase(letras == null ? null : { letras, rotas, tiembla })
        if (letras == null) timers.current = []
      }, t))
    }
    playHechizo(false)
    timers.current.push(setTimeout(() => playHechizo(true), SOSTIENE_MS))
  }, [activo])

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
