import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShoppingCartIcon, XMarkIcon, MinusIcon, PlusIcon, TicketIcon, PaintBrushIcon, TrashIcon, LockClosedIcon, UserCircleIcon } from '@heroicons/react/24/solid'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useActiveDiscount, GOLDEN_TICKET_DISCOUNT, setGoldenTicketSaved } from '../../lib/useActiveDiscount.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { useAuth } from '../../auth/authContext.js'
import ProductMeta from './ProductMeta.jsx'
import PriceTag from './PriceTag.jsx'
import HelpLink from '../help/HelpLink.jsx'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

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
  // Nivel y % del ticket vivo de la cuenta (Silver 10 % o Golden 35 %).
  ticketTier = null,
  ticketPct = 0,
  // El sitio de teléfono no tiene retrato: sin esto el rAF de abajo lo
  // buscaría en el DOM cada frame para nada.
  anchorToPortrait = true,
}) {
  const { lang } = useLanguage()
  const { getAccessToken, authenticated } = useAuth()
  const cart = useShopCartCtx()
  const { active: activeDiscountRaw, apply: applyDiscount, clear: clearDiscount } = useActiveDiscount()
  const { formatPrice, regions, region, setRegion, checkoutEnabled, refresh } = useShopData()
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
    if (!anchorToPortrait) return undefined
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
  }, [anchorToPortrait])

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

  // Escape cierra, como en los modales (H03: salida clara). En document y con
  // preventDefault: el Escape de la sección (App.jsx, en window) respeta uno
  // ya usado, así cerrar el carrito no te saca de la tienda.
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Escuchar el evento del GoldenTicketBadge para abrirse al click.
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('shop-cart-open-request', handler)
    return () => window.removeEventListener('shop-cart-open-request', handler)
  }, [])

  const isEn = lang === 'en'
  const ticketName = ticketTier === 'silver' ? 'Silver Ticket' : 'Golden Ticket'
  const tr = {
    closeAria: isEn ? 'Close cart' : 'Cerrar carrito',
    title: isEn ? 'Cart' : 'Carrito',
    count: (n) => (isEn ? `${n} piece${n === 1 ? '' : 's'}` : `${n} pieza${n === 1 ? '' : 's'}`),
    ticketTitle: isEn ? `You have a ${ticketName}` : `Tienes un ${ticketName}`,
    ticketOffer: isEn ? `${ticketPct}% off this order` : `${ticketPct}% menos en esta compra`,
    ticketUse: isEn ? 'Use it' : 'Usarlo',
    ticketApplied: isEn ? `${ticketName} applied` : `${ticketName} aplicado`,
    ticketSaves: (amount) => (isEn ? `You save ${amount}` : `Ahorras ${amount}`),
    removeDiscount: isEn ? 'Save for later' : 'Guardar para después',
    checkoutFailed: isEn ? 'Checkout failed. Try again.' : 'Falló el pago. Intenta de nuevo.',
    checkoutPaused: isEn ? 'Payments are paused right now.' : 'Los pagos están en pausa en este momento.',
    itemsGone: isEn
      ? 'Some pieces were just taken. Your cart was updated.'
      : 'Alguien se llevó algunas piezas hace un momento. Tu carrito se actualizó.',
    soldOutBlock: isEn
      ? 'Remove the sold-out pieces to check out.'
      : 'Quita las piezas agotadas para poder pagar.',
    redirecting: isEn ? 'Opening checkout…' : 'Abriendo el pago…',
    emptyTitle: isEn ? 'Your cart is empty' : 'Tu carrito está vacío',
    emptyBody: isEn
      ? 'The pieces you add will show up here.'
      : 'Las piezas que agregues van a aparecer aquí.',
    emptyCta: isEn ? 'Go to the shop' : 'Ir a la tienda',
    removeAria: (title) => (isEn ? `Remove ${title} from the cart` : `Quitar ${title} del carrito`),
    soldOut: isEn ? 'Sold out' : 'Agotado',
    shipTo: isEn ? 'Ship to' : 'Envío a',
    hidden: (n) => (isEn
      ? `${n} item${n === 1 ? '' : 's'} in your cart can't be bought in this region.`
      : `${n} producto${n === 1 ? '' : 's'} de tu carrito no se vende${n === 1 ? '' : 'n'} en esta región.`),
    digitalOnly: isEn ? 'Download it from your account right after paying.' : 'Lo descargas desde tu cuenta en cuanto pagues.',
    subtotal: 'Subtotal',
    proceed: isEn ? 'Checkout' : 'Ir a pagar',
    paused: isEn ? 'Checkout paused' : 'Pagos en pausa',
    signIn: isEn ? 'Sign in to pay' : 'Inicia sesión para pagar',
    digitalNeedsAccount: isEn
      ? 'Digital files are downloaded from your account, so only you can get them. Sign in to pay.'
      : 'Los archivos digitales se descargan desde tu cuenta, así solo tú puedes bajarlos. Inicia sesión para pagar.',
  }

  // Una línea con lo que cambia la región: en qué moneda pagas y desde cuánto
  // sale el envío (y desde cuánto es gratis). El envío exacto se elige en la
  // página de pago.
  const shippingNote = (() => {
    if (!region) return null
    const pay = isEn ? `You pay in ${region.currency}.` : `Pagas en ${region.currency}.`
    if (!cart.hasPhysical) return `${pay} ${tr.digitalOnly}`
    const amounts = (region.rates || []).map(r => Number(r.amount)).filter(n => Number.isFinite(n))
    if (!amounts.length) return pay
    const from = formatPrice(Math.min(...amounts), region.currency)
    const free = region.free_over ? formatPrice(region.free_over, region.currency) : null
    if (isEn) return `${pay} Shipping from ${from}${free ? `, free over ${free}` : ''}; you pick it at checkout.`
    return `${pay} Envío desde ${from}${free ? `, gratis desde ${free}` : ''}; lo eliges al pagar.`
  })()

  const saveTicketForLater = () => {
    setGoldenTicketSaved(true)
    clearDiscount()
  }
  const applyTicketNow = () => {
    setGoldenTicketSaved(false)
    applyDiscount({
      ...GOLDEN_TICKET_DISCOUNT,
      pct: ticketPct,
      label: ticketTier === 'silver' ? 'Silver Ticket' : 'Golden Ticket',
      rarity: ticketTier === 'silver' ? 'rare' : 'legendary',
    })
  }

  // Con el carrito vacío la salida es ir a ver piezas. Si ya estás en la
  // tienda, basta con cerrar el panel.
  const goToShop = () => {
    setOpen(false)
    if (!window.location.pathname.startsWith('/lost-and-found-shop')) {
      window.dispatchEvent(new CustomEvent('navigate-section', { detail: { section: 'section3' } }))
    }
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
      } else if (err?.code === 'login_required') {
        // La sesión venció entre que abrió el carrito y pagó.
        setCheckoutError(tr.digitalNeedsAccount)
      } else {
        setCheckoutError(tr.checkoutFailed)
      }
      setCheckingOut(false)
    }
  }

  const hasItems = cart.items.length > 0
  const pct = activeDiscount?.pct || 0
  // Centavos enteros para no arrastrar decimales en monedas como MXN.
  const subtotalCents = Math.round(cart.subtotal * 100)
  const savedCents = Math.round(subtotalCents * (pct / 100))
  const finalPrice = Math.max(0, subtotalCents - savedCents) / 100
  const hasSoldOut = cart.items.some(it => !it.variant?.availableForSale)
  // Con algo digital y sin sesión, la acción es iniciar sesión (App.jsx
  // escucha `auth-login-request`); al volver, el carrito sigue igual.
  const needsLogin = cart.hasDigital && !authenticated
  const requestLogin = () => {
    try { window.dispatchEvent(new CustomEvent('auth-login-request')) } catch { }
  }
  // Si no se puede pagar, se dice por qué junto al botón (H09), no solo se
  // apaga.
  const blockedReason = checkoutError
    || (hasItems && hasSoldOut ? tr.soldOutBlock : null)
    || (hasItems && !checkoutEnabled ? tr.checkoutPaused : null)

  // Sidebar renderizado por portal a document.body (fuera de #root),
  // para que la transformación del #root no lo arrastre.
  //
  // Misma anatomía que el detalle de producto (DESIGN.md §14.6): nombre + una
  // línea de detalle arriba, las piezas sobre divisores y abajo la barra de
  // pago con el subtotal a la izquierda y la acción de color al final. Las
  // secciones del pie van separadas por divisor, sin cajas adentro del panel.
  const sidebar = (
    <div
      className={`fixed inset-0 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      // Encima del grupo flotante de música y menú de mobile (999998), que
      // tapaba "Ir a pagar". Mismo valor que el detalle de producto: gana por
      // montarse al final del body.
      style={{ zIndex: 999998 }}
      inert={!open}
    >
      {/* Velo de los modales (§6.1): /70 + blur. Se funde él solo; la opacity
          nunca va en un ancestro o el blur deja de ver la página. */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity duration-400 ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-cart-title"
        className={`absolute top-0 right-0 bottom-0 w-full max-w-md border-l-2 border-white/12 bg-[#0d0714] text-white flex flex-col transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-6 sm:pt-7 pb-5 border-b-2 border-white/10">
          <div className="min-w-0">
            <h2 id="shop-cart-title" className="shop-detail__title">{tr.title}</h2>
            {hasItems && <p className="shop-meta shop-meta--lg mt-1">{tr.count(cart.totalItems)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-11 h-11 shrink-0 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${FOCUS_RING}`}
            aria-label={tr.closeAria}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-7">
          {!hasItems ? (
            <div className="min-h-full flex flex-col items-center justify-center text-center py-16">
              <ShoppingCartIcon className="w-14 h-14 text-white/15" aria-hidden />
              <p className="mt-5 text-lg font-bold text-white">{tr.emptyTitle}</p>
              <p className="mt-1.5 text-[0.9375rem] text-white/60 leading-relaxed max-w-[28ch]">{tr.emptyBody}</p>
              <button
                type="button"
                onClick={goToShop}
                className={`shop-btn shop-btn--primary mt-7 min-h-[48px] px-6 text-xs ${FOCUS_RING}`}
              >
                {tr.emptyCta}
              </button>
            </div>
          ) : (
            <ul className="divide-y-2 divide-white/10">
              {cart.items.map((it) => {
                const p = it.product
                const v = it.variant
                const title = isEn ? p.title_en : p.title_es
                // La variante elegida es lo que distingue al renglón ("M · Negro");
                // sin opciones, la línea de detalle de la tienda (categoría ·
                // edición, o "Quedan 5" si apremia).
                const optsText = Object.values(v?.selectedOptions || {}).join(' · ')
                const itemImage = v?.image || p.image
                const unitPrice = v?.price ?? p.price
                const soldOut = !v?.availableForSale
                return (
                  <li key={it.variantId} className="py-5 flex gap-4">
                    {/* contain, igual que en card y modal: la miniatura tiene
                        que ser reconocible como la pieza que viste (§14.7). */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-[#150a1d] rounded-xl overflow-hidden relative">
                      <img src={itemImage} alt="" className="absolute inset-0 w-full h-full object-contain p-1.5" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 pt-0.5">
                          <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
                          {soldOut ? (
                            <p className="shop-meta mt-1 !text-red-400 font-bold">{tr.soldOut}</p>
                          ) : optsText ? (
                            <p className="shop-meta mt-1"><span className="truncate">{optsText}</span></p>
                          ) : (
                            <ProductMeta product={p} lang={lang} className="mt-1" />
                          )}
                        </div>
                        {/* Bote y no X: la X ya es "cerrar el carrito". */}
                        <button
                          type="button"
                          onClick={() => cart.remove(p.id, it.variantId)}
                          className={`-mt-1.5 -mr-2 w-10 h-10 shrink-0 grid place-items-center rounded-full text-white/45 hover:text-red-400 hover:bg-white/5 active:scale-90 transition-all ${FOCUS_RING}`}
                          aria-label={tr.removeAria(title)}
                          title={tr.removeAria(title)}
                        >
                          <TrashIcon className="w-[18px] h-[18px]" />
                        </button>
                      </div>
                      <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                        {soldOut ? <span /> : (
                          // El "−" se detiene en 1: quitar es el bote, no un
                          // clic de más en la cantidad (H05).
                          <div className="inline-flex items-center border-2 border-white/15 rounded-full">
                            <button
                              type="button"
                              onClick={() => cart.setQty(p.id, it.variantId, Math.max(1, it.qty - 1))}
                              disabled={it.qty <= 1}
                              className={`w-10 h-10 grid place-items-center text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent active:scale-90 ${FOCUS_RING}`}
                              aria-label={isEn ? 'Decrease quantity' : 'Reducir cantidad'}
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>
                            <span className="w-7 text-center text-white font-bold text-base tabular-nums" aria-live="polite">{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => cart.setQty(p.id, it.variantId, Math.min(it.maxQty, it.qty + 1))}
                              disabled={it.qty >= it.maxQty}
                              className={`w-10 h-10 grid place-items-center text-white hover:bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent active:scale-90 ${FOCUS_RING}`}
                              aria-label={isEn ? 'Increase quantity' : 'Aumentar cantidad'}
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <PriceTag size="sm" amount={unitPrice * it.qty} className="shrink-0" />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {(hasItems || cart.hiddenCount > 0) && (
          <footer className="shrink-0 border-t-2 border-white/10">
            {/* Región = destino del envío + moneda del cobro. Va primero
                porque cambia todos los números de abajo. */}
            <div className="px-5 sm:px-7 py-5">
              {regions.length > 1 && (
                <fieldset>
                  <legend className="text-sm text-white/60 mb-3">{tr.shipTo}</legend>
                  <div className="flex flex-wrap gap-2">
                    {regions.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        aria-pressed={region?.code === r.code}
                        onClick={() => { setRegion(r.code); setCheckoutError(null) }}
                        className={`shop-chip min-h-[40px] px-4 text-[11px] ${FOCUS_RING}`}
                      >
                        {isEn ? r.name_en : r.name_es}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {shippingNote && (
                <p className={`text-sm text-white/55 leading-relaxed ${regions.length > 1 ? 'mt-3' : ''}`}>{shippingNote}</p>
              )}
              {cart.hiddenCount > 0 && (
                <p className="text-sm text-amber-300/90 leading-relaxed mt-3">{tr.hidden(cart.hiddenCount)}</p>
              )}
            </div>

            {/* Golden ticket: un renglón con su acción, no una caja dentro
                del panel. Usarlo o guardarlo se decide aquí mismo. */}
            {hasItems && goldenTicketAvailable && (
              <div className="px-5 sm:px-7 py-4 border-t-2 border-white/10 flex items-center gap-3">
                <TicketIcon className={`w-6 h-6 shrink-0 ${ticketTier === 'silver' ? 'text-[#cbd5e1]' : 'text-[#facc15]'}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{activeDiscount ? tr.ticketApplied : tr.ticketTitle}</p>
                  <p className="text-sm text-white/60">
                    {activeDiscount ? tr.ticketSaves(formatPrice(savedCents / 100)) : tr.ticketOffer}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={activeDiscount ? saveTicketForLater : applyTicketNow}
                  className={`shop-btn shop-btn--ghost shrink-0 min-h-[40px] px-4 text-[11px] ${FOCUS_RING}`}
                >
                  {activeDiscount ? tr.removeDiscount : tr.ticketUse}
                </button>
              </div>
            )}

            {/* Barra de pago, igual que la de compra del detalle: el monto a
                la izquierda y la acción de color al final. Con ticket, el
                subtotal tachado y el porcentaje debajo (PriceTag). */}
            {hasItems && (
              <div className="px-5 sm:px-7 pt-4 pb-5 border-t-2 border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white/60 mb-1.5">{tr.subtotal}</p>
                    <PriceTag
                      amount={activeDiscount ? finalPrice : cart.subtotal}
                      struck={activeDiscount ? cart.subtotal : null}
                      pct={pct}
                    />
                  </div>
                  {needsLogin ? (
                    <button
                      type="button"
                      disabled={!checkoutEnabled || hasSoldOut}
                      onClick={requestLogin}
                      className={`shop-btn shop-btn--primary ml-auto shrink-0 min-h-[52px] px-5 sm:px-6 text-xs gap-2 ${FOCUS_RING}`}
                    >
                      <UserCircleIcon className="w-4 h-4 shrink-0" aria-hidden />
                      <span>{checkoutEnabled ? tr.signIn : tr.paused}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={checkingOut || !checkoutEnabled || hasSoldOut}
                      onClick={handleCheckout}
                      className={`shop-btn shop-btn--primary ml-auto shrink-0 min-h-[52px] px-5 sm:px-6 text-xs gap-2 ${FOCUS_RING}`}
                    >
                      {checkoutEnabled && !checkingOut && <LockClosedIcon className="w-4 h-4 shrink-0" aria-hidden />}
                      <span>{checkingOut ? tr.redirecting : (checkoutEnabled ? tr.proceed : tr.paused)}</span>
                    </button>
                  )}
                </div>
                {blockedReason ? (
                  <p role="alert" className="text-sm text-red-400 leading-relaxed mt-3">{blockedReason}</p>
                ) : needsLogin && (
                  <p className="text-sm text-white/60 leading-relaxed mt-3">{tr.digitalNeedsAccount}</p>
                )}
                {/* Antes de pagar, a la mano: qué pasa si hay que cancelar o
                    devolver (LFPC art. 76 bis). */}
                <HelpLink lang={lang} section="returns" className="mt-4 text-xs" />
              </div>
            )}
          </footer>
        )}
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
          className={`fixed rounded-full w-12 h-12 grid place-items-center backdrop-blur-xl border transition-colors ${customizeOpen ? 'bg-white border-white text-black' :'bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'}`}
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
