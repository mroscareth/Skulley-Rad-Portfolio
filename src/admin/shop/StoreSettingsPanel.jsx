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
  invalid_email: "The notification email isn't a valid email address.",
  invalid_zone_code: 'A zone code is empty or used by another zone.',
  invalid_currency: 'Currency must be MXN or USD.',
  countries_required: 'Add at least one country.',
  invalid_country: "Stripe Checkout doesn't ship to one of these countries. Remove it.",
  country_in_two_zones: 'A country can only belong to one zone.',
  rates_required: 'Add at least one rate with an amount.',
  invalid_price: 'Amounts must be numbers of 0 or more.',
  invalid_number: 'Days must be whole numbers.',
  unauthorized: 'Your session expired. Log in again.',
  server_error: 'Server error. Check the PHP error log.',
  error: 'Something went wrong.',
}

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
    return new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code) || null
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
    <div className="w-full space-y-6">
      <div>
        <h1 className="a-title">Store settings</h1>
        <p className="a-subtitle">Stripe, checkout, categories and shipping zones. Each section saves on its own.</p>
      </div>

      {loadError && (
        <div className="a-alert a-alert--danger px-4 py-3 items-center" role="alert">
          <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <span className="flex-1 min-w-0">{loadError}</span>
          {!data && (
            <button type="button" onClick={load} className="a-btn a-btn--secondary a-btn--sm shrink-0">Retry</button>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Loading settings" />
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
        </>
      ) : null}
    </div>
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
    <section className="a-section space-y-5">
      <SectionHeader icon={CreditCardIcon} title="Stripe">
        {stripe.test_mode && <TestModeBadge />}
        <button type="button" onClick={onRecheck} disabled={rechecking} className="a-btn a-btn--secondary a-btn--sm">
          <ArrowPathIcon className={`w-4 h-4 ${rechecking ? 'animate-spin' : ''}`} aria-hidden />
          {rechecking ? 'Checking…' : 'Check again'}
        </button>
      </SectionHeader>

      <div className="space-y-3">
        <dl className="space-y-2">
          <StatusLine
            ok={stripe.configured}
            label="Secret key"
            okText="Set"
            badText="Missing, so checkout is off"
          />
          {stripe.configured && (
            <StatusLine
              ok
              warn={stripe.test_mode}
              label="Mode"
              okText={stripe.test_mode
                ? <>Test (<span className="a-code text-inherit">sk_test_</span>), no real charges</>
                : 'Live, real charges'}
            />
          )}
          <StatusLine
            ok={stripe.webhook_secret}
            label="Webhook secret"
            okText="Set"
            badText="Missing, so payments won't be confirmed"
          />
        </dl>
        <p className="a-help">
          Keys live in <span className="a-code">public/api/config.local.php</span> as{' '}
          <span className="a-code">STRIPE_SECRET_KEY</span> and <span className="a-code">STRIPE_WEBHOOK_SECRET</span>.
        </p>
      </div>

      <div className="space-y-2">
        <span className="a-label mb-0">Webhook URL</span>
        <div className="flex items-center gap-2">
          <div className="a-input flex-1 min-w-0 break-all select-all">
            <span className="a-code text-white">{webhookUrl || '—'}</span>
          </div>
          <button
            type="button"
            onClick={() => copy(webhookUrl, 'url')}
            disabled={!webhookUrl}
            className="a-btn a-btn--secondary a-btn--sm shrink-0"
          >
            {copied === 'url'
              ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
              : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
            {copied === 'url' ? 'Copied' : 'Copy'}
          </button>
        </div>
        {!publicHttps && (
          <div className="a-alert a-alert--warning px-3.5 py-2.5 text-[0.8125rem]">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span className="min-w-0">
              <span className="a-code text-inherit">SITE_URL</span> in the config isn't a public HTTPS URL, so Stripe can't reach this webhook.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="a-label mb-0">Events to enable</span>
          <button type="button" onClick={() => copy(WEBHOOK_EVENTS.join('\n'), 'events')} className="a-btn a-btn--ghost a-btn--sm -my-1">
            {copied === 'events'
              ? <CheckIcon className="w-4 h-4 text-green-400" aria-hidden />
              : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
            {copied === 'events' ? 'Copied' : 'Copy all'}
          </button>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
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
          className="a-btn a-btn--secondary a-btn--sm mt-1"
        >
          Stripe → Developers → Webhooks
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-60" aria-hidden />
        </a>
      </div>
    </section>
  )
}

function StatusLine({ ok, warn = false, label, okText, badText }) {
  const Icon = !ok ? XCircleIcon : warn ? BoltIcon : CheckCircleIcon
  const iconColor = !ok ? 'text-red-400' : warn ? 'text-amber-300' : 'text-green-400'
  const textColor = !ok ? 'text-red-300' : warn ? 'text-amber-200' : 'text-white/80'
  return (
    <div className="flex items-start gap-3 text-sm">
      <dt className="flex items-center gap-2.5 w-36 sm:w-40 shrink-0 text-white/45">
        <Icon className={`w-[1.125rem] h-[1.125rem] shrink-0 ${iconColor}`} aria-hidden />
        {label}
      </dt>
      <dd className={`min-w-0 ${textColor}`}>{ok ? okText : badText}</dd>
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
  download_days: numStr(s?.download_days ?? '30'),
  download_max: numStr(s?.download_max ?? '5'),
})

function CheckoutSection({ initial, stripeConfigured, onSaved }) {
  const [form, setForm] = useState(() => settingsToForm(initial))
  const [saved, setSaved] = useState(() => settingsToForm(initial))
  const sv = useSave()
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const save = () => {
    const days = String(form.download_days).trim()
    const max = String(form.download_max).trim()
    if (!INT_RE.test(days) || Number(days) < 1 || Number(days) > 365) return sv.setError('Download link lifetime must be between 1 and 365 days.')
    if (!INT_RE.test(max) || Number(max) < 1 || Number(max) > 100) return sv.setError('Downloads per link must be between 1 and 100.')
    sv.run(async () => {
      const res = await saveSettings({
        checkout_enabled: form.checkout_enabled,
        allow_promo_codes: form.allow_promo_codes,
        notify_email: form.notify_email.trim(),
        download_days: Number(days),
        download_max: Number(max),
      })
      const next = settingsToForm(res.settings)
      setForm(next)
      setSaved(next)
      onSaved?.(res)
    })
  }

  return (
    <section className="a-section space-y-5">
      <SectionHeader icon={ShoppingBagIcon} title="Checkout">
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      <Toggle on={form.checkout_enabled} onChange={(v) => set({ checkout_enabled: v })} label="Checkout enabled">
        <p className={`text-[0.8125rem] mt-0.5 ${form.checkout_enabled ? 'text-green-300' : 'text-amber-200'}`}>
          {form.checkout_enabled ? 'The store is open. Customers can pay.' : 'The store is closed. Products stay visible, but nobody can pay.'}
        </p>
        {!stripeConfigured && (
          <p className="text-[0.8125rem] text-red-300 mt-0.5">Stripe keys are missing, so checkout stays off either way.</p>
        )}
      </Toggle>

      <Toggle on={form.allow_promo_codes} onChange={(v) => set({ allow_promo_codes: v })} label="Allow promo codes">
        <p className="a-help mt-0.5">
          Promo codes are created in the Stripe dashboard (Coupons → Promotion codes). They can't be combined with the golden ticket in the same purchase.
        </p>
      </Toggle>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <Field
          className="sm:col-span-3"
          label="Notification email"
          type="email"
          value={form.notify_email}
          onChange={(v) => set({ notify_email: v })}
          placeholder="Empty uses the site default (TO_EMAIL)"
          hint="New orders and chargebacks are emailed here."
        />
        <Field
          label="Download link lifetime (days)"
          inputMode="numeric"
          value={form.download_days}
          onChange={(v) => set({ download_days: v.replace(/\D/g, '') })}
          placeholder="30"
          hint="Each download link lives this many days."
        />
        <Field
          label="Downloads per link"
          inputMode="numeric"
          value={form.download_max}
          onChange={(v) => set({ download_max: v.replace(/\D/g, '') })}
          placeholder="5"
          hint="How many times each link can be used."
        />
        <p className="a-help sm:col-span-3">Download limits apply to orders paid after saving. Existing links keep theirs.</p>
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
      if (!r.name_en.trim() && !r.name_es.trim()) e.push('Add a name in at least one language.')
      if (!HEX_RE.test(r.color.trim())) e.push('Color must be a hex value like #e600ff.')
      if (e.length) errs[r._key] = e
    })
    setRowErrors(errs)
    if (Object.keys(errs).length) return sv.setError('Fix the highlighted categories.')

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
      <SectionHeader icon={TagIcon} title="Categories">
        <button type="button" onClick={add} className="a-btn a-btn--secondary a-btn--sm">
          <PlusIcon className="w-4 h-4" aria-hidden />
          Add category
        </button>
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      <p className="a-help -mt-2">Drag to reorder. The slug is set on the first save and never changes.</p>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      {rows.length === 0 ? (
        <div className="a-empty">No categories yet. Use Add category to create one.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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

function SortableCategoryRow({ row, index, errors, confirming, onChange, onRequestRemove, onConfirmRemove, onCancelRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._key })
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
      <div className={`a-inset p-4 space-y-4 ${stateClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* touch-action:none deja arrastrar con el dedo sin que la página haga scroll */}
            <div
              {...attributes}
              {...listeners}
              style={{ touchAction: 'none' }}
              className="inline-flex items-center gap-2 -ml-1.5 px-1.5 py-1 rounded-lg cursor-grab active:cursor-grabbing text-white/60 hover:text-white hover:bg-white/[0.06] shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-section-quests"
              title="Drag to reorder"
            >
              <Bars3Icon className="w-4 h-4" aria-hidden />
              <span className="text-sm font-semibold">Category {index + 1}</span>
            </div>
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 border-white/20"
              style={{ background: HEX_RE.test(row.color) ? row.color : 'transparent' }}
              aria-hidden
            />
            <span className="a-meta truncate">
              {row.slug ? <>Slug <span className="a-code">{row.slug}</span></> : 'Slug is set on save'}
            </span>
          </div>
          {!confirming && (
            <button
              type="button"
              onClick={onRequestRemove}
              className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
              aria-label="Remove category"
              title="Remove category"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {confirming && (
          <ConfirmStrip
            text="Remove this category? Its products become uncategorized when you save."
            onConfirm={onConfirmRemove}
            onCancel={onCancelRemove}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Name (EN)" value={row.name_en} onChange={(v) => onChange({ name_en: v })} placeholder="Art Toys" />
          <Field label="Name (ES)" value={row.name_es} onChange={(v) => onChange({ name_es: v })} placeholder="Art Toys" />
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
    if (!code) e.push('Add a code.')
    else if (seen.has(code)) e.push(`The code “${code}” is used by another zone.`)
    else if (!z.id && removedCodes.includes(code)) {
      // Las altas se insertan antes de borrar las bajas: el mismo código
      // chocaría con el índice único de shop_zones.
      e.push(`“${code}” belongs to a zone you removed. Save the removal first, then add it again.`)
    }
    if (code) seen.add(code)
    if (!z.name_en.trim() && !z.name_es.trim()) e.push('Add a name. Customers see it.')
    if (!z.countries.length) e.push('Add at least one country.')
    if (!z.rates.length) e.push('Add at least one rate.')
    z.rates.forEach((r, i) => {
      const n = i + 1
      if (!MONEY_RE.test(String(r.amount).trim())) e.push(`Rate ${n}: the amount must be a number of 0 or more.`)
      if (!r.name_en.trim() && !r.name_es.trim()) e.push(`Rate ${n}: add a name. It's shown at checkout.`)
      const minOk = r.min_days === '' || INT_RE.test(String(r.min_days).trim())
      const maxOk = r.max_days === '' || INT_RE.test(String(r.max_days).trim())
      if (!minOk || !maxOk) e.push(`Rate ${n}: days must be whole numbers.`)
      else if (r.min_days !== '' && r.max_days !== '' && Number(r.min_days) > Number(r.max_days)) e.push(`Rate ${n}: min days is greater than max days.`)
    })
    if (String(z.free_over).trim() !== '' && !MONEY_RE.test(String(z.free_over).trim())) e.push('The free shipping threshold must be a number of 0 or more.')
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
      (map[c] ||= []).push({ key: z._key, code: finalCode(z.code) || 'a new zone' })
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
    if (Object.keys(errs).length) return sv.setError('Fix the highlighted zones.')

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
      <SectionHeader icon={GlobeAmericasIcon} title="Shipping zones">
        <button type="button" onClick={add} className="a-btn a-btn--secondary a-btn--sm">
          <PlusIcon className="w-4 h-4" aria-hidden />
          Add zone
        </button>
        <SaveControls dirty={dirty} saving={sv.saving} ok={sv.ok} onSave={save} />
      </SectionHeader>
      <p className="a-help -mt-2">
        Each zone sets the currency, countries and rates the customer gets at checkout. The order here is the order in the region picker.
      </p>
      {sv.error && <ErrorAlert>{sv.error}</ErrorAlert>}

      {zones.length === 0 ? (
        <div className="a-empty">No zones, so nobody can check out. Use Add zone to create one.</div>
      ) : (
        <div className="space-y-4">
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
    <div className={`a-inset p-4 sm:p-5 space-y-5 ${hasErrors ? 'border-red-500/50' : ''}`}>
      <div className="flex items-center justify-between gap-x-2 gap-y-3 flex-wrap">
        <div className="flex items-center gap-x-3 gap-y-2 min-w-0 flex-wrap">
          <span className="text-sm font-semibold text-white/60">Zone {index + 1}</span>
          {code
            ? <span className="a-code text-sm text-white truncate">{code}</span>
            : <span className="text-sm a-muted">New zone</span>}
          <MiniToggle on={zone.active} onChange={(v) => onChange({ active: v })} label={zone.active ? 'Active' : 'Inactive'} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="a-icon-btn a-icon-btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move zone up"
            title="Move up"
          >
            <ArrowUpIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="a-icon-btn a-icon-btn--sm disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move zone down"
            title="Move down"
          >
            <ArrowDownIcon className="w-4 h-4" />
          </button>
          {!confirmRemove && (
            <button
              type="button"
              onClick={() => (isNew ? onRemove() : setConfirmRemove(true))}
              className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
              aria-label="Remove zone"
              title="Remove zone"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {confirmRemove && (
        <ConfirmStrip
          text="Remove this zone? Customers in its countries won't be able to check out once you save."
          onConfirm={() => { setConfirmRemove(false); onRemove() }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {!zone.active && (
        <div className="a-alert a-alert--warning px-3.5 py-2.5 text-[0.8125rem]">
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>Inactive. It's hidden from the region picker and its countries can't check out.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isNew ? (
          <Field
            label="Code"
            value={zone.code}
            onChange={(v) => onChange({ code: typeCode(v) })}
            placeholder="eu"
            maxLength={16}
            hint="Lowercase letters, numbers and dashes. Fixed after saving."
          />
        ) : (
          <div className="min-w-0">
            <span className="a-label">Code</span>
            <div className="a-input opacity-60 cursor-not-allowed truncate" aria-disabled="true">
              <span className="a-code text-white">{zone.code}</span>
            </div>
            <p className="a-help mt-1.5">Fixed. Orders reference it.</p>
          </div>
        )}
        <Field label="Name (EN)" value={zone.name_en} onChange={(v) => onChange({ name_en: v })} placeholder="Latin America" />
        <Field label="Name (ES)" value={zone.name_es} onChange={(v) => onChange({ name_es: v })} placeholder="Latinoamérica" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
        <label className="block">
          <span className="a-label">Currency</span>
          <select
            value={cur}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="a-input"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <p className="a-help sm:col-span-2 sm:pt-7">
          Customers in this zone pay in {cur}. Every product they can buy needs a price in {cur}.
        </p>
      </div>

      <CountriesInput
        zoneKey={zone._key}
        value={zone.countries}
        countryZones={countryZones}
        onChange={(countries) => onChange({ countries })}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="a-label mb-0">Rates ({zone.rates.length}/{MAX_RATES})</span>
          <button
            type="button"
            onClick={addRate}
            disabled={zone.rates.length >= MAX_RATES}
            className="a-btn a-btn--secondary a-btn--sm"
          >
            <PlusIcon className="w-4 h-4" aria-hidden />
            Add rate
          </button>
        </div>
        {zone.rates.length === 0 && (
          <p className="text-[0.8125rem] text-red-300">No rates. Add at least one to save.</p>
        )}
        {zone.rates.map((r, ri) => (
          <div key={r._key} className="pt-3 border-t-2 border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="a-meta">
                Rate {ri + 1} · {cur}{ri === 0 && String(zone.free_over).trim() !== '' ? ' · Free over the threshold' : ''}
              </span>
              <button
                type="button"
                onClick={() => removeRate(r._key)}
                className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                aria-label={`Remove rate ${ri + 1}`}
                title="Remove rate"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-x-2 gap-y-3">
              <Field className="col-span-3" label="Name (EN)" value={r.name_en} onChange={(v) => updateRate(r._key, { name_en: v })} placeholder="Standard shipping" />
              <Field className="col-span-3" label="Name (ES)" value={r.name_es} onChange={(v) => updateRate(r._key, { name_es: v })} placeholder="Envío estándar" />
              <Field className="col-span-2" label="Amount" inputMode="decimal" value={r.amount} onChange={(v) => updateRate(r._key, { amount: v })} placeholder="150" />
              <Field className="col-span-2" label="Min days" inputMode="numeric" value={r.min_days} onChange={(v) => updateRate(r._key, { min_days: v.replace(/\D/g, '') })} placeholder="3" />
              <Field className="col-span-2" label="Max days" inputMode="numeric" value={r.max_days} onChange={(v) => updateRate(r._key, { max_days: v.replace(/\D/g, '') })} placeholder="7" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 items-start">
        <Field
          label={`Free shipping over (${cur}, optional)`}
          inputMode="decimal"
          value={zone.free_over}
          onChange={(v) => onChange({ free_over: v })}
          placeholder="Empty means never free"
        />
        <p className="a-help sm:col-span-2 sm:pt-7">
          When the order subtotal after discounts reaches it, the first rate becomes free. Stripe promo codes are applied later and don't count.
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
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="a-label mb-0">Countries ({value.length})</label>
        <button type="button" onClick={addPreset} className="a-btn a-btn--ghost a-btn--sm -my-1">
          <PlusIcon className="w-4 h-4" aria-hidden />
          Add Latin America
        </button>
      </div>
      <div className="a-input flex flex-wrap items-center gap-1.5 px-2 py-2 focus-within:border-section-quests">
        {value.map((code) => {
          const name = countryLabel(code)
          const others = (countryZones[code] || []).filter((z) => z.key !== zoneKey)
          const conflict = others.length > 0
          const toneClass = conflict
            ? 'border-red-500/50 bg-red-500/10 text-red-300'
            : !name ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : ''
          const title = conflict
            ? `${name || code} is also in ${others.map((o) => o.code).join(', ')}`
            : name || 'Unknown ISO code'
          return (
            <span key={code} title={title} className={`a-chip gap-1 pl-2.5 pr-1 py-1 ${toneClass}`}>
              {code}
              {conflict && <ExclamationTriangleIcon className="w-3.5 h-3.5" aria-label="Also in another zone" />}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-white/10 transition-opacity"
                aria-label={`Remove ${name || code}`}
                title={`Remove ${code}`}
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
          placeholder={value.length ? 'Add…' : 'MX, US… (Enter or comma)'}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={helpId}
          className="flex-1 min-w-[90px] bg-transparent outline-none text-sm text-white placeholder:text-white/30 placeholder:normal-case uppercase px-1 py-1"
        />
      </div>
      {invalid && (
        <p className="text-[0.8125rem] text-amber-200" role="status">
          Ignored, not two-letter ISO codes: <span className="a-code text-inherit">{invalid}</span>
        </p>
      )}
      <p id={helpId} className="a-help">
        Two-letter ISO codes. Red means the country is also in another zone; amber means it isn't a known ISO code.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PIEZAS
// ═══════════════════════════════════════════════════════════════

function SectionHeader({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-white/50 shrink-0" aria-hidden />
        <h2 className="a-section-title">{title}</h2>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

function SaveControls({ dirty, saving, ok, onSave }) {
  return (
    <>
      {ok && (
        <span className="inline-flex items-center gap-1.5 text-sm text-green-300" role="status">
          <CheckCircleIcon className="w-4 h-4" aria-hidden />
          Saved
        </span>
      )}
      {!ok && dirty && <span className="a-badge a-badge--warning">Unsaved changes</span>}
      <button type="button" onClick={onSave} disabled={saving} className="a-btn a-btn--primary a-btn--sm">
        {saving ? 'Saving…' : 'Save'}
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
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX6_RE.test(value) ? value : '#e600ff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-11 h-11 p-1 shrink-0 cursor-pointer rounded-xl border-2 border-white/10 bg-[var(--a-surface-2)]"
          aria-label="Pick a color"
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
        aria-label="Active"
        onClick={() => onChange(!on)}
        className="a-switch"
      />
      <label htmlFor={id} className={`text-[0.8125rem] font-semibold cursor-pointer select-none ${on ? 'text-white/70' : 'text-amber-200'}`}>
        {label}
      </label>
    </span>
  )
}

function ConfirmStrip({ text, onConfirm, onCancel }) {
  return (
    <div className="a-alert a-alert--danger px-3.5 py-3 flex-wrap items-center">
      <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-[180px] text-[0.8125rem]">{text}</span>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className="a-btn a-btn--danger-solid a-btn--sm">
          Remove
        </button>
        <button type="button" onClick={onCancel} className="a-btn a-btn--ghost a-btn--sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

function FieldErrors({ errors }) {
  if (!errors?.length) return null
  return (
    <div role="alert">
      <ul className="space-y-1 text-[0.8125rem] text-red-300">
        {errors.map((e) => (
          <li key={e} className="flex items-start gap-1.5">
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
    <div className="a-alert a-alert--danger px-3.5 py-2.5 text-[0.8125rem]" role="alert">
      <XCircleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
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
