import React, { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, ShoppingCartIcon } from '@heroicons/react/24/solid'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'
import ProductMeta from './ProductMeta.jsx'
import PriceTag from './PriceTag.jsx'

const AUTOPLAY_MS = 2800       // autoplay continuo (en reposo)
const HOVER_CYCLE_MS = 1400    // más rápido al hover (desktop)
const ADDED_MS = 1800          // cuánto se queda el botón en "Agregado"

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
  const [added, setAdded] = useState(false)
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

  // "Agregado" solo cuando el carrito de verdad lo aceptó: Shop.handleAdd
  // avisa con `shop-toast` al agregar, y no avisa si no quedaba stock.
  useEffect(() => {
    if (!added) return undefined
    const t = setTimeout(() => setAdded(false), ADDED_MS)
    return () => clearTimeout(t)
  }, [added])
  useEffect(() => {
    const onToast = (e) => {
      if (e?.detail?.product?.id === product.id) setAdded(true)
    }
    window.addEventListener('shop-toast', onToast)
    return () => window.removeEventListener('shop-toast', onToast)
  }, [product.id])

  const tr = {
    soldOut: isEn ? 'Sold out' : 'Agotado',
    add: isEn ? 'Add' : 'Agregar',
    choose: isEn ? 'Choose' : 'Elegir',
    added: isEn ? 'Added' : 'Agregado',
    addAria: isEn ? `Add ${title} to cart` : `Agregar ${title} al carrito`,
    chooseAria: isEn ? `Choose options for ${title}` : `Elegir opciones de ${title}`,
  }

  const needsChoice = product.hasOptions
  const btnLabel = isSoldOut ? tr.soldOut : added ? tr.added : needsChoice ? tr.choose : tr.add
  // "Elegir" abre el detalle: el chevron va DESPUÉS del texto. Antes del texto
  // se leería como el prompt `>` de la terminal que el sitio ya no usa.
  const LeadIcon = isSoldOut || (needsChoice && !added) ? null : added ? CheckIcon : ShoppingCartIcon

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
        {/* SOLD OUT caution-tape: cinta diagonal policiaca con marquee.
            Las esquinas se enmascaran por el overflow-hidden del marco. */}
        {isSoldOut && (
          <>
            <div className="absolute inset-0 z-[4] bg-black/55 pointer-events-none" />
            <div className="shop-soldout-tape z-[5] pointer-events-none" role="img" aria-label={tr.soldOut}>
              <div className="shop-soldout-tape-inner">
                {/* Dos mitades idénticas (10 tiles c/u) para cubrir la cinta
                    inclinada de lado a lado y mantener seamless en cards grandes. */}
                {[0, 1].map((seq) => (
                  <React.Fragment key={seq}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={i} className="shop-soldout-tape-text">
                        ⚠ {tr.soldOut.toUpperCase()} &nbsp;·&nbsp;
                      </span>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}

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

        <button
          type="button"
          disabled={isSoldOut}
          aria-label={isSoldOut ? `${tr.soldOut}: ${title}` : added ? `${tr.added}: ${title}` : needsChoice ? tr.chooseAria : tr.addAria}
          onClick={(e) => {
            e.stopPropagation()
            if (!isSoldOut && onAdd) onAdd(product)
          }}
          className="shop-btn shop-btn--primary shop-card__cta shrink-0"
        >
          {LeadIcon && <LeadIcon className="w-4 h-4 -ml-0.5" aria-hidden />}
          <span>{btnLabel}</span>
          {needsChoice && !added && !isSoldOut && <ChevronRightIcon className="w-4 h-4 -mr-1" aria-hidden />}
        </button>
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
