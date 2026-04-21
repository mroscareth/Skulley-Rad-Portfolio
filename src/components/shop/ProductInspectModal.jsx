import React, { useEffect, useState } from 'react'
import { XMarkIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/solid'
import { formatPrice } from '../../lib/shopMockData.js'

// Modal de inspección — overlay full-screen al click en "INSPECT".
// Estilo "ficha forense" de museo — imagen grande + specs + add to cart.
export default function ProductInspectModal({ product, lang = 'en', onClose, onAdd }) {
  const [selectedSize, setSelectedSize] = useState(null)
  const [qty, setQty] = useState(1)
  const isEn = lang === 'en'
  const title = product ? (isEn ? product.title_en : product.title_es) : ''
  const description = product ? (isEn ? product.description_en : product.description_es) : ''
  const isSoldOut = product && (!product.inStock || product.unitsRemaining === 0)
  const tr = {
    inspectingLabel: isEn ? 'INSPECTING:' : 'INSPECCIONANDO:',
    lostItemTag: isEn ? '[LOST ITEM]' : '[OBJETO PERDIDO]',
    archiveIdLabel: isEn ? 'ARCHIVE ID' : 'ID DE ARCHIVO',
    recoveredLabel: isEn ? 'RECOVERED' : 'RECUPERADO',
    unitsRemainingLabel: isEn ? 'UNITS REMAINING' : 'UNIDADES RESTANTES',
    statusLabel: isEn ? 'STATUS' : 'ESTATUS',
    availableStatus: isEn ? 'AVAILABLE' : 'DISPONIBLE',
    archivedStatus: isEn ? 'SOLD OUT' : 'AGOTADO',
    sizeLabel: isEn ? 'SIZE' : 'TALLA',
    qtyLabel: isEn ? 'QUANTITY' : 'CANTIDAD',
    addCta: isEn ? 'ADD TO BAG' : 'AÑADIR A BOLSA',
    archivedCta: isEn ? 'SOLD OUT' : 'AGOTADO',
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    closeAria: isEn ? 'Close' : 'Cerrar',
  }

  useEffect(() => {
    if (!product) return
    setSelectedSize(product.sizes?.[0] || null)
    setQty(1)
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  if (!product) return null

  const handleAdd = () => {
    if (isSoldOut) return
    if (product.sizes && !selectedSize) return
    onAdd?.(product, qty, selectedSize)
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[52] flex items-center justify-center p-4 sm:p-8 shop-inspect-enter"
      style={{ fontFamily: '"Cascadia Code", monospace' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-black border-2 border-[#e600ff] overflow-hidden">
        {/* Header bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b-2 border-[#e600ff] bg-black">
          <div className="flex items-center gap-3 text-xs text-[#e600ff] uppercase tracking-widest">
            <span className="opacity-60">&gt;</span>
            <span className="font-bold">{tr.inspectingLabel}</span>
            <span className="text-white">{product.archiveId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center border border-[#e600ff]/60 text-[#e600ff] hover:bg-[#e600ff] hover:text-black transition-colors"
            aria-label={tr.closeAria}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Imagen grande */}
          <div className="relative min-h-[320px] lg:min-h-0 bg-gradient-to-br from-[#0a0f1a] to-black border-b-2 lg:border-b-0 lg:border-r-2 border-[#e600ff]/30 overflow-hidden">
            <div className="absolute inset-0 shop-halftone opacity-30 pointer-events-none z-[2]" />
            <div className="absolute inset-0 shop-scanlines pointer-events-none z-[2] opacity-40" />
            <span className="absolute top-3 left-3 z-[3] text-xs text-[#e600ff]/80">{tr.lostItemTag}</span>
            <span className="absolute top-3 right-3 z-[3] text-xs text-[#e600ff]/80 shop-blink">●REC</span>
            <img
              src={product.image}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover z-[1]"
              draggable={false}
            />
            {isSoldOut && (
              <>
                <div className="absolute inset-0 z-[4] bg-black/55 backdrop-blur-[1px] pointer-events-none" />
                <div className="shop-soldout-tape z-[5] pointer-events-none" role="img" aria-label={tr.soldOut}>
                  <div className="shop-soldout-tape-inner">
                    {[0, 1].map((seq) => (
                      <React.Fragment key={seq}>
                        {Array.from({ length: 8 }).map((_, i) => (
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
          </div>

          {/* Info */}
          <div className="p-6 sm:p-8 flex flex-col gap-5">
            <div>
              <div className="text-xs text-[#e600ff] uppercase tracking-widest mb-2 font-bold">
                [{product.category.toUpperCase()}]
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{title}</h2>
            </div>

            <div className="border border-[#e600ff]/30 divide-y divide-[#e600ff]/15 text-xs sm:text-sm">
              <SpecRow k={tr.archiveIdLabel} v={product.archiveId} />
              <SpecRow k={tr.recoveredLabel} v={product.recoveredDate} />
              <SpecRow
                k={tr.unitsRemainingLabel}
                v={<span className={product.unitsRemaining < 20 ? 'text-red-400 shop-blink' : 'text-white'}>{product.unitsRemaining}</span>}
              />
              <SpecRow
                k={tr.statusLabel}
                v={isSoldOut
                  ? <span className="text-red-400">● {tr.archivedStatus}</span>
                  : <span className="text-green-400">● {tr.availableStatus}</span>}
              />
            </div>

            <p className="text-white/70 text-sm leading-relaxed">{description}</p>

            {/* Sizes */}
            {product.sizes && (
              <div>
                <div className="text-xs text-[#e600ff]/70 uppercase tracking-widest mb-2">
                  {tr.sizeLabel}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`min-w-[48px] px-3 py-2 text-sm font-bold border-2 transition-all ${selectedSize === s
                        ? 'bg-[#e600ff] text-black border-[#e600ff]'
                        : 'bg-transparent text-[#e600ff] border-[#e600ff]/40 hover:border-[#e600ff]'
                        }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Qty */}
            <div>
              <div className="text-xs text-[#e600ff]/70 uppercase tracking-widest mb-2">
                {tr.qtyLabel}
              </div>
              <div className="inline-flex items-center border-2 border-[#e600ff]/60">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 grid place-items-center text-[#e600ff] hover:bg-[#e600ff]/20">
                  <MinusIcon className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-white font-bold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(product.unitsRemaining || 99, q + 1))} className="w-10 h-10 grid place-items-center text-[#e600ff] hover:bg-[#e600ff]/20">
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="pt-3 border-t border-[#e600ff]/20 flex flex-col sm:flex-row sm:items-center gap-4 mt-auto">
              <div className="flex items-baseline gap-3 flex-1">
                {product.priceOriginal && (
                  <span className="text-white/40 text-lg line-through decoration-[#e600ff] decoration-2">
                    {formatPrice(product.priceOriginal)}
                  </span>
                )}
                <span className="text-3xl sm:text-4xl font-black text-[#e600ff]" style={{ textShadow: '0 0 16px rgba(230, 0, 255, 0.6)' }}>
                  {formatPrice(product.price * qty)}
                </span>
              </div>
              <button
                type="button"
                disabled={isSoldOut || (product.sizes && !selectedSize)}
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 bg-[#e600ff] text-black border-[#e600ff] hover:shadow-[0_0_24px_rgba(230,0,255,0.7)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                <span>&gt;_</span>
                <span>{isSoldOut ? tr.archivedCta : tr.addCta}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpecRow({ k, v }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[#e600ff]/70 uppercase tracking-widest text-xs">{k}</span>
      <span className="text-white font-bold">{v}</span>
    </div>
  )
}
