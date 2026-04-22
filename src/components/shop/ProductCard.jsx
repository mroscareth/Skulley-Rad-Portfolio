import React, { useEffect, useState } from 'react'
import { EyeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useShopFormatter } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'

const AUTOPLAY_MS = 2800       // autoplay continuo (en reposo)
const HOVER_CYCLE_MS = 1400    // más rápido al hover (desktop)

// Colores por categoría (NUNCA amarillo en esta sección — la paleta del store es magenta).
const CATEGORY_COLORS = {
  'art-toys':       '#e600ff',
  apparel:          '#22c55e',
  prints:           '#38bdf8',
  stickers:         '#ec4899',
  coleccionables:   '#ef4444',
}
const DEFAULT_ACCENT = '#e600ff'
const LOW_STOCK_COLOR = '#ef4444'

// Card cuadrada, grid de 2 columnas. Sin amarillo.
export default function ProductCard({ product, lang = 'en', onAdd, onInspect }) {
  const [hover, setHover] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const { formatPrice } = useShopFormatter()
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const color = CATEGORY_COLORS[product.category] || DEFAULT_ACCENT
  const isSoldOut = !product.inStock || product.unitsRemaining === 0

  // Galería: featured + variant images, dedup en el adapter. Fallback a la
  // imagen única si el producto solo trae una.
  const gallery = product.images?.length ? product.images : [{ url: product.image, alt: title }]
  const hasMultiple = gallery.length > 1
  const safeIndex = Math.min(imageIndex, Math.max(0, gallery.length - 1))

  // Autoplay continuo del slideshow. Al hover acelera un poco para dar
  // feedback visual de interacción. Mobile usa los dots tappables + autoplay.
  useEffect(() => {
    if (!hasMultiple) return
    const ms = hover ? HOVER_CYCLE_MS : AUTOPLAY_MS
    const id = setInterval(() => {
      setImageIndex((i) => (i + 1) % gallery.length)
    }, ms)
    return () => clearInterval(id)
  }, [hover, hasMultiple, gallery.length])
  const tr = {
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    add: isEn ? 'ADD TO CART' : 'AGREGAR AL CARRITO',
    left: isEn ? 'LEFT' : 'RESTAN',
    inspect: isEn ? 'Inspect' : 'Inspeccionar',
  }

  return (
    <article
      className="group relative flex flex-col bg-black rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
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
      style={{
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        border: `2px solid ${hover ? 'rgba(230, 0, 255, 0.8)' : 'rgba(230, 0, 255, 0.25)'}`,
        boxShadow: hover ? '0 0 24px rgba(230, 0, 255, 0.35)' : 'none',
      }}
    >
      {/* Image frame — CUADRADO */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#1a0a20] to-black">
        {/* Halftone + scanlines */}
        <div className="absolute inset-0 shop-halftone opacity-30 z-[2] pointer-events-none" />
        <div className="absolute inset-0 shop-scanlines z-[2] pointer-events-none opacity-40" />

        {/* Category badge */}
        <div
          className="absolute top-2 left-2 z-[4] px-2 py-1 text-[10px] font-black uppercase tracking-widest border"
          style={{
            color,
            borderColor: color,
            background: 'rgba(0,0,0,0.7)',
            boxShadow: hover ? `0 0 12px ${color}80` : 'none',
            transition: 'box-shadow 200ms',
          }}
        >
          [{(product.categoryLabel || product.category).toUpperCase()}]
        </div>

        {/* Archive ID */}
        <div className="absolute top-2 right-2 z-[4] text-[10px] text-white/80 font-mono" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          {product.archiveId}
        </div>

        {/* SOLD OUT caution-tape: cinta diagonal policiaca con marquee.
            Las esquinas se enmascaran por el overflow-hidden del parent. */}
        {isSoldOut && (
          <>
            <div className="absolute inset-0 z-[4] bg-black/55 backdrop-blur-[1px] pointer-events-none" />
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
            flash de carga. loading="lazy" en todas menos la primera. */}
        {gallery.map((img, i) => (
          <img
            key={img.url || i}
            src={img.url}
            alt={img.alt || title}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            className={`absolute inset-0 w-full h-full object-cover z-[1] transition-opacity duration-500 ease-out ${
              i === safeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: hover && i === safeIndex ? 'scale(1.06)' : 'scale(1)',
              transition: 'opacity 500ms ease-out, transform 500ms cubic-bezier(0.16,1,0.3,1)',
            }}
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
              className={`absolute left-1.5 top-1/2 -translate-y-1/2 z-[5] w-7 h-7 sm:w-8 sm:h-8 grid place-items-center rounded-full border border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-opacity duration-300 ${
                hover ? 'opacity-100' : 'opacity-70 sm:opacity-0'
              }`}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setImageIndex((i) => (i + 1) % gallery.length)
              }}
              aria-label={isEn ? 'Next image' : 'Imagen siguiente'}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-[5] w-7 h-7 sm:w-8 sm:h-8 grid place-items-center rounded-full border border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-all ${
                hover ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </>
        )}

        {/* Dots del slideshow — solo si hay > 1 imagen. stopPropagation para
            que no dispare el onClick del article (abrir modal). */}
        {hasMultiple && (
          <div
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
              hover ? 'opacity-100' : 'opacity-60'
            }`}
          >
            {gallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setImageIndex(i)
                }}
                aria-label={`${isEn ? 'Image' : 'Imagen'} ${i + 1}`}
                className={`transition-all ${
                  i === safeIndex
                    ? 'w-3 h-1.5 bg-[#e600ff] rounded-full'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80 rounded-full'
                }`}
              />
            ))}
          </div>
        )}

        {/* Low stock blink — rojo por urgencia, nada de amarillo */}
        {!isSoldOut && product.unitsRemaining < 20 && (
          <div
            className="absolute bottom-2 left-2 z-[4] text-[10px] shop-blink font-bold"
            style={{ color: LOW_STOCK_COLOR, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            ⚠ {product.unitsRemaining} {tr.left}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-4 border-t-2 border-[#e600ff]/20 bg-[#0a050f]">
        <h3
          className={`text-xs sm:text-sm font-bold text-white leading-tight mb-1 line-clamp-2 ${hover ? 'shop-title-glitch' : ''}`}
          data-glitch={title}
        >
          {title}
        </h3>

        <ProductCardPrice product={product} color={color} formatPrice={formatPrice} />


        <div className="flex gap-2 mt-3">
          {/* ADD: magenta via inline style para evitar cualquier edge-case del JIT */}
          <button
            type="button"
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation()
              if (!isSoldOut && onAdd) onAdd(product)
            }}
            className="flex-1 min-h-[40px] sm:min-h-0 inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:py-2 text-[11px] font-bold uppercase tracking-widest border rounded-full transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              color: '#e600ff',
              borderColor: 'rgba(230, 0, 255, 0.6)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (isSoldOut) return
              e.currentTarget.style.background = '#e600ff'
              e.currentTarget.style.color = '#000'
              e.currentTarget.style.borderColor = '#e600ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#e600ff'
              e.currentTarget.style.borderColor = 'rgba(230, 0, 255, 0.6)'
            }}
          >
            <span>&gt;_</span>
            <span className="truncate">{isSoldOut ? tr.soldOut : tr.add}</span>
          </button>

          {/* INSPECT: EyeIcon solid (heroicons/24/solid — DESIGN.md §9.1) */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInspect && onInspect(product) }}
            className="min-w-[40px] min-h-[40px] px-3 py-2 grid place-items-center border border-white/30 text-white/70 hover:border-white hover:text-white rounded-full active:scale-95 transition-all"
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
function ProductCardPrice({ product, color, formatPrice }) {
  const { finalPrice, originalPrice, hasDiscount } = usePriceWithDiscount(
    product.price,
    product.priceOriginal,
  )
  return (
    <div className="flex items-baseline gap-2 mt-1">
      {(hasDiscount || product.priceOriginal) && (
        <span className="text-white/40 text-[10px] sm:text-xs line-through decoration-[#e600ff]">
          {formatPrice(hasDiscount ? originalPrice : product.priceOriginal)}
        </span>
      )}
      <span
        className="text-base sm:text-lg font-black"
        style={{ color, textShadow: `0 0 8px ${color}60` }}
      >
        {formatPrice(finalPrice)}
      </span>
    </div>
  )
}
