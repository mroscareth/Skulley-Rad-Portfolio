import React, { useEffect, useState } from 'react'
import { EyeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useShopFormatter, useShopData } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'

const AUTOPLAY_MS = 2800       // autoplay continuo (en reposo)
const HOVER_CYCLE_MS = 1400    // más rápido al hover (desktop)

// Colores por categoría (NUNCA amarillo en esta sección — la paleta del store
// es magenta). Se usan como acento puntual, no como fill de superficies.
const CATEGORY_COLORS = {
  'art-toys':       '#e600ff',
  apparel:          '#22c55e',
  prints:           '#38bdf8',
  stickers:         '#ec4899',
  coleccionables:   '#ef4444',
}
const DEFAULT_ACCENT = '#e600ff'
const LOW_STOCK_COLOR = '#ef4444'

// Escala tipográfica por peso de card. El `hero` es la pieza que ancla cada
// tanda de la retícula.
const WEIGHTS = {
  hero: { title: 'text-xl sm:text-3xl lg:text-4xl', price: 'text-2xl sm:text-4xl', pad: 'p-4 sm:p-6' },
  std:  { title: 'text-sm sm:text-base',            price: 'text-lg sm:text-xl',   pad: 'p-3 sm:p-4' },
}

export default function ProductCard({ product, lang = 'en', weight = 'std', onAdd, onInspect }) {
  const [hover, setHover] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const { formatPrice } = useShopFormatter()
  const { slideshow } = useShopData()
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const color = CATEGORY_COLORS[product.category] || DEFAULT_ACCENT
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const scale = WEIGHTS[weight] || WEIGHTS.std
  // Todas las cards son verticales: imagen arriba, ficha abajo. La jerarquía
  // del hero es solo de ancho (4 columnas contra 3) y de escala tipográfica.
  // El salto se controla desde la retícula, no partiendo la card — ver
  // DESIGN.md §14.6.
  const isHero = weight === 'hero'

  // Proporción REAL de la pieza. El marco la adopta, así que la imagen lo
  // llena exacto: ni recorte ni paspartú. Arranca en 1/1 —la mayoría del
  // catálogo es cuadrado— y se corrige al cargar la primera imagen; el
  // masonry de ProductGrid re-mide la card cuando eso pasa.
  //
  // Se usa la ratio de la PRIMERA imagen, no la de la que esté visible: si el
  // marco cambiara de forma con cada paso del slideshow, la retícula entera
  // se reacomodaría sola cada 2.8 segundos.
  const [ratio, setRatio] = useState(1)
  const onFirstImageLoad = (e) => {
    const w = e?.target?.naturalWidth
    const h = e?.target?.naturalHeight
    if (w > 0 && h > 0) setRatio(w / h)
  }

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

  const tr = {
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    add: isEn ? 'ADD' : 'AGREGAR',
    addLong: isEn ? 'ADD TO CART' : 'AGREGAR AL CARRITO',
    left: isEn ? 'LEFT' : 'RESTAN',
    inspect: isEn ? 'Inspect' : 'Inspeccionar',
  }

  return (
    <article
      className="shop-card group relative overflow-hidden cursor-pointer flex flex-col"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onInspect && onInspect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onInspect && onInspect(product)
        }
      }}
    >
      {/* Marco de imagen: adopta la proporción de la pieza en vez de imponerle
          la forma de la celda. Antes la celda mandaba (alto fijo por la
          retícula) y la foto se recortaba para llenarla; ahora es al revés —
          el marco se ajusta y la card crece lo que tenga que crecer. */}
      <div className="relative overflow-hidden bg-[#150a1d]" style={{ aspectRatio: String(ratio) }}>
        {/* Category badge */}
        <div
          className="shop-kicker absolute top-3 left-3 z-[4] px-2.5 py-1 rounded-full"
          style={{ color: '#0a0510', background: color }}
        >
          {(product.categoryLabel || product.category).toUpperCase()}
        </div>

        {/* Archive ID — flavor del canon, ya no chrome de terminal */}
        <div className="shop-kicker absolute top-3 right-3 z-[4] text-white/60" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          {product.archiveId}
        </div>

        {/* SOLD OUT caution-tape: cinta diagonal policiaca con marquee.
            Las esquinas se enmascaran por el overflow-hidden del parent. */}
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
                        ⚠ {tr.soldOut} &nbsp;·&nbsp;
                      </span>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Product images — slideshow apilado, fade por opacity. Renderizamos
            todas las imágenes en DOM para que el cambio sea instantáneo sin
            flash de carga. loading="lazy" en todas menos la primera.

            `object-contain`, NO cover: la pieza se ve COMPLETA y con su
            proporción real. Como el marco ya tiene la ratio de la primera
            imagen, ésta lo llena exacto y `contain` no deja ningún sobrante.
            La red de seguridad es para las OTRAS imágenes de la galería: si
            una trae otra forma, se ajusta dentro del marco en vez de
            recortarse. En una tienda de arte recortar la pieza es esconder
            justo lo que se está vendiendo.

            El zoom de 1.04 al hover se fue: escalar una imagen que llena el
            marco exacto la recorta por las orillas, o sea que reintroducía el
            problema. Además el hover de la Store es SOLO elevación
            (DESIGN.md §14.2) y la card ya la hace. */}
        {gallery.map((img, i) => (
          <img
            key={img.url || i}
            src={img.url}
            alt={img.alt || title}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            onLoad={i === 0 ? onFirstImageLoad : undefined}
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

        {/* Low stock — rojo por urgencia, nada de amarillo */}
        {!isSoldOut && product.unitsRemaining < 20 && (
          <div
            className="shop-kicker absolute bottom-3 left-3 z-[4] px-2 py-1 rounded-full bg-black/70"
            style={{ color: LOW_STOCK_COLOR }}
          >
            {product.unitsRemaining} {tr.left}
          </div>
        )}
      </div>

      {/* Ficha */}
      <div className={`flex flex-col ${scale.pad}`}>
        <h3 className={`font-bold text-white leading-tight line-clamp-2 ${scale.title}`}>
          {title}
        </h3>

        <ProductCardPrice
          product={product}
          formatPrice={formatPrice}
          priceClass={scale.price}
        />

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation()
              if (!isSoldOut && onAdd) onAdd(product)
            }}
            className={`shop-btn shop-btn--primary flex-1 min-h-[40px] px-4 ${isHero ? 'text-sm' : 'text-[11px] sm:text-xs'}`}
          >
            <span className="truncate">
              {isSoldOut ? tr.soldOut : (isHero ? tr.addLong : tr.add)}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInspect && onInspect(product) }}
            className="shop-btn shop-btn--ghost min-w-[40px] min-h-[40px] px-3"
            title={tr.inspect}
            aria-label={tr.inspect}
          >
            <EyeIcon className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}

// Sub-componente que aplica el golden ticket si está activo. Aislado así el
// hook usePriceWithDiscount no dispara re-renders del card entero cuando
// cambia el discount activo.
function ProductCardPrice({ product, formatPrice, priceClass }) {
  const { finalPrice, originalPrice, hasDiscount } = usePriceWithDiscount(
    product.price,
    product.priceOriginal,
  )
  return (
    <div className="flex items-baseline gap-2 mt-2">
      <span className={`font-black text-white ${priceClass}`}>
        {formatPrice(finalPrice)}
      </span>
      {(hasDiscount || product.priceOriginal) && (
        <span className="text-white/40 text-xs sm:text-sm line-through decoration-[#e600ff] decoration-2">
          {formatPrice(hasDiscount ? originalPrice : product.priceOriginal)}
        </span>
      )}
    </div>
  )
}
