import React from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

/**
 * Enlace a la página de ayuda de la tienda (/help). Abre en otra pestaña: la
 * ayuda es una página aparte y así no se pierde el carrito ni la escena 3D.
 * `section` lleva a una parte concreta (returns, shipping, cancellations…).
 */
export default function HelpLink({ lang = 'en', section = '', children, className = '' }) {
  const label = children || (lang === 'es' ? 'Envíos, cancelaciones y devoluciones' : 'Shipping, cancellations and returns')
  return (
    <a
      href={`/help${lang === 'es' ? '?lang=es' : ''}${section ? `#${section}` : ''}`}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 text-sm text-white/60 underline underline-offset-4 decoration-white/25 hover:text-white hover:decoration-white/60 transition-colors rounded ${FOCUS_RING} ${className}`}
    >
      {label}
      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
    </a>
  )
}
