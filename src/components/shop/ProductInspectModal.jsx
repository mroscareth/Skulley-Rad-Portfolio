import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, MinusIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { useShopFormatter } from '../../lib/shopDataContext.jsx'
import { findVariantBySelection } from '../../lib/shopifyAdapter.js'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'

// Modal de inspección — overlay full-screen al click en "INSPECT".
// Soporta variantes multi-opción (Color + Size, etc.): se renderiza un grupo
// de botones por opción y resuelve la variante exacta para precio/imagen.
//
// Lenguaje visual: SHOP v2 (DESIGN.md §14). Sin monoespaciado, sin scanlines,
// sin glows y sin eyebrows (§0.7) — la categoría vive en la ficha, no como
// rótulo encima del título.
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

  // Si hay golden ticket activo, aplica el descuento sobre el price unitario.
  // El qty se multiplica después — así el tachado muestra el pre-ticket x qty.
  const {
    finalPrice: unitFinalPrice,
    originalPrice: unitOriginalPrice,
    hasDiscount: ticketActive,
  } = usePriceWithDiscount(displayPrice, displayPriceOriginal)

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
    classLabel: isEn ? 'Class' : 'Clase',
    archiveIdLabel: isEn ? 'Archive ID' : 'ID de archivo',
    recoveredLabel: isEn ? 'Recovered' : 'Recuperado',
    unitsRemainingLabel: isEn ? 'Units left' : 'Unidades',
    statusLabel: isEn ? 'Status' : 'Estatus',
    availableStatus: isEn ? 'Available' : 'Disponible',
    archivedStatus: isEn ? 'Sold out' : 'Agotado',
    qtyLabel: isEn ? 'Quantity' : 'Cantidad',
    addCta: isEn ? 'Add to cart' : 'Agregar al carrito',
    archivedCta: isEn ? 'Sold out' : 'Agotado',
    selectCta: isEn ? 'Select options' : 'Selecciona opciones',
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

  // Lock scroll del body mientras el modal está abierto — en mobile fullscreen
  // el scroll del section container detrás se seguía moviendo y se sentía raro.
  useEffect(() => {
    if (!product) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [product])

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

  // Portal a document.body: el modal se renderiza desde Shop.jsx, que vive
  // dentro del section-scroll de App.jsx (ese contenedor tiene opacity y
  // z-10, lo que crea un stacking context — todo adentro queda topado a z-10
  // globalmente, por más zIndex: 999999 que le pongas al modal). Al portalear
  // a document.body escapamos el stacking context y el zIndex inline sí
  // compite contra el UI global (portrait, music btn, hamburger).
  return createPortal(
    <div
      className="fixed inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8 shop-inspect-enter"
      // zIndex alto: debe cubrir portrait (999990), music btn y hamburger (999993).
      // Usamos el mismo rango que ShopCart para consistencia.
      style={{ zIndex: 999996 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      {/* Alpha <= /70 + blur fuerte: DESIGN.md §6.1 regla 2 (con /85 el blur
          dejaba de notarse y el overlay se veía plano). */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      <div className="relative w-full h-full sm:h-auto sm:max-w-6xl sm:max-h-[92vh] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-2xl overflow-hidden">
        {/* Close flotante — sin header con rótulo "INSPECTING" (era un eyebrow) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
          aria-label={tr.closeAria}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto modal-scroll grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-0">
          <div className="relative h-[46vh] sm:h-[52vh] lg:h-auto lg:min-h-0 bg-[#150a1d] overflow-hidden">
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-[6] w-10 h-10 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pauseAutoplay()
                    setImageIndex((i) => (i + 1) % gallery.length)
                  }}
                  aria-label={isEn ? 'Next image' : 'Imagen siguiente'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-[6] w-10 h-10 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>

                {/* Dots indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-1.5">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        pauseAutoplay()
                        setImageIndex(i)
                      }}
                      aria-label={`${isEn ? 'Image' : 'Imagen'} ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${i === safeIndex
                        ? 'w-6 bg-white'
                        : 'w-2 bg-white/45 hover:bg-white/80'
                        }`}
                    />
                  ))}
                </div>
              </>
            )}

            {isSoldOut && (
              <>
                <div className="absolute inset-0 z-[4] bg-black/55 pointer-events-none" />
                <div className="shop-soldout-tape z-[5] pointer-events-none" role="img" aria-label={tr.soldOut}>
                  <div className="shop-soldout-tape-inner">
                    {/* Dos mitades idénticas (12 tiles c/u) — el modal es grande,
                        necesitamos mitad > viewport para que el -50% sea seamless. */}
                    {[0, 1].map((seq) => (
                      <React.Fragment key={seq}>
                        {Array.from({ length: 12 }).map((_, i) => (
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

          <div className="p-5 sm:p-8 lg:p-10 flex flex-col gap-5 sm:gap-6 pb-10">
            {/* El título entra directo, sin rótulo de categoría encima (§0.7);
                la categoría es una fila más de la ficha. */}
            <h2 className="shop-display shop-display--md pr-12">{title}</h2>

            <dl className="border-t border-white/10">
              <SpecRow k={tr.classLabel} v={product.categoryLabel || product.category} />
              <SpecRow k={tr.archiveIdLabel} v={product.archiveId} />
              <SpecRow k={tr.recoveredLabel} v={product.recoveredDate} />
              <SpecRow
                k={tr.unitsRemainingLabel}
                v={<span className={(!isUnlimited && typeof displayUnits === 'number' && displayUnits < 20) ? 'text-red-400' : 'text-white'}>{displayUnits}</span>}
              />
              <SpecRow
                k={tr.statusLabel}
                v={isSoldOut
                  ? <span className="text-red-400">{tr.archivedStatus}</span>
                  : <span className="text-green-400">{tr.availableStatus}</span>}
              />
            </dl>

            <p className="text-white/70 text-sm sm:text-base leading-relaxed">{description}</p>

            {/* Option selectors — uno por opción real del producto (Size, Color, etc.) */}
            {product.options?.map((option) => (
              <div key={option.name}>
                <div className="shop-kicker text-white/45 mb-3">
                  {option.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = selectedOptions[option.name] === value
                    const available = isValueAvailable(option.name, value)
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => selectOption(option.name, value)}
                        disabled={!available}
                        className={`shop-chip min-w-[52px] min-h-[44px] px-4 py-2 text-xs ${available ? '' : 'line-through opacity-30 cursor-not-allowed'}`}
                      >{value}</button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Qty picker + ADD TO CART: en mobile se apilan (qty arriba,
                CTA full-width abajo) para no achicar el label del CTA; en
                desktop van en una fila. */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
              <div>
                <div className="shop-kicker text-white/45 mb-3">
                  {tr.qtyLabel}
                </div>
                <div className="inline-flex items-center border-2 border-white/15 rounded-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-12 h-12 grid place-items-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                    aria-label={isEn ? 'Decrease quantity' : 'Reducir cantidad'}
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-white font-bold text-base">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    className="w-12 h-12 grid place-items-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                    aria-label={isEn ? 'Increase quantity' : 'Aumentar cantidad'}
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={addDisabled}
                onClick={handleAdd}
                className="shop-btn shop-btn--primary w-full sm:flex-1 sm:min-w-0 min-h-[52px] px-6 text-sm whitespace-nowrap"
              >
                <span className="truncate">{ctaLabel}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-white/10 mt-auto">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="shop-display shop-display--md whitespace-nowrap">
                  {formatPrice(unitFinalPrice * qty)}
                </span>
                {(ticketActive || displayPriceOriginal) && (
                  <span className="text-white/40 text-base sm:text-lg line-through decoration-[#e600ff] decoration-2">
                    {formatPrice((ticketActive ? unitOriginalPrice : displayPriceOriginal) * qty)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function SpecRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
      <dt className="shop-kicker text-white/45">{k}</dt>
      <dd className="text-white font-semibold text-sm sm:text-base text-right">{v}</dd>
    </div>
  )
}
