/**
 * Ajustes de la tienda — Stripe, checkout, categorías y zonas de envío.
 *
 * Cada sección guarda por separado: un país mal escrito en zonas no debe
 * impedir cerrar la tienda en un apuro.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Bars3Icon,
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  GlobeAmericasIcon,
  PlusIcon,
  ShoppingBagIcon,
  TagIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import {
  getSettings,
  saveSettings,
  listCategories,
  saveCategories,
  listZones,
  saveZones,
} from './shopAdminApi.js'

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded',
  'charge.dispute.created',
]

const LATAM_PRESET = ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PE', 'PY', 'SV', 'UY']
// Stripe Checkout acepta como máximo 5 shipping_options por sesión.
const MAX_RATES = 5
const CURRENCIES = ['MXN', 'USD']

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/
const HEX6_RE = /^#[0-9a-fA-F]{6}$/
const MONEY_RE = /^\d+([.,]\d{1,2})?$/
const INT_RE = /^\d+$/

const ERROR_MESSAGES = {
  invalid_email: 'El correo de notificaciones no es un correo válido.',
  invalid_zone_code: 'El código de una zona está vacío o ya lo usa otra zona.',
  invalid_currency: 'La moneda debe ser MXN o USD.',
  countries_required: 'Agrega al menos un país.',
  invalid_country: 'Stripe Checkout no envía a uno de estos países. Quítalo.',
  country_in_two_zones: 'Un país solo puede estar en una zona.',
  rates_required: 'Agrega al menos una tarifa con monto.',
  invalid_price: 'Los montos deben ser números de 0 o más.',
  invalid_number: 'Los días deben ser números enteros.',
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  server_error: 'Algo falló en el servidor. Intenta de nuevo (el detalle queda en el log de PHP).',
  error: 'Algo salió mal. Intenta de nuevo.',
}

// En celular los botones chicos crecen a 44 px para el dedo.
const TAP = 'max-sm:min-h-11'
const TAP_ICON = 'max-sm:min-w-11 max-sm:min-h-11'

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

let keySeq = 0
const newKey = (prefix) => `${prefix}-new-${Date.now().toString(36)}-${++keySeq}`
const numStr = (v) => (v === null || v === undefined ? '' : String(v))
const withoutKey = (obj, key) => {
  if (!obj[key]) return obj
  const next = { ...obj }
  delete next[key]
  return next
}
const toNumber = (v) => Number(String(v).trim().replace(',', '.'))
const toIntOrNull = (v) => (String(v).trim() === '' ? null : parseInt(String(v).trim(), 10))

function countryLabel(code) {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' }).of(code) || null
  } catch {
    return null
  }
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

function useSave() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const run = useCallback(async (fn) => {
    setSaving(true)
    setError(null)
    setOk(false)
    clearTimeout(timer.current)
    try {
      await fn()
      setOk(true)
      timer.current = setTimeout(() => setOk(false), 2500)
      return true
    } catch (e) {
      setError(errorText(e))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { saving, error, ok, run, setError }
}

// ═══════════════════════════════════════════════════════════════

// `onBack` ya no se usa: es vista de nivel superior y la navegación vive en
// la barra lateral del CMS.
export default function StoreSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [data, setData] = useState(null)
  const [stripe, setStripe] = useState(null)
  const [rechecking, setRechecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [s, categories, zones] = await Promise.all([getSettings(), listCategories(), listZones()])
      setData({ settings: s.settings, categories, zones })
      setStripe(s.stripe)
    } catch (e) {
      setLoadError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Solo relee el estado de Stripe: no debe tirar lo que se esté editando abajo.
  const recheckStripe = async () => {
    setRechecking(true)
    try {
      const s = await getSettings()
      setStripe(s.stripe)
    } catch (e) {
      setLoadError(errorText(e))
    } finally {
      setRechecking(false)
    }
  }

  return (
    <div className="w-full a-fade-in">
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Ajustes de la tienda</h1>
          <p className="a-subtitle">Stripe, checkout, categorías y zonas de envío. Cada sección se guarda por separado.</p>
        </div>
      </header>

      {loadError && (
        <div className="a-alert a-alert--danger px-4 py-3 items-center flex-wrap mb-6" role="alert">
          <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <span className="flex-1 min-w-[12rem]">{loadError}</span>
          {!data && (
            <button type="button" onClick={load} className={`a-btn a-btn--secondary a-btn--sm shrink-0 ${TAP}`}>Reintentar</button>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Cargando ajustes" />
        </div>
      ) : data ? (
        <>
          {stripe && <StripeSection stripe={stripe} onRecheck={recheckStripe} rechecking={rechecking} />}
          <CheckoutSection
            initial={data.settings}
            stripeConfigured={!!stripe?.configured}
            onSaved={(res) => res?.stripe && setStripe(res.stripe)}
          />
          <CategoriesSection initial={data.categories} />
          <ZonesSection initial={data.zones} />
          <StoreRules />
        </>
      ) : null}
    </div>
  )
}

// Ayuda donde surge la duda (heurística 10): lo que pasa al guardar y no se
// ve en esta pantalla. Cada regla sale de shop-checkout.php, shop.php,
// shop-admin.php, shop-lib.php o src/lib/shopDataContext.jsx.
function StoreRules() {
  const id = useId()
  return (
    <section className="a-section" aria-labelledby={id}>
      <h2 id={id} className="a-section-title">Reglas</h2>
      <ul className="a-rules mt-4 max-w-3xl">
        <li>
          <strong>Apagar el checkout</strong> cierra la tienda al momento: los productos se siguen viendo, pero nadie puede
          empezar a pagar. Quien ya estaba pagando en Stripe sí puede terminar.
        </li>
        <li>
          <strong>La zona decide la moneda.</strong> Por ejemplo, México paga en MXN, y Estados Unidos y Latinoamérica en
          USD. Un producto sin precio en la moneda de una zona no se muestra en esa zona.
        </li>
        <li>
          <strong>Un país solo puede estar en una zona</strong>, y el cliente solo puede poner una dirección de envío de los
          países de su zona.
        </li>
        <li>
          <strong>Una zona inactiva</strong> desaparece del selector de región y sus países no pueden pagar. Eliminarla
          tiene el mismo efecto en cuanto guardas.
        </li>
        <li>
          <strong>Envío gratis:</strong> cuando el subtotal (ya con el descuento del golden ticket) llega al monto, la
          primera tarifa sale gratis. Los códigos de descuento no cuentan, porque Stripe los aplica después.
        </li>
        <li>
          <strong>Los días de entrega</strong> solo se muestran en el checkout si pones mínimo y máximo. Son días hábiles.
        </li>
        <li>
          <strong>Eliminar una categoría</strong> deja sus productos sin categoría. Una categoría sin nada a la venta en
          una región no se muestra ahí.
        </li>
        <li>
          <strong>El tope de descargas</strong> se cuenta por comprador y por archivo en las últimas 24 horas; cambiarlo aplica de inmediato.
        </li>
      </ul>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// STRIPE
// ═══════════════════════════════════════════════════════════════

function StripeSection({ stripe, onRecheck, rechecking }) {
  const [copied, setCopied] = useState(null)
  const webhookUrl = stripe.webhook_url || ''
  const publicHttps = /^https:\/\//i.test(webhookUrl)
  const dashboard = `https://dashboard.stripe.com/${stripe.test_mode ? 'test/' : ''}webhooks`

  const copy = async (text, key) => {
    if (await copyText(text)) {
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    }
  }

  return (
    <section className="a-section space-y-6">
      <SectionHeader icon={CreditCardIcon} title="Stripe">
        {stripe.test_mode && <TestModeBadge />}
        <button type="button" onClick={onRecheck} disabled={rechecking} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
          <ArrowPathIcon className={`w-4 h-4 ${rechecking ? 'animate-spin' : ''}`} aria-hidden />
          {rechecking ? 'Revisando…' : 'Revisar otra vez'}
        </button>
      </SectionHeader>

      <div className="space-y-4">
        <dl className="space-y-3">
          <StatusLine
            ok={stripe.configured}
            label="Llave secreta"
            okText="Configurada"
            badText="Falta, así que el checkout está apagado"
          />
          {stripe.configured && (
            <StatusLine
              ok
              warn={stripe.test_mode}
              label="Modo"
              okText={stripe.test_mode
                ? <>Prueba (<span className="a-code text-inherit">sk_test_</span>): no se cobra de verdad</>
                : 'En vivo: cobros reales'}
            />
          )}
          <StatusLine
            ok={stripe.webhook_secret}
            label="Secreto del webhook"
            okText="Configurado"
            badText="Falta, así que los pagos no se confirman"
          />
        </dl>
        <p className="a-help">
          Las llaves viven en <span className="a-code">public/api/config.local.php</span> como{' '}
          <span className="a-code">STRIPE_SECRET_KEY</span> y <span className="a-code">STRIPE_WEBHOOK_SECRET</span>.
        </p>
      </div>

      <div className="space-y-2">
        <span className="a-label mb-0">URL del webhook</span>
        <div className="flex items-center gap-3">
          <div className="a-input flex-1 min-w-0 break-all select-all">
            <span className="a-code text-white">{webhookUrl || '—'}</span>
          </div>
          <button
            type="button"
            onClick={() => copy(webhookUrl, 'url')}
            disabled={!webhookUrl}
            className={`a-btn a-btn--secondary a-btn--sm shrink-0 ${TAP}`}
          >
            {copied === 'url'
              ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
              : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
            {copied === 'url' ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        {!publicHttps && (
          <div className="a-alert a-alert--warning px-4 py-3 text-[0.8125rem]">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span className="min-w-0">
              <span className="a-code text-inherit">SITE_URL</span> en la config no es una URL pública con HTTPS, así que Stripe no puede llegar a este webhook.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="a-label mb-0">Eventos que hay que activar</span>
          <button type="button" onClick={() => copy(WEBHOOK_EVENTS.join('\n'), 'events')} className={`a-btn a-btn--ghost a-btn--sm -my-1 ${TAP}`}>
            {copied === 'events'
              ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
              : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
            {copied === 'events' ? 'Copiados' : 'Copiar todos'}
          </button>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <li key={ev} className="break-all">
              <span className="a-code text-white/80">{ev}</span>
            </li>
          ))}
        </ul>
        <a
          href={dashboard}
          target="_blank"
          rel="noopener noreferrer"
          className={`a-btn a-btn--secondary a-btn--sm mt-1 ${TAP}`}
        >
          Stripe → Desarrolladores → Webhooks
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
        </a>
      </div>

      {/* Solo mientras falte el secreto: ya conectado, los pasos sobran. */}
      {!stripe.webhook_secret && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Cómo conectar el webhook</h3>
          <ol className="a-steps max-w-3xl">
            <li>Abre <strong>Stripe → Desarrolladores → Webhooks</strong> y agrega un destino con la URL de arriba.</li>
            <li>Activa los {WEBHOOK_EVENTS.length} eventos de la lista. Con “Copiar todos” los tienes a la mano.</li>
            <li>
              Copia el secreto de firma del destino (empieza con <span className="a-code">whsec_</span>) a{' '}
              <span className="a-code">config.local.php</span> como <span className="a-code">STRIPE_WEBHOOK_SECRET</span>.
            </li>
            <li>Dale a <strong>Revisar otra vez</strong>: el secreto del webhook debe decir Configurado.</li>
          </ol>
        </div>
      )}
    </section>
  )
}

