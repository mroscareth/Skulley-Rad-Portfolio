import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShoppingCartIcon, XMarkIcon, MinusIcon, PlusIcon, TicketIcon, PaintBrushIcon } from '@heroicons/react/24/solid'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useActiveDiscount, GOLDEN_TICKET_DISCOUNT, setGoldenTicketSaved } from '../../lib/useActiveDiscount.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { useAuth } from '../../auth/authContext.js'

// Solo color de texto/borde: el `glow` inset se eliminó al migrar a SHOP v2
// (DESIGN.md §14.2 — cero box-shadow en la Store).
const RARITY_CHIP = {
  common:    { text: '#cbd5e1' },
  rare:      { text: '#60a5fa' },
  legendary: { text: '#facc15' },
}

// "Bolsa de evidencia" GLOBAL — se monta en App.jsx y sigue al portrait
// siempre, en todas las secciones (no solo /store). Usa el context del
// carrito para compartir estado con la tienda.
//
// Icon-button (DESIGN.md §4.2 + §9 heroicons/24/solid) posicionado
// OVERLAPPING la esquina superior-derecha del inner character del portrait.
//
// Sidebar sale por createPortal a document.body para que el
// translateX(-28rem) aplicado a #root (empuje del canvas) no lo arrastre.
export default function ShopCart({
  customizeOpen = false,
  customizeOnHome = false,
  onCustomizeToggle,
  goldenTicketAvailable = false,
}) {
  const { lang } = useLanguage()
  const { getAccessToken } = useAuth()
  const cart = useShopCartCtx()
  const { active: activeDiscountRaw, apply: applyDiscount, clear: clearDiscount } = useActiveDiscount()
  const { formatPrice, regions, region, setRegion, checkoutEnabled, goldenTicketPct, refresh } = useShopData()
  // El ticket solo cuenta si la cuenta lo tiene vivo: un chip que quedó en
  // localStorage de una sesión anterior no debe prometer un descuento que el
  // backend no va a aplicar.
  const activeDiscount = goldenTicketAvailable ? activeDiscountRaw : null
  const [open, setOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const [buttonPos, setButtonPos] = useState(null)
  const [visible, setVisible] = useState(false)
  // Opacity clonada del portrait — el cart es parte de él y sigue sus fades/animaciones
  const [portraitOpacity, setPortraitOpacity] = useState(0)
  const btnRafRef = useRef(null)
  const onOpen = () => setOpen(true)
  const onClose = () => setOpen(false)

  // Medir el INNER character div (w-[12rem] h-[18rem] o compact equivalent).
  // Tiene clase `rounded-full` → con aspecto 2:3 es una PÍLDORA: dos semicírculos
  // radio = width/2 + tramo recto vertical en el medio.
  //
  // Columna de 3 botones (pincel/bolt/cámara) sobre el BORDE RECTO DERECHO
  // de la píldora (x = r.left + W, borde recto de y=W/2 a y=r.height-W/2).
  // Este pincel es el PRIMERO (más arriba) de la columna: centro fijo en
  // x = r.left + W, y = r.top + W*(5.75/12) — el bolt (CharacterPortrait.jsx)
  // va centrado en y=9rem y la cámara (App.jsx) en y=12.25rem, mismo x.
  useEffect(() => {
    const BTN = 48 // w-12 h-12 — hit-target DESIGN.md §4.3 size lg
    const tick = () => {
      try {
        const outer = document.querySelector('[data-portrait-root]')
        const inner = outer?.querySelector(':scope > div')
        if (outer && inner) {
          const r = inner.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            const centerX = r.left + r.width
            const centerY = r.top + r.width * 0.4792 // y=5.75rem: primera posición de la columna del borde derecho
            const next = {
              top: Math.round(centerY - BTN / 2),
              left: Math.round(centerX - BTN / 2),
            }
            setButtonPos((prev) => (
              prev && prev.top === next.top && prev.left === next.left ? prev : next
            ))
            // Clonamos la opacity computada del portrait: si está fading/hidden,
            // el cart lo acompaña. Así cuando showMusic oculta el retrato, o
            // uiAnimPhase === 'hidden', el cart desaparece con él.
            const op = parseFloat(window.getComputedStyle(outer).opacity)
            setPortraitOpacity(Number.isFinite(op) ? op : 1)
            setVisible(true)
          } else {
            setVisible(false)
          }
        } else {
          setVisible(false)
        }
      } catch { }
      btnRafRef.current = requestAnimationFrame(tick)
    }
    btnRafRef.current = requestAnimationFrame(tick)
    return () => { if (btnRafRef.current) cancelAnimationFrame(btnRafRef.current) }
  }, [])

  // Agregar/quitar clase al body cuando el panel abre.
  // index.css usa body.shop-cart-open > #root { transform: translateX(-28rem) }
  useEffect(() => {
    if (open) {
      document.body.classList.add('shop-cart-open')
    } else {
      document.body.classList.remove('shop-cart-open')
    }
    return () => document.body.classList.remove('shop-cart-open')
  }, [open])

  // Escuchar el evento del GoldenTicketBadge para abrirse al click.
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('shop-cart-open-request', handler)
    return () => window.removeEventListener('shop-cart-open-request', handler)
  }, [])

  const isEn = lang === 'en'
  const tr = {
    openAria: isEn ? 'Open cart' : 'Abrir carrito',
    closeAria: isEn ? 'Close' : 'Cerrar',
    title: isEn ? 'CART' : 'CARRITO',
    removeDiscount: isEn ? 'Save it for later' : 'Guardarlo para después',
    discountApplied: isEn ? 'APPLIED TO THIS ORDER' : 'APLICADO A ESTA COMPRA',
    useTicket: isEn ? `Use my golden ticket (−${goldenTicketPct}%)` : `Usar mi golden ticket (−${goldenTicketPct}%)`,
    discountTotal: isEn ? 'TOTAL' : 'TOTAL',
    discountSaved: isEn ? 'You save' : 'Ahorras',
    checkoutFailed: isEn ? 'Checkout failed. Try again.' : 'Falló el pago. Intenta de nuevo.',
    checkoutPaused: isEn ? 'Payments are paused right now.' : 'Los pagos están en pausa en este momento.',
    itemsGone: isEn
      ? 'Some pieces were just taken. Your cart was updated.'
      : 'Alguien se llevó algunas piezas hace un momento. Tu carrito se actualizó.',
    redirecting: isEn ? 'Opening secure checkout…' : 'Abriendo pago seguro…',
    emptyTitle: isEn ? 'Your cart is empty' : 'Tu carrito está vacío',
    emptyBody: isEn
      ? 'Browse the shop to add items.'
      : 'Explora la tienda para añadir productos.',
    removeAria: isEn ? 'Remove item' : 'Quitar producto',
    soldOut: isEn ? 'Sold out' : 'Agotado',
    shipTo: isEn ? 'Ship to' : 'Enviar a',
    payIn: isEn ? 'Pay in' : 'Pagas en',
    hidden: (n) => (isEn
      ? `${n} item${n === 1 ? '' : 's'} in your cart can't be bought in this region.`
      : `${n} producto${n === 1 ? '' : 's'} de tu carrito no se vende${n === 1 ? '' : 'n'} en esta región.`),
    digitalOnly: isEn ? 'Instant download after payment.' : 'Descarga inmediata después del pago.',
    subtotal: isEn ? 'SUBTOTAL' : 'SUBTOTAL',
    proceed: isEn ? 'CHECKOUT' : 'PAGAR',
    paused: isEn ? 'CHECKOUT PAUSED' : 'PAGOS EN PAUSA',
    finalSales: isEn
      ? 'ALL SALES FINAL · NO AFTERLIFE REFUNDS'
      : 'VENTAS FINALES · SIN DEVOLUCIÓN EN EL MÁS ALLÁ',
  }

  // Nota de envío: lo más barato de la zona + desde cuánto es gratis. El
  // envío exacto se elige en la página de pago.
  const shippingNote = (() => {
    if (!region) return null
    if (!cart.hasPhysical) return tr.digitalOnly
    const amounts = (region.rates || []).map(r => Number(r.amount)).filter(n => Number.isFinite(n))
    if (!amounts.length) return null
    const from = formatPrice(Math.min(...amounts), region.currency)
    const free = region.free_over ? formatPrice(region.free_over, region.currency) : null
    if (isEn) return `Shipping from ${from}${free ? ` · free over ${free}` : ''}. You pick it at checkout.`
    return `Envío desde ${from}${free ? ` · gratis desde ${free}` : ''}. Lo eliges al pagar.`
  })()

  const saveTicketForLater = () => {
    setGoldenTicketSaved(true)
    clearDiscount()
  }
  const applyTicketNow = () => {
    setGoldenTicketSaved(false)
    applyDiscount({ ...GOLDEN_TICKET_DISCOUNT, pct: goldenTicketPct })
  }

  const handleCheckout = async () => {
    if (cart.totalItems === 0 || !checkoutEnabled) return
    setCheckingOut(true)
    setCheckoutError(null)
    try {
      // Precios, stock, envío y golden ticket se resuelven en el servidor; el
      // carrito NO se vacía aquí: si el comprador cancela en Stripe, regresa
      // con todo intacto. Se vacía al volver con el pago confirmado.
      const authToken = await getAccessToken()
      const url = await cart.checkout({ lang, authToken, useGoldenTicket: !!activeDiscount })
      window.location.href = url
    } catch (err) {
      console.error('[ShopCart] checkout failed:', err)
      if (err?.code === 'items_unavailable') {
        // Alguien más pagó primero (o se agotó mientras tanto): ajustamos el
        // carrito a lo que queda en vez de dejar al comprador adivinando.
        for (const p of err.payload?.items || []) {
          const it = cart.items.find(i => i.variantId === p.variant_id)
          if (!it) continue
          if (p.available > 0) cart.setQty(it.productId, it.variantId, p.available)
          else cart.remove(it.productId, it.variantId)
        }
        refresh()
        setCheckoutError(tr.itemsGone)
      } else if (err?.code === 'checkout_unavailable') {
        setCheckoutError(tr.checkoutPaused)
      } else {
        setCheckoutError(tr.checkoutFailed)
      }
      setCheckingOut(false)
    }
  }

  // Sidebar renderizado por portal a document.body (fuera de #root),
  // para que la transformación del #root no lo arrastre.
  const sidebar = (
    <div
      className={`fixed inset-0 transition-all duration-400 ease-out ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ zIndex: 999996 }}
    >
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-400 ease-out ${open ? 'opacity-70' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute top-0 right-0 bottom-0 w-full max-w-md border-l-2 border-white/12 bg-[#0d0714] flex flex-col transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Título + close. Sin traffic-lights ni prompt `M.A.D.R.E.@mausoleum`:
            el carrito es superficie comercial, no UI diegética (DESIGN.md §14).
            Tampoco lleva contador al lado del título — sería un eyebrow (§0.7)
            y el badge del botón del carrito ya comunica la cantidad. */}
        <header className="flex items-center justify-between gap-4 px-5 sm:px-6 pt-6 pb-5 border-b border-white/10">
          <h3 className="shop-display shop-display--md">{tr.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex-shrink-0 grid place-items-center rounded-full border-2 border-white/25 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
            aria-label={tr.closeAria}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto modal-scroll px-5 sm:px-6 py-5">
          {cart.items.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <ShoppingCartIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-white/80 text-base font-semibold">{tr.emptyTitle}</p>
              <p className="text-sm mt-2 text-white/45">{tr.emptyBody}</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {cart.items.map((it) => {
                const p = it.product
                const v = it.variant
                const title = isEn ? p.title_en : p.title_es
                // Opciones de la variante en el idioma activo: "Talla: M · Color: Negro"
                const optsText = Object.entries(v?.selectedOptions || {})
                  .map(([k, val]) => `${k}: ${val}`)
                  .join(' · ')
                const itemImage = v?.image || p.image
                const unitPrice = v?.price ?? p.price
                const soldOut = !v?.availableForSale
                return (
                  <li key={it.variantId} className="py-4 flex gap-3">
                    <div className="w-20 h-20 flex-shrink-0 bg-[#150a1d] rounded-xl overflow-hidden relative">
                      {/* contain, igual que en card y modal: la miniatura del
                          carrito tiene que ser reconocible como la pieza que
                          viste, no un recorte distinto de ella. */}
                      <img src={itemImage} alt={title} className="absolute inset-0 w-full h-full object-contain p-1.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-white text-sm font-bold leading-snug">{title}</h4>
                        <button
                          type="button"
                          onClick={() => cart.remove(p.id, it.variantId)}
                          className="text-white/40 hover:text-red-400 transition-colors"
                          aria-label={tr.removeAria}
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-white/45 text-xs mt-1">
                        {p.archiveId}{optsText ? ` · ${optsText}` : ''}
                      </div>
                      {soldOut && (
                        <div className="text-red-400 text-xs font-bold mt-1">{tr.soldOut}</div>
                      )}
                      <div className="flex items-center justify-between gap-3 mt-2.5">
                        <div className="flex items-center rounded-full border-2 border-white/15 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => cart.setQty(p.id, it.variantId, it.qty - 1)}
                            className="w-8 h-8 grid place-items-center text-white hover:bg-white/10 transition-colors"
                            aria-label={isEn ? 'Decrease quantity' : 'Reducir cantidad'}
                          >
                            <MinusIcon className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-white text-sm font-bold">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => cart.setQty(p.id, it.variantId, Math.min(it.maxQty, it.qty + 1))}
                            disabled={it.qty >= it.maxQty}
                            className="w-8 h-8 grid place-items-center text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            aria-label={isEn ? 'Increase quantity' : 'Aumentar cantidad'}
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-white font-black">
                          {formatPrice(unitPrice * it.qty)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {(cart.items.length > 0 || cart.hiddenCount > 0) && (() => {
          const pct = activeDiscount?.pct || 0
          // Use integer math to avoid float drift on currencies like MXN.
          const savedCents = Math.round(cart.subtotal * 100 * (pct / 100))
          const subtotalCents = Math.round(cart.subtotal * 100)
          const finalCents = Math.max(0, subtotalCents - savedCents)
          const finalPrice = finalCents / 100
          const savedPrice = savedCents / 100
          const chipColors = RARITY_CHIP[activeDiscount?.rarity] || RARITY_CHIP.common
          const hasSoldOut = cart.items.some(it => !it.variant?.availableForSale)
          return (
          <footer className="border-t border-white/10 bg-[#0d0714] p-5 sm:p-6">
            {/* Región = destino del envío + moneda del cobro. Es lo primero
                del footer porque cambia todos los números de abajo. */}
            {regions.length > 1 && (
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="shop-kicker text-white/45">{tr.shipTo}</span>
                  {region && (
                    <span className="text-xs text-white/45">{tr.payIn} {region.currency}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={tr.shipTo}>
                  {regions.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      aria-pressed={region?.code === r.code}
                      onClick={() => { setRegion(r.code); setCheckoutError(null) }}
                      className="shop-chip px-3.5 py-2 text-[11px]"
                    >
                      {isEn ? r.name_en : r.name_es}
                    </button>
                  ))}
                </div>
                {shippingNote && (
                  <p className="text-xs text-white/45 mt-2.5 leading-relaxed">{shippingNote}</p>
                )}
              </div>
            )}

            {cart.hiddenCount > 0 && (
              <p className="text-xs text-amber-300/90 mb-4 leading-relaxed">{tr.hidden(cart.hiddenCount)}</p>
            )}

            {/* Active discount chip — el color por rareza se conserva; se fue
                el glow inset (§14.2: cero box-shadow en la Store). */}
            {cart.items.length > 0 && activeDiscount && (
              <div
                className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-xl border-2"
                style={{ borderColor: chipColors.text }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <TicketIcon className="w-4 h-4 flex-shrink-0" style={{ color: chipColors.text }} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: chipColors.text }}>
                      {activeDiscount.label} — {activeDiscount.pct}% off
                    </div>
                    <div className="text-xs text-white/45 truncate">
                      {tr.discountApplied}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveTicketForLater}
                  className="flex-shrink-0 w-7 h-7 grid place-items-center rounded-full text-white/40 hover:text-red-400 transition-colors"
                  aria-label={tr.removeDiscount}
                  title={tr.removeDiscount}
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            {cart.items.length > 0 && goldenTicketAvailable && !activeDiscount && (
              <button
                type="button"
                onClick={applyTicketNow}
                className="shop-btn shop-btn--ghost w-full min-h-[44px] px-4 mb-4 text-xs gap-2"
              >
                <TicketIcon className="w-4 h-4 text-[#facc15]" aria-hidden />
                <span className="truncate">{tr.useTicket}</span>
              </button>
            )}

            {activeDiscount ? (
              <>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-white/45">{tr.subtotal}</span>
                  <span className="text-white/45 line-through">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-4" style={{ color: chipColors.text }}>
                  <span>{tr.discountSaved}</span>
                  <span>− {formatPrice(savedPrice)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 mb-5">
                  <span className="shop-kicker text-white/45">{tr.discountTotal}</span>
                  <span className="shop-display shop-display--md">{formatPrice(finalPrice)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-baseline justify-between gap-3 mb-5">
                <span className="shop-kicker text-white/45">{tr.subtotal}</span>
                <span className="shop-display shop-display--md">
                  {formatPrice(cart.subtotal)}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={checkingOut || !checkoutEnabled || cart.items.length === 0 || hasSoldOut}
              onClick={handleCheckout}
              className="shop-btn shop-btn--primary w-full min-h-[52px] px-6 text-sm"
            >
              <span className="truncate">
                {checkingOut ? tr.redirecting : (checkoutEnabled ? tr.proceed : tr.paused)}
              </span>
            </button>
            {checkoutError && (
              <p className="text-xs text-red-400 text-center mt-3">
                {checkoutError}
              </p>
            )}
            <p className="text-[11px] text-white/35 text-center mt-4 uppercase tracking-widest">
              {tr.finalSales}
            </p>
          </footer>
          )
        })()}
      </aside>
    </div>
  )

  return (
    <>
      {/* Botón anclado a la esquina del retrato. SWAP: ahora es el de CUSTOMIZE
          (el carrito se movió al top-right-group en App.jsx). HOME only. Conserva
          el anclaje al portrait + sync de opacity. */}
      {visible && customizeOnHome && (
        <button
          type="button"
          onClick={() => { try { onCustomizeToggle?.() } catch { } }}
          aria-label={lang === 'es' ? 'Personalizar personaje' : 'Customize character'}
          title={lang === 'es' ? 'Personalizar personaje' : 'Customize character'}
          className={`fixed rounded-full w-12 h-12 grid place-items-center backdrop-blur-xl border transition-colors ${customizeOpen ? 'bg-sky-400/15 border-sky-400 text-white shadow-glow-terminal' : 'bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'}`}
          style={{
            top: `${buttonPos?.top ?? 16}px`,
            left: `${buttonPos?.left ?? 0}px`,
            zIndex: 999995,
            opacity: portraitOpacity,
            pointerEvents: portraitOpacity < 0.1 ? 'none' : 'auto',
            transition: 'opacity 200ms ease-out, background-color 120ms, border-color 120ms',
          }}
        >
          <PaintBrushIcon className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar via portal a document.body — fuera de #root para no recibir
          el translateX(-28rem) cuando cart-open. */}
      {typeof document !== 'undefined' && createPortal(sidebar, document.body)}
    </>
  )
}
