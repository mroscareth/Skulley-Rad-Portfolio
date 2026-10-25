import React from 'react'

// "Caution tape" amarillo/negro que se mueve infinito. Footer del shop.
//
// Patrón seamless: dos mitades IDÉNTICAS en el DOM, animación translateX(0
// → -50%). Cada mitad debe ser más ancha que el viewport — si no, se asoma
// espacio vacío al loopear. repeat(14) = ~10k px por mitad, cubre ultrawide.
//
// Sin "ventas finales" ni "sin devoluciones" (2026-10-25): sí puede haber
// reembolsos (se hacen desde el CMS), y la cinta no debe prometer lo contrario.
export default function ArchiveTape({ lang = 'en' }) {
  const en = '⚠ LOST ITEMS LIMITED  ·  HANDLE WITH CARE  ·  M.A.D.R.E. ARCHIVE  ·  '
  const es = '⚠ OBJETOS PERDIDOS LIMITADOS  ·  MANÉJESE CON CUIDADO  ·  ARCHIVO M.A.D.R.E.  ·  '
  const text = (lang === 'en' ? en : es).repeat(14)

  return (
    <footer className="relative w-full overflow-hidden" aria-hidden>
      <div className="shop-tape-track">
        <div className="flex whitespace-nowrap shop-tape-scroll">
          <span className="shop-tape-text">{text}</span>
          <span className="shop-tape-text" aria-hidden>{text}</span>
        </div>
      </div>
    </footer>
  )
}
