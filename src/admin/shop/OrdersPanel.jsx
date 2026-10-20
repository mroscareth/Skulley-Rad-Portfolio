/**
 * Pedidos — lista, detalle y fulfillment.
 *
 * Stripe cobra y confirma (webhook); desde aquí solo se mueve la logística
 * (preparar → enviar → entregar), se reembolsa y se cancela lo que no se pagó.
 * Las guías se compran a mano en Envia.com: el detalle está armado para copiar
 * la dirección, pegar la guía y avisar al cliente en un solo paso.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TruckIcon,
  ClipboardDocumentIcon,
  PrinterIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ReceiptRefundIcon,
  XCircleIcon,
  XMarkIcon,
  CubeIcon,
  CloudArrowDownIcon,
  TicketIcon,
  ShoppingBagIcon,
  UserIcon,
  MapPinIcon,
  PencilSquareIcon,
  ShieldExclamationIcon,
  PhotoIcon,
  BoltIcon,
  CreditCardIcon,
  CheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid'
import {
  listOrders,
  getOrder,
  getOrderStats,
  updateOrder,
  refundOrder,
  cancelOrder,
  resendOrderEmail,
  ordersExportUrl,
  formatMoney,
} from './shopAdminApi.js'

// `tone` es la variante de .a-badge. Magenta = te toca actuar (pagado, por
// empacar); lo que ya no pide nada queda neutro.
const STATUS_META = {
  pending: { label: 'Checkout open', tone: null },
  awaiting_payment: { label: 'Awaiting payment (OXXO)', tone: 'warning' },
  paid: { label: 'Paid · to pack', tone: 'accent' },
  preparing: { label: 'Preparing', tone: 'accent' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: null },
  expired: { label: 'Expired', tone: null },
  refunded: { label: 'Refunded', tone: null },
}

const TABS = [
  { id: 'to_fulfill', label: 'To fulfill', statuses: ['paid', 'preparing'] },
  { id: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { id: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { id: 'awaiting_payment', label: 'Awaiting payment', statuses: ['awaiting_payment'] },
  { id: 'refunded', label: 'Refunded', statuses: ['refunded'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
  // `all` es el único que incluye checkouts abandonados (pending/expired).
  { id: 'all', label: 'All', all: true },
]

const PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered']
const UNPAID_STATUSES = ['pending', 'awaiting_payment']
const FULFILL_STEPS = ['paid', 'preparing', 'shipped', 'delivered']
const FULFILL_STEP_LABELS = { paid: 'Paid', preparing: 'Preparing', shipped: 'Shipped', delivered: 'Delivered' }
const PAYMENT_LABELS = { card: 'Card', oxxo: 'OXXO' }

const CARRIERS = ['Estafeta', 'DHL', 'FedEx', 'UPS', 'USPS', 'Redpack', 'Paquetexpress', '99minutos', 'Correos de México']
const OTHER_CARRIER = '__other'

// Solo paqueterías que aceptan la guía como parámetro de URL. Estafeta,
// Redpack y compañía rastrean desde un formulario: ese link se pega a mano.
const TRACKING_TEMPLATES = {
  DHL: 'https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={n}',
  FedEx: 'https://www.fedex.com/fedextrack/?trknbr={n}',
  UPS: 'https://www.ups.com/track?tracknum={n}',
  USPS: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={n}',
}

const ERROR_MESSAGES = {
  order_not_paid: "This order isn't paid, so its fulfillment status can't change.",
  invalid_status: 'Only Stripe can set that status.',
  stripe_error: 'Stripe rejected the request.',
  already_refunded: 'This order is already fully refunded.',
  invalid_amount: "The amount must be more than 0 and no more than what's left to refund.",
  not_cancellable: 'Only unpaid orders (checkout open or awaiting payment) can be cancelled.',
  no_payment: 'No Stripe payment is linked to this order.',
  oxxo_not_refundable: "OXXO payments can't be refunded through Stripe. Return the money by bank transfer and note it here.",
  not_found: 'Order not found.',
  unauthorized: 'Your session expired. Log in again.',
  server_error: 'Server error. Check the PHP error log.',
  error: 'Something went wrong.',
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100
const badgeClass = (tone) => `a-badge${tone ? ` a-badge--${tone}` : ''}`

// Las fechas llegan como 'YYYY-MM-DD HH:MM:SS' en hora del servidor. Se
// muestran tal cual: pasarlas por Date las corre de zona (y Safari no
// parsea el formato con espacio).
const fmtDate = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—')
const parseDate = (s) => (s ? new Date(String(s).replace(' ', 'T')) : null)

function errorText(err) {
  const code = err?.message || 'error'
  const base = ERROR_MESSAGES[code] || fallbackError(code)
  return err?.detail ? `${base.replace(/\.$/, '')}: ${err.detail}` : base
}

// Códigos sin traducir (o `http_502` cuando el backend no respondió JSON):
// mejor una frase legible que el código crudo.
function fallbackError(code) {
  const http = /^http_(\d+)$/.exec(code)
  if (http) return `Request failed (HTTP ${http[1]}).`
  const text = String(code).replace(/_/g, ' ').trim()
  if (!text) return ERROR_MESSAGES.error
  return `${text[0].toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`
}

function countryName(code, lang = 'es') {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

function addressLines(order, lang = 'es') {
  const a = order?.shipping_address || {}
  return [
    order?.shipping_name || order?.customer_name || '',
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(' '),
    a.state,
    countryName(a.country, lang),
  ]
    .map((l) => String(l || '').trim())
    .filter(Boolean)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Sin https (preview en LAN) navigator.clipboard no existe.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    return ok
  }
}

function splitCarrier(value) {
  const v = String(value || '').trim()
  if (!v) return ['', '']
  const preset = CARRIERS.find((c) => c.toLowerCase() === v.toLowerCase())
  return preset ? [preset, ''] : [OTHER_CARRIER, v]
}

// Cada caja del detalle lleva su propio estado de acción para que el
// resultado aparezca junto al botón (en mobile la cabecera queda lejos).
function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const run = useCallback(async (fn, okText) => {
    setBusy(true)
    setMsg(null)
    clearTimeout(timer.current)
    try {
      const res = await fn()
      if (okText) {
        setMsg({ ok: true, text: typeof okText === 'function' ? okText(res) : okText })
        timer.current = setTimeout(() => setMsg(null), 5000)
      }
      return res
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) })
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, msg, run, setMsg }
}

// ═══════════════════════════════════════════════════════════════

// `onBack` ya no se usa: es vista de nivel superior y la navegación vive en
// la barra lateral del CMS.
export default function OrdersPanel({ initialOrderId = null }) {
  const [selectedId, setSelectedId] = useState(initialOrderId)
  const [tab, setTab] = useState('to_fulfill')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)

  useEffect(() => {
    if (initialOrderId) setSelectedId(initialOrderId)
  }, [initialOrderId])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [selectedId])

  const loadStats = useCallback(async () => {
    try {
      setStats(await getOrderStats())
      setStatsError(null)
    } catch (e) {
      setStatsError(errorText(e))
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  if (selectedId) {
    return (
      <OrderDetail
        key={selectedId}
        orderId={selectedId}
        testMode={!!stats?.stripe?.test_mode}
        onClose={() => setSelectedId(null)}
        onChanged={loadStats}
      />
    )
  }

  return (
    <OrdersList
      onOpen={setSelectedId}
      stats={stats}
      statsError={statsError}
      onRefreshStats={loadStats}
      tab={tab}
      setTab={setTab}
      search={search}
      setSearch={setSearch}
      page={page}
      setPage={setPage}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// LISTA
// ═══════════════════════════════════════════════════════════════

function OrdersList({ onOpen, stats, statsError, onRefreshStats, tab, setTab, search, setSearch, page, setPage }) {
  const [query, setQuery] = useState(() => search.trim())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const next = search.trim()
    if (next === query) return
    const t = setTimeout(() => {
      setQuery(next)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search, query, setPage])

  const current = TABS.find((t) => t.id === tab) || TABS[0]

  const load = useCallback(async () => {
    // Una respuesta lenta de un filtro viejo no debe pisar la del actual.
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await listOrders({
        status: current.statuses ? current.statuses.join(',') : undefined,
        q: query,
        page,
        all: !!current.all,
      })
      if (seq === seqRef.current) setData(res)
    } catch (e) {
      if (seq === seqRef.current) setError(errorText(e))
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [current, query, page])

  useEffect(() => { load() }, [load])

  const counts = data?.counts || {}
  const tabCount = (t) => (t.all
    ? Object.values(counts).reduce((a, b) => a + Number(b || 0), 0)
    : t.statuses.reduce((a, s) => a + Number(counts[s] || 0), 0))

  const orders = data?.orders || []
  const total = data?.total || 0
  const perPage = data?.per_page || 50
  const pages = Math.max(1, Math.ceil(total / perPage))
  const stripe = stats?.stripe

  const selectTab = (id) => {
    setTab(id)
    setPage(1)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="a-title">Orders</h1>
            {stripe?.test_mode && <TestModeBadge />}
          </div>
          <p className="a-subtitle">Payments run through Stripe. Packing, shipping and refunds happen here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { load(); onRefreshStats() }}
            className="a-icon-btn"
            aria-label="Refresh orders"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a href={ordersExportUrl()} download className="a-btn a-btn--secondary">
            <ArrowDownTrayIcon className="w-4 h-4" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      {stripe && !stripe.configured && (
        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
          <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <span>Stripe keys are missing, so checkout is off.</span>
        </div>
      )}
      {stripe && !stripe.webhook_secret && (
        <div className="a-alert a-alert--warning px-4 py-3">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            The webhook secret is missing, so payments won't be confirmed.
            <span className="block text-[0.8125rem] opacity-80 mt-0.5">
              Set <span className="a-code text-inherit">STRIPE_WEBHOOK_SECRET</span>. Details in Store settings.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Net sales this month" className="col-span-2 lg:col-span-1">
          {stats?.month_sales?.length ? (
            <div className="space-y-1">
              {stats.month_sales.map((s) => (
                <div key={s.currency} className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold text-white a-num">{formatMoney(s.net, s.currency)}</span>
                  <span className="a-meta">{s.orders} {s.orders === 1 ? 'order' : 'orders'}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xl font-bold text-white/45">{stats ? '—' : '…'}</span>
          )}
        </Kpi>
        <Kpi label="To ship" onClick={() => selectTab('to_fulfill')}>
          <KpiValue value={stats?.to_ship} className={stats?.to_ship > 0 ? 'text-section-quests' : 'text-white'} />
        </Kpi>
        <Kpi label="Awaiting payment" onClick={() => selectTab('awaiting_payment')}>
          <KpiValue value={stats?.awaiting_payment} className={stats?.awaiting_payment > 0 ? 'text-amber-300' : 'text-white'} />
        </Kpi>
        <Kpi label="Disputes" danger={stats?.disputes > 0}>
          <KpiValue value={stats?.disputes} className={stats?.disputes > 0 ? 'text-red-300' : 'text-white/45'} />
        </Kpi>
      </div>
      {statsError && <p className="text-sm text-red-300">Couldn't load the stats. {statsError}</p>}

      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="a-tabs min-w-0 lg:flex-1" role="tablist" aria-label="Order status">
          {TABS.map((t) => {
            const active = t.id === tab
            const n = tabCount(t)
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.id)}
                className="a-tab"
              >
                {t.label}
                {data && n > 0 && <span className="a-num opacity-60">{n}</span>}
              </button>
            )
          })}
        </div>
        <div className="relative lg:w-80 shrink-0">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 pointer-events-none" aria-hidden />
          <input
            type="text"
            enterKeyHint="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number, email, name or tracking"
            aria-label="Search orders"
            className="a-input pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Clear search"
              title="Clear"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
          <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="a-card overflow-hidden" role="tabpanel" aria-label={current.label}>
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 border-b-2 border-white/10">
          <span className="a-meta">
            {current.label} · {total} {total === 1 ? 'order' : 'orders'}{query ? ` · “${query}”` : ''}
          </span>
          {loading && data && <span className="a-spinner a-spinner--sm" role="status" aria-label="Loading" />}
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-16">
            <div className="a-spinner" role="status" aria-label="Loading orders" />
          </div>
        ) : orders.length === 0 ? (
          <div className="a-empty border-0 rounded-none">
            No orders in “{current.label}”{query ? ` matching “${query}”` : ''}.
          </div>
        ) : (
          <div className={`divide-y divide-white/10 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} onOpen={onOpen} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t-2 border-white/10">
            <span className="a-meta">Page {page} of {pages}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="a-icon-btn a-icon-btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(pages, page + 1))}
                disabled={page >= pages || loading}
                className="a-icon-btn a-icon-btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderRow({ order: o, onOpen }) {
  const who = o.customer_name || o.shipping_name || o.email || '—'
  const country = o.shipping_address?.country
  const items = Number(o.item_count || 0)
  const open = () => onOpen(o.id)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      className="px-4 sm:px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-section-quests"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white a-num">{o.number || `#${o.id}`}</span>
            <StatusChip status={o.status} />
            {o.dispute && <Badge tone="danger" icon={ShieldExclamationIcon}>Dispute</Badge>}
            {o.golden_ticket && <Badge tone="gold" icon={TicketIcon}>Golden ticket</Badge>}
          </div>
          <div className="mt-1 text-sm text-white/70 truncate">
            {who}
            {o.email && who !== o.email && <span className="text-white/45"> · {o.email}</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-x-2 gap-y-1.5 flex-wrap a-meta">
            <span>{fmtDate(o.created_at)}</span>
            <span>· {items} {items === 1 ? 'item' : 'items'}</span>
            {(o.zone || country) && <span>· {o.zone || '—'}{country ? ` / ${country}` : ''}</span>}
            {o.has_physical && <Badge icon={CubeIcon}>Physical</Badge>}
            {o.has_digital && <Badge icon={CloudArrowDownIcon}>Digital</Badge>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-white a-num whitespace-nowrap">{formatMoney(o.total, o.currency)}</div>
          {o.refunded > 0 && (
            <div className="a-meta whitespace-nowrap" title="Refunded">
              <span className="sr-only">Refunded </span>− {formatMoney(o.refunded, o.currency)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DETALLE
// ═══════════════════════════════════════════════════════════════

function OrderDetail({ orderId, testMode, onClose, onChanged }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [slipError, setSlipError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOrder(await getOrder(orderId))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const applyUpdate = useCallback((fresh) => {
    if (fresh) setOrder(fresh)
    onChanged?.()
  }, [onChanged])

  const backButton = (
    <button type="button" onClick={onClose} className="a-icon-btn" aria-label="Back to orders" title="Back to orders">
      <ArrowLeftIcon className="w-5 h-5" />
    </button>
  )

  if (!order) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          {backButton}
          <h1 className="a-title">Order</h1>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="a-spinner" role="status" aria-label="Loading order" />
          </div>
        ) : (
          <div className="a-alert a-alert--danger px-4 py-3" role="alert">
            <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
            <span>{error || ERROR_MESSAGES.not_found}</span>
          </div>
        )}
      </div>
    )
  }

  const fulfillable = order.has_physical && PAID_STATUSES.includes(order.status)
  const dates = [
    ['Created', order.created_at],
    ['Paid', order.paid_at],
    ['Shipped', order.shipped_at],
    ['Delivered', order.delivered_at],
  ].filter(([, v]) => v)
  if (UNPAID_STATUSES.includes(order.status) && order.expires_at) dates.push(['Held until', order.expires_at])

  const printSlip = () => {
    setSlipError(printPackingSlip(order) ? null : 'The popup was blocked. Allow popups for this site to print.')
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {backButton}
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="a-title break-words">{order.number || `#${order.id}`}</h1>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusChip status={order.status} />
              {order.dispute && <Badge tone="danger" icon={ShieldExclamationIcon}>Dispute</Badge>}
              {order.golden_ticket && <Badge tone="gold" icon={TicketIcon}>Golden ticket</Badge>}
              {order.payment_method && <Badge>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Badge>}
              {testMode && <TestModeBadge />}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 a-meta">
              {dates.map(([k, v]) => (
                <span key={k} className="whitespace-nowrap">
                  {k} <span className="text-white/70">{fmtDate(v)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:pl-[3.25rem]">
          {order.stripe_url && (
            <a href={order.stripe_url} target="_blank" rel="noopener noreferrer" className="a-btn a-btn--secondary a-btn--sm">
              <CreditCardIcon className="w-4 h-4" aria-hidden />
              Open in Stripe
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
            </a>
          )}
          {order.public_url && (
            <a href={order.public_url} target="_blank" rel="noopener noreferrer" className="a-btn a-btn--secondary a-btn--sm">
              <UserIcon className="w-4 h-4" aria-hidden />
              Customer page
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
            </a>
          )}
          {order.has_physical && (
            <button type="button" onClick={printSlip} className="a-btn a-btn--secondary a-btn--sm">
              <PrinterIcon className="w-4 h-4" aria-hidden />
              Print packing slip
            </button>
          )}
          <button
            type="button"
            onClick={load}
            className="a-icon-btn a-icon-btn--sm"
            aria-label="Reload order"
            title="Reload"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {slipError && <p className="text-sm text-red-300 sm:pl-[3.25rem]" role="alert">{slipError}</p>}
        {error && (
          <div className="a-alert a-alert--danger px-4 py-3" role="alert">
            <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      {order.dispute && (
        <div className="a-alert a-alert--danger px-4 py-3">
          <ShieldExclamationIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            Chargeback open. Answer it with evidence in the Stripe dashboard before the deadline.
            {order.stripe_url && (
              <a
                href={order.stripe_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 font-semibold text-white underline underline-offset-4 decoration-white/40 hover:decoration-white"
              >
                Open payment
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <ItemsCard order={order} />
        <CustomerCard order={order} />
        {fulfillable && <FulfillmentCard key={`f-${order.id}`} order={order} onUpdated={applyUpdate} />}
        <ActionsCard key={`a-${order.id}`} order={order} testMode={testMode} onUpdated={applyUpdate} />
        <NotesCard key={`n-${order.id}`} order={order} onUpdated={applyUpdate} />
        {order.downloads?.length > 0 && <DownloadsCard downloads={order.downloads} />}
      </div>
    </div>
  )
}

function ItemsCard({ order }) {
  const cur = order.currency
  const items = order.items || []
  const rows = [['Subtotal', formatMoney(order.subtotal, cur)]]
  if (order.discount > 0) rows.push([order.discount_label || 'Discount', `− ${formatMoney(order.discount, cur)}`])
  if (order.has_physical) {
    // Un checkout abierto todavía no sabe qué envío eligió el cliente.
    const ship = order.shipping > 0 ? formatMoney(order.shipping, cur) : order.paid_at ? 'Free' : '—'
    rows.push([order.shipping_method ? `Shipping · ${order.shipping_method}` : 'Shipping', ship])
  }

  return (
    <section className="a-card p-5 sm:p-6 space-y-4">
      <SectionHead icon={ShoppingBagIcon} title={`Items (${items.reduce((a, i) => a + Number(i.qty || 0), 0)})`} />
      <div className="divide-y divide-white/10">
        {items.map((it) => (
          <div key={it.id} className="flex gap-3 py-3 first:pt-0">
            <Thumb src={it.image} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white break-words">{it.title}</div>
              {it.options && <div className="text-[0.8125rem] text-white/70 break-words">{it.options}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 a-meta">
                {it.sku && <span>SKU <span className="a-code">{it.sku}</span></span>}
                {it.kind === 'digital' && <span>Digital</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="a-meta whitespace-nowrap">{it.qty} × {formatMoney(it.unit_price, cur)}</div>
              <div className="text-sm text-white a-num whitespace-nowrap">{formatMoney(round2(it.unit_price * it.qty), cur)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 space-y-1.5 border-t-2 border-white/10 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-white/70 min-w-0 break-words">{k}</span>
            <span className="text-white a-num whitespace-nowrap">{v}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 pt-1.5 text-base font-bold text-white">
          <span>Total</span>
          <span className="a-num whitespace-nowrap">{formatMoney(order.total, cur)}</span>
        </div>
        {order.refunded > 0 && (
          <>
            <div className="flex justify-between gap-3 text-white/70">
              <span>Refunded</span>
              <span className="a-num whitespace-nowrap">− {formatMoney(order.refunded, cur)}</span>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-white">
              <span>Net</span>
              <span className="a-num whitespace-nowrap">{formatMoney(round2(order.total - order.refunded), cur)}</span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function CustomerCard({ order }) {
  const [copied, setCopied] = useState(null)
  const lines = order.shipping_address ? addressLines(order) : []
  const fullAddress = [...lines, order.phone, order.email].filter(Boolean).join('\n')

  const copy = async (text, key) => {
    if (await copyText(text)) {
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    }
  }

  return (
    <section className="a-card p-5 sm:p-6 space-y-4">
      <SectionHead icon={UserIcon} title="Customer" />
      <div className="space-y-1 text-sm">
        <div className="font-semibold text-white">{order.customer_name || '—'}</div>
        {order.email ? (
          <a
            href={`mailto:${order.email}`}
            className="block text-white/70 hover:text-white underline-offset-4 hover:underline break-all transition-colors"
          >
            {order.email}
          </a>
        ) : (
          <div className="a-muted">No email on file</div>
        )}
        {order.phone && (
          <a href={`tel:${order.phone}`} className="block text-white/70 hover:text-white underline-offset-4 hover:underline transition-colors">
            {order.phone}
          </a>
        )}
        <div className="a-meta pt-1">
          Language {order.lang || '—'} · Zone {order.zone || '—'} · {order.privy_id ? 'Account' : 'Guest'}
        </div>
      </div>

      {order.has_physical ? (
        <div className="space-y-3 pt-4 border-t-2 border-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-4 h-4 text-white/50" aria-hidden />
              <span className="text-sm font-semibold text-white">Ship to</span>
            </div>
            {lines.length > 0 && (
              <button type="button" onClick={() => copy(fullAddress, 'all')} className="a-btn a-btn--secondary a-btn--sm">
                {copied === 'all'
                  ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
                  : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
                {copied === 'all' ? 'Copied' : 'Copy address'}
              </button>
            )}
          </div>
          {lines.length > 0 ? (
            <>
              <div className="a-inset p-1.5">
                {lines.map((l, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => copy(l, i)}
                    title="Copy this line"
                    aria-label={`Copy “${l}”`}
                    className="group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="min-w-0 break-words">{l}</span>
                    <span className="shrink-0 text-white/30 group-hover:text-white/70">
                      {copied === i
                        ? <CheckIcon className="w-3.5 h-3.5 text-green-400" aria-hidden />
                        : <ClipboardDocumentIcon className="w-3.5 h-3.5" aria-hidden />}
                    </span>
                  </button>
                ))}
              </div>
              <p className="a-help">Tap a line to copy just that field. Handy for Envia.com.</p>
            </>
          ) : (
            <p className="a-help">The address arrives when the customer completes checkout.</p>
          )}
          {order.shipping_method && (
            <div className="a-meta">Shipping method: <span className="text-white/70">{order.shipping_method}</span></div>
          )}
        </div>
      ) : (
        <p className="a-help">Digital only. Nothing to ship.</p>
      )}
    </section>
  )
}

function FulfillmentCard({ order, onUpdated }) {
  const act = useAction()
  const urlInputId = useId()
  const [carrierSel, setCarrierSel] = useState(() => splitCarrier(order.carrier)[0])
  const [carrierOther, setCarrierOther] = useState(() => splitCarrier(order.carrier)[1])
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '')
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url || '')
  // Mientras no se escriba a mano, la URL sigue a la plantilla de la paquetería.
  const [urlAuto, setUrlAuto] = useState(!order.tracking_url)
  const [notify, setNotify] = useState(true)

  const carrier = carrierSel === OTHER_CARRIER ? carrierOther.trim() : carrierSel
  const number = trackingNumber.trim()
  const template = TRACKING_TEMPLATES[carrierSel]
  const suggestion = template && number ? template.replace('{n}', encodeURIComponent(number)) : ''

  useEffect(() => {
    if (urlAuto) setTrackingUrl(suggestion)
  }, [urlAuto, suggestion])

  const status = order.status
  const canShip = status === 'paid' || status === 'preparing'
  const shippedOrLater = status === 'shipped' || status === 'delivered'
  const missing = !carrier ? 'Pick a carrier' : !number ? 'Add the tracking number' : null
  const trackingChanged = carrier !== (order.carrier || '')
    || number !== (order.tracking_number || '')
    || trackingUrl.trim() !== (order.tracking_url || '')

  const setStatus = (next, okText) => act.run(async () => {
    const res = await updateOrder({ id: order.id, status: next })
    onUpdated(res.order)
    return res
  }, okText)

  const ship = () => act.run(async () => {
    const res = await updateOrder({
      id: order.id,
      status: 'shipped',
      carrier,
      tracking_number: number,
      tracking_url: trackingUrl.trim(),
      notify,
    })
    onUpdated(res.order)
    return res
  }, (res) => (res?.notified ? `Shipped. ${order.email} was notified.` : 'Shipped. No email was sent.'))

  const saveTracking = () => act.run(async () => {
    const res = await updateOrder({
      id: order.id,
      carrier,
      tracking_number: number,
      tracking_url: trackingUrl.trim(),
    })
    onUpdated(res.order)
    return res
  }, 'Tracking saved.')

  return (
    <section className="a-card p-5 sm:p-6 space-y-5">
      <SectionHead icon={TruckIcon} title="Fulfillment" />
      <FulfillmentSteps status={status} />

      {status === 'paid' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" onClick={() => setStatus('preparing', 'Marked as preparing.')} disabled={act.busy} className="a-btn a-btn--secondary a-btn--sm">
            <CubeIcon className="w-4 h-4" aria-hidden />
            Mark as preparing
          </button>
          <span className="a-help">Optional. You can ship straight from Paid.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="a-label">Carrier</span>
          <select
            value={carrierSel}
            onChange={(e) => setCarrierSel(e.target.value)}
            className="a-input"
          >
            <option value="">Select a carrier</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER_CARRIER}>Other…</option>
          </select>
        </label>
        <label className="block">
          <span className="a-label">Tracking number</span>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Paste from Envia.com"
            autoComplete="off"
            className="a-input"
          />
        </label>
        {carrierSel === OTHER_CARRIER && (
          <label className="block sm:col-span-2">
            <span className="a-label">Carrier name</span>
            <input
              type="text"
              value={carrierOther}
              onChange={(e) => setCarrierOther(e.target.value)}
              placeholder="e.g. J&T Express"
              maxLength={60}
              className="a-input"
            />
          </label>
        )}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor={urlInputId} className="a-label mb-0">
              Tracking URL{urlAuto && suggestion ? <span className="font-normal text-white/45"> · auto</span> : null}
            </label>
            {!urlAuto && suggestion && trackingUrl.trim() !== suggestion && (
              <button type="button" onClick={() => setUrlAuto(true)} className="a-btn a-btn--ghost a-btn--sm -my-1">
                Use {carrierSel} link
              </button>
            )}
          </div>
          <input
            id={urlInputId}
            type="url"
            value={trackingUrl}
            onChange={(e) => { setTrackingUrl(e.target.value); setUrlAuto(false) }}
            placeholder={template ? 'Filled from the tracking number' : 'Paste the tracking link (optional)'}
            className="a-input"
          />
        </div>
      </div>

      {canShip && (
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="a-checkbox mt-0.5 shrink-0"
            />
            <span className="text-sm font-semibold text-white">
              Notify customer
              <span className="block a-help font-normal mt-0.5">
                {order.email ? `Sends “Your order shipped” to ${order.email}.` : 'No email on file, so nothing will be sent.'}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={ship} disabled={act.busy || !!missing} className="a-btn a-btn--primary">
              <TruckIcon className="w-4 h-4" aria-hidden />
              {act.busy ? 'Saving…' : 'Mark as shipped'}
            </button>
            {missing && <span className="a-help">{missing} to ship.</span>}
          </div>
        </div>
      )}

      {shippedOrLater && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveTracking}
              disabled={act.busy || !trackingChanged || !!missing}
              className="a-btn a-btn--secondary a-btn--sm"
            >
              <PencilSquareIcon className="w-4 h-4" aria-hidden />
              Save tracking
            </button>
            {status === 'shipped' && (
              <button
                type="button"
                onClick={() => setStatus('delivered', 'Marked as delivered.')}
                disabled={act.busy}
                className="a-btn a-btn--primary a-btn--sm"
              >
                {act.busy ? 'Saving…' : 'Mark as delivered'}
              </button>
            )}
          </div>
          <p className="a-help">Editing the tracking doesn't email the customer. Use Resend shipping email after saving.</p>
        </div>
      )}

      <ActionMsg msg={act.msg} />
    </section>
  )
}

function FulfillmentSteps({ status }) {
  const current = FULFILL_STEPS.indexOf(status)
  return (
    <ol className="flex items-center flex-wrap gap-x-1.5 gap-y-2 text-xs font-semibold" aria-label="Fulfillment progress">
      {FULFILL_STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex items-center gap-1.5" aria-current={active ? 'step' : undefined}>
            {i > 0 && <ChevronRightIcon className="w-3 h-3 text-white/25" aria-hidden />}
            {active ? (
              <span className={badgeClass(STATUS_META[s].tone)}>{FULFILL_STEP_LABELS[s]}</span>
            ) : (
              <span className={`inline-flex items-center gap-1 ${done ? 'text-white/70' : 'text-white/30'}`}>
                {done && <CheckIcon className="w-3.5 h-3.5 text-green-400" aria-hidden />}
                {FULFILL_STEP_LABELS[s]}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ActionsCard({ order, testMode, onUpdated }) {
  const act = useAction()
  const [mode, setMode] = useState(null) // null | 'refund' | 'refund_confirm' | 'cancel'
  const [amount, setAmount] = useState('')
  const [restock, setRestock] = useState(!!order.has_physical)

  const cur = order.currency
  const remaining = round2(order.total - order.refunded)
  const remainingCents = Math.round(remaining * 100)
  const paid = PAID_STATUSES.includes(order.status)
  // OXXO es efectivo: Stripe no lo reembolsa (ver oxxo_not_refundable).
  const canRefund = !!order.stripe_payment_intent && order.payment_method !== 'oxxo' && remainingCents > 0 && (paid || order.status === 'refunded')
  const canCancel = UNPAID_STATUSES.includes(order.status)
  const canResendShipped = order.has_physical && !!order.shipped_at && (order.status === 'shipped' || order.status === 'delivered')
  const hasEmail = !!order.email

  const amountNum = Number(String(amount).trim().replace(',', '.'))
  const amountCents = Math.round(amountNum * 100)
  const amountValid = String(amount).trim() !== '' && Number.isFinite(amountNum) && amountCents > 0 && amountCents <= remainingCents
  const amountMoney = formatMoney(amountCents / 100, cur)
  const doRestock = !!order.has_physical && restock

  const openRefund = () => {
    setAmount(remaining.toFixed(2))
    setRestock(!!order.has_physical)
    setMode('refund')
    act.setMsg(null)
  }

  const doRefund = () => act.run(async () => {
    const fresh = await refundOrder({ id: order.id, amount: amountCents / 100, restock: doRestock })
    onUpdated(fresh)
    setMode(null)
    return fresh
  }, `Refunded ${amountMoney}.${doRestock ? ' The pieces are back in stock.' : ''}`)

  const doCancel = () => act.run(async () => {
    const fresh = await cancelOrder(order.id)
    onUpdated(fresh)
    setMode(null)
    return fresh
  }, 'Order cancelled. The reserved pieces were released.')

  const resend = (type) => {
    const what = type === 'confirmation' ? 'Confirmation email' : 'Shipping email'
    return act.run(
      () => resendOrderEmail(order.id, type),
      (res) => (res?.sent ? `${what} sent to ${order.email}.` : `${what} wasn't sent. Check the SMTP config and the PHP error log.`),
    )
  }

  const nothingToDo = !paid && !canRefund && !canCancel && !canResendShipped

  return (
    <section className="a-card p-5 sm:p-6 space-y-4">
      <SectionHead icon={BoltIcon} title="Actions" />

      {nothingToDo ? (
        <p className="a-help">Nothing to do on this order ({STATUS_META[order.status]?.label || order.status}).</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {paid && (
            <button type="button" onClick={() => resend('confirmation')} disabled={!hasEmail || act.busy} className="a-btn a-btn--secondary a-btn--sm">
              <EnvelopeIcon className="w-4 h-4" aria-hidden />
              Resend confirmation
            </button>
          )}
          {canResendShipped && (
            <button type="button" onClick={() => resend('shipped')} disabled={!hasEmail || act.busy} className="a-btn a-btn--secondary a-btn--sm">
              <TruckIcon className="w-4 h-4" aria-hidden />
              Resend shipping email
            </button>
          )}
          {canRefund && mode === null && (
            <button type="button" onClick={openRefund} disabled={act.busy} className="a-btn a-btn--danger a-btn--sm">
              <ReceiptRefundIcon className="w-4 h-4" aria-hidden />
              Refund
            </button>
          )}
          {canCancel && mode === null && (
            <button type="button" onClick={() => { setMode('cancel'); act.setMsg(null) }} disabled={act.busy} className="a-btn a-btn--danger a-btn--sm">
              <XCircleIcon className="w-4 h-4" aria-hidden />
              Cancel order
            </button>
          )}
        </div>
      )}
      {(paid || canResendShipped) && !hasEmail && <p className="a-help">No email on file, so emails can't be sent.</p>}

      {mode === 'refund' && (
        <div className="a-inset p-4 space-y-4">
          <label className="block">
            <span className="a-label">Amount ({cur})</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="a-input w-36 a-num"
              />
              <button type="button" onClick={() => setAmount(remaining.toFixed(2))} className="a-btn a-btn--ghost a-btn--sm">
                Max {formatMoney(remaining, cur)}
              </button>
            </div>
          </label>
          {String(amount).trim() !== '' && !amountValid && (
            <p className="text-sm text-red-300" role="alert">Enter an amount between 0.01 and {remaining.toFixed(2)}.</p>
          )}
          {order.has_physical && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="a-checkbox mt-0.5 shrink-0" />
              <span className="text-sm font-semibold text-white">
                Restock
                <span className="block a-help font-normal mt-0.5">
                  Puts every physical unit of this order back in stock. Uncheck it if the piece didn't come back.
                </span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode('refund_confirm')} disabled={!amountValid} className="a-btn a-btn--danger a-btn--sm">
              Review refund
            </button>
            <button type="button" onClick={() => setMode(null)} className="a-btn a-btn--ghost a-btn--sm">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'refund_confirm' && (
        <div className="a-alert a-alert--danger p-4" role="group" aria-label="Confirm refund">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="font-semibold text-white">
                Refund <span className="a-num">{amountMoney}</span> to {order.customer_name || order.email || 'the customer'}?
              </div>
              <div className="text-[0.8125rem]">
                This returns real money to their card through Stripe and can't be undone.
                {testMode && ' Test mode: no real money moves.'}
              </div>
              <div className="text-[0.8125rem] opacity-80">
                {amountCents < remainingCents ? 'Partial refund' : 'Full refund. The status changes to Refunded'} · Restock: {doRestock ? 'yes' : 'no'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={doRefund} disabled={act.busy} className="a-btn a-btn--danger-solid a-btn--sm">
                {act.busy ? 'Refunding…' : `Confirm refund of ${amountMoney}`}
              </button>
              <button type="button" onClick={() => setMode('refund')} disabled={act.busy} className="a-btn a-btn--ghost a-btn--sm">Back</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="a-alert a-alert--danger p-4" role="group" aria-label="Confirm cancellation">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="font-semibold text-white">Cancel {order.number}?</div>
              <div className="text-[0.8125rem]">
                {order.status === 'awaiting_payment'
                  ? 'The OXXO voucher is voided in Stripe so it can no longer be paid, and the reserved pieces go back on sale.'
                  : 'The open Stripe checkout is closed and the reserved pieces go back on sale.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={doCancel} disabled={act.busy} className="a-btn a-btn--danger-solid a-btn--sm">
                {act.busy ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
              <button type="button" onClick={() => setMode(null)} disabled={act.busy} className="a-btn a-btn--ghost a-btn--sm">Keep order</button>
            </div>
          </div>
        </div>
      )}

      {order.refunded > 0 && (
        <p className="text-sm text-white/70">
          Refunded so far <span className="text-white a-num">{formatMoney(order.refunded, cur)}</span> · Left <span className="text-white a-num">{formatMoney(remaining, cur)}</span>
        </p>
      )}

      <ActionMsg msg={act.msg} />
    </section>
  )
}

function NotesCard({ order, onUpdated }) {
  const act = useAction()
  const notesId = useId()
  const serverNotes = order.notes || ''
  const [draft, setDraft] = useState(serverNotes)
  const baseRef = useRef(serverNotes)

  useEffect(() => {
    const base = baseRef.current
    if (serverNotes === base) return
    setDraft((cur) => {
      if (cur === base || cur === serverNotes) return serverNotes
      // El servidor agrega líneas (reembolso, pago tardío) al final. Si había
      // texto sin guardar, se suman al borrador en vez de pisarlo.
      if (serverNotes.startsWith(base)) {
        const added = serverNotes.slice(base.length).trim()
        return [cur.trimEnd(), added].filter(Boolean).join('\n')
      }
      return cur
    })
    baseRef.current = serverNotes
  }, [serverNotes])

  const dirty = draft !== serverNotes

  const save = () => act.run(async () => {
    const res = await updateOrder({ id: order.id, notes: draft })
    onUpdated(res.order)
    return res
  }, 'Notes saved.')

  return (
    <section className="a-card p-5 sm:p-6 space-y-4">
      <SectionHead
        icon={PencilSquareIcon}
        title="Internal notes"
        titleId={notesId}
        right={dirty && <span className="a-badge a-badge--warning">Unsaved</span>}
      />
      <p className="a-help -mt-2">Only you see these. Refunds and late payments are logged here automatically.</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        aria-labelledby={notesId}
        placeholder="Packed with extra stickers, customer asked for gift wrap…"
        className="a-input min-h-[120px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={act.busy || !dirty} className="a-btn a-btn--primary a-btn--sm">
          {act.busy ? 'Saving…' : 'Save notes'}
        </button>
        <ActionMsg msg={act.msg} />
      </div>
    </section>
  )
}

function DownloadsCard({ downloads }) {
  const [copied, setCopied] = useState(null)
  const now = Date.now()

  const copy = async (d) => {
    if (await copyText(d.url)) {
      setCopied(d.id)
      setTimeout(() => setCopied((c) => (c === d.id ? null : c)), 1800)
    }
  }

  return (
    <section className="a-card p-5 sm:p-6 space-y-4">
      <SectionHead icon={CloudArrowDownIcon} title={`Digital downloads (${downloads.length})`} />
      <div className="divide-y divide-white/10">
        {downloads.map((d) => {
          const exp = parseDate(d.expires_at)
          const expired = exp && !Number.isNaN(exp.getTime()) && exp.getTime() < now
          const exhausted = d.max_downloads > 0 && d.downloads >= d.max_downloads
          return (
            <div key={d.id} className="py-3 first:pt-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white break-all">{d.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 a-meta">
                  <span className={exhausted ? 'text-red-300' : ''}>
                    {d.downloads}/{d.max_downloads} downloads
                  </span>
                  <span className={expired ? 'text-red-300' : ''}>
                    {expired ? 'Expired' : 'Expires'} {fmtDate(d.expires_at)}
                  </span>
                </div>
              </div>
              {d.url && (
                <button type="button" onClick={() => copy(d)} className="a-btn a-btn--secondary a-btn--sm shrink-0" title="Copy download link">
                  {copied === d.id
                    ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
                    : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
                  {copied === d.id ? 'Copied' : 'Copy link'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// PIEZAS
// ═══════════════════════════════════════════════════════════════

function SectionHead({ icon: Icon, title, titleId, right }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="w-5 h-5 text-white/50 shrink-0" aria-hidden />
        <h2 id={titleId} className="a-section-title truncate">{title}</h2>
      </div>
      {right || null}
    </div>
  )
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: null }
  return <span className={badgeClass(meta.tone)}>{meta.label}</span>
}

function Badge({ tone = null, icon: Icon, children }) {
  return (
    <span className={badgeClass(tone)}>
      {Icon && <Icon className="w-3 h-3" aria-hidden />}
      {children}
    </span>
  )
}

function TestModeBadge() {
  return (
    <span className="a-badge a-badge--warning" title="Stripe test keys. No real money moves.">
      <BoltIcon className="w-3 h-3" aria-hidden />
      Test mode
    </span>
  )
}

function Kpi({ label, children, onClick, danger = false, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`a-card p-4 text-left ${onClick ? 'a-card--interactive' : ''} ${danger ? 'border-red-500/40 bg-red-500/[0.06]' : ''} ${className}`}
    >
      <div className="a-kicker mb-2">{label}</div>
      {children}
    </Tag>
  )
}

function KpiValue({ value, className = 'text-white' }) {
  return (
    <div className={`text-2xl font-bold a-num ${className}`}>
      {value === undefined || value === null ? '…' : Number(value).toLocaleString()}
    </div>
  )
}

function Thumb({ src }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="a-inset w-12 h-12 overflow-hidden shrink-0 flex items-center justify-center">
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <PhotoIcon className="w-5 h-5 text-white/25" aria-hidden />
      )}
    </div>
  )
}

function ActionMsg({ msg }) {
  if (!msg) return null
  if (msg.ok) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-green-300" role="status">
        <CheckCircleIcon className="w-4 h-4 shrink-0" aria-hidden />
        {msg.text}
      </p>
    )
  }
  return (
    <div className="a-alert a-alert--danger px-3 py-2 text-[0.8125rem]" role="alert">
      <XCircleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <span>{msg.text}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PACKING SLIP
// ═══════════════════════════════════════════════════════════════

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

function packingSlipHtml(order) {
  const es = order.lang !== 'en'
  const lang = es ? 'es' : 'en'
  const t = es
    ? {
      doc: 'Lista de empaque', date: 'Fecha', shipTo: 'Enviar a', method: 'Envío', qty: 'Cant.', item: 'Producto',
      digital: (n) => `+ ${n} ${n === 1 ? 'archivo digital enviado' : 'archivos digitales enviados'} por correo.`,
      thanks: 'Gracias por tu compra. Empacado a mano en México.',
    }
    : {
      doc: 'Packing slip', date: 'Date', shipTo: 'Ship to', method: 'Shipping', qty: 'Qty', item: 'Item',
      digital: (n) => `+ ${n} digital ${n === 1 ? 'item' : 'items'} delivered by email.`,
      thanks: 'Thank you for your order. Packed by hand in Mexico.',
    }
  const items = order.items || []
  const physical = items.filter((i) => i.kind !== 'digital')
  const digitalCount = items.length - physical.length
  const addr = addressLines(order, lang)
  if (order.phone) addr.push(order.phone)
  const brand = (window.location.hostname || '').replace(/^www\./, '')
  const date = String(order.paid_at || order.created_at || '').slice(0, 10)

  const rows = physical.map((i) => `
    <tr>
      <td class="check"><span class="box"></span></td>
      <td class="qty">${escHtml(i.qty)}</td>
      <td>
        <div class="name">${escHtml(i.title)}</div>
        ${i.options ? `<div class="opt">${escHtml(i.options)}</div>` : ''}
        ${i.sku ? `<div class="sku">${escHtml(i.sku)}</div>` : ''}
      </td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escHtml(order.number)} — ${escHtml(t.doc)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { background: #fff; color: #000; }
  body { margin: 0; padding: 28px; font: 14px/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .brand { font-weight: 800; font-size: 18px; }
  .doc { font-size: 13px; color: #333; }
  .right { text-align: right; }
  .num { font-size: 26px; font-weight: 800; line-height: 1.1; }
  .meta { font-size: 13px; color: #333; }
  .cols { display: flex; flex-wrap: wrap; gap: 32px; margin: 22px 0 8px; }
  h2 { font-size: 14px; font-weight: 800; margin: 0 0 6px; }
  .addr { font-size: 15px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { text-align: left; padding: 9px 6px; border-bottom: 1px solid #bbb; vertical-align: top; }
  th { font-size: 12px; font-weight: 800; border-bottom: 2px solid #000; }
  td.check { width: 30px; }
  .box { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #000; margin-top: 2px; }
  td.qty { width: 56px; font-weight: 800; font-size: 16px; }
  .name { font-weight: 700; }
  .opt { color: #333; font-size: 13px; }
  .sku { color: #555; font-size: 11px; font-family: ui-monospace, Consolas, monospace; }
  .note { margin-top: 12px; font-size: 13px; color: #333; }
  .thanks { margin-top: 32px; font-size: 15px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">${escHtml(brand)}</div>
      <div class="doc">${escHtml(t.doc)}</div>
    </div>
    <div class="right">
      <div class="num">${escHtml(order.number)}</div>
      <div class="meta">${escHtml(t.date)}: ${escHtml(date)}</div>
    </div>
  </div>
  <div class="cols">
    <div>
      <h2>${escHtml(t.shipTo)}</h2>
      <div class="addr">${addr.map(escHtml).join('<br>')}</div>
    </div>
    ${order.shipping_method ? `<div><h2>${escHtml(t.method)}</h2><div>${escHtml(order.shipping_method)}</div></div>` : ''}
  </div>
  <table>
    <thead><tr><th></th><th>${escHtml(t.qty)}</th><th>${escHtml(t.item)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${digitalCount ? `<p class="note">${escHtml(t.digital(digitalCount))}</p>` : ''}
  <p class="thanks">${escHtml(t.thanks)}</p>
</body>
</html>`
}

function printPackingSlip(order) {
  const w = window.open('', '_blank', 'width=760,height=900')
  if (!w) return false
  w.document.open()
  w.document.write(packingSlipHtml(order))
  w.document.close()
  w.focus()
  // Un respiro para que el documento termine de pintar antes del diálogo.
  setTimeout(() => w.print(), 250)
  return true
}
