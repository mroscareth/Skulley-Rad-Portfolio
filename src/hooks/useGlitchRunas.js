import { useCallback, useEffect, useRef, useState } from 'react'
import { playHechizo } from '../lib/hechizoSound.js'

// El easter egg de las runas (Oscar, 2026-11-10): un clic glitchea un título de
// SKULLEYGLYPH a Luckiest Guy, la tipografía de antes, y al rato regresa igual,
// con un sonido de hechizo. Lo usan los marquees (useMarqueeGlitch) y el nombre
// de Argus. El glitch es el del título del preloader (GlitchName): tiembla
// (clase .glitch-runas) y las letras se rompen en bloques █▓▒░. Cada fase es un
// render; nada corre por cuadro.
const BLOQUES = '█▓▒░'
// [ms desde el clic, letras, rotas, tiembla]
const IDA = [[0, false, true, true], [80, true, true, true], [170, true, true, true], [260, true, false, true], [420, true, false, false]]
const SOSTIENE_MS = 2800
const VUELTA = [[0, true, true, true], [80, false, true, true], [170, false, true, true], [260, false, false, true], [420, null]]

export function romperTexto(texto) {
  return [...texto].map((c) => (c !== ' ' && Math.random() < 0.35 ? BLOQUES[Math.floor(Math.random() * BLOQUES.length)] : c)).join('')
}

export const textoGlitch = (texto, fase) => (fase?.rotas ? romperTexto(texto) : texto)

/** { fase, disparar }: fase es null (runas) o { letras, rotas, tiembla }. */
export function useGlitchRunas(activo = true) {
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

  return { fase, disparar }
}
