import React, { useEffect, useRef } from 'react'
import { useGlitchRunas, textoGlitch } from '../../hooks/useGlitchRunas.js'

// La firma de M.A.D.R.E. se glitchea sola a SKULLEYGLYPH y regresa (Oscar,
// 2026-11-10): la primera vez poco después de verse y luego cada tanto, solo
// mientras está en pantalla y la pestaña al frente. Sin sonido (repetido en la
// tienda cansaría) y quieta con menos movimiento.
const FIRMA_PRIMERA_MS = 1800
const FIRMA_CADA_MS = 7000
const FIRMA_SOSTIENE_MS = 2600

// Nota de bienvenida — texto corto y divertido entre el hero y el featured.
// Mantiene la sátira corporativa de M.A.D.R.E. (propósito absurdo tipo
// "data center en la luna"). EN + ES.
export default function WelcomeNote({ lang = 'en' }) {
  const isEn = lang === 'en'
  const firmaRef = useRef(null)
  const firma = useGlitchRunas(true, { sonido: false, sostieneMs: FIRMA_SOSTIENE_MS })
  const disparar = firma.disparar
  useEffect(() => {
    const el = firmaRef.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let id = 0
    const vuelta = (ms) => {
      id = setTimeout(() => {
        if (!document.hidden) disparar()
        vuelta(FIRMA_CADA_MS)
      }, ms)
    }
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(id)
      if (e.isIntersecting) vuelta(FIRMA_PRIMERA_MS)
    })
    io.observe(el)
    return () => { io.disconnect(); clearTimeout(id) }
  }, [disparar])
  // La frase de arriba va en display grande; el resto en body. Partirla así
  // evita que un párrafo entero en Luckiest Guy se vuelva ilegible.
  const hook = isEn ? 'We are selling everything he owned.' : 'Estamos vendiendo todo lo que tuvo.'
  const body = isEn
    ? 'Welcome to Skulley Rad’s lost-and-found shop. We’ve decided to sell all of his earthly possessions to fund a new data center on the moon. Thanks for your support — your kind contribution would make Skulley Rad very happy if he were still among us.'
    : 'Bienvenido a la tienda de objetos perdidos de Skulley Rad. Hemos decidido vender todas sus pertenencias terrenales para financiar un nuevo data center en la luna. Gracias por el apoyo — tu gentil aportación lo haría muy feliz si siguiera entre nosotros.'
  const signOff = isEn
    ? 'With all the processing of my chips,'
    : 'Con todo el procesamiento de mis chips,'

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-10 py-12 sm:py-24">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-16 items-start">
          <div>
            <p className="shop-display shop-display--lg">{hook}</p>
          </div>

          <div className="lg:pt-4">
            <p className="text-white/75 text-base sm:text-xl leading-relaxed">
              {body}
            </p>
            <div className="mt-6 sm:mt-8">
              <p className="text-white/45 text-sm sm:text-base italic">{signOff}</p>
              <p
                ref={firmaRef}
                className={`shop-display shop-display--md text-[#e600ff] mt-1${firma.fase?.letras ? ' display-title--runas' : ''}${firma.fase?.tiembla ? ' glitch-runas' : ''}`}
              >
                {textoGlitch('M.A.D.R.E.', firma.fase)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
