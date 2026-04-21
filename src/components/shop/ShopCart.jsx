import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShoppingBagIcon, XMarkIcon, MinusIcon, PlusIcon, TicketIcon } from '@heroicons/react/24/solid'
import { formatPrice } from '../../lib/shopMockData.js'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useActiveDiscount } from '../../lib/useActiveDiscount.js'

const RARITY_CHIP = {
  common:    { text: '#cbd5e1', glow: 'rgba(203,213,225,0.25)' },
  rare:      { text: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  legendary: { text: '#facc15', glow: 'rgba(250,204,21,0.45)' },
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
export default function ShopCart() {
  const { lang } = useLanguage()
  const cart = useShopCartCtx()
  const { active: activeDiscount, clear: clearDiscount } = useActiveDiscount()
  const [open, setOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [success, setSuccess] = useState(null)
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
  // Posicionamos el CENTRO del botón sobre la curva superior-derecha a θ=60°
  // desde la vertical. Así el borde visible curvo pasa exactamente por el
  // centro del botón → mitad overlapping el portrait, mitad fuera.
  //
  // Parametrización de la píldora:
  //   top arc center: (r.left + W/2, r.top + W/2), radius = W/2
  //   point at angle θ from vertical: x = r.left + W/2*(1+sin θ),
  //                                    y = r.top  + W/2*(1-cos θ)
  //
  // θ = 60° → sin=0.866, cos=0.5 → x = r.left + W*0.933, y = r.top + W*0.25
  useEffect(() => {
    const BTN = 48 // w-12 h-12 — hit-target DESIGN.md §4.3 size lg
    const tick = () => {
      try {
        const outer = document.querySelector('[data-portrait-root]')
        const inner = outer?.querySelector(':scope > div')
        if (outer && inner) {
          const r = inner.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            const centerX = r.left + r.width * 0.933
            const centerY = r.top  + r.width * 0.25
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

  const isEn = lang === 'en'
  const tr = {
    openAria: isEn ? 'Open cart' : 'Abrir carrito',
    closeAria: isEn ? 'Close' : 'Cerrar',
    title: isEn ? 'CART' : 'CARRITO',
    removeDiscount: isEn ? 'Remove code' : 'Quitar código',
    discountApplied: isEn ? 'CODE APPLIED' : 'CÓDIGO ACTIVO',
    discountTotal: isEn ? 'TOTAL' : 'TOTAL',
    discountSaved: isEn ? 'You save' : 'Ahorras',
    archivedOk: isEn ? 'ORDER PLACED' : 'PEDIDO REALIZADO',
    receiptId: isEn ? 'Order ID:' : 'ID de pedido:',
    mockNote: isEn
      ? '// Mock checkout. Shopify integration pending.'
      : '// Checkout simulado. Integración Shopify pendiente.',
    emptyTitle: isEn ? 'Your cart is empty' : 'Tu carrito está vacío',
    emptyBody: isEn
      ? 'Browse the shop to add items.'
      : 'Explora la tienda para añadir productos.',
    removeAria: isEn ? 'Remove item' : 'Quitar producto',
    subtotal: isEn ? 'SUBTOTAL' : 'SUBTOTAL',
    archiving: isEn ? 'PROCESSING…' : 'PROCESANDO…',
    proceed: isEn ? 'CHECKOUT' : 'PAGAR',
    finalSales: isEn
      ? 'ALL SALES FINAL · NO AFTERLIFE REFUNDS'
      : 'VENTAS FINALES · SIN DEVOLUCIÓN EN EL MÁS ALLÁ',
  }

  const handleCheckout = async () => {
    if (cart.totalItems === 0) return
    setCheckingOut(true)
    const res = await cart.mockCheckout()
    setCheckingOut(false)
    if (res?.ok) {
      setSuccess(res.archiveId)
      cart.clear()
      setTimeout(() => setSuccess(null), 4000)
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
        className={`absolute top-0 right-0 bottom-0 w-full max-w-md border-l-2 border-blue-500 flex flex-col transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          fontFamily: '"Cascadia Code", "Fira Code", monospace',
          background: '#0a0a14', // terminal-bg (DESIGN.md §1.2)
        }}
      >
        {/* Terminal chrome header (DESIGN.md §6.2b) — traffic-lights estilo macOS,
            homologado con ContactForm.jsx. El rojo es funcional (close), los
            otros dos son dummies visuales. */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1.5 -m-1.5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
              onClick={onClose}
              aria-label={tr.closeAria}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-sm sm:text-base">M.A.D.R.E.@mausoleum:~/cart</span>
          <div className="w-6" />
        </header>

        {/* Sub-header con el título descriptivo */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-blue-500/20">
          <span className="text-cyan-400 text-xs opacity-80">&gt;</span>
          <h3 className="text-blue-100 font-black uppercase tracking-widest text-sm">
            {tr.title}
          </h3>
          <span className="text-blue-400/60 text-xs">[{cart.totalItems}]</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {success ? (
            <div className="text-center py-10 border border-green-500 bg-green-500/10 p-6">
              <div className="text-green-400 text-4xl mb-3">✓</div>
              <h4 className="text-green-400 font-black uppercase tracking-widest mb-2">
                {tr.archivedOk}
              </h4>
              <p className="text-green-400/80 text-xs">{tr.receiptId}</p>
              <p className="text-white font-mono text-sm mt-1">{success}</p>
              <p className="text-green-400/60 text-[11px] mt-4">{tr.mockNote}</p>
            </div>
          ) : cart.items.length === 0 ? (
            <div className="text-center py-16 text-blue-400/60">
              <ShoppingBagIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="uppercase text-sm tracking-widest">{tr.emptyTitle}</p>
              <p className="text-xs mt-2 opacity-60">{tr.emptyBody}</p>
            </div>
          ) : (
            <ul className="divide-y divide-blue-500/15">
              {cart.items.map((it) => {
                const p = it.product
                const title = isEn ? p.title_en : p.title_es
                const key = `${p.id}__${it.size || 'none'}`
                return (
                  <li key={key} className="py-4 flex gap-3">
                    <div className="w-20 h-20 flex-shrink-0 bg-[#05060e] border border-blue-500/30 overflow-hidden relative">
                      <img src={p.image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-blue-50 text-sm font-bold leading-snug">{title}</h4>
                        <button
                          type="button"
                          onClick={() => cart.remove(p.id, it.size)}
                          className="text-red-400 hover:text-red-300"
                          aria-label={tr.removeAria}
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-blue-400/70 text-[11px] mt-0.5">
                        {p.archiveId}{it.size ? ` · ${it.size}` : ''}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center rounded-lg border border-blue-500/40 bg-blue-500/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => cart.setQty(p.id, it.size, it.qty - 1)}
                            className="w-7 h-7 grid place-items-center text-blue-200 hover:bg-blue-500/20 transition-colors"
                          >
                            <MinusIcon className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-blue-50 text-sm">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => cart.setQty(p.id, it.size, it.qty + 1)}
                            className="w-7 h-7 grid place-items-center text-blue-200 hover:bg-blue-500/20 transition-colors"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-blue-100 font-black">
                          {formatPrice(p.price * it.qty)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!success && cart.items.length > 0 && (() => {
          const pct = activeDiscount?.pct || 0
          const discountAmount = pct > 0 ? Math.round(cart.subtotal * pct) / 100 * 100 / 100 : 0
          // Use integer math to avoid float drift on currencies like MXN.
          const savedCents = Math.round(cart.subtotal * 100 * (pct / 100))
          const subtotalCents = Math.round(cart.subtotal * 100)
          const finalCents = Math.max(0, subtotalCents - savedCents)
          const finalPrice = finalCents / 100
          const savedPrice = savedCents / 100
          const chipColors = RARITY_CHIP[activeDiscount?.rarity] || RARITY_CHIP.common
          return (
          <footer className="border-t-2 border-blue-500 p-5" style={{ background: '#0a0a14' }}>
            {/* Active discount chip */}
            {activeDiscount && (
              <div
                className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded border"
                style={{
                  borderColor: chipColors.text,
                  background: 'rgba(0,0,0,0.5)',
                  boxShadow: `inset 0 0 12px ${chipColors.glow}`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TicketIcon className="w-4 h-4 flex-shrink-0" style={{ color: chipColors.text }} />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest opacity-70" style={{ color: chipColors.text }}>
                      {tr.discountApplied} · {activeDiscount.rarity}
                    </div>
                    <div className="text-xs font-bold truncate" style={{ color: chipColors.text }}>
                      {activeDiscount.code} — {activeDiscount.pct}% off
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearDiscount}
                  className="flex-shrink-0 w-6 h-6 grid place-items-center rounded hover:bg-red-500/20 text-blue-300/60 hover:text-red-400 transition-colors"
                  aria-label={tr.removeDiscount}
                  title={tr.removeDiscount}
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeDiscount ? (
              <>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-blue-300/60 uppercase tracking-widest">{tr.subtotal}</span>
                  <span className="text-blue-300/70 line-through">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-3" style={{ color: chipColors.text }}>
                  <span className="uppercase tracking-widest opacity-80">{tr.discountSaved}</span>
                  <span>− {formatPrice(savedPrice)}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-blue-300/80 uppercase text-sm tracking-widest">{tr.discountTotal}</span>
                  <span className="text-3xl font-black text-blue-50">{formatPrice(finalPrice)}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between mb-4">
                <span className="text-blue-300/80 uppercase text-sm tracking-widest">{tr.subtotal}</span>
                <span className="text-3xl font-black text-blue-50">
                  {formatPrice(cart.subtotal)}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={checkingOut}
              onClick={handleCheckout}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {checkingOut ? (
                <>
                  <span className="shop-blink">●</span>
                  <span>{tr.archiving}</span>
                </>
              ) : (
                <>
                  <span>&gt;_</span>
                  <span>{tr.proceed}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-blue-400/50 text-center mt-3 uppercase tracking-widest">
              ⚠ {tr.finalSales}
            </p>
          </footer>
          )
        })()}
      </aside>
    </div>
  )

  return (
    <>
      {/* Icon-button universal — paleta terminal (DESIGN.md §1.2 + §4.2).
          El cart es un componente global, usa azul base (no el magenta que
          identifica solo la sección store). Hit-target 48px. */}
      {visible && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={tr.openAria}
          className="fixed rounded-full w-12 h-12 grid place-items-center bg-black/40 hover:bg-blue-500/20 backdrop-blur-xl border-2 border-blue-500 hover:border-blue-400 transition-colors group"
          style={{
            top: `${buttonPos?.top ?? 16}px`,
            left: `${buttonPos?.left ?? 0}px`,
            // Portrait tiene zIndex={999990} (App.jsx) → cart debe quedar ENCIMA.
            zIndex: 999995,
            // Clonamos la opacity del portrait → fades/animaciones sincronizadas.
            // Cuando el portrait se oculta (showMusic, uiAnimPhase='hidden', etc.)
            // el cart se oculta con él. pointer-events off debajo de 0.1 para
            // que no sea clickable durante el fade-out residual.
            opacity: portraitOpacity,
            pointerEvents: portraitOpacity < 0.1 ? 'none' : 'auto',
            transition: 'opacity 200ms ease-out',
          }}
        >
          <ShoppingBagIcon className="w-6 h-6 text-blue-400 group-hover:text-white transition-colors" />
          {cart.totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 grid place-items-center rounded-full bg-blue-500 text-black text-[11px] font-black border-2 border-black">
              {cart.totalItems}
            </span>
          )}
        </button>
      )}

      {/* Sidebar via portal a document.body — fuera de #root para no recibir
          el translateX(-28rem) cuando cart-open. */}
      {typeof document !== 'undefined' && createPortal(sidebar, document.body)}
    </>
  )
}