function StatusLine({ ok, warn = false, label, okText, badText }) {
  const Icon = !ok ? XCircleIcon : warn ? BoltIcon : CheckCircleIcon
  const iconColor = !ok ? 'text-red-400' : warn ? 'text-amber-300' : 'text-green-400'
  const textColor = !ok ? 'text-red-300' : warn ? 'text-amber-200' : 'text-white/80'
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3 text-sm">
      <dt className="flex items-center gap-2.5 sm:w-44 shrink-0 text-white/45">
        <Icon className={`w-[1.125rem] h-[1.125rem] shrink-0 ${iconColor}`} aria-hidden />
        {label}
      </dt>
      <dd className={`min-w-0 pl-7 sm:pl-0 ${textColor}`}>{ok ? okText : badText}</dd>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════════

const settingsToForm = (s) => ({
  checkout_enabled: s?.checkout_enabled === '1',
  allow_promo_codes: s?.allow_promo_codes === '1',
  notify_email: s?.notify_email || '',
  download_max: numStr(s?.download_max ?? '5'),
})

function CheckoutSection({ initial, stripeConfigured, onSaved }) {
  const [form, setForm] = useState(() => settingsToForm(initial))
  const [saved, setSaved] = useState(() => settingsToForm(initial))
  const sv = useSave()
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const save = () => {
    const max = String(form.download_max).trim()
    if (!INT_RE.test(max) || Number(max) < 1 || Number(max) > 100) return sv.setError('Las descargas por archivo al día deben ser de 1 a 100.')
    sv.run(async () => {
      const res = await saveSettings({
        checkout_enabled: form.checkout_enabled,
        allow_promo_codes: form.allow_promo_codes,
        notify_email: form.notify_email.trim(),
        download_max: Number(max),
      })
      const next = settingsToForm(res.settings)
      setForm(next)
      setSaved(next)
      onSaved?.(res)
    })
  }

  return (
    <section className="a-section space-y-6">
      <SectionHeader icon={ShoppingBagIcon} title="Checkout">
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      <Toggle on={form.checkout_enabled} onChange={(v) => set({ checkout_enabled: v })} label="Checkout activo">
        <p className={`text-[0.8125rem] mt-1 ${form.checkout_enabled ? 'text-green-300' : 'text-amber-200'}`}>
          {form.checkout_enabled ? 'La tienda está abierta: los clientes pueden pagar.' : 'La tienda está cerrada: los productos se siguen viendo, pero nadie puede pagar.'}
        </p>
        {!stripeConfigured && (
          <p className="text-[0.8125rem] text-red-300 mt-1">Faltan las llaves de Stripe, así que el checkout sigue apagado de todos modos.</p>
        )}
      </Toggle>

      <Toggle on={form.allow_promo_codes} onChange={(v) => set({ allow_promo_codes: v })} label="Permitir códigos de descuento">
        <p className="a-help mt-1">
          Los clientes los escriben en el checkout de Stripe. Se crean en Códigos de descuento. No se combinan con el golden ticket en la misma compra.
        </p>
      </Toggle>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5 pt-1">
        <Field
          className="sm:col-span-3"
          label="Correo de notificaciones"
          type="email"
          value={form.notify_email}
          onChange={(v) => set({ notify_email: v })}
          placeholder="Vacío usa el del sitio (TO_EMAIL)"
          hint="Aquí llegan los avisos de pedidos nuevos y de disputas."
        />
        <Field
          label="Descargas por archivo al día"
          inputMode="numeric"
          value={form.download_max}
          onChange={(v) => set({ download_max: v.replace(/\D/g, '') })}
          placeholder="5"
          hint="Cuántas veces cada comprador puede bajar cada archivo en 24 horas."
        />
        <p className="a-help sm:col-span-2">
          Lo digital solo se compra con sesión y solo se baja desde Mi cuenta → Descargas. Cada descarga usa un enlace que sirve una vez y dura 5 minutos, y el archivo lleva los datos del comprador.
        </p>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════════════════

const catToDraft = (c) => ({
  _key: `cat-${c.id}`,
  id: c.id,
  slug: c.slug || '',
  name_en: c.name_en || '',
  name_es: c.name_es || '',
  color: c.color || '#e600ff',
})
const catsSnapshot = (rows) => JSON.stringify(rows.map(({ _key, ...r }) => r))

function CategoriesSection({ initial }) {
  const [rows, setRows] = useState(() => initial.map(catToDraft))
  const [snapshot, setSnapshot] = useState(() => catsSnapshot(initial.map(catToDraft)))
  const [rowErrors, setRowErrors] = useState({})
  const [confirmKey, setConfirmKey] = useState(null)
  const sv = useSave()
  const dirty = catsSnapshot(rows) !== snapshot

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const update = (key, patch) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)))
    setRowErrors((prev) => withoutKey(prev, key))
  }
  const remove = (key) => {
    setRows((prev) => prev.filter((r) => r._key !== key))
    setConfirmKey(null)
  }
  const add = () => setRows((prev) => [...prev, { _key: newKey('cat'), id: null, slug: '', name_en: '', name_es: '', color: '#e600ff' }])

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const from = prev.findIndex((r) => r._key === active.id)
      const to = prev.findIndex((r) => r._key === over.id)
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to)
    })
  }

  const save = () => {
    // El backend descarta en silencio una categoría sin nombre, y eso la
    // borraría dejando sus productos sin categoría. Se frena aquí.
    const errs = {}
    rows.forEach((r) => {
      const e = []
      if (!r.name_en.trim() && !r.name_es.trim()) e.push('Ponle nombre en al menos un idioma.')
      if (!HEX_RE.test(r.color.trim())) e.push('El color debe ser un valor hex, como #e600ff.')
      if (e.length) errs[r._key] = e
    })
    setRowErrors(errs)
    if (Object.keys(errs).length) return sv.setError('Corrige las categorías marcadas en rojo.')

    sv.run(async () => {
      const saved = await saveCategories(rows.map((r) => ({
        id: r.id || undefined,
        slug: r.slug || '',
        name_en: r.name_en.trim(),
        name_es: r.name_es.trim(),
        color: r.color.trim(),
      })))
      const next = saved.map(catToDraft)
      setRows(next)
      setSnapshot(catsSnapshot(next))
    })
  }

  return (
    <section className="a-section space-y-5">
      <SectionHeader icon={TagIcon} title="Categorías">
        <button type="button" onClick={add} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
          <PlusIcon className="w-4 h-4" aria-hidden />
          Agregar categoría
        </button>
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      <p className="a-help -mt-1">
        Arrastra para cambiar el orden: así aparecen en la tienda. El identificador se crea la primera vez que guardas y ya no cambia.
      </p>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      {rows.length === 0 ? (
        <div className="a-empty">Todavía no hay categorías. Crea una con Agregar categoría.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={DND_A11Y}>
          <SortableContext items={rows.map((r) => r._key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <SortableCategoryRow
                  key={r._key}
                  row={r}
                  index={i}
                  errors={rowErrors[r._key]}
                  confirming={confirmKey === r._key}
                  onChange={(patch) => update(r._key, patch)}
                  onRequestRemove={() => (r.id ? setConfirmKey(r._key) : remove(r._key))}
                  onConfirmRemove={() => remove(r._key)}
                  onCancelRemove={() => setConfirmKey(null)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

// Textos de lector de pantalla de dnd-kit (por default vienen en inglés).
const DND_A11Y = {
  screenReaderInstructions: {
    draggable: 'Para mover una categoría, presiona espacio o Enter. Muévela con las flechas y vuelve a presionar espacio o Enter para soltarla. Esc cancela.',
  },
  announcements: {
    onDragStart: () => 'Tomaste la categoría.',
    onDragOver: ({ over }) => (over ? 'La categoría está sobre otra posición.' : 'La categoría está fuera de la lista.'),
    onDragEnd: ({ over }) => (over ? 'Soltaste la categoría.' : 'Soltaste la categoría fuera de la lista.'),
    onDragCancel: () => 'Movimiento cancelado.',
  },
}

function SortableCategoryRow({ row, index, errors, confirming, onChange, onRequestRemove, onConfirmRemove, onCancelRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row._key,
    attributes: { roleDescription: 'categoría ordenable' },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
  }
  const hasErrors = errors?.length > 0
  const stateClass = hasErrors
    ? 'border-red-500/50'
    : isDragging ? 'border-section-quests bg-[var(--a-surface-3)]' : ''

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`a-inset p-4 sm:p-5 space-y-4 ${stateClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* touch-action:none deja arrastrar con el dedo sin que la página haga scroll */}
            <div
              {...attributes}
              {...listeners}
              style={{ touchAction: 'none' }}
              className={`inline-flex items-center gap-2 -ml-1.5 px-1.5 py-1 rounded-lg cursor-grab active:cursor-grabbing text-white/60 hover:text-white hover:bg-white/[0.06] shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-section-quests ${TAP}`}
              title="Arrastra para cambiar el orden"
            >
              <Bars3Icon className="w-4 h-4" aria-hidden />
              <span className="text-sm font-semibold">Categoría {index + 1}</span>
            </div>
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white/20"
              style={{ background: HEX_RE.test(row.color) ? row.color : 'transparent' }}
              aria-hidden
            />
            <span className="a-meta truncate">
              {row.slug ? <>Identificador <span className="a-code">{row.slug}</span></> : 'El identificador se crea al guardar'}
            </span>
          </div>
          {!confirming && (
            <button
              type="button"
              onClick={onRequestRemove}
              className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${TAP_ICON}`}
              aria-label="Eliminar categoría"
              title="Eliminar categoría"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {confirming && (
          <ConfirmStrip
            text="¿Eliminar esta categoría? Al guardar, sus productos se quedan sin categoría."
            onConfirm={onConfirmRemove}
            onCancel={onCancelRemove}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5">
          <Field label="Nombre en inglés" value={row.name_en} onChange={(v) => onChange({ name_en: v })} placeholder="Art Toys" />
          <Field label="Nombre en español" value={row.name_es} onChange={(v) => onChange({ name_es: v })} placeholder="Art Toys" />
          <ColorField value={row.color} onChange={(v) => onChange({ color: v })} />
        </div>
        <FieldErrors errors={errors} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ZONAS DE ENVÍO
// ═══════════════════════════════════════════════════════════════

const emptyRate = (withNames = false) => ({
  _key: newKey('rate'),
  name_en: withNames ? 'Standard shipping' : '',
  name_es: withNames ? 'Envío estándar' : '',
  amount: '',
  min_days: '',
  max_days: '',
})

const zoneToDraft = (z) => ({
  _key: `zone-${z.id}`,
  id: z.id,
  code: z.code || '',
  name_en: z.name_en || '',
  name_es: z.name_es || '',
  currency: z.currency || 'USD',
  active: !!z.active,
  countries: [...(z.countries || [])],
  rates: (z.rates || []).map((r) => ({
    _key: newKey('rate'),
    name_en: r.name_en || '',
    name_es: r.name_es || '',
    amount: numStr(r.amount),
    min_days: numStr(r.min_days),
    max_days: numStr(r.max_days),
  })),
  free_over: numStr(z.free_over),
})

const emptyZone = () => ({
  _key: newKey('zone'),
  id: null,
  code: '',
  name_en: '',
  name_es: '',
  currency: 'USD',
  active: true,
  countries: [],
  rates: [emptyRate(true)],
  free_over: '',
})

const zonesSnapshot = (list) => JSON.stringify(list.map(({ _key, rates, ...z }) => ({
  ...z,
  rates: rates.map(({ _key: rateKey, ...r }) => r),
})))

// Mismo resultado que Middleware::slugify del backend: [a-z0-9-].
const typeCode = (v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').slice(0, 16)
const finalCode = (v) => typeCode(v).replace(/^-+|-+$/g, '')

function validateZones(list, removedCodes) {
  const errs = {}
  const seen = new Set()
  list.forEach((z) => {
    const e = []
    const code = finalCode(z.code)
    if (!code) e.push('Ponle un código.')
    else if (seen.has(code)) e.push(`El código “${code}” ya lo usa otra zona.`)
    else if (!z.id && removedCodes.includes(code)) {
      // Las altas se insertan antes de borrar las bajas: el mismo código
      // chocaría con el índice único de shop_zones.
      e.push(`“${code}” es de una zona que eliminaste. Guarda primero la eliminación y luego vuelve a agregarla.`)
    }
    if (code) seen.add(code)
    if (!z.name_en.trim() && !z.name_es.trim()) e.push('Ponle un nombre: el cliente lo ve.')
    if (!z.countries.length) e.push('Agrega al menos un país.')
    if (!z.rates.length) e.push('Agrega al menos una tarifa.')
    z.rates.forEach((r, i) => {
      const n = i + 1
      if (!MONEY_RE.test(String(r.amount).trim())) e.push(`Tarifa ${n}: el monto debe ser un número de 0 o más.`)
      if (!r.name_en.trim() && !r.name_es.trim()) e.push(`Tarifa ${n}: ponle un nombre; se ve en el checkout.`)
      const minOk = r.min_days === '' || INT_RE.test(String(r.min_days).trim())
      const maxOk = r.max_days === '' || INT_RE.test(String(r.max_days).trim())
      if (!minOk || !maxOk) e.push(`Tarifa ${n}: los días deben ser números enteros.`)
      else if (r.min_days !== '' && r.max_days !== '' && Number(r.min_days) > Number(r.max_days)) e.push(`Tarifa ${n}: los días mínimos son más que los máximos.`)
    })
    if (String(z.free_over).trim() !== '' && !MONEY_RE.test(String(z.free_over).trim())) e.push('El monto para envío gratis debe ser un número de 0 o más.')
    if (e.length) errs[z._key] = e
  })
  return errs
}

const zoneToPayload = (z) => ({
  id: z.id || undefined,
  code: finalCode(z.code),
  name_en: z.name_en.trim(),
  name_es: z.name_es.trim(),
  currency: z.currency,
  active: !!z.active,
  countries: z.countries,
  rates: z.rates.map((r) => ({
    name_en: r.name_en.trim(),
    name_es: r.name_es.trim(),
    amount: toNumber(r.amount),
    min_days: toIntOrNull(r.min_days),
    max_days: toIntOrNull(r.max_days),
  })),
  free_over: String(z.free_over).trim() === '' ? null : toNumber(z.free_over),
})

function ZonesSection({ initial }) {
  const [zones, setZones] = useState(() => initial.map(zoneToDraft))
  const [savedZones, setSavedZones] = useState(() => initial.map(zoneToDraft))
  const [zoneErrors, setZoneErrors] = useState({})
  const sv = useSave()
  const dirty = zonesSnapshot(zones) !== zonesSnapshot(savedZones)

  const removedCodes = useMemo(() => {
    const ids = new Set(zones.filter((z) => z.id).map((z) => z.id))
    return savedZones.filter((z) => !ids.has(z.id)).map((z) => z.code)
  }, [zones, savedZones])

  // País → zonas que lo incluyen. Un país en dos zonas deja ambigua la
  // moneda y las tarifas que ve el cliente.
  const countryZones = useMemo(() => {
    const map = {}
    zones.forEach((z) => z.countries.forEach((c) => {
      (map[c] ||= []).push({ key: z._key, code: finalCode(z.code) || 'una zona nueva' })
    }))
    return map
  }, [zones])

  const update = (key, patch) => {
    setZones((prev) => prev.map((z) => (z._key === key ? { ...z, ...patch } : z)))
    setZoneErrors((prev) => withoutKey(prev, key))
  }
  const remove = (key) => setZones((prev) => prev.filter((z) => z._key !== key))
  const move = (key, dir) => setZones((prev) => {
    const from = prev.findIndex((z) => z._key === key)
    const to = from + dir
    return from < 0 || to < 0 || to >= prev.length ? prev : arrayMove(prev, from, to)
  })
  const add = () => setZones((prev) => [...prev, emptyZone()])

  const save = () => {
    const errs = validateZones(zones, removedCodes)
    setZoneErrors(errs)
    if (Object.keys(errs).length) return sv.setError('Corrige las zonas marcadas en rojo.')

    const sent = zones
    sv.run(async () => {
      try {
        const res = await saveZones(sent.map(zoneToPayload))
        const next = res.map(zoneToDraft)
        setZones(next)
        setSavedZones(next.map((z) => ({ ...z })))
      } catch (e) {
        const idx = e?.payload?.index
        if (typeof idx === 'number' && sent[idx]) setZoneErrors({ [sent[idx]._key]: [errorText(e)] })
        throw e
      }
    })
  }

  return (
    <section className="a-section space-y-5">
      <SectionHeader icon={GlobeAmericasIcon} title="Zonas de envío">
        <button type="button" onClick={add} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
          <PlusIcon className="w-4 h-4" aria-hidden />
          Agregar zona
        </button>
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      <p className="a-help -mt-1">
        Cada zona define la moneda, los países y las tarifas de envío que ve el cliente en el checkout. El orden de aquí es el orden del selector de región.
      </p>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      {zones.length === 0 ? (
        <div className="a-empty">No hay zonas, así que nadie puede pagar. Crea una con Agregar zona.</div>
      ) : (
        <div className="space-y-5">
          {zones.map((z, i) => (
            <ZoneCard
              key={z._key}
              zone={z}
              index={i}
              count={zones.length}
              errors={zoneErrors[z._key]}
              countryZones={countryZones}
              onChange={(patch) => update(z._key, patch)}
              onRemove={() => remove(z._key)}
              onMove={(dir) => move(z._key, dir)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ZoneCard({ zone, index, count, errors, countryZones, onChange, onRemove, onMove }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const isNew = !zone.id
  const cur = zone.currency
  const code = finalCode(zone.code)
  const hasErrors = errors?.length > 0

  const updateRate = (key, patch) => onChange({ rates: zone.rates.map((r) => (r._key === key ? { ...r, ...patch } : r)) })
  const removeRate = (key) => onChange({ rates: zone.rates.filter((r) => r._key !== key) })
  const addRate = () => zone.rates.length < MAX_RATES && onChange({ rates: [...zone.rates, emptyRate(false)] })

  return (
    <div className={`a-inset p-4 sm:p-5 space-y-6 ${hasErrors ? 'border-red-500/50' : ''}`}>
      <div className="flex items-center justify-between gap-x-3 gap-y-3 flex-wrap">
        <div className="flex items-center gap-x-3 gap-y-2 min-w-0 flex-wrap">
          <span className="text-sm font-semibold text-white/60">Zona {index + 1}</span>
          {code
            ? <span className="a-code text-sm text-white truncate">{code}</span>
            : <span className="text-sm a-muted">Zona nueva</span>}
          <MiniToggle on={zone.active} onChange={(v) => onChange({ active: v })} label={zone.active ? 'Activa' : 'Inactiva'} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className={`a-icon-btn a-icon-btn--sm ${TAP_ICON} disabled:opacity-30 disabled:cursor-not-allowed`}
            aria-label="Subir zona"
            title="Subir"
          >
            <ArrowUpIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className={`a-icon-btn a-icon-btn--sm ${TAP_ICON} disabled:opacity-30 disabled:cursor-not-allowed`}
            aria-label="Bajar zona"
            title="Bajar"
          >
            <ArrowDownIcon className="w-4 h-4" />
          </button>
          {!confirmRemove && (
            <button
              type="button"
              onClick={() => (isNew ? onRemove() : setConfirmRemove(true))}
              className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${TAP_ICON}`}
              aria-label="Eliminar zona"
              title="Eliminar zona"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {confirmRemove && (
        <ConfirmStrip
          text="¿Eliminar esta zona? Al guardar, los clientes de sus países ya no van a poder pagar."
          onConfirm={() => { setConfirmRemove(false); onRemove() }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {!zone.active && (
        <div className="a-alert a-alert--warning px-4 py-3 text-[0.8125rem]">
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>Inactiva: no aparece en el selector de región y sus países no pueden pagar.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-5">
        {isNew ? (
          <Field
            label="Código"
            value={zone.code}
            onChange={(v) => onChange({ code: typeCode(v) })}
            placeholder="eu"
            maxLength={16}
            hint="Minúsculas, números y guiones. No se puede cambiar después de guardar."
          />
        ) : (
          <div className="min-w-0">
            <span className="a-label">Código</span>
            <div className="a-input opacity-60 cursor-not-allowed truncate" aria-disabled="true">
              <span className="a-code text-white">{zone.code}</span>
            </div>
            <p className="a-help mt-1.5">Fijo: los pedidos lo guardan.</p>
          </div>
        )}
        <Field label="Nombre en inglés" value={zone.name_en} onChange={(v) => onChange({ name_en: v })} placeholder="Latin America" />
        <Field label="Nombre en español" value={zone.name_es} onChange={(v) => onChange({ name_es: v })} placeholder="Latinoamérica" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
        <label className="block">
          <span className="a-label">Moneda</span>
          <select
            value={cur}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="a-input"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <p className="a-help sm:col-span-2 sm:pt-7">
          Los clientes de esta zona pagan en {cur}. Un producto sin precio en {cur} no se les muestra.
        </p>
      </div>

      <CountriesInput
        zoneKey={zone._key}
        value={zone.countries}
        countryZones={countryZones}
        onChange={(countries) => onChange({ countries })}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="a-label mb-0">Tarifas ({zone.rates.length}/{MAX_RATES})</span>
          <button
            type="button"
            onClick={addRate}
            disabled={zone.rates.length >= MAX_RATES}
            className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
          >
            <PlusIcon className="w-4 h-4" aria-hidden />
            Agregar tarifa
          </button>
        </div>
        {zone.rates.length === 0 && (
          <p className="text-[0.8125rem] text-red-300">Sin tarifas. Agrega al menos una para poder guardar.</p>
        )}
        {zone.rates.map((r, ri) => (
          <div key={r._key} className="pt-4 border-t-2 border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="a-meta">
                Tarifa {ri + 1} · {cur}{ri === 0 && String(zone.free_over).trim() !== '' ? ' · Gratis al llegar al monto' : ''}
              </span>
              <button
                type="button"
                onClick={() => removeRate(r._key)}
                className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${TAP_ICON}`}
                aria-label={`Quitar tarifa ${ri + 1}`}
                title="Quitar tarifa"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-x-3 gap-y-4">
              <Field className="col-span-3" label="Nombre en inglés" value={r.name_en} onChange={(v) => updateRate(r._key, { name_en: v })} placeholder="Standard shipping" />
              <Field className="col-span-3" label="Nombre en español" value={r.name_es} onChange={(v) => updateRate(r._key, { name_es: v })} placeholder="Envío estándar" />
              <Field className="col-span-2" label="Monto" inputMode="decimal" value={r.amount} onChange={(v) => updateRate(r._key, { amount: v })} placeholder="150" />
              <Field className="col-span-2" label="Días mín." inputMode="numeric" value={r.min_days} onChange={(v) => updateRate(r._key, { min_days: v.replace(/\D/g, '') })} placeholder="3" />
              <Field className="col-span-2" label="Días máx." inputMode="numeric" value={r.max_days} onChange={(v) => updateRate(r._key, { max_days: v.replace(/\D/g, '') })} placeholder="7" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
        <Field
          label={`Envío gratis desde (${cur}, opcional)`}
          inputMode="decimal"
          value={zone.free_over}
          onChange={(v) => onChange({ free_over: v })}
          placeholder="Vacío: nunca es gratis"
        />
        <p className="a-help sm:col-span-2 sm:pt-7">
          Cuando el subtotal (ya con el descuento del golden ticket) llega a este monto, la primera tarifa sale gratis. Los códigos de descuento se aplican después en Stripe y no cuentan.
        </p>
      </div>

      <FieldErrors errors={errors} />
    </div>
  )
}

function CountriesInput({ zoneKey, value, countryZones, onChange }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(null)
  const inputId = useId()
  const helpId = useId()

  const commit = (raw) => {
    const tokens = String(raw).split(/[\s,;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    if (!tokens.length) return
    const bad = tokens.filter((t) => !/^[A-Z]{2}$/.test(t))
    const next = [...value]
    tokens.forEach((t) => { if (/^[A-Z]{2}$/.test(t) && !next.includes(t)) next.push(t) })
    if (next.length !== value.length) onChange(next)
    setInvalid(bad.length ? bad.join(', ') : null)
  }

  // Los teclados móviles no siempre mandan keydown con ',' (Android da
  // 'Unidentified'), así que la coma/espacio también se detecta en onChange.
  const onInput = (e) => {
    const v = e.target.value
    if (/[\s,;]/.test(v)) {
      const parts = v.split(/[\s,;]+/)
      const last = parts.pop()
      commit(parts.join(','))
      setText(last)
    } else {
      setText(v)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(text)
      setText('')
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const removeCode = (code) => onChange(value.filter((c) => c !== code))
  const addPreset = () => {
    const next = [...value]
    LATAM_PRESET.forEach((c) => { if (!next.includes(c)) next.push(c) })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="a-label mb-0">Países ({value.length})</label>
        <button type="button" onClick={addPreset} className={`a-btn a-btn--ghost a-btn--sm -my-1 ${TAP}`}>
          <PlusIcon className="w-4 h-4" aria-hidden />
          Agregar Latinoamérica
        </button>
      </div>
      <div className="a-input flex flex-wrap items-center gap-2 px-2 py-2 focus-within:border-section-quests">
        {value.map((code) => {
          const name = countryLabel(code)
          const others = (countryZones[code] || []).filter((z) => z.key !== zoneKey)
          const conflict = others.length > 0
          const toneClass = conflict
            ? 'border-red-500/50 bg-red-500/10 text-red-300'
            : !name ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : ''
          const title = conflict
            ? `${name || code} también está en ${others.map((o) => o.code).join(', ')}`
            : name || 'Código ISO desconocido'
          return (
            <span key={code} title={title} className={`a-chip gap-1 pl-2.5 pr-1 py-1 ${toneClass}`}>
              {code}
              {conflict && <ExclamationTriangleIcon className="w-3.5 h-3.5" aria-label="También está en otra zona" />}
              {/* En celular el área de toque crece con un ::after invisible: la equis sigue chica. */}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="relative rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-white/10 transition-opacity max-sm:after:absolute max-sm:after:-inset-3 max-sm:after:content-['']"
                aria-label={`Quitar ${name || code}`}
                title={`Quitar ${code}`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )
        })}
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onBlur={() => { commit(text); setText('') }}
          placeholder={value.length ? 'Agregar…' : 'MX, US… (Enter o coma)'}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={helpId}
          className="flex-1 min-w-[90px] bg-transparent outline-none text-sm text-white placeholder:text-white/30 placeholder:normal-case uppercase px-1 py-1"
        />
      </div>
      {invalid && (
        <p className="text-[0.8125rem] text-amber-200" role="status">
          Se ignoraron porque no son códigos ISO de dos letras: <span className="a-code text-inherit">{invalid}</span>
        </p>
      )}
      <p id={helpId} className="a-help">
        Códigos ISO de dos letras. En rojo: el país también está en otra zona. En ámbar: no es un código ISO conocido.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PIEZAS
// ═══════════════════════════════════════════════════════════════

// Acciones de sección: secundarias primero y Guardar (la principal) al final, a la derecha.
function SectionHeader({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-white/50 shrink-0" aria-hidden />
        <h2 className="a-section-title">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>}
    </div>
  )
}

function SaveControls({ dirty, saving, ok, onSave }) {
  return (
    <>
      {ok && (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-300" role="status">
          <CheckCircleIcon className="w-4 h-4" aria-hidden />
          Guardado
        </span>
      )}
      {!ok && dirty && <span className="a-badge a-badge--warning">Cambios sin guardar</span>}
      <button type="button" onClick={onSave} disabled={saving} className={`a-btn a-btn--primary a-btn--sm ${TAP}`}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </>
  )
}

function Field({ label, value, onChange, placeholder, hint, type = 'text', inputMode, maxLength, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="a-label truncate">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="a-input"
      />
      {hint && <span className="block a-help mt-1.5">{hint}</span>}
    </label>
  )
}

function ColorField({ value, onChange }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="a-label">Color</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX6_RE.test(value) ? value : '#e600ff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-11 h-11 p-1 shrink-0 cursor-pointer rounded-xl border-2 border-white/10 bg-[var(--a-surface-2)]"
          aria-label="Elegir un color"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#e600ff"
          maxLength={9}
          className="a-input flex-1 min-w-0"
        />
      </div>
    </div>
  )
}

function Toggle({ on, onChange, label, children }) {
  const id = useId()
  const descId = useId()
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={children ? descId : undefined}
        onClick={() => onChange(!on)}
        className="a-switch mt-0.5"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-white cursor-pointer select-none">
          {label}
        </label>
        {children && <div id={descId}>{children}</div>}
      </div>
    </div>
  )
}

function MiniToggle({ on, onChange, label }) {
  const id = useId()
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Zona activa"
        onClick={() => onChange(!on)}
        className="a-switch"
      />
      <label htmlFor={id} className={`text-[0.8125rem] font-semibold cursor-pointer select-none ${on ? 'text-white/70' : 'text-amber-200'}`}>
        {label}
      </label>
    </span>
  )
}

// Confirmación de algo destructivo: Cancelar primero y Eliminar al final (derecha).
function ConfirmStrip({ text, onConfirm, onCancel }) {
  return (
    <div className="a-alert a-alert--danger px-4 py-3 flex-wrap items-center gap-y-3">
      <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-[180px] text-[0.8125rem]">{text}</span>
      <div className="flex flex-wrap items-center justify-end gap-3 ml-auto">
        <button type="button" onClick={onCancel} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className={`a-btn a-btn--danger-solid a-btn--sm ${TAP}`}>
          Eliminar
        </button>
      </div>
    </div>
  )
}

function FieldErrors({ errors }) {
  if (!errors?.length) return null
  return (
    <div role="alert">
      <ul className="space-y-1.5 text-[0.8125rem] text-red-300">
        {errors.map((e) => (
          <li key={e} className="flex items-start gap-2">
            <XCircleIcon className="w-4 h-4 shrink-0 mt-px" aria-hidden />
            <span className="min-w-0">{e}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ErrorAlert({ children }) {
  return (
    <div className="a-alert a-alert--danger px-4 py-3 text-[0.8125rem]" role="alert">
      <XCircleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0">{children}</span>
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
