import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { fetchOrder, cancelCheckout } from '../../lib/shopApi.js'
import { readPendingCheckout, clearPendingCheckout } from '../../lib/useShopCart.js'
import HelpLink from '../help/HelpLink.jsx'
import { formatPriceWithCurrency } from '../../lib/shopProduct.js'

// Estado de un pedido. Se abre solo cuando la URL trae ?pedido=TOKEN:
//   - regreso de Stripe tras pagar (success_url),
//   - regreso de Stripe sin pagar (cancel_url, con &cancelado=1),
//   - link "Ver mi pedido" de los correos.
//
// El pago lo confirma el webhook, no el regreso del navegador: si el comprador
// llega antes que el webhook, el pedido sigue `pending` unos segundos y aquí
// se consulta de nuevo hasta que cambie.
//
// Lenguaje visual SHOP v2 (DESIGN.md §14): sin monoespaciado, sin glows, sin
// eyebrows. Mismo overlay que ProductInspectModal.

const TOKEN_RE = /^[a-f0-9]{32}$/
const POLL_MS = 2000
const POLL_MAX = 20

function readParams() {
  try {
    const sp = new URLSearchParams(window.location.search)
    const token = sp.get('pedido') || ''
    return TOKEN_RE.test(token) ? { token, cancelled: sp.get('cancelado') === '1' } : null
  } catch {
    return null
  }
}

function stripParams() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('pedido')
    url.searchParams.delete('cancelado')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch { }
}

