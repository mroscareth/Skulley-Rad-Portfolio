import { useCallback, useEffect, useRef, useState } from 'react'
import { playHechizo } from '../lib/hechizoSound.js'

// El easter egg de las runas (Oscar, 2026-11-10): un clic glitchea un título de
// SKULLEYGLYPH a Luckiest Guy, la tipografía de antes, y al rato regresa igual,
// con un sonido de hechizo. Lo usan los marquees (useMarqueeGlitch), el nombre
// de Argus y, solos y al revés (useGlitchSolo), la firma de M.A.D.R.E. y el
// título Lost items de la tienda: ahí la fase `letras` es la otra fuente, las
// runas. El glitch es el del título del preloader (GlitchName): tiembla (clase
// .glitch-runas) y las letras se rompen en bloques █▓▒░. Cada fase es un render;
// nada corre por cuadro.
const BLOQUES = '█▓▒░'
// [ms desde el clic, letras, rotas, tiembla]
const IDA = [[0, false, true, true], [80, true, true, true], [170, true, true, true], [260, true, false, true], [420, true, false, false]]
const SOSTIENE_MS = 2800
const VUELTA = [[0, true, true, true], [80, false, true, true], [170, false, true, true], [260, false, false, true], [420, null]]

export function romperTexto(texto) {
  return [...texto].map((c) => (c !== ' ' && Math.random() < 0.35 ? BLOQUES[Math.floor(Math.random() * BLOQUES.length)] : c)).join('')
}

export const textoGlitch = (texto, fase) => (fase?.rotas ? romperTexto(texto) : texto)

/**
 * { fase, disparar }: fase es null (runas) o { letras, rotas, tiembla }.
 * `sonido: false` sin el hechizo; `sostieneMs`, cuánto se queda en la otra fuente.
 */
export function useGlitchRunas(activo = true, { sonido = true, sostieneMs = SOSTIENE_MS } = {}) {
  const [fase, setFase] = useState(null)
  const timers = useRef([])
  const limpia = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => limpia, [])
  useEffect(() => { if (!activo) { limpia(); setFase(null) } }, [activo])

  const disparar = useCallback(() => {
    if (!activo || timers.current.length) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const pasos = quieto
      ? [[0, true, false, false], [sostieneMs, null]]
      : [...IDA, ...VUELTA.map(([t, ...r]) => [t + sostieneMs, ...r])]
    for (const [t, letras, rotas, tiembla] of pasos) {
      timers.current.push(setTimeout(() => {
        setFase(letras == null ? null : { letras, rotas, tiembla })
        if (letras == null) timers.current = []
      }, t))
    }
    if (sonido) {
      playHechizo(false)
      timers.current.push(setTimeout(() => playHechizo(true), sostieneMs))
    }
  }, [activo, sonido, sostieneMs])

  return { fase, disparar }
}

/**
 * El glitch solo, sin clic (Oscar, 2026-11-10: la firma de M.A.D.R.E. y el título
 * Lost items de la tienda). La primera vez `primeraMs` después de que `ref` se
 * ve y luego cada `cadaMs`, solo mientras está en pantalla y la pestaña al
 * frente. Sin sonido (repetido cansaría) y quieto con menos movimiento.
 * Devuelve la fase.
 */
export function useGlitchSolo(ref, { primeraMs = 1800, cadaMs = 7000, sostieneMs = 2600 } = {}) {
  const { fase, disparar } = useGlitchRunas(true, { sonido: false, sostieneMs })
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let id = 0
    const vuelta = (ms) => {
      id = setTimeout(() => {
        if (!document.hidden) disparar()
        vuelta(cadaMs)
      }, ms)
    }
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(id)
      if (e.isIntersecting) vuelta(primeraMs)
    })
    io.observe(el)
    return () => { io.disconnect(); clearTimeout(id) }
  }, [disparar, ref, primeraMs, cadaMs])
  return fase
}
