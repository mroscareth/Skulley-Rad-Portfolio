import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, MinusIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, ShoppingCartIcon } from '@heroicons/react/24/solid'
import { findVariantBySelection, formatAmount } from '../../lib/shopProduct.js'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'
import ProductMeta from './ProductMeta.jsx'
import PriceTag from './PriceTag.jsx'

// Detalle de una pieza. Misma anatomía que la card (DESIGN.md §14.6), en
// grande: nombre y línea de detalle arriba, descripción, opciones y ficha en
// medio, y abajo el precio a la izquierda con la acción a la derecha.
//
// Soporta variantes multi-opción (Color + Size, etc.): un grupo de chips por
// opción, y la variante exacta resuelve precio, stock e imagen.
//
// Lenguaje visual: SHOP v2 (§14). Sin monoespaciado, sin glows y sin
// eyebrows (§0.7).
export default function ProductInspectModal({ product, lang = 'en', onClose, onAdd }) {
  const [selectedOptions, setSelectedOptions] = useState({})
  const [qty, setQty] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
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

  // Si hay golden ticket activo, aplica el descuento sobre el precio unitario.
  const {
    finalPrice: unitFinalPrice,
    originalPrice: unitOriginalPrice,
    hasDiscount: ticketActive,
    pct: ticketPct,
  } = usePriceWithDiscount(displayPrice, displayPriceOriginal)

  // Galería: todas las imágenes del producto (dedupe de featured + images +
  // variant images, hecho en el adapter).
  const gallery = product?.images?.length ? product.images : (product?.image ? [{ url: product.image, alt: '' }] : [])
  const safeIndex = Math.min(imageIndex, Math.max(0, gallery.length - 1))
  const displayImage = gallery[safeIndex]?.url || ''
  const hasMultipleImages = gallery.length > 1

  // Unidades disponibles (stock − lo apartado por checkouts abiertos). null en
  // la variante = sin límite (digitales, impresión bajo demanda).
  const variantUnits = activeVariant && typeof activeVariant.quantityAvailable === 'number'
    ? activeVariant.quantityAvailable
    : null
  const maxQty = variantUnits !== null ? variantUnits : 99

  // Sin precio en la moneda de la región la variante tampoco está a la venta:
  // el adapter lo resuelve en availableForSale.
  const isSoldOut = product && (
    activeVariant
      ? !activeVariant.availableForSale
      : !product.inStock
  )

  const tr = {
    detailsTitle: isEn ? 'Details' : 'Ficha',
    editionLabel: isEn ? 'Edition' : 'Edición',
    unique: isEn ? 'One of one · 1/1' : 'Pieza única · 1/1',
    editionOf: (n) => (isEn ? `Edition of ${n}` : `Tiraje de ${n}`),
    open: isEn ? 'Open edition' : 'Edición abierta',
    formatLabel: isEn ? 'Format' : 'Formato',
    digitalFormat: isEn ? 'Digital download' : 'Descarga digital',
    physicalFormat: isEn ? 'Physical, shipped to you' : 'Física, con envío',
    unitsLabel: isEn ? 'Available' : 'Disponibles',
    archiveIdLabel: isEn ? 'Archive ID' : 'ID de archivo',
    qtyLabel: isEn ? 'Quantity' : 'Cantidad',
    each: (n, unit) => (isEn ? `${n} × ${unit} each` : `${n} × ${unit} c/u`),
    addCta: isEn ? 'Add to cart' : 'Agregar al carrito',
    soldOutCta: isEn ? 'Sold out' : 'Agotado',
    pickCta: (name) => (isEn ? `Choose ${name.toLowerCase()}` : `Elige ${name.toLowerCase()}`),
    soldOut: isEn ? 'SOLD OUT' : 'AGOTADO',
    closeAria: isEn ? 'Close' : 'Cerrar',
    imageAria: (i) => (isEn ? `Image ${i}` : `Imagen ${i}`),
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
  // en el CMS, saltamos a esa imagen. Si no tiene imagen propia, respetamos la
  // que el usuario está viendo.
  //
  // Sin autoplay: aquí se viene a VER la pieza, y una galería que cambia sola
  // cambia lo que estás mirando sin que lo pidas (heurística 03; ver también
  // DESIGN.md §14.9 sobre el autoplay).
  useEffect(() => {
    if (!activeVariant?.image || !gallery.length) return
    const idx = gallery.findIndex(g => g.url === activeVariant.image)
    if (idx >= 0) setImageIndex(idx)
  }, [activeVariant?.image])

  // Si el usuario tenía qty=5 y cambia a un color con solo 2 disponibles,
  // bajamos la qty al stock de ese color.
  useEffect(() => {
    if (variantUnits !== null && qty > variantUnits) {
      setQty(Math.max(1, variantUnits))
    }
  }, [variantUnits])

  // Escape — separado para que cambios en onClose no reseteen state. En
  // captura y con preventDefault: App también escucha Escape en window para
  // salir de la sección, y sin esto un Escape cerraba la ficha Y la tienda.
  // Las flechas pasan de foto, como en cualquier visor.
  useEffect(() => {
    if (!product) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (gallery.length < 2) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') setImageIndex((i) => (i + 1) % gallery.length)
      if (e.key === 'ArrowLeft') setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [product, onClose, gallery.length])

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

  // El botón dice lo que falta o lo que va a pasar: qué opción elegir,
  // agotado, o agregar. El total ya lo dice el precio de al lado.
  const missingOption = product.hasOptions
    ? product.options.find(o => !selectedOptions[o.name])
    : null
  const addDisabled = isSoldOut || (product.hasOptions && !activeVariant)
  const ctaLabel = isSoldOut
    ? tr.soldOutCta
    : missingOption
      ? tr.pickCta(missingOption.name)
      : tr.addCta
  const unitStruck = ticketActive ? unitOriginalPrice : displayPriceOriginal

  const editionValue = product.edition === 'unique'
    ? tr.unique
    : product.edition === 'limited' && product.editionSize
      ? tr.editionOf(product.editionSize)
      : tr.open
  // Disponibles solo cuando hay un número que decir: en una 1/1 la edición
  // ya lo dice, y "sin límite" no informa nada.
  const units = variantUnits !== null ? variantUnits : (product.unitsRemaining < 9999 ? product.unitsRemaining : null)
  const showUnits = !isSoldOut && product.edition !== 'unique' && units !== null

  // Portal a document.body: el modal se renderiza desde Shop.jsx, que vive
  // dentro del section-scroll de App.jsx (ese contenedor tiene opacity y
  // z-10, lo que crea un stacking context — todo adentro queda topado a z-10
  // globalmente, por más zIndex: 999999 que le pongas al modal). Al portalear
  // a document.body escapamos el stacking context y el zIndex inline sí
  // compite contra el UI global (portrait, music btn, hamburger).
  return createPortal(
    <div
      className="fixed inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8 shop-inspect-enter"
      // Tiene que cubrir el retrato (999990) y el grupo flotante de música y
      // menú de mobile (999998): con la barra de compra pegada abajo, ese
      // grupo tapaba el botón. Mismo valor que el grupo; gana porque el
      // portal se monta al final del body. El cursor global (999999) sigue
      // encima.
      style={{ zIndex: 999998 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Alpha <= /70 + blur fuerte: DESIGN.md §6.1 regla 2. */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      <div className="shop-detail relative w-full h-full sm:h-auto sm:max-w-6xl sm:max-h-[92vh] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
          aria-label={tr.closeAria}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
          {/* Foto. En desktop se queda fija mientras la columna de la derecha
              scrollea, así la pieza no se pierde de vista al elegir. */}
          <div className="shop-detail__media relative bg-[#150a1d] flex flex-col">
            <div className="relative h-[46vh] sm:h-[52vh] lg:h-auto lg:flex-1 lg:min-h-0 overflow-hidden">
              {/* `object-contain`: aquí se viene a ver la pieza ENTERA antes
                  de comprarla. Recortar es esconder lo que se vende (§14.7). */}
              <img
                src={displayImage}
                alt={gallery[safeIndex]?.alt || title}
                className="absolute inset-0 w-full h-full object-contain p-4 sm:p-6 lg:p-8 z-[1]"
                draggable={false}
                key={displayImage}
              />

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={() => setImageIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                    aria-label={isEn ? 'Previous image' : 'Imagen anterior'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-[6] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageIndex((i) => (i + 1) % gallery.length)}
                    aria-label={isEn ? 'Next image' : 'Imagen siguiente'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-[6] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
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

            {/* Miniaturas en vez de puntos: se ve qué hay antes de pasar
                (heurística 06). */}
            {hasMultipleImages && (
              <div className="flex gap-2 px-4 sm:px-6 pb-4 sm:pb-6 overflow-x-auto no-native-scrollbar" role="tablist" aria-label={isEn ? 'Images' : 'Imágenes'}>
                {gallery.map((img, i) => (
                  <button
                    key={img.url || i}
                    type="button"
                    role="tab"
                    aria-selected={i === safeIndex}
                    aria-label={tr.imageAria(i + 1)}
                    onClick={() => setImageIndex(i)}
                    className="shop-thumb"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-contain" draggable={false} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="p-5 sm:p-8 lg:p-10 flex flex-col gap-6">
              <div className="pr-12">
                <h2 className="shop-detail__title">{title}</h2>
                <ProductMeta product={product} lang={lang} className="shop-meta--lg mt-2" />
              </div>

              {description && (
                <p className="text-white/75 text-base leading-relaxed whitespace-pre-line">{description}</p>
              )}

              {/* Un grupo por opción real (Size, Color…). El label dice lo que
                  está elegido: no hay que deducirlo del chip relleno (H06). */}
              {product.options?.map((option) => (
                <fieldset key={option.name}>
                  <legend className="text-sm text-white/60 mb-3">
                    {option.name}
                    {selectedOptions[option.name] && (
                      <>: <span className="text-white font-bold">{selectedOptions[option.name]}</span></>
                    )}
                  </legend>
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
                </fieldset>
              ))}

              {/* Cantidad junto a las opciones: es otra elección de la compra,
                  y así la barra de abajo queda como la de la card. */}
              {!isSoldOut && (
                <fieldset>
                  <legend className="text-sm text-white/60 mb-3">{tr.qtyLabel}</legend>
                  <div className="inline-flex items-center border-2 border-white/15 rounded-full">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      className="w-11 h-11 grid place-items-center text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                      aria-label={isEn ? 'Decrease quantity' : 'Reducir cantidad'}
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-white font-bold text-base tabular-nums" aria-live="polite">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                      disabled={qty >= maxQty}
                      className="w-11 h-11 grid place-items-center text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                      aria-label={isEn ? 'Increase quantity' : 'Aumentar cantidad'}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </fieldset>
              )}

              {/* La ficha informa, no decide: va después de lo que sí decide.
                  Sin "Recuperado" ni "Estatus" — la fecha de alta no ayuda a
                  comprar y el estado ya lo dicen el botón y la cinta. */}
              <section aria-labelledby="shop-detail-specs">
                <h3 id="shop-detail-specs" className="text-sm font-bold text-white mb-1">{tr.detailsTitle}</h3>
                <dl>
                  <SpecRow k={tr.editionLabel} v={editionValue} />
                  <SpecRow k={tr.formatLabel} v={product.digital ? tr.digitalFormat : tr.physicalFormat} />
                  {showUnits && (
                    <SpecRow
                      k={tr.unitsLabel}
                      v={<span className={units < 20 ? 'text-red-400' : ''}>{units}</span>}
                    />
                  )}
                  <SpecRow k={tr.archiveIdLabel} v={product.archiveId} />
                </dl>
              </section>
            </div>

            {/* Precio a la izquierda y la acción a la derecha, como en la
                card. Pegada abajo: en mobile sigue a mano mientras se lee. El
                precio es el total de lo que se va a agregar; con varias
                unidades, abajo dice cuánto cuesta cada una. */}
            <div className="sticky bottom-0 mt-auto bg-[#0d0714] border-t-2 border-white/10 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
              <PriceTag
                size="lg"
                amount={unitFinalPrice * qty}
                struck={unitStruck ? unitStruck * qty : null}
                pct={ticketActive ? ticketPct : 0}
                note={qty > 1 ? tr.each(qty, formatAmount(unitFinalPrice)) : null}
              />
              <button
                type="button"
                disabled={addDisabled}
                onClick={handleAdd}
                className="shop-btn shop-btn--primary shrink-0 min-h-[52px] px-6 text-sm"
              >
                {!addDisabled && <ShoppingCartIcon className="w-5 h-5 shrink-0" aria-hidden />}
                <span>{ctaLabel}</span>
              </button>
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
      <dt className="text-sm text-white/55">{k}</dt>
      <dd className="text-white font-semibold text-sm sm:text-base text-right">{v}</dd>
    </div>
  )
}
