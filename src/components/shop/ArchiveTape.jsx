import React from 'react'

// "Caution tape" amarillo/negro que se mueve infinito. Footer del shop.
export default function ArchiveTape({ lang = 'en' }) {
  const en = '⚠ ALL SALES FINAL  ·  NO REFUNDS IN THE AFTERLIFE  ·  LOST ITEMS LIMITED  ·  M.A.D.R.E. ARCHIVE  ·  '
  const es = '⚠ VENTAS FINALES  ·  SIN DEVOLUCIÓN EN EL MÁS ALLÁ  ·  OBJETOS PERDIDOS LIMITADOS  ·  ARCHIVO M.A.D.R.E.  ·  '
  const text = (lang === 'en' ? en : es).repeat(6)

  return (
    <footer className="relative w-full overflow-hidden" aria-hidden>
      <div className="shop-tape-track">
        <div
          className="flex whitespace-nowrap shop-tape-scroll"
          style={{ fontFamily: '"Cascadia Code", monospace' }}
        >
          <span className="shop-tape-text">{text}</span>
          <span className="shop-tape-text" aria-hidden>{text}</span>
        </div>
      </div>
    </footer>
  )
}
