import React, { useState } from 'react'
import { EyeIcon } from '@heroicons/react/24/solid'
import { formatPrice } from '../../lib/shopMockData.js'

// Colores por categoría (NUNCA amarillo en esta sección — la paleta del store es magenta).
const CATEGORY_COLORS = {
  apparel:  '#22c55e',
  prints:   '#38bdf8',
  stickers: '#ec4899',
  digital:  '#e600ff',
  relic:    '#ef4444',
}
const DEFAULT_ACCENT = '#e600ff'
const LOW_STOCK_COLOR = '#ef4444'

// Card cuadrada, grid de 2 columnas. Sin amarillo.
export default function ProductCard({ product, lang = 'en', onAdd, onInspect }) {
  const [hover, setHover] = useState(false)
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const color = CATEGORY_COLORS[product.category] || DEFAULT_ACCENT
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const tr = {
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    add: isEn ? 'ADD' : 'AÑADIR',
    left: isEn ? 'LEFT' : 'RESTAN',
    inspect: isEn ? 'Inspect' : 'Inspeccionar',
  }

  return (
    <article
      className="group relative flex flex-col bg-black transition-all duration-300 hover:-translate-y-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
          [{product.category.toUpperCase()}]
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
                {[0, 1].map((seq) => (
                  <React.Fragment key={seq}>
                    {Array.from({ length: 6 }).map((_, i) => (
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

        {/* Product image */}
        <img
          src={product.image}
          alt={title}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover z-[1] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${hover ? 'scale-[1.06]' : 'scale-100'}`}
        />

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

        <div className="flex items-baseline gap-2 mt-1">
          {product.priceOriginal && (
            <span className="text-white/40 text-[10px] sm:text-xs line-through decoration-[#e600ff]">
              {formatPrice(product.priceOriginal)}
            </span>
          )}
          <span
            className="text-base sm:text-lg font-black"
            style={{ color, textShadow: `0 0 8px ${color}60` }}
          >
            {formatPrice(product.price)}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          {/* ADD: magenta via inline style para evitar cualquier edge-case del JIT */}
          <button
            type="button"
            disabled={isSoldOut}
            onClick={() => !isSoldOut && onAdd && onAdd(product)}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-bold uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
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
            <span>{isSoldOut ? tr.soldOut : tr.add}</span>
          </button>

          {/* INSPECT: EyeIcon solid (heroicons/24/solid — DESIGN.md §9.1) */}
          <button
            type="button"
            onClick={() => onInspect && onInspect(product)}
            className="px-3 py-2 grid place-items-center border border-white/30 text-white/70 hover:border-white hover:text-white active:scale-95 transition-all"
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