export default function OrderStatusModal() {
  const { lang } = useLanguage()
  const cart = useShopCartCtx()
  const { refresh } = useShopData()
  const [token, setToken] = useState(null)
  const [order, setOrder] = useState(null)
  const [failed, setFailed] = useState(false)
  const [polls, setPolls] = useState(0)
  const clearedRef = useRef(false)
  const isEn = lang === 'en'

  useEffect(() => {
    const params = readParams()
    if (!params) return
    if (params.cancelled) {
      // Regresó sin pagar: se suelta lo que su checkout apartaba y se le
      // devuelve el carrito abierto, tal como lo dejó.
      cancelCheckout(params.token).catch(() => { })
      if (readPendingCheckout() === params.token) clearPendingCheckout()
      stripParams()
      refresh()
      try { window.dispatchEvent(new CustomEvent('shop-cart-open-request')) } catch { }
      return
    }
    setToken(params.token)
  }, [refresh])

  const load = useCallback(() => {
    if (!token) return
    fetchOrder(token)
      .then((o) => { setOrder(o); setFailed(false) })
      .catch(() => setFailed(true))
  }, [token])

  useEffect(() => { load() }, [load])

  // Webhook en camino: consultar de nuevo mientras siga pendiente.
  useEffect(() => {
    if (order?.status !== 'pending' || polls >= POLL_MAX) return
    const id = setTimeout(() => { setPolls(n => n + 1); load() }, POLL_MS)
    return () => clearTimeout(id)
  }, [order?.status, polls, load])

  // Pago confirmado (o ficha OXXO emitida): el carrito de ESTE checkout se
  // vacía. Un link viejo de correo no toca el carrito actual del comprador.
  useEffect(() => {
    if (!order || clearedRef.current) return
    const settled = ['paid', 'preparing', 'shipped', 'delivered', 'awaiting_payment'].includes(order.status)
    if (!settled) return
    clearedRef.current = true
    if (readPendingCheckout() === token) {
      cart.clear()
      clearPendingCheckout()
      refresh()
    }
  }, [order, token, cart, refresh])

  useEffect(() => {
    if (!token) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const close = () => {
    stripParams()
    setToken(null)
    setOrder(null)
  }

  if (!token) return null

  const fmt = (n) => formatPriceWithCurrency(n, order?.currency || 'MXN')
  const tr = isEn ? EN : ES
  const view = describe(order, failed, polls >= POLL_MAX, tr)

  return createPortal(
    <div
      className="fixed inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8 shop-inspect-enter"
      style={{ zIndex: 999997 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* Deja pasar el clic al fondo para que cerrar afuera funcione. */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div className="relative w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[92vh] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-2xl overflow-hidden text-white">
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
          aria-label={tr.close}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto modal-scroll p-6 sm:p-8 flex flex-col gap-6">
          <div className="pr-12">
            <h2 className="shop-display shop-display--md">{view.title}</h2>
            {view.body && <p className="text-white/70 text-base leading-relaxed mt-3">{view.body}</p>}
          </div>

          {order && (
            <>
              <dl className="border-t border-white/10">
                <Row k={tr.number} v={order.number} />
                {order.shipping_method && <Row k={tr.shipping} v={order.shipping_method} />}
                {order.carrier && <Row k={tr.carrier} v={order.carrier} />}
                {order.tracking_number && (
                  <Row
                    k={tr.tracking}
                    v={order.tracking_url
                      ? <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-[#e600ff] underline underline-offset-4">{order.tracking_number}</a>
                      : order.tracking_number}
                  />
                )}
                {order.shipping_address?.city && (
                  <Row k={tr.shipTo} v={[order.shipping_address.city, order.shipping_address.country].filter(Boolean).join(', ')} />
                )}
              </dl>

              {order.downloads?.length > 0 && (
                <div className="flex flex-col gap-2">
                  {order.downloads.map((d) => (
                    <a
                      key={d.url}
                      href={d.url}
                      className="shop-btn shop-btn--primary min-h-[48px] px-5 text-sm gap-2 justify-between"
                    >
                      <span className="truncate">{d.name}</span>
                      <ArrowDownTrayIcon className="w-5 h-5 flex-shrink-0" aria-hidden />
                    </a>
                  ))}
                  <p className="text-xs text-white/45">{tr.downloadNote}</p>
                </div>
              )}

              <ul className="divide-y divide-white/10 border-y border-white/10">
                {order.items.map((it) => (
                  <li key={it.id} className="py-3 flex gap-3 items-center">
                    <div className="w-14 h-14 flex-shrink-0 bg-[#150a1d] rounded-lg overflow-hidden relative">
                      {it.image && <img src={it.image} alt={it.title} className="absolute inset-0 w-full h-full object-contain p-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-snug">{it.title} × {it.qty}</div>
                      {it.options && <div className="text-xs text-white/45 mt-0.5">{it.options}</div>}
                    </div>
                    <div className="text-sm font-bold whitespace-nowrap">{fmt(it.unit_price * it.qty)}</div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1.5 text-sm">
                <Line k={tr.subtotal} v={fmt(order.subtotal)} />
                {order.discount > 0 && <Line k={order.discount_label || tr.discount} v={`− ${fmt(order.discount)}`} />}
                {order.has_physical && order.status !== 'pending' && (
                  <Line k={tr.shippingCost} v={order.shipping > 0 ? fmt(order.shipping) : tr.free} />
                )}
                <div className="flex items-baseline justify-between gap-3 mt-2">
                  <span className="shop-kicker text-white/45">{tr.total}</span>
                  <span className="shop-display shop-display--md">{fmt(order.total)}</span>
                </div>
                {order.refunded > 0 && <Line k={tr.refunded} v={fmt(order.refunded)} />}
              </div>
            </>
          )}

          {/* Si algo sale mal con el pedido: cancelar, devolver, dañado. */}
          <HelpLink lang={lang} className="mt-auto" />

          <button
            type="button"
            onClick={close}
            className="shop-btn shop-btn--ghost w-full min-h-[52px] px-6 text-sm"
          >
            {tr.back}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function describe(order, failed, gaveUp, tr) {
  if (failed && !order) return { title: tr.notFoundTitle, body: tr.notFoundBody }
  if (!order) return { title: tr.loadingTitle, body: null }
  switch (order.status) {
    case 'pending':
      return gaveUp
        ? { title: tr.slowTitle, body: tr.slowBody }
        : { title: tr.confirmingTitle, body: tr.confirmingBody }
    case 'awaiting_payment':
      return { title: tr.awaitingTitle, body: tr.awaitingBody }
    case 'paid':
    case 'preparing':
      return { title: tr.paidTitle, body: tr.paidBody(order.number) }
    case 'shipped':
      return { title: tr.shippedTitle, body: tr.shippedBody }
    case 'delivered':
      return order.has_physical
        ? { title: tr.deliveredTitle, body: tr.deliveredBody }
        : { title: tr.paidTitle, body: tr.digitalBody }
    case 'refunded':
      return { title: tr.refundedTitle, body: tr.refundedBody }
    default:
      return { title: tr.closedTitle, body: tr.closedBody }
  }
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
      <dt className="shop-kicker text-white/45">{k}</dt>
      <dd className="text-white font-semibold text-sm text-right min-w-0 break-words">{v}</dd>
    </div>
  )
}

function Line({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 text-white/60">
      <span>{k}</span>
      <span className="whitespace-nowrap">{v}</span>
    </div>
  )
}

const ES = {
  close: 'Cerrar',
  back: 'Volver a la tienda',
  number: 'Pedido',
  shipping: 'Envío',
  carrier: 'Paquetería',
  tracking: 'Guía',
  shipTo: 'Destino',
  subtotal: 'Subtotal',
  discount: 'Descuento',
  shippingCost: 'Envío',
  free: 'Gratis',
  total: 'Total',
  refunded: 'Reembolsado',
  downloadNote: 'Los links también van en tu correo de confirmación.',
  loadingTitle: 'Abriendo tu pedido…',
  notFoundTitle: 'No encontramos ese pedido.',
  notFoundBody: 'Revisa el link de tu correo. Si el problema sigue, escríbenos.',
  confirmingTitle: 'Confirmando tu pago…',
  confirmingBody: 'Stripe nos está avisando. Toma unos segundos.',
  slowTitle: 'Tu pago sigue en camino.',
  slowBody: 'Si ya pagaste, te llega un correo de confirmación en unos minutos. No vuelvas a pagar.',
  awaitingTitle: 'Tu ficha está lista.',
  awaitingBody: 'Págala en OXXO antes de que venza. En cuanto el pago se confirme te escribimos y tu pedido entra a preparación. Las piezas quedan apartadas mientras tanto.',
  paidTitle: 'Pago recibido.',
  paidBody: (n) => `Tu pedido ${n} ya está en el archivo. Te escribimos cuando salga a paquetería, con su número de rastreo.`,
  digitalBody: 'Tus descargas están listas aquí abajo.',
  shippedTitle: 'Va en camino.',
  shippedBody: 'Tu pedido ya está en manos de la paquetería.',
  deliveredTitle: 'Entregado.',
  deliveredBody: 'Este pedido ya llegó a su destino.',
  refundedTitle: 'Pedido reembolsado.',
  refundedBody: 'El reembolso sale a tu método de pago original. El banco puede tardar unos días en reflejarlo.',
  closedTitle: 'Este pago no se completó.',
  closedBody: 'No se hizo ningún cargo. Las piezas volvieron a la tienda.',
}

const EN = {
  close: 'Close',
  back: 'Back to the shop',
  number: 'Order',
  shipping: 'Shipping',
  carrier: 'Carrier',
  tracking: 'Tracking',
  shipTo: 'Destination',
  subtotal: 'Subtotal',
  discount: 'Discount',
  shippingCost: 'Shipping',
  free: 'Free',
  total: 'Total',
  refunded: 'Refunded',
  downloadNote: 'The links are also in your confirmation email.',
  loadingTitle: 'Opening your order…',
  notFoundTitle: "We couldn't find that order.",
  notFoundBody: 'Check the link in your email. If it keeps failing, write to us.',
  confirmingTitle: 'Confirming your payment…',
  confirmingBody: 'Stripe is letting us know. It takes a few seconds.',
  slowTitle: 'Your payment is still on its way.',
  slowBody: "If you already paid, a confirmation email will arrive in a few minutes. Don't pay again.",
  awaitingTitle: 'Your voucher is ready.',
  awaitingBody: "Pay it at OXXO before it expires. As soon as the payment clears we'll email you and your order goes into preparation. The pieces stay on hold meanwhile.",
  paidTitle: 'Payment received.',
  paidBody: (n) => `Your order ${n} is now on file. We'll email you when it ships, with its tracking number.`,
  digitalBody: 'Your downloads are ready below.',
  shippedTitle: "It's on its way.",
  shippedBody: 'Your order is now with the carrier.',
  deliveredTitle: 'Delivered.',
  deliveredBody: 'This order has reached its destination.',
  refundedTitle: 'Order refunded.',
  refundedBody: 'The refund goes back to your original payment method. Your bank may take a few days to show it.',
  closedTitle: "This payment didn't go through.",
  closedBody: 'You were not charged. The pieces went back to the shop.',
}
