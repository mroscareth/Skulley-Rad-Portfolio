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
  SparklesIcon,
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
  setDisputeHandled,
} from './shopAdminApi.js'
import { getOrdersSeenAt, markOrdersSeen, notifyOrdersChanged } from './ordersAttention.js'

// `tone` es la variante de .a-badge. Magenta = te toca actuar (pagado, por
// empacar); lo que ya no pide nada queda neutro.
const STATUS_META = {
  pending: { label: 'Checkout abierto', tone: null },
  awaiting_payment: { label: 'Esperando pago (OXXO)', tone: 'warning' },
  paid: { label: 'Pagado · por enviar', tone: 'accent' },
  preparing: { label: 'En preparación', tone: 'accent' },
  shipped: { label: 'Enviado', tone: 'info' },
  delivered: { label: 'Entregado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: null },
  expired: { label: 'Vencido', tone: null },
  refunded: { label: 'Reembolsado', tone: null },
}

const TABS = [
  { id: 'to_fulfill', label: 'Por enviar', statuses: ['paid', 'preparing'], empty: 'No hay nada por enviar. Cuando Stripe confirme un pago, el pedido aparece aquí.' },
  { id: 'shipped', label: 'Enviados', statuses: ['shipped'], empty: 'No hay pedidos enviados.' },
  { id: 'delivered', label: 'Entregados', statuses: ['delivered'], empty: 'No hay pedidos entregados.' },
  { id: 'awaiting_payment', label: 'Esperando pago', statuses: ['awaiting_payment'], empty: 'No hay fichas OXXO esperando pago.' },
  { id: 'refunded', label: 'Reembolsados', statuses: ['refunded'], empty: 'No hay pedidos reembolsados.' },
  { id: 'cancelled', label: 'Cancelados', statuses: ['cancelled'], empty: 'No hay pedidos cancelados.' },
  // `all` es el único que incluye checkouts abandonados (pending/expired).
  { id: 'all', label: 'Todos', all: true, empty: 'Todavía no hay pedidos.' },
]

const PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered']
const UNPAID_STATUSES = ['pending', 'awaiting_payment']
const FULFILL_STEPS = ['paid', 'preparing', 'shipped', 'delivered']
const FULFILL_STEP_LABELS = { paid: 'Pagado', preparing: 'En preparación', shipped: 'Enviado', delivered: 'Entregado' }
const PAYMENT_LABELS = { card: 'Tarjeta', oxxo: 'OXXO' }
const LANG_LABELS = { es: 'español', en: 'inglés' }

// En celular los botones chicos crecen a 44 px para el dedo.
const TAP = 'max-sm:min-h-11'
const TAP_ICON = 'max-sm:min-w-11 max-sm:min-h-11'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

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
  order_not_paid: 'Este pedido no está pagado, así que su envío no se puede mover.',
  invalid_status: 'Ese estado solo lo pone Stripe.',
  stripe_error: 'Stripe rechazó la solicitud.',
  already_refunded: 'Este pedido ya está reembolsado por completo.',
  invalid_amount: 'El monto debe ser mayor que 0 y no pasar de lo que falta por reembolsar.',
  not_cancellable: 'Solo se cancelan pedidos sin pagar (checkout abierto o esperando pago).',
  no_payment: 'Este pedido no tiene un pago de Stripe ligado.',
  oxxo_not_refundable: 'Stripe no reembolsa pagos en OXXO. Devuelve el dinero por transferencia y anótalo aquí.',
  not_found: 'No encontramos este pedido.',
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  server_error: 'Algo falló en el servidor. Intenta de nuevo (el detalle queda en el log de PHP).',
  error: 'Algo salió mal. Intenta de nuevo.',
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100
const badgeClass = (tone) => `a-badge${tone ? ` a-badge--${tone}` : ''}`

// Las fechas llegan como 'YYYY-MM-DD HH:MM:SS' en hora del servidor. Se
// arman a mano y se formatean en UTC: así Intl muestra la misma hora que
// guardó el servidor sin correrla de zona (y Safari no tiene que parsear el
// formato con espacio).
const DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
})
const DAY_FMT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtDate = (s) => {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s))
  if (!m) return String(s).replace('T', ' ').slice(0, 16)
  const [, y, mo, d, h, mi] = m
  if (h === undefined) return DAY_FMT.format(new Date(Date.UTC(+y, +mo - 1, +d)))
  return DATE_FMT.format(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)))
}
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
  if (http) return `El servidor no respondió bien (HTTP ${http[1]}).`
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
export default function OrdersPanel({ initialOrderId = null, attention = null }) {
  const [selectedId, setSelectedId] = useState(initialOrderId)
  const [tab, setTab] = useState('to_fulfill')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  // La visita anterior, tomada antes de marcar esta: lo pagado después lleva
  // "Nuevo" en la lista mientras sigas aquí.
  const [seenBefore] = useState(getOrdersSeenAt)
  const markedRef = useRef(false)

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

  // Entrar a Pedidos = ya viste lo que había: los nuevos dejan de contar en
  // la esferita (lo por enviar y las disputas siguen hasta resolverse).
  useEffect(() => {
    markOrdersSeen().then(() => { markedRef.current = true })
  }, [])

  // Si mientras estás aquí entra un pedido (la esferita lo detecta cada
  // minuto), la lista y los números se actualizan solos y queda visto. Con la
  // pestaña en segundo plano se espera a que regreses, para que el "(n)" del
  // título te avise.
  useEffect(() => {
    if (!markedRef.current || !(attention?.new > 0) || document.visibilityState !== 'visible') return
    loadStats()
    setReloadKey((k) => k + 1)
    markOrdersSeen()
  }, [attention, loadStats])

  const onChanged = useCallback(() => {
    loadStats()
    notifyOrdersChanged()
  }, [loadStats])

  if (selectedId) {
    return (
      <OrderDetail
        key={selectedId}
        orderId={selectedId}
        testMode={!!stats?.stripe?.test_mode}
        onClose={() => setSelectedId(null)}
        onChanged={onChanged}
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
      reloadKey={reloadKey}
      seenBefore={seenBefore}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// LISTA
// ═══════════════════════════════════════════════════════════════

function OrdersList({ onOpen, stats, statsError, onRefreshStats, tab, setTab, search, setSearch, page, setPage, reloadKey, seenBefore }) {
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

  useEffect(() => { load() }, [load, reloadKey])

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
    <div className="w-full a-fade-in">
      <header className="a-page-head">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="a-title">Pedidos</h1>
            {stripe?.test_mode && <TestModeBadge />}
          </div>
          <p className="a-subtitle">Stripe cobra; aquí empacas, envías y reembolsas.</p>
        </div>
        <div className="a-page-head__actions justify-end">
          <button
            type="button"
            onClick={() => { load(); onRefreshStats() }}
            className={`a-icon-btn ${TAP_ICON}`}
            aria-label="Actualizar pedidos"
            title="Actualizar"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={ordersExportUrl()}
            download
            className={`a-btn a-btn--secondary ${TAP}`}
            title="Todos los pedidos menos los checkouts abandonados y los cancelados, para contabilidad."
          >
            <ArrowDownTrayIcon className="w-4 h-4" aria-hidden />
            Descargar CSV
          </a>
        </div>
      </header>

      <section className="a-section space-y-6">
        {stripe && !stripe.configured && (
          <div className="a-alert a-alert--danger px-4 py-3" role="alert">
            <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
            <span>Faltan las llaves de Stripe, así que el checkout está apagado.</span>
          </div>
        )}
        {stripe && !stripe.webhook_secret && (
          <div className="a-alert a-alert--warning px-4 py-3">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              Falta el secreto del webhook, así que los pagos no se van a confirmar.
              <span className="block text-[0.8125rem] opacity-80 mt-1">
                Configura <span className="a-code text-inherit">STRIPE_WEBHOOK_SECRET</span>. Los pasos están en Ajustes de la tienda.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi label="Ventas netas del mes" className="col-span-2 lg:col-span-1">
            {stats?.month_sales?.length ? (
              <div className="space-y-3">
                {stats.month_sales.map((s) => (
                  <div key={s.currency}>
                    <div className="text-xl font-bold text-white a-num whitespace-nowrap">{formatMoney(s.net, s.currency)}</div>
                    <div className="a-meta mt-0.5">{plural(s.orders, 'pedido', 'pedidos')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xl font-bold text-white/45">{stats ? '—' : '…'}</span>
            )}
          </Kpi>
          <Kpi label="Por enviar" title="Ver los pedidos por enviar" onClick={() => selectTab('to_fulfill')}>
            <KpiValue value={stats?.to_ship} className={stats?.to_ship > 0 ? 'text-section-quests' : 'text-white'} />
          </Kpi>
          <Kpi label="Esperando pago" title="Ver las fichas OXXO sin pagar" onClick={() => selectTab('awaiting_payment')}>
            <KpiValue value={stats?.awaiting_payment} className={stats?.awaiting_payment > 0 ? 'text-amber-300' : 'text-white'} />
          </Kpi>
          <Kpi label="Disputas abiertas" danger={stats?.disputes > 0}>
            <KpiValue value={stats?.disputes} className={stats?.disputes > 0 ? 'text-red-300' : 'text-white/45'} />
          </Kpi>
        </div>
        {statsError && <p className="text-sm text-red-300">No se pudieron cargar los números. {statsError}</p>}

        {/* Pestañas en su propio renglón: con el buscador al lado no cabían
            las siete y la última se cortaba a media palabra. */}
        <div className="flex flex-col gap-4">
          <div className="a-tabs min-w-0" role="tablist" aria-label="Estado del pedido">
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
                  className={`a-tab ${TAP}`}
                >
                  {t.label}
                  {data && n > 0 && <span className="a-num opacity-60">{n}</span>}
                </button>
              )
            })}
          </div>
          <div className="relative w-full sm:max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 pointer-events-none" aria-hidden />
            <input
              type="text"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número, correo, nombre o guía"
              aria-label="Buscar pedidos"
              className="a-input pl-10 pr-12"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Borrar búsqueda"
                title="Borrar"
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
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b-2 border-white/10">
            <span className="a-meta">
              {current.label} · {plural(total, 'pedido', 'pedidos')}{query ? ` · “${query}”` : ''}
            </span>
            {loading && data && <span className="a-spinner a-spinner--sm" role="status" aria-label="Cargando" />}
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-16">
              <div className="a-spinner" role="status" aria-label="Cargando pedidos" />
            </div>
          ) : orders.length === 0 ? (
            <div className="a-empty border-0 rounded-none px-6">
              {query ? `Ningún pedido de “${current.label}” coincide con “${query}”.` : current.empty}
            </div>
          ) : (
            <>
              <div className={`hidden lg:grid ${ROW_GRID} px-5 py-2.5 border-b-2 border-white/10`} aria-hidden>
                <span className="a-kicker">Pedido</span>
                <span className="a-kicker">Cliente</span>
                <span className="a-kicker">Fecha</span>
                <span className="a-kicker text-right">Total</span>
              </div>
              <div className={`divide-y divide-white/10 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                {orders.map((o) => (
                  <OrderRow key={o.id} order={o} onOpen={onOpen} seenBefore={seenBefore} />
                ))}
              </div>
            </>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t-2 border-white/10">
              <span className="a-meta">Página {page} de {pages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || loading}
                  className={`a-icon-btn a-icon-btn--sm ${TAP_ICON} disabled:opacity-30 disabled:cursor-not-allowed`}
                  aria-label="Página anterior"
                  title="Página anterior"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pages, page + 1))}
                  disabled={page >= pages || loading}
                  className={`a-icon-btn a-icon-btn--sm ${TAP_ICON} disabled:opacity-30 disabled:cursor-not-allowed`}
                  aria-label="Página siguiente"
                  title="Página siguiente"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <FulfillHowTo />
      <OrderRules />
    </div>
  )
}

// Columnas de la lista en escritorio. En celular cada fila se apila:
// número y estado con el total a la derecha, cliente, y fecha con detalle.
const ROW_GRID = 'lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,9rem)_minmax(0,8rem)] lg:gap-x-5'

function OrderRow({ order: o, onOpen, seenBefore }) {
  const who = o.customer_name || o.shipping_name || o.email || '—'
  const country = o.shipping_address?.country
  const items = Number(o.item_count || 0)
  const open = () => onOpen(o.id)
  const where = (o.zone || country) ? `${o.zone || '—'}${country ? ` / ${country}` : ''}` : ''
  // Pagado después de tu visita anterior a Pedidos. Mismo formato de fecha del
  // servidor en los dos lados, así que se comparan como texto.
  const isNew = !!(seenBefore && o.paid_at && o.paid_at > seenBefore && PAID_STATUSES.includes(o.status))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 ${ROW_GRID} lg:items-start px-4 sm:px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-section-quests`}
    >
      <div className="order-1 lg:order-none min-w-0 flex flex-wrap items-center gap-2 lg:flex-col lg:items-start lg:gap-1.5">
        <span className="text-sm font-bold text-white a-num">{o.number || `#${o.id}`}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {isNew && <Badge tone="accent" icon={SparklesIcon}>Nuevo</Badge>}
          <StatusChip status={o.status} />
          <DisputeBadge order={o} />
          {o.golden_ticket && <Badge tone="gold" icon={TicketIcon}>Golden ticket</Badge>}
        </span>
      </div>

      <div className="order-3 col-span-2 lg:order-none lg:col-span-1 min-w-0 text-sm truncate lg:whitespace-normal">
        <span className="text-white/80 lg:block lg:truncate">{who}</span>
        {o.email && who !== o.email && (
          <span className="text-white/45 lg:block lg:truncate lg:mt-1 lg:text-xs">
            <span className="lg:hidden"> · </span>{o.email}
          </span>
        )}
      </div>

      <div className="order-4 col-span-2 lg:order-none lg:col-span-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 a-meta lg:flex-col lg:items-start lg:gap-1">
        <span className="lg:text-[0.8125rem] lg:text-white/70">{fmtDate(o.created_at)}</span>
        <span className="before:content-['·'] before:mr-2 lg:before:content-none lg:before:mr-0">
          {plural(items, 'artículo', 'artículos')}{where ? ` · ${where}` : ''}
        </span>
        {(o.has_physical || o.has_digital) && (
          <span className="flex flex-wrap gap-1.5">
            {o.has_physical && <Badge icon={CubeIcon}>Físico</Badge>}
            {o.has_digital && <Badge icon={CloudArrowDownIcon}>Digital</Badge>}
          </span>
        )}
      </div>

      <div className="order-2 lg:order-none text-right shrink-0">
        <div className="text-sm font-semibold text-white a-num whitespace-nowrap">{formatMoney(o.total, o.currency)}</div>
        {o.refunded > 0 && (
          <div className="a-meta whitespace-nowrap mt-0.5" title="Reembolsado">
            <span className="sr-only">Reembolsado </span>− {formatMoney(o.refunded, o.currency)}
          </div>
        )}
      </div>
    </div>
  )
}

// Ayuda donde surge la duda (heurística 10): el flujo para surtir y las
// consecuencias que no se ven en la pantalla. Cada regla sale del backend
// (shop-orders.php, shop-webhook.php, shop-lib.php, shop-mailer.php).
function FulfillHowTo() {
  const id = useId()
  return (
    <section className="a-section" aria-labelledby={id}>
      <h2 id={id} className="a-section-title">Cómo surtir un pedido</h2>
      <ol className="a-steps mt-4 max-w-3xl">
        <li>
          Cuando Stripe confirma el pago, el pedido aparece en <strong>Por enviar</strong> como Pagado, y llega un
          aviso al correo de notificaciones de la tienda.
        </li>
        <li>
          Ábrelo y, si quieres, márcalo <strong>En preparación</strong> mientras empacas. Imprime la{' '}
          <strong>lista de empaque</strong> para meterla en la caja.
        </li>
        <li>Compra la guía en Envia.com. Copia la dirección desde el pedido: cada línea se copia sola.</li>
        <li>
          Elige la paquetería, pega el <strong>número de guía</strong> y dale a <strong>Marcar como enviado</strong>.
          Con “Avisar al cliente” le llega un correo con su guía.
        </li>
        <li>Cuando la paquetería lo entregue, márcalo <strong>Entregado</strong>.</li>
      </ol>
      <p className="a-help mt-4 max-w-3xl">
        Los pedidos solo digitales no pasan por aquí: al pagarse quedan como Entregado y el cliente recibe sus
        enlaces de descarga por correo.
      </p>
    </section>
  )
}

function OrderRules() {
  const id = useId()
  return (
    <section className="a-section" aria-labelledby={id}>
      <h2 id={id} className="a-section-title">Reglas</h2>
      <ul className="a-rules mt-4 max-w-3xl">
        <li>
          <strong>El número junto a Pedidos</strong> (en el menú y en la pestaña del navegador) cuenta lo que te toca: lo
          que está por enviar, las disputas abiertas y los pedidos pagados desde tu última visita a Pedidos. Lo por enviar
          se quita al marcarlo como enviado; una disputa, con “Ya la atendí”; los nuevos, al entrar aquí. Se revisa cada minuto.
        </li>
        <li><strong>Pagado solo lo pone Stripe</strong>, cuando confirma el cobro. Desde aquí no se puede marcar un pedido como pagado.</li>
        <li>
          <strong>Marcar como enviado</strong> con “Avisar al cliente” le manda un correo con la paquetería, el número de
          guía y el enlace de rastreo. Si después cambias la guía, no se le avisa: usa Reenviar correo de envío.
        </li>
        <li>
          <strong>Un reembolso mueve dinero real</strong> en Stripe y no se puede deshacer. Si es por el total, el pedido
          pasa a Reembolsado. Los pagos en OXXO no se reembolsan desde aquí: devuélvelos por transferencia.
        </li>
        <li>
          <strong>Un pedido sin pagar aparta las piezas</strong>: unos 35 minutos mientras está en el checkout, y mientras
          la ficha OXXO siga vigente (3 días). Al vencer, vuelven solas a la venta. Las existencias se descuentan hasta que se paga.
        </li>
        <li><strong>Solo puedes cancelar pedidos sin pagar.</strong> A un pedido pagado se le reembolsa.</li>
        <li>
          <strong>Si reembolsas desde el panel de Stripe</strong>, aquí se actualiza solo, pero las piezas no regresan a
          existencias.
        </li>
        <li>
          <strong>Si un pago llega después de que venció el apartado</strong>, el pedido se respeta y queda una nota: revisa
          que todavía tengas la pieza.
        </li>
        <li>
          <strong>Una disputa</strong> (contracargo) llega como aviso al correo de notificaciones. Respóndela con evidencia en
          Stripe antes de la fecha límite y luego márcala con “Ya la atendí” en el pedido.
        </li>
      </ul>
    </section>
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
    <button type="button" onClick={onClose} className={`a-icon-btn ${TAP_ICON}`} aria-label="Volver a pedidos" title="Volver a pedidos">
      <ArrowLeftIcon className="w-5 h-5" />
    </button>
  )

  if (!order) {
    return (
      <div className="w-full a-fade-in">
        <header className="a-page-head">
          <div className="flex items-center gap-3">
            {backButton}
            <h1 className="a-title">Pedido</h1>
          </div>
        </header>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="a-spinner" role="status" aria-label="Cargando pedido" />
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
    ['Creado', order.created_at],
    ['Pagado', order.paid_at],
    ['Enviado', order.shipped_at],
    ['Entregado', order.delivered_at],
  ].filter(([, v]) => v)
  if (UNPAID_STATUSES.includes(order.status) && order.expires_at) dates.push(['Apartado hasta', order.expires_at])

  const printSlip = () => {
    setSlipError(printPackingSlip(order) ? null : 'El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio para imprimir.')
  }

  const itemCount = (order.items || []).reduce((a, i) => a + Number(i.qty || 0), 0)
  const buyer = order.customer_name || order.shipping_name || order.email

  return (
    <div className="w-full a-fade-in">
      <header className="a-page-head">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex items-start gap-3">
            {backButton}
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="a-title break-words">{order.number || `#${order.id}`}</h1>
              <p className="a-subtitle break-words">
                {buyer ? `${buyer} · ` : ''}{plural(itemCount, 'artículo', 'artículos')} · {formatMoney(order.total, order.currency)}
              </p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <StatusChip status={order.status} />
                <DisputeBadge order={order} />
                {order.golden_ticket && <Badge tone="gold" icon={TicketIcon}>Golden ticket</Badge>}
                {order.payment_method && <Badge>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Badge>}
                {testMode && <TestModeBadge />}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 a-meta">
                {dates.map(([k, v]) => (
                  <span key={k} className="whitespace-nowrap">
                    {k} <span className="text-white/70">{fmtDate(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={load}
              className={`a-icon-btn a-icon-btn--sm ${TAP_ICON}`}
              aria-label="Volver a cargar el pedido"
              title="Volver a cargar"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {order.stripe_url && (
              <a href={order.stripe_url} target="_blank" rel="noopener noreferrer" className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
                <CreditCardIcon className="w-4 h-4" aria-hidden />
                Ver en Stripe
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
              </a>
            )}
            {order.public_url && (
              <a href={order.public_url} target="_blank" rel="noopener noreferrer" className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
                <UserIcon className="w-4 h-4" aria-hidden />
                Página del cliente
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
              </a>
            )}
            {order.has_physical && (
              <button type="button" onClick={printSlip} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
                <PrinterIcon className="w-4 h-4" aria-hidden />
                Imprimir lista de empaque
              </button>
            )}
          </div>
          {slipError && <p className="text-sm text-red-300 text-right" role="alert">{slipError}</p>}
          {error && (
            <div className="a-alert a-alert--danger px-4 py-3" role="alert">
              <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
      </header>

      {order.dispute && <DisputeNotice key={`d-${order.id}`} order={order} onUpdated={applyUpdate} />}

      <div className="a-section grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-x-10 gap-y-7 items-start pt-7 border-t-2 border-white/10">
        <div className="space-y-7 min-w-0">
          <ItemsCard order={order} />
          {fulfillable && <FulfillmentCard key={`f-${order.id}`} order={order} onUpdated={applyUpdate} />}
          <ActionsCard key={`a-${order.id}`} order={order} testMode={testMode} onUpdated={applyUpdate} />
          {order.downloads?.length > 0 && <DownloadsCard downloads={order.downloads} />}
        </div>
        <div className="space-y-7 min-w-0 max-lg:pt-7 max-lg:border-t-2 max-lg:border-white/10">
          <CustomerCard order={order} />
          <NotesCard key={`n-${order.id}`} order={order} onUpdated={applyUpdate} />
        </div>
      </div>

      <OrderRules />
    </div>
  )
}

function ItemsCard({ order }) {
  const cur = order.currency
  const items = order.items || []
  const rows = [['Subtotal', formatMoney(order.subtotal, cur)]]
  if (order.discount > 0) rows.push([order.discount_label || 'Descuento', `− ${formatMoney(order.discount, cur)}`])
  if (order.has_physical) {
    // Un checkout abierto todavía no sabe qué envío eligió el cliente.
    const ship = order.shipping > 0 ? formatMoney(order.shipping, cur) : order.paid_at ? 'Gratis' : '—'
    rows.push([order.shipping_method ? `Envío · ${order.shipping_method}` : 'Envío', ship])
  }

  return (
    <section className="a-section space-y-4">
      <SectionHead icon={ShoppingBagIcon} title={`Artículos (${items.reduce((a, i) => a + Number(i.qty || 0), 0)})`} />
      <div className="divide-y divide-white/10">
        {items.map((it) => (
          <div key={it.id} className="flex gap-4 py-4 first:pt-0">
            <Thumb src={it.image} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white break-words">{it.title}</div>
              {it.options && <div className="mt-0.5 text-[0.8125rem] text-white/70 break-words">{it.options}</div>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 a-meta">
                {it.sku && <span>SKU <span className="a-code">{it.sku}</span></span>}
                {it.kind === 'digital' && <span>Digital</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="a-meta whitespace-nowrap">{it.qty} × {formatMoney(it.unit_price, cur)}</div>
              <div className="mt-0.5 text-sm text-white a-num whitespace-nowrap">{formatMoney(round2(it.unit_price * it.qty), cur)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 space-y-2 border-t-2 border-white/10 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-white/70 min-w-0 break-words">{k}</span>
            <span className="text-white a-num whitespace-nowrap">{v}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-2 text-base font-bold text-white">
          <span>Total</span>
          <span className="a-num whitespace-nowrap">{formatMoney(order.total, cur)}</span>
        </div>
        {order.refunded > 0 && (
          <>
            <div className="flex justify-between gap-4 text-white/70">
              <span>Reembolsado</span>
              <span className="a-num whitespace-nowrap">− {formatMoney(order.refunded, cur)}</span>
            </div>
            <div className="flex justify-between gap-4 font-semibold text-white">
              <span>Neto</span>
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
    <section className="a-section space-y-4">
      <SectionHead icon={UserIcon} title="Cliente" />
      <div className="space-y-1.5 text-sm">
        <div className="font-semibold text-white">{order.customer_name || '—'}</div>
        {order.email ? (
          <a
            href={`mailto:${order.email}`}
            className="block text-white/70 hover:text-white underline-offset-4 hover:underline break-all transition-colors"
          >
            {order.email}
          </a>
        ) : (
          <div className="a-muted">Sin correo registrado</div>
        )}
        {order.phone && (
          <a href={`tel:${order.phone}`} className="block text-white/70 hover:text-white underline-offset-4 hover:underline transition-colors">
            {order.phone}
          </a>
        )}
        <div className="a-meta pt-1">
          Idioma: {LANG_LABELS[order.lang] || order.lang || '—'} · Zona {order.zone || '—'} · {order.privy_id ? 'Con cuenta' : 'Sin cuenta'}
        </div>
      </div>

      {order.has_physical ? (
        <div className="space-y-3 pt-5 border-t-2 border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-4 h-4 text-white/50" aria-hidden />
              <span className="text-sm font-semibold text-white">Enviar a</span>
            </div>
            {lines.length > 0 && (
              <button type="button" onClick={() => copy(fullAddress, 'all')} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
                {copied === 'all'
                  ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
                  : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
                {copied === 'all' ? 'Copiada' : 'Copiar dirección'}
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
                    title="Copiar esta línea"
                    aria-label={`Copiar “${l}”`}
                    className={`group w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm text-white hover:bg-white/[0.06] transition-colors ${TAP}`}
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
              <p className="a-help">Toca una línea para copiar solo ese dato. Sirve para llenar la guía en Envia.com.</p>
            </>
          ) : (
            <p className="a-help">La dirección aparece cuando el cliente termina el checkout.</p>
          )}
          {order.shipping_method && (
            <div className="a-meta">Envío elegido: <span className="text-white/70">{order.shipping_method}</span></div>
          )}
        </div>
      ) : (
        <p className="a-help">Solo digital. No hay nada que enviar.</p>
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
  const missing = !carrier ? 'Elige una paquetería' : !number ? 'Escribe el número de guía' : null
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
  }, (res) => (res?.notified ? `Enviado. Se le avisó a ${order.email}.` : 'Enviado. No se mandó ningún correo.'))

  const saveTracking = () => act.run(async () => {
    const res = await updateOrder({
      id: order.id,
      carrier,
      tracking_number: number,
      tracking_url: trackingUrl.trim(),
    })
    onUpdated(res.order)
    return res
  }, 'Guía guardada.')

  return (
    <section className="a-section space-y-5">
      <SectionHead icon={TruckIcon} title="Envío" />
      <FulfillmentSteps status={status} />

      {status === 'paid' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={() => setStatus('preparing', 'Marcado en preparación.')} disabled={act.busy} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
            <CubeIcon className="w-4 h-4" aria-hidden />
            Marcar en preparación
          </button>
          <span className="a-help">Opcional. Puedes enviarlo directo desde Pagado.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        <label className="block">
          <span className="a-label">Paquetería</span>
          <select
            value={carrierSel}
            onChange={(e) => setCarrierSel(e.target.value)}
            className="a-input"
          >
            <option value="">Elige una paquetería</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER_CARRIER}>Otra…</option>
          </select>
        </label>
        <label className="block">
          <span className="a-label">Número de guía</span>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Pégalo de Envia.com"
            autoComplete="off"
            className="a-input"
          />
        </label>
        {carrierSel === OTHER_CARRIER && (
          <label className="block sm:col-span-2">
            <span className="a-label">Nombre de la paquetería</span>
            <input
              type="text"
              value={carrierOther}
              onChange={(e) => setCarrierOther(e.target.value)}
              placeholder="p. ej. J&T Express"
              maxLength={60}
              className="a-input"
            />
          </label>
        )}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <label htmlFor={urlInputId} className="a-label mb-0">
              Enlace de rastreo{urlAuto && suggestion ? <span className="font-normal text-white/45"> · automático</span> : null}
            </label>
            {!urlAuto && suggestion && trackingUrl.trim() !== suggestion && (
              <button type="button" onClick={() => setUrlAuto(true)} className="a-btn a-btn--ghost a-btn--sm -my-1">
                Usar el de {carrierSel}
              </button>
            )}
          </div>
          <input
            id={urlInputId}
            type="url"
            value={trackingUrl}
            onChange={(e) => { setTrackingUrl(e.target.value); setUrlAuto(false) }}
            placeholder={template ? 'Se llena solo con el número de guía' : 'Pega el enlace de rastreo (opcional)'}
            className="a-input"
          />
        </div>
      </div>

      {canShip && (
        <div className="space-y-4 pt-1">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="a-checkbox mt-0.5 shrink-0"
            />
            <span className="text-sm font-semibold text-white">
              Avisar al cliente
              <span className="block a-help font-normal mt-1">
                {order.email
                  ? `Le manda un correo a ${order.email} con la paquetería, el número de guía y el enlace de rastreo.`
                  : 'No hay correo registrado, así que no se manda nada.'}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {missing && <span className="a-help">{missing} para enviarlo.</span>}
            <button type="button" onClick={ship} disabled={act.busy || !!missing} className={`a-btn a-btn--primary ${TAP}`}>
              <TruckIcon className="w-4 h-4" aria-hidden />
              {act.busy ? 'Guardando…' : 'Marcar como enviado'}
            </button>
          </div>
        </div>
      )}

      {shippedOrLater && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={saveTracking}
              disabled={act.busy || !trackingChanged || !!missing}
              className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
            >
              <PencilSquareIcon className="w-4 h-4" aria-hidden />
              Guardar guía
            </button>
            {status === 'shipped' && (
              <button
                type="button"
                onClick={() => setStatus('delivered', 'Marcado como entregado.')}
                disabled={act.busy}
                className={`a-btn a-btn--primary a-btn--sm ${TAP}`}
              >
                {act.busy ? 'Guardando…' : 'Marcar como entregado'}
              </button>
            )}
          </div>
          <p className="a-help sm:text-right">Cambiar la guía no le avisa al cliente. Después de guardar, usa Reenviar correo de envío.</p>
        </div>
      )}

      <ActionMsg msg={act.msg} />
    </section>
  )
}

function FulfillmentSteps({ status }) {
  const current = FULFILL_STEPS.indexOf(status)
  return (
    <ol className="flex items-center flex-wrap gap-x-2 gap-y-2 text-xs font-semibold" aria-label="Avance del envío">
      {FULFILL_STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
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
  }, `Reembolso de ${amountMoney} hecho.${doRestock ? ' Las piezas regresaron a existencias.' : ''}`)

  const doCancel = () => act.run(async () => {
    const fresh = await cancelOrder(order.id)
    onUpdated(fresh)
    setMode(null)
    return fresh
  }, 'Pedido cancelado. Las piezas apartadas volvieron a la venta.')

  const resend = (type) => {
    const what = type === 'confirmation' ? 'de confirmación' : 'de envío'
    return act.run(
      () => resendOrderEmail(order.id, type),
      (res) => (res?.sent ? `Correo ${what} enviado a ${order.email}.` : `No se pudo mandar el correo ${what}. Revisa la configuración de SMTP y el log de PHP.`),
    )
  }

  const nothingToDo = !paid && !canRefund && !canCancel && !canResendShipped

  return (
    <section className="a-section space-y-4">
      <SectionHead icon={BoltIcon} title="Acciones" />

      {/* Lo destructivo va a la izquierda (mr-auto), nunca junto a una acción
          principal; los reenvíos de correo quedan a la derecha. */}
      {nothingToDo ? (
        <p className="a-help">No hay nada que hacer con este pedido ({STATUS_META[order.status]?.label || order.status}).</p>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canRefund && mode === null && (
            <button type="button" onClick={openRefund} disabled={act.busy} className={`a-btn a-btn--danger a-btn--sm mr-auto ${TAP}`}>
              <ReceiptRefundIcon className="w-4 h-4" aria-hidden />
              Reembolsar
            </button>
          )}
          {canCancel && mode === null && (
            <button type="button" onClick={() => { setMode('cancel'); act.setMsg(null) }} disabled={act.busy} className={`a-btn a-btn--danger a-btn--sm mr-auto ${TAP}`}>
              <XCircleIcon className="w-4 h-4" aria-hidden />
              Cancelar pedido
            </button>
          )}
          {paid && (
            <button type="button" onClick={() => resend('confirmation')} disabled={!hasEmail || act.busy} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
              <EnvelopeIcon className="w-4 h-4" aria-hidden />
              Reenviar confirmación
            </button>
          )}
          {canResendShipped && (
            <button type="button" onClick={() => resend('shipped')} disabled={!hasEmail || act.busy} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
              <TruckIcon className="w-4 h-4" aria-hidden />
              Reenviar correo de envío
            </button>
          )}
        </div>
      )}
      {(paid || canResendShipped) && !hasEmail && <p className="a-help">No hay correo registrado, así que no se pueden mandar correos.</p>}

      {mode === 'refund' && (
        <div className="a-inset p-4 sm:p-5 space-y-5">
          <label className="block">
            <span className="a-label">Monto ({cur})</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="a-input w-36 a-num"
              />
              <button type="button" onClick={() => setAmount(remaining.toFixed(2))} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>
                Máximo {formatMoney(remaining, cur)}
              </button>
            </div>
          </label>
          {String(amount).trim() !== '' && !amountValid && (
            <p className="text-sm text-red-300" role="alert">Escribe un monto entre 0.01 y {remaining.toFixed(2)}.</p>
          )}
          {order.has_physical && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="a-checkbox mt-0.5 shrink-0" />
              <span className="text-sm font-semibold text-white">
                Regresar a existencias
                <span className="block a-help font-normal mt-1">
                  Regresa a existencias todas las piezas físicas de este pedido. Desmárcalo si la pieza no regresó.
                </span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => setMode(null)} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>Cerrar</button>
            <button type="button" onClick={() => setMode('refund_confirm')} disabled={!amountValid} className={`a-btn a-btn--primary a-btn--sm ${TAP}`}>
              Revisar reembolso
            </button>
          </div>
        </div>
      )}

      {mode === 'refund_confirm' && (
        <div className="a-alert a-alert--danger p-4 sm:p-5" role="group" aria-label="Confirmar reembolso">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1.5">
              <div className="font-semibold text-white">
                ¿Reembolsar <span className="a-num">{amountMoney}</span> a {order.customer_name || order.email || 'el cliente'}?
              </div>
              <div className="text-[0.8125rem]">
                Esto le regresa dinero real a su tarjeta a través de Stripe y no se puede deshacer.
                {testMode && ' Modo de prueba: no se mueve dinero real.'}
              </div>
              <div className="text-[0.8125rem] opacity-80">
                {amountCents < remainingCents ? 'Reembolso parcial' : 'Reembolso total. El estado cambia a Reembolsado'} · Regresar a existencias: {doRestock ? 'sí' : 'no'}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => setMode('refund')} disabled={act.busy} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>Volver</button>
              <button type="button" onClick={doRefund} disabled={act.busy} className={`a-btn a-btn--danger-solid a-btn--sm ${TAP}`}>
                {act.busy ? 'Reembolsando…' : `Reembolsar ${amountMoney}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="a-alert a-alert--danger p-4 sm:p-5" role="group" aria-label="Confirmar cancelación">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1.5">
              <div className="font-semibold text-white">¿Cancelar {order.number}?</div>
              <div className="text-[0.8125rem]">
                {order.status === 'awaiting_payment'
                  ? 'La ficha OXXO se anula en Stripe para que ya no se pueda pagar, y las piezas apartadas vuelven a la venta.'
                  : 'Se cierra el checkout abierto en Stripe y las piezas apartadas vuelven a la venta.'}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => setMode(null)} disabled={act.busy} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>No cancelar</button>
              <button type="button" onClick={doCancel} disabled={act.busy} className={`a-btn a-btn--danger-solid a-btn--sm ${TAP}`}>
                {act.busy ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {order.refunded > 0 && (
        <p className="text-sm text-white/70">
          Ya reembolsado: <span className="text-white a-num">{formatMoney(order.refunded, cur)}</span> · Queda: <span className="text-white a-num">{formatMoney(remaining, cur)}</span>
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
  }, 'Notas guardadas.')

  return (
    <section className="a-section space-y-4">
      <SectionHead
        icon={PencilSquareIcon}
        title="Notas internas"
        titleId={notesId}
        right={dirty && <span className="a-badge a-badge--warning">Sin guardar</span>}
      />
      <p className="a-help -mt-1">El cliente no las ve. Los reembolsos y los pagos tardíos se anotan aquí solos.</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        aria-labelledby={notesId}
        placeholder="Va con stickers extra, el cliente pidió envoltura de regalo…"
        className="a-input min-h-[120px]"
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ActionMsg msg={act.msg} />
        <button type="button" onClick={save} disabled={act.busy || !dirty} className={`a-btn a-btn--primary a-btn--sm ${TAP}`}>
          {act.busy ? 'Guardando…' : 'Guardar notas'}
        </button>
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
    <section className="a-section space-y-4">
      <SectionHead icon={CloudArrowDownIcon} title={`Descargas digitales (${downloads.length})`} />
      <div className="divide-y divide-white/10">
        {downloads.map((d) => {
          const exp = parseDate(d.expires_at)
          const expired = exp && !Number.isNaN(exp.getTime()) && exp.getTime() < now
          const exhausted = d.max_downloads > 0 && d.downloads >= d.max_downloads
          return (
            <div key={d.id} className="py-4 first:pt-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white break-all">{d.name}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 a-meta">
                  <span className={exhausted ? 'text-red-300' : ''}>
                    {d.downloads}/{d.max_downloads} descargas
                  </span>
                  <span className={expired ? 'text-red-300' : ''}>
                    {expired ? 'Venció' : 'Vence'} {fmtDate(d.expires_at)}
                  </span>
                </div>
              </div>
              {d.url && (
                <button type="button" onClick={() => copy(d)} className={`a-btn a-btn--secondary a-btn--sm shrink-0 ${TAP}`} title="Copiar enlace de descarga">
                  {copied === d.id
                    ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
                    : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
                  {copied === d.id ? 'Copiado' : 'Copiar enlace'}
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
    <div className="flex items-center justify-between gap-3">
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

// Abierta = te toca responder en Stripe; atendida = solo queda constancia.
function DisputeBadge({ order }) {
  if (!order.dispute) return null
  return order.dispute_open
    ? <Badge tone="danger" icon={ShieldExclamationIcon}>Disputa</Badge>
    : <Badge icon={ShieldExclamationIcon}>Disputa atendida</Badge>
}

// La disputa se responde en Stripe; aquí solo se marca como atendida para que
// deje de contar en la esferita de Pedidos. Se puede regresar (H03): si te
// equivocaste, o si quieres tenerla presente hasta que Stripe la cierre.
function DisputeNotice({ order, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const open = !!order.dispute_open

  const toggle = async () => {
    setBusy(true)
    setErr(null)
    try {
      onUpdated(await setDisputeHandled(order.id, open))
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`a-alert ${open ? 'a-alert--danger' : ''} flex-wrap px-4 py-3 mb-8`} role={open ? 'alert' : undefined}>
      <ShieldExclamationIcon className="w-5 h-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        {open
          ? 'Este pago tiene una disputa (contracargo). Respóndela con evidencia en Stripe antes de la fecha límite. Cuando la hayas atendido, márcala para que deje de contar en Pedidos.'
          : 'Este pago tuvo una disputa y ya la marcaste como atendida. Si Stripe abre otra, vuelve a aparecer aquí.'}
        {order.stripe_url && (
          <a
            href={order.stripe_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 font-semibold text-white underline underline-offset-4 decoration-white/40 hover:decoration-white"
          >
            Abrir el pago
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden />
          </a>
        )}
        {err && <p className="mt-1.5 text-red-300" role="alert">{err}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`a-btn a-btn--sm ${open ? 'a-btn--primary' : 'a-btn--secondary'} ml-auto shrink-0 ${TAP}`}
      >
        {open && <CheckIcon className="w-4 h-4" aria-hidden />}
        {open ? 'Ya la atendí' : 'Marcar como pendiente'}
      </button>
    </div>
  )
}

function TestModeBadge() {
  return (
    <span className="a-badge a-badge--warning" title="Llaves de prueba de Stripe. No se mueve dinero real.">
      <BoltIcon className="w-3 h-3" aria-hidden />
      Modo de prueba
    </span>
  )
}

function Kpi({ label, title, children, onClick, danger = false, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`a-card p-4 sm:p-5 text-left ${onClick ? 'a-card--interactive' : ''} ${danger ? 'border-red-500/40 bg-red-500/[0.06]' : ''} ${className}`}
    >
      <div className="a-kicker mb-3">{label}</div>
      {children}
    </Tag>
  )
}

function KpiValue({ value, className = 'text-white' }) {
  return (
    <div className={`text-2xl font-bold a-num ${className}`}>
      {value === undefined || value === null ? '…' : Number(value).toLocaleString('es-MX')}
    </div>
  )
}

function Thumb({ src }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="a-thumb w-14 grid place-items-center">
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
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
      <p className="flex items-center gap-2 text-sm text-green-300" role="status">
        <CheckCircleIcon className="w-4 h-4 shrink-0" aria-hidden />
        {msg.text}
      </p>
    )
  }
  return (
    <div className="a-alert a-alert--danger px-4 py-3 text-[0.8125rem]" role="alert">
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
