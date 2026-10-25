import React, { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'
import ProductMeta from './ProductMeta.jsx'
import PriceTag from './PriceTag.jsx'
import AddButton from './AddButton.jsx'
import SoldOutTape from './SoldOutTape.jsx'

const AUTOPLAY_MS = 2800       // autoplay continuo (en reposo)
const HOVER_CYCLE_MS = 1400    // más rápido al hover (desktop)

/**
 * Card de la retícula. De arriba abajo, como se lee una pieza antes de
 * decidir: qué es (nombre + una línea), cómo se ve (la foto completa) y
 * cuánto cuesta con la única acción al lado.
 *
 * Lo que NO lleva, a propósito: el archive ID y el badge de categoría encima
 * de la foto (la categoría pasó a la línea de abajo del nombre; el ID vive en
 * la ficha del detalle), ni un segundo botón para inspeccionar — la card
 * entera abre el detalle.
 */
export default function ProductCard({ product, lang = 'en', onAdd, onInspect }) {
  const [hover, setHover] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const { slideshow } = useShopData()
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const isSoldOut = !product.inStock || product.unitsRemaining === 0

  // Galería: featured + variant images, dedup en el adapter. Fallback a la
  // imagen única si el producto solo trae una.
  const allImages = product.images?.length ? product.images : [{ url: product.image, alt: title }]
  // Modo administrado desde el CMS: 'auto' rota sola, 'manual' deja solo
  // flechas y dots, 'off' muestra una sola imagen. Ver shop-config.php.
  const mode = slideshow?.card || 'auto'
  // En 'off' la galería se RECORTA, no se esconde: si solo dejáramos de pintar
  // los controles, el DOM seguiría cargando las 4 fotos de cada producto para
  // no mostrar ninguna. `hidden` cae acá también: quitar el módulo entero solo
  // tiene sentido en el banner del hero, una card sin foto no es una card.
  const singleImage = mode === 'off' || mode === 'hidden'
  const gallery = singleImage ? allImages.slice(0, 1) : allImages
  const hasMultiple = gallery.length > 1
  const safeIndex = Math.min(imageIndex, Math.max(0, gallery.length - 1))

  // Autoplay continuo del slideshow. Al hover acelera un poco para dar
  // feedback visual de interacción. Mobile usa los dots tappables + autoplay.
  useEffect(() => {
    if (!hasMultiple || mode !== 'auto') return
    const ms = hover ? HOVER_CYCLE_MS : AUTOPLAY_MS
    const id = setInterval(() => {
      setImageIndex((i) => (i + 1) % gallery.length)
    }, ms)
    return () => clearInterval(id)
  }, [hover, hasMultiple, mode, gallery.length])

  // Si el CMS apaga el slideshow con el usuario parado en la imagen 3, hay que
  // regresar a la primera: si no, la card se queda congelada en una foto
  // secundaria y la ratio del marco (tomada de la primera) ya no le queda.
  useEffect(() => {
    if (singleImage) setImageIndex(0)
  }, [singleImage])

  const soldOutLabel = isEn ? 'Sold out' : 'Agotado'

  return (
    <article
      className="shop-card group relative cursor-pointer flex flex-col w-full h-full p-4 sm:p-5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onInspect && onInspect(product)}
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onInspect && onInspect(product)
        }
      }}
    >
      {/* Encabezado de alto fijo (DESIGN.md §14.6): el nombre reserva dos
          líneas y la línea de detalle va pegada a él, así las fotos de toda
          la fila arrancan a la misma altura aunque un nombre sea corto. */}
      <header className="shop-card__head">
        <h3 className="shop-card__title">{title}</h3>
        <ProductMeta product={product} lang={lang} className="mt-1.5" />
      </header>

      {/* Marco CUADRADO fijo: todas las cards miden lo mismo (§14.6). La foto
          se ajusta completa adentro; si no es cuadrada queda paspartú del
          color del marco, nunca un recorte (§14.7). */}
      <div className="shop-card__frame">
        {isSoldOut && <SoldOutTape label={soldOutLabel} />}

        {/* Product images — slideshow apilado, fade por opacity. Todas en DOM
            para que el cambio sea instantáneo; lazy en todas menos la primera.
            `object-contain`, NO cover, y sin zoom al hover (§14.7, §14.2). */}
        {gallery.map((img, i) => (
          <img
            key={img.url || i}
            src={img.url}
            alt={img.alt || title}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain z-[1] ${i === safeIndex ? 'opacity-100' : 'opacity-0'}`}
            style={{ transition: 'opacity 500ms ease-out' }}
          />
        ))}

        {/* Flechas del slideshow — visibles al hover. stopPropagation para no
            disparar el click del article (abrir modal). */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)
              }}
              aria-label={isEn ? 'Previous image' : 'Imagen anterior'}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${hover ? 'opacity-100' : 'opacity-70 sm:opacity-0'}`}
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setImageIndex((i) => (i + 1) % gallery.length)
              }}
              aria-label={isEn ? 'Next image' : 'Imagen siguiente'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${hover ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dots del slideshow — solo si hay > 1 imagen. stopPropagation para
            que no dispare el onClick del article (abrir modal). */}
        {hasMultiple && (
          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-1.5 transition-opacity duration-300 ${hover ? 'opacity-100' : 'opacity-70'}`}>
            {gallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setImageIndex(i)
                }}
                aria-label={`${isEn ? 'Image' : 'Imagen'} ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Precio a la izquierda, la única acción a la derecha. */}
      <footer className="flex items-center justify-between gap-3 mt-auto pt-4">
        <ProductCardPrice product={product} />

        <AddButton product={product} lang={lang} onAdd={onAdd} className="shop-card__cta" />
      </footer>
    </article>
  )
}

// Sub-componente que aplica el golden ticket si está activo. Aislado así el
// hook usePriceWithDiscount no dispara re-renders del card entero cuando
// cambia el discount activo.
function ProductCardPrice({ product }) {
  const { finalPrice, originalPrice, hasDiscount, pct } = usePriceWithDiscount(
    product.price,
    product.priceOriginal,
  )
  return (
    <PriceTag
      amount={finalPrice}
      struck={hasDiscount ? originalPrice : product.priceOriginal}
      pct={hasDiscount ? pct : 0}
    />
  )
}
