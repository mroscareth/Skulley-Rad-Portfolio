import React from 'react'

/**
 * Cinta policiaca diagonal de "agotado" sobre la foto de una pieza, con
 * velo oscuro debajo. Va dentro de un marco con `position: relative` y
 * `overflow: hidden`, que enmascara las esquinas de la cinta.
 *
 * `tiles` = repeticiones por mitad: la cinta lleva dos mitades idénticas para
 * que el loop de -50% sea seamless, y cada mitad tiene que medir más que el
 * marco. Marcos grandes (detalle, destacada) piden más.
 */
export default function SoldOutTape({ label, tiles = 10 }) {
  return (
    <>
      <div className="absolute inset-0 z-[4] bg-black/55 pointer-events-none" />
      <div className="shop-soldout-tape z-[5] pointer-events-none" role="img" aria-label={label}>
        <div className="shop-soldout-tape-inner">
          {[0, 1].map((seq) => (
            <React.Fragment key={seq}>
              {Array.from({ length: tiles }).map((_, i) => (
                <span key={i} className="shop-soldout-tape-text">
                  ⚠ {label.toUpperCase()} &nbsp;·&nbsp;
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  )
}
