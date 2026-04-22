import React, { useEffect, useMemo, useState } from 'react'
import { XMarkIcon, MinusIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useShopFormatter } from '../../lib/shopDataContext.jsx'
import { findVariantBySelection } from '../../lib/shopifyAdapter.js'

// Modal de inspección — overlay full-screen al click en "INSPECT".
// Soporta variantes multi-opción (Color + Size, etc.): se renderiza un grupo
// de botones por opción y resuelve la variante exacta para precio/imagen.
export default function ProductInspectModal({ product, lang = 'en', onClose, onAdd }) {
  const [selectedOptions, setSelectedOptions] = useState({})
  const [qty, setQty] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const { formatPrice } = useShopFormatter()
  const isEn = lang === 'en'
  const title = product ? (isEn ? product.title_en : product.title_es) : ''
  const description = product ? (isEn ? product.description_en : product.description_es) : ''

  // Variante activa resuelta por la selección. Si el producto no tiene opciones
  // reales, usamos la defaultVariant (primera disponible).
  const activeVariant = useMemo(() => {
    if (!product) return null
    if (!product.hasOptions) {
      return product.variants?.find(v => v.id === product.defaultVariantId) || product.variants?.[0] || null
    }
    // Verificar que TODAS las opciones del producto tengan selección.
    const allSelected = product.options.every(o => selectedOptions[o.name])
    if (!allSelected) return null
    return findVariantBySelection(product, selectedOptions)
  }, [product, selectedOptions])

  // Precio de la variante activa, fallback al producto.
  const displayPrice = activeVariant?.price ?? product?.price ?? 0
  const displayPriceOriginal = activeVariant?.priceOriginal ?? product?.priceOriginal ?? null

  // Galería: slideshow de todas las imágenes del producto (dedupe de featured
  // + images + variant images, hecho en el adapter). Si el producto solo
  // tiene una imagen, ocultamos los controles del slideshow.
  const gallery = product?.images?.length ? product.images : (product?.image ? [{ url: product.image, alt: '' }] : [])
  const safeIndex = Math.min(imageIndex, Math.max(0, gallery.length - 1))
  const displayImage = gallery[safeIndex]?.url || ''
  const hasMultipleImages = gallery.length > 1

  // Unidades restantes. "Ilimitado" si: (a) no hay tracking, o (b) la variante
  // está availableForSale con quantity 0 → significa que Shopify tiene
  // "Continue selling when out of stock" activado, lo cual es efectivamente
  // unlimited desde el punto de vista del comprador.
  const variantUnits = activeVariant && typeof activeVariant.quantityAvailable === 'number'
    ? activeVariant.quantityAvailable
    : null
  const noTracking = variantUnits === null && product?.unitsRemaining >= 9999
  const continueSellingPastZero = variantUnits === 0 && activeVariant?.availableForSale
  const isUnlimited = noTracking || continueSellingPastZero
  const displayUnits = isUnlimited ? '∞' : (variantUnits !== null ? variantUnits : product?.unitsRemaining ?? 0)
  const maxQty = isUnlimited ? 99 : (variantUnits !== null ? variantUnits : 99)

  // SoldOut: la única fuente de verdad es Shopify. Si dice availableForSale
  // respetamos eso, no importa si quantityAvailable es 0 (caso típico cuando
  // el producto tiene "Continue selling when out of stock" activado).
  const isSoldOut = product && (
    activeVariant
      ? !activeVariant.availableForSale
      : !product.inStock
  )

  const tr = {
    inspectingLabel: isEn ? 'INSPECTING:' : 'INSPECCIONANDO:',
    lostItemTag: isEn ? '[LOST ITEM]' : '[OBJETO PERDIDO]',
    archiveIdLabel: isEn ? 'ARCHIVE ID' : 'ID DE ARCHIVO',
    recoveredLabel: isEn ? 'RECOVERED' : 'RECUPERADO',
    unitsRemainingLabel: isEn ? 'UNITS REMAINING' : 'UNIDADES RESTANTES',
    statusLabel: isEn ? 'STATUS' : 'ESTATUS',
    availableStatus: isEn ? 'AVAILABLE' : 'DISPONIBLE',
    archivedStatus: isEn ? 'SOLD OUT' : 'AGOTADO',
    qtyLabel: isEn ? 'QUANTITY' : 'CANTIDAD',
    addCta: isEn ? 'ADD TO CART' : 'AGREGAR AL CARRITO',
    archivedCta: isEn ? 'SOLD OUT' : 'AGOTADO',
    selectCta: isEn ? 'SELECT OPTIONS' : 'SELECCIONA OPCIONES',
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    closeAria: isEn ? 'Close' : 'Cerrar',
  }

  // Reset al abrir un producto distinto. NO depende de onClose — si lo
  // incluyéramos en deps, cada render del parent (identidad nueva de onClose)
  // re-ejecutaría este effect y pisaría la selección del usuario.
  useEffect(() => {
    if (!product) return
    const firstPick = product.variants?.find(v => v.availableForSale) || product.variants?.[0]
    setSelectedOptions(firstPick?.selectedOptions ? { ...firstPick.selectedOptions } : {})
    setQty(1)
    setImageIndex(0)
  }, [product])

  // Cuando el usuario cambia de variante y esa variante tiene imagen asignada
  // en Shopify, saltamos el slideshow a esa imagen. Si la variante no tiene
  // imagen propia, respetamos el index actual (el usuario puede seguir
  // navegando las fotos manualmente).
  useEffect(() => {
    if (!activeVariant?.image || !gallery.length) return
    const idx = gallery.findIndex(g => g.url === activeVariant.image)
    if (idx >= 0) setImageIndex(idx)
  }, [activeVariant?.image])

  // Autoplay del slideshow (3.2s por imagen). Se pausa ~6s cuando el usuario
  // interactúa (click en dots/arrows o cambio de variante) y luego resume.
  const [autoplayPausedUntil, setAutoplayPausedUntil] = useState(0)
  useEffect(() => {
    if (!product || gallery.length < 2) return
    const id = setInterval(() => {
      if (Date.now() < autoplayPausedUntil) return
      setImageIndex((i) => (i + 1) % gallery.length)
    }, 3200)
    return () => clearInterval(id)
  }, [product, gallery.length, autoplayPausedUntil])

  const pauseAutoplay = () => setAutoplayPausedUntil(Date.now() + 6000)

  // Si el usuario tenía qty=5 y cambia a un color con solo 2 disponibles,
  // bajamos la qty al stock de ese color.
  useEffect(() => {
    if (variantUnits !== null && qty > variantUnits) {
      setQty(Math.max(1, variantUnits))
    }
  }, [variantUnits])

  // Listener de Escape — separado para que cambios en onClose no reseteen state.
  useEffect(() => {
    if (!product) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  if (!product) return null

  const selectOption = (optionName, value) => {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }))
  }

  // Para cada valor de una opción, ¿resulta en una variante available si se
  // combina con las demás selecciones actuales? Si no, lo marcamos disabled.
  const isValueAvailable = (optionName, value) => {
    const tentative = { ...selectedOptions, [optionName]: value }
    const match = findVariantBySelection(product, tentative)
    // Si no hay match con selección completa, comprobar si ALGUNA variante
    // disponible tiene este value para esta opción (útil cuando faltan otras
    // selecciones).
    if (match) return match.availableForSale
    return product.variants.some(v => v.selectedOptions?.[optionName] === value && v.availableForSale)
  }

  const handleAdd = () => {
    if (isSoldOut) return
    if (product.hasOptions && !activeVariant) return
    const variantId = activeVariant?.id || product.defaultVariantId
    onAdd?.(product, qty, selectedOptions, variantId)
    onClose?.()
  }

  const addDisabled = isSoldOut || (product.hasOptions && !activeVariant)
  const ctaLabel = isSoldOut ? tr.archivedCta : (product.hasOptions && !activeVariant ? tr.selectCta : tr.addCta)

  return (
    <div
      className="fixed inset-0 z-[52] flex items-center justify-center p-4 sm:p-8 shop-inspect-enter"
      style={{ fontFamily: '"Cascadia Code", monospace' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-black border-2 border-[#e600ff] rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b-2 border-[#e600ff] bg-black">
          <div className="flex items-center gap-3 text-xs text-[#e600ff] uppercase tracking-widest">
            <span className="opacity-60">&gt;</span>
            <span className="font-bold">{tr.inspectingLabel}</span>
            <span className="text-white">{product.archiveId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 grid place-items-center border border-[#e600ff]/60 rounded-full text-[#e600ff] hover:bg-[#e600ff] hover:text-black transition-colors"
            aria-label={tr.closeAria}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="relative min-h-[320px] lg:min-h-0 bg-gradient-to-br from-[#0a0f1a] to-black border-b-2 lg:border-b-0 lg:border-r-2 border-[#e600ff]/30 overflow-hidden">
            <div className="absolute inset-0 shop-halftone opacity-30 pointer-events-none z-[2]" />
            <div className="absolute inset-0 shop-scanlines pointer-events-none z-[2] opacity-40" />
            <span className="absolute top-3 left-3 z-[3] text-xs text-[#e600ff]/80">{tr.lostItemTag}</span>
            <span className="absolute top-3 right-3 z-[3] text-xs text-[#e600ff]/80 shop-blink">●REC</span>
            <img
              src={displayImage}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover z-[1] transition-opacity duration-300"
              draggable={false}
              key={displayImage}
            />

            {/* Slideshow controls — solo visibles si hay > 1 imagen */}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    pauseAutoplay()
                    setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)
                  }}
                  aria-label={isEn ? 'Previous image' : 'Imagen anterior'}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-[6] w-9 h-9 sm:w-10 sm:h-10 grid place-items-center rounded-full border-2 border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-all"
                >
                  <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pauseAutoplay()
                    setImageIndex((i) => (i + 1) % gallery.length)
                  }}
                  aria-label={isEn ? 'Next image' : 'Imagen siguiente'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-[6] w-9 h-9 sm:w-10 sm:h-10 grid place-items-center rounded-full border-2 border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-all"
                >
                  <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        pauseAutoplay()
                        setImageIndex(i)
                      }}
                      aria-label={`${isEn ? 'Image' : 'Imagen'} ${i + 1}`}
                      className={`transition-all ${i === safeIndex
                        ? 'w-4 h-2 bg-[#e600ff] rounded-full'
                        : 'w-2 h-2 bg-white/40 hover:bg-white/70 rounded-full'
                        }`}
                    />
                  ))}
                </div>

                {/* Contador top-right */}
                <span className="absolute top-3 right-14 z-[6] text-[10px] text-white/70 font-mono px-2 py-0.5 rounded-full bg-black/60">
                  {safeIndex + 1}/{gallery.length}
                </span>
              </>
            )}

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

          <div className="p-6 sm:p-8 flex flex-col gap-5">
            <div>
              <div className="text-xs text-[#e600ff] uppercase tracking-widest mb-2 font-bold">
                [{(product.categoryLabel || product.category).toUpperCase()}]
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{title}</h2>
            </div>

            <div className="border border-[#e600ff]/30 rounded-xl overflow-hidden divide-y divide-[#e600ff]/15 text-xs sm:text-sm">
              <SpecRow k={tr.archiveIdLabel} v={product.archiveId} />
              <SpecRow k={tr.recoveredLabel} v={product.recoveredDate} />
              <SpecRow
                k={tr.unitsRemainingLabel}
                v={<span className={(!isUnlimited && typeof displayUnits === 'number' && displayUnits < 20) ? 'text-red-400 shop-blink' : 'text-white'}>{displayUnits}</span>}
              />
              <SpecRow
                k={tr.statusLabel}
                v={isSoldOut
                  ? <span className="text-red-400">● {tr.archivedStatus}</span>
                  : <span className="text-green-400">● {tr.availableStatus}</span>}
              />
            </div>

            <p className="text-white/70 text-sm leading-relaxed">{description}</p>

            {/* Option selectors — uno por opción real del producto (Size, Color, etc.) */}
            {product.options?.map((option) => (
              <div key={option.name}>
                <div className="text-xs text-[#e600ff]/70 uppercase tracking-widest mb-2">
                  {option.name}
                  {selectedOptions[option.name] && (
                    <span className="ml-2 text-white/60 normal-case tracking-normal">
                      · {selectedOptions[option.name]}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = selectedOptions[option.name] === value
                    const available = isValueAvailable(option.name, value)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectOption(option.name, value)}
                        disabled={!available}
                        className={`min-w-[48px] px-3 py-2 text-sm font-bold border-2 rounded-full transition-all ${isSelected
                          ? 'bg-[#e600ff] text-black border-[#e600ff]'
                          : available
                            ? 'bg-transparent text-[#e600ff] border-[#e600ff]/40 hover:border-[#e600ff]'
                            : 'bg-transparent text-white/20 border-white/10 line-through cursor-not-allowed'
                          }`}
                      >{value}</button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Qty picker + ADD TO CART en una sola fila para liberar espacio
                al precio (que queda solo debajo, grande y sin wrap). */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-xs text-[#e600ff]/70 uppercase tracking-widest mb-2">
                  {tr.qtyLabel}
                </div>
                <div className="inline-flex items-center border-2 border-[#e600ff]/60 rounded-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-10 h-10 grid place-items-center text-[#e600ff] hover:bg-[#e600ff]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-white font-bold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    className="w-10 h-10 grid place-items-center text-[#e600ff] hover:bg-[#e600ff]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={addDisabled}
                onClick={handleAdd}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 sm:px-6 h-11 text-sm font-bold uppercase tracking-widest border-2 rounded-full bg-[#e600ff] text-black border-[#e600ff] hover:shadow-[0_0_24px_rgba(230,0,255,0.7)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all whitespace-nowrap"
              >
                <span>&gt;_</span>
                <span className="truncate">{ctaLabel}</span>
              </button>
            </div>

            <div className="pt-3 border-t border-[#e600ff]/20 mt-auto">
              <div className="flex items-baseline gap-3 flex-wrap">
                {displayPriceOriginal && (
                  <span className="text-white/40 text-lg line-through decoration-[#e600ff] decoration-2">
                    {formatPrice(displayPriceOriginal)}
                  </span>
                )}
                <span className="text-4xl sm:text-5xl font-black text-[#e600ff] leading-none whitespace-nowrap" style={{ textShadow: '0 0 16px rgba(230, 0, 255, 0.6)' }}>
                  {formatPrice(displayPrice * qty)}
                </span>
              </div>
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
