/**
 * Products panel — catálogo de la tienda propia (MySQL + Stripe).
 *
 * Dos vistas internas: lista (filtros + acciones rápidas) y editor (un form
 * largo por secciones). El editor trabaja con los campos crudos del admin
 * (images_raw, archive_id_raw, image_url_raw) para guardar rutas relativas y
 * no URLs públicas.
 *
 * Variantes = producto cartesiano de los valores de las opciones. Cada valor
 * lleva un _key estable: renombrar "Blak" → "Black" no pierde precios ni
 * stock de las filas ya capturadas, y la fila conserva su id → el servidor
 * actualiza en vez de borrar y recrear (las ventas siguen ligadas).
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  PhotoIcon,
  ArrowUpTrayIcon,
  StarIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentIcon,
  TagIcon,
  CubeIcon,
  Squares2X2Icon,
  PaperClipIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/solid'
import {
  listProducts,
  saveProduct,
  deleteProduct,
  listCategories,
  uploadProductImage,
  uploadDigitalFile,
  toPublicUrl,
  formatMoney,
  getFxRate,
} from './shopAdminApi.js'

// Tipo de cambio USD→MXN. Lo trae el servidor de una fuente pública y lo
// cachea 12h, así que esto no sale a la red en cada producto. Se pide una vez
// por sesión del CMS; si falla, el autollenado simplemente no ocurre.
let fxRatePromise = null
const loadFxRate = () => {
  if (!fxRatePromise) {
    fxRatePromise = getFxRate()
      .then((fx) => ({ rate: Number(fx?.rate) || 0, at: fx?.at || '', stale: !!fx?.stale }))
      .catch(() => ({ rate: 0, at: '', stale: true }))
  }
  return fxRatePromise
}

// El MXN que corresponde a un USD dado. '' cuando no hay con qué calcularlo.
const mxnFromUsd = (usd, rate) => {
  const n = Number(usd)
  if (!rate || !Number.isFinite(n) || n <= 0) return ''
  return String(Math.round(n * rate))
}

const MAX_OPTIONS = 3
const MONEY_FIELDS = ['price_mxn', 'price_usd', 'compare_mxn', 'compare_usd']

const ERROR_MESSAGES = {
  title_required: 'Add a title in English or Spanish.',
  edition_size_required: 'A limited edition needs an edition size (how many units exist).',
  variants_required: 'At least one variant is required.',
  variant_duplicate: 'Two variants have the same option combination.',
  variant_options_mismatch: "A variant doesn't match the current options. Reload the product and try again.",
  variant_option_unknown: 'A variant uses an option value that no longer exists.',
  digital_files_required: 'An active digital product needs at least one file.',
  invalid_price: 'A price is not a valid amount. Use a number of 0 or more.',
  invalid_number: 'Stock, weight and edition size must be whole numbers of 0 or more.',
  too_many_options: `A product can have up to ${MAX_OPTIONS} options.`,
  unique_no_options: 'A 1/1 is a single piece. Remove its options, or make it a limited edition.',
  not_found: 'This product no longer exists. It may have been deleted somewhere else.',
  unauthorized: 'Your session expired. Log in again.',
  server_error: 'Server error. Check the PHP error log.',
  invalid_file_type: "That file type isn't allowed.",
  file_too_large: 'The file is too large.',
  upload_failed: 'The upload failed.',
  move_failed: "The server couldn't store the file.",
  rate_limit: 'Too many uploads at once. Wait a moment and try again.',
  uploads_pending: 'Wait for the uploads to finish before saving.',
}

const STATUS_LABEL = { active: 'Active', draft: 'Draft', archived: 'Archived' }
const STATUS_BADGE = { active: 'a-badge--success', draft: 'a-badge--warning', archived: '' }

const WARNING_LABEL = {
  no_mxn: 'No MXN price',
  no_usd: 'No USD price',
  no_images: 'No images',
  sold_out: 'Sold out',
}
const WARNING_BADGE = {
  no_mxn: 'a-badge--warning',
  no_usd: 'a-badge--warning',
  no_images: 'a-badge--warning',
  sold_out: 'a-badge--danger',
}

const KIND_LABEL = { physical: 'Physical', digital: 'Digital' }

// ═══════════════════════════════════════════════════════════════
// Helpers de datos
// ═══════════════════════════════════════════════════════════════

let uidSeq = 0
const uid = (prefix) => `${prefix}-${(uidSeq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const numToStr = (n) => (n === null || n === undefined ? '' : String(n))

// '' → null. Lo no numérico se manda tal cual para que el servidor lo
// rechace con su código (invalid_price / invalid_number) en vez de perderlo.
function toMoney(s) {
  const t = String(s ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : t
}

function toInt(s) {
  const t = String(s ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : t
}

function formatBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`
}

// Espejo del filtro de handleProductSave: una opción sin nombre o sin valores
// no existe para el servidor. Las variantes se generan solo contra estas, si
// no option_values no cuadra y el save truena con variant_options_mismatch.
function effectiveOptions(options) {
  const out = []
  for (const o of options) {
    const nameEn = o.name_en.trim()
    const nameEs = o.name_es.trim()
    if (!nameEn && !nameEs) continue
    const seen = new Set()
    const values = []
    for (const v of o.values) {
      const en = v.en.trim()
      if (!en || seen.has(en.toLowerCase())) continue
      seen.add(en.toLowerCase())
      values.push({ _key: v._key, en, es: v.es.trim() })
    }
    if (!values.length) continue
    out.push({ _key: o._key, name_en: nameEn, name_es: nameEs, values })
  }
  return out.slice(0, MAX_OPTIONS)
}

const cartesian = (lists) =>
  lists.reduce((acc, list) => acc.flatMap((prefix) => list.map((v) => [...prefix, v])), [[]])

const textSig = (values) => values.map((v) => String(v).trim().toLowerCase()).join('|')

function sigFor(options, values) {
  if (!values.length || values.length !== options.length) return ''
  const keys = []
  for (let i = 0; i < values.length; i++) {
    const want = String(values[i])
    const list = options[i].values
    const hit = list.find((v) => v.en === want)
      || list.find((v) => v.en.trim().toLowerCase() === want.trim().toLowerCase())
    if (!hit) return ''
    keys.push(hit._key)
  }
  return keys.join('|')
}

function emptyVariant() {
  return {
    _key: uid('var'),
    _sig: '',
    id: null,
    sku: '',
    option_values: [],
    price_mxn: '',
    price_usd: '',
    compare_mxn: '',
    compare_usd: '',
    stock: '',
    image_url: '',
    available: null,
    sold: 0,
    reserved: 0,
  }
}

const pricingOf = (row) => ({
  price_mxn: row.price_mxn,
  price_usd: row.price_usd,
  compare_mxn: row.compare_mxn,
  compare_usd: row.compare_usd,
  image_url: row.image_url,
})

function closestRow(prev, combo) {
  const keys = new Set(combo.map((v) => v._key))
  let best = null
  let bestScore = 0
  for (const r of prev) {
    const score = (r._sig ? r._sig.split('|') : []).filter((k) => keys.has(k)).length
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

// Filas que salieron de la tabla (p. ej. se borró el texto de un valor para
// reescribirlo) se guardan aquí; si su combinación vuelve, regresan con su
// id, sku y stock en vez de nacer vacías.
const STASH_MAX = 100

function syncVariants(options, prev, stash = []) {
  const eff = effectiveOptions(options)
  const prevKeys = new Set(prev.map((r) => r._key))
  const pool = [...prev, ...stash.filter((r) => !prevKeys.has(r._key))]
  const used = new Set()
  const leftovers = () => pool.filter((r) => !used.has(r._key)).slice(0, STASH_MAX)

  if (!eff.length) {
    const base = prev.find((r) => !r.option_values.length) || prev[0]
    if (base) used.add(base._key)
    return {
      variants: [base ? { ...base, _sig: '', option_values: [] } : emptyVariant()],
      stash: leftovers(),
    }
  }

  const bySig = new Map()
  const byText = new Map()
  for (const r of pool) {
    if (r._sig && !bySig.has(r._sig)) bySig.set(r._sig, r)
    if (r.option_values.length) {
      const t = textSig(r.option_values)
      if (!byText.has(t)) byText.set(t, r)
    }
  }
  // De "sin opciones" a "con opciones": la primera combinación hereda la
  // variante única completa (id incluido, para no huerfanear sus ventas) y
  // el resto solo sus precios.
  const single = prev.length === 1 && !prev[0].option_values.length ? prev[0] : null

  const variants = cartesian(eff.map((o) => o.values)).map((combo) => {
    const sig = combo.map((v) => v._key).join('|')
    const values = combo.map((v) => v.en)
    let row = bySig.get(sig)
    if (!row || used.has(row._key)) row = byText.get(textSig(values))
    if (row && !used.has(row._key)) {
      used.add(row._key)
      return { ...row, _sig: sig, option_values: values }
    }
    if (single && !used.has(single._key)) {
      used.add(single._key)
      return { ...single, _sig: sig, option_values: values }
    }
    // Combinación nueva (p. ej. se agregó la talla L): copia precios de la
    // fila más parecida para no recapturarlos; stock y sku nunca se heredan.
    const donor = single || closestRow(prev, combo)
    return { ...emptyVariant(), ...(donor ? pricingOf(donor) : {}), _sig: sig, option_values: values }
  })
  return { variants, stash: leftovers() }
}

function productToDraft(p) {
  const options = (p?.options || []).map((o) => ({
    _key: uid('opt'),
    name_en: o.name_en || '',
    name_es: o.name_es || '',
    values: (o.values || []).map((v) => ({ _key: uid('val'), en: v.en || '', es: v.es || '' })),
  }))
  const variants = (p?.variants || []).map((v) => {
    const optionValues = (v.option_values || []).map(String)
    return {
      ...emptyVariant(),
      _sig: sigFor(options, optionValues),
      id: v.id ?? null,
      sku: v.sku || '',
      option_values: optionValues,
      price_mxn: numToStr(v.price_mxn),
      price_usd: numToStr(v.price_usd),
      compare_mxn: numToStr(v.compare_mxn),
      compare_usd: numToStr(v.compare_usd),
      stock: numToStr(v.stock),
      image_url: v.image_url_raw ?? '',
      available: v.available ?? null,
      sold: v.sold || 0,
      reserved: v.reserved || 0,
    }
  })
  return {
    id: p?.id ?? null,
    title_en: p?.title_en || '',
    title_es: p?.title_es || '',
    description_en: p?.description_en || '',
    description_es: p?.description_es || '',
    slug: p?.slug || '',
    archive_id: p?.archive_id_raw || '',
    archive_auto: p?.archive_id || '',
    category_id: p?.category_id ? String(p.category_id) : '',
    status: p?.status || 'draft',
    kind: p?.kind || 'physical',
    edition: p?.edition || 'open',
    edition_size: numToStr(p?.edition_size),
    featured: !!p?.featured,
    weight_g: p?.weight_g ? String(p.weight_g) : '',
    // No se edita aquí, pero handleProductSave lo pisa con 0 si no viaja.
    display_order: p?.display_order ?? 0,
    images: (p?.images_raw || []).map((i) => ({
      _key: uid('img'),
      url: i.url || '',
      alt_en: i.alt_en || '',
      alt_es: i.alt_es || '',
    })),
    options,
    variants: syncVariants(options, variants).variants,
    _stash: [],
    digital_files: (p?.digital_files || []).map((f) => ({
      _key: uid('file'),
      key: f.key,
      name: f.name || f.key,
      size: f.size || 0,
    })),
  }
}

function duplicateDraft(p) {
  const d = productToDraft(p)
  return {
    ...d,
    id: null,
    slug: '',
    archive_id: '',
    archive_auto: '',
    status: 'draft',
    featured: false,
    title_en: d.title_en ? `${d.title_en} (copy)` : '',
    title_es: d.title_es ? `${d.title_es} (copy)` : '',
    // Los archivos digitales NO se copian: compartir la misma key entre dos
    // productos haría que al quitarla de uno el servidor la borre del disco.
    digital_files: [],
    // En 1/1 y limitada el stock es "lo que queda de la edición": la copia es
    // una edición nueva, así que arranca llena (vacío = default del servidor).
    variants: d.variants.map((v) => ({
      ...v,
      id: null,
      sku: '',
      stock: d.edition === 'open' ? v.stock : '',
      available: null,
      sold: 0,
      reserved: 0,
    })),
  }
}

function buildPayload(d) {
  const eff = effectiveOptions(d.options)
  return {
    id: d.id || null,
    title_en: d.title_en.trim(),
    title_es: d.title_es.trim(),
    description_en: d.description_en,
    description_es: d.description_es,
    slug: d.slug.trim(),
    archive_id: d.archive_id.trim().toUpperCase(),
    category_id: d.category_id ? Number(d.category_id) : null,
    status: d.status,
    kind: d.kind,
    edition: d.edition,
    edition_size: d.edition === 'limited' ? toInt(d.edition_size) : null,
    featured: !!d.featured,
    weight_g: d.kind === 'physical' ? toInt(d.weight_g) : null,
    display_order: d.display_order,
    images: d.images.map((i) => ({ url: i.url, alt_en: i.alt_en.trim(), alt_es: i.alt_es.trim() })),
    options: eff.map((o) => ({
      name_en: o.name_en,
      name_es: o.name_es,
      values: o.values.map((v) => ({ en: v.en, es: v.es })),
    })),
    variants: d.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim(),
      option_values: eff.length ? v.option_values : [],
      price_mxn: toMoney(v.price_mxn),
      price_usd: toMoney(v.price_usd),
      compare_mxn: toMoney(v.compare_mxn),
      compare_usd: toMoney(v.compare_usd),
      stock: toInt(v.stock),
      image_url: v.image_url,
    })),
    digital_files: d.digital_files.map((f) => ({ key: f.key, name: f.name, size: f.size })),
  }
}

// Mismo shape que los errores de shopAdminApi (message = código, payload = extra).
const localError = (code, extra = {}) => ({ message: code, payload: extra })

function validateDraft(d) {
  if (!d.title_en.trim() && !d.title_es.trim()) return localError('title_required')
  if (d.edition === 'limited' && !(toInt(d.edition_size) >= 1)) return localError('edition_size_required')
  if (d.edition === 'unique' && effectiveOptions(d.options).length) return localError('unique_no_options')
  for (let i = 0; i < d.variants.length; i++) {
    for (const f of MONEY_FIELDS) {
      const n = toMoney(d.variants[i][f])
      if (n !== null && (typeof n !== 'number' || n < 0)) return localError('invalid_price', { index: i })
    }
  }
  if (d.kind === 'digital' && d.status === 'active' && !d.digital_files.length) {
    return localError('digital_files_required')
  }
  return null
}

const variantLabel = (v) => (v.option_values.length ? v.option_values.join(' · ') : 'Default')

function describeError(err, variants) {
  const code = err?.message || 'error'
  const extra = err?.payload || {}
  let msg = ERROR_MESSAGES[code]
    || (code.startsWith('upload_error_') ? ERROR_MESSAGES.upload_failed : `Something went wrong (${code}).`)
  if (Number.isInteger(extra.index) && variants?.[extra.index]) {
    msg += ` Variant ${extra.index + 1}: ${variantLabel(variants[extra.index])}.`
  }
  if (extra.value) msg += ` Value: "${extra.value}".`
  return msg
}

function editionLabel(edition, size) {
  if (edition === 'unique') return '1/1'
  if (edition === 'limited') return `Edition of ${size ?? '?'}`
  return 'Open edition'
}

function productStats(p) {
  const vs = p.variants || []
  const pick = (f) => vs.map((v) => v[f]).filter((n) => n !== null && n !== undefined)
  const mxn = pick('price_mxn')
  const usd = pick('price_usd')
  const unlimited = vs.some((v) => v.available === null || v.available === undefined)
  const warnings = []
  if (vs.some((v) => v.price_mxn === null || v.price_mxn === undefined)) warnings.push('no_mxn')
  if (vs.some((v) => v.price_usd === null || v.price_usd === undefined)) warnings.push('no_usd')
  if (vs.length && vs.every((v) => v.available === 0)) warnings.push('sold_out')
  if (!(p.images || []).length) warnings.push('no_images')
  return {
    minMxn: mxn.length ? Math.min(...mxn) : null,
    mxnVaries: new Set(mxn).size > 1,
    minUsd: usd.length ? Math.min(...usd) : null,
    usdVaries: new Set(usd).size > 1,
    stock: unlimited ? '∞' : vs.reduce((s, v) => s + (v.available || 0), 0),
    warnings,
  }
}

function matchesSearch(p, q) {
  if (!q) return true
  const hay = [p.title_en, p.title_es, p.archive_id, ...(p.variants || []).map((v) => v.sku)]
  return hay.some((s) => (s || '').toLowerCase().includes(q))
}

// ═══════════════════════════════════════════════════════════════
// Panel
// ═══════════════════════════════════════════════════════════════

// Vista de nivel superior: sin botón back (la navegación vive en el sidebar),
// así que el onBack que manda AdminApp ya no se usa.
export default function ProductsPanel() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editor, setEditor] = useState(null)
  const [filters, setFilters] = useState({ status: 'all', category: '', q: '' })
  const [busyId, setBusyId] = useState(null)
  const listScroll = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, cats] = await Promise.all([listProducts(), listCategories()])
      setProducts(prods || [])
      setCategories(cats || [])
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEditor = (draft, isCopy = false) => {
    listScroll.current = window.scrollY
    setEditor({ draft, isCopy, key: uid('editor') })
    window.scrollTo(0, 0)
  }

  const closeEditor = () => {
    setEditor(null)
    load()
    requestAnimationFrame(() => window.scrollTo(0, listScroll.current))
  }

  const quickStatus = async (p) => {
    const next = p.status === 'active' ? 'draft' : p.status === 'draft' ? 'active' : 'draft'
    setBusyId(p.id)
    setError(null)
    const draft = { ...productToDraft(p), status: next }
    try {
      await saveProduct(buildPayload(draft))
      await load()
    } catch (err) {
      setError(`${p.title_es || p.title_en}: ${describeError(err, draft.variants)}`)
    } finally {
      setBusyId(null)
    }
  }

  if (editor) {
    return (
      <ProductEditor
        key={editor.key}
        initialDraft={editor.draft}
        isCopy={editor.isCopy}
        categories={categories}
        onClose={closeEditor}
      />
    )
  }

  return (
    <ProductList
      products={products}
      categories={categories}
      loading={loading}
      error={error}
      filters={filters}
      setFilters={setFilters}
      busyId={busyId}
      onNew={() => openEditor(productToDraft(null))}
      onEdit={(p) => openEditor(productToDraft(p))}
      onDuplicate={(p) => openEditor(duplicateDraft(p), true)}
      onQuickStatus={quickStatus}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// Lista
// ═══════════════════════════════════════════════════════════════

function ProductList({
  products, categories, loading, error, filters, setFilters, busyId,
  onNew, onEdit, onDuplicate, onQuickStatus,
}) {
  const q = filters.q.trim().toLowerCase()

  // Los conteos de los chips respetan categoría y búsqueda, no el status.
  const preStatus = useMemo(() => products.filter((p) => {
    if (filters.category === '__none' && p.category_id) return false
    if (filters.category && filters.category !== '__none' && String(p.category_id) !== filters.category) return false
    return matchesSearch(p, q)
  }), [products, filters.category, q])

  const counts = useMemo(() => {
    const c = { all: preStatus.length, active: 0, draft: 0, archived: 0 }
    preStatus.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1 })
    return c
  }, [preStatus])

  const visible = filters.status === 'all' ? preStatus : preStatus.filter((p) => p.status === filters.status)

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="a-title">Products</h1>
          <p className="a-subtitle">Catalog, stock and prices in MXN and USD.</p>
        </div>
        <button type="button" onClick={onNew} className="a-btn a-btn--primary self-start sm:self-auto">
          <PlusIcon className="w-4 h-4" aria-hidden />
          New product
        </button>
      </header>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {['all', 'active', 'draft', 'archived'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, status: s }))}
              aria-pressed={filters.status === s}
              className="a-chip"
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
              <span className="a-chip__count">{counts[s] || 0}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search by title, archive ID or SKU"
              aria-label="Search products"
              className="a-input pl-10"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            aria-label="Filter by category"
            className="a-input"
          >
            <option value="">All categories</option>
            <option value="__none">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name_es || c.name_en}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !products.length ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Loading products" />
        </div>
      ) : visible.length === 0 ? (
        <div className="a-empty">
          {products.length ? 'Nothing matches these filters.' : 'No products yet. Create the first one with New product.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              busy={busyId === p.id}
              onEdit={() => onEdit(p)}
              onDuplicate={() => onDuplicate(p)}
              onQuickStatus={() => onQuickStatus(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductRow({ product: p, busy, onEdit, onDuplicate, onQuickStatus }) {
  const stats = productStats(p)
  const cover = p.images?.[0]?.url
  const primary = p.title_es || p.title_en
  const secondary = p.title_en && p.title_en !== primary ? p.title_en : ''
  const toggleLabel = p.status === 'active' ? 'Unpublish' : p.status === 'draft' ? 'Publish' : 'Unarchive'
  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onEdit() }}
      className="a-card a-card--interactive p-3 sm:p-4 flex gap-3 sm:gap-4"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 grid place-items-center overflow-hidden rounded-[var(--a-radius-sm)] border-2 border-white/10 bg-[var(--a-surface-2)]">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-contain" draggable={false} loading="lazy" />
        ) : (
          <PhotoIcon className="w-6 h-6 text-white/20" aria-hidden />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold text-white truncate flex items-center gap-1.5">
              {p.featured && (
                <StarIcon className="w-4 h-4 text-section-quests flex-shrink-0" title="Featured" />
              )}
              <span className="truncate">{primary || 'Untitled'}</span>
            </p>
            {secondary && <p className="text-xs text-white/45 truncate mt-0.5">{secondary}</p>}
          </div>
          <span className={`a-badge flex-shrink-0 ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}>
            {STATUS_LABEL[p.status] || p.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-white/55 a-num">
          {p.archive_id && <span className="a-code">{p.archive_id}</span>}
          {p.category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="a-dot" style={{ backgroundColor: p.category.color }} aria-hidden />
              {p.category.name_es || p.category.name_en}
            </span>
          )}
          <span>{KIND_LABEL[p.kind] || p.kind}</span>
          <span>{editionLabel(p.edition, p.edition_size)}</span>
          <span>{stats.minMxn === null ? '— MXN' : `${stats.mxnVaries ? 'From ' : ''}${formatMoney(stats.minMxn, 'MXN')}`}</span>
          <span>{stats.minUsd === null ? '— USD' : `${stats.usdVaries ? 'From ' : ''}${formatMoney(stats.minUsd, 'USD')}`}</span>
          <span>Stock {stats.stock}</span>
          <span>{p.sold || 0} sold</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <div className="flex flex-wrap gap-1.5">
            {stats.warnings.map((w) => (
              <span key={w} className={`a-badge ${WARNING_BADGE[w] || ''}`}>
                {WARNING_LABEL[w] || w}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={stop(onDuplicate)}
              className="a-btn a-btn--secondary a-btn--sm"
              title="Duplicate as a new draft"
            >
              <DocumentDuplicateIcon className="w-3.5 h-3.5" aria-hidden />
              Duplicate
            </button>
            <button
              type="button"
              onClick={stop(onQuickStatus)}
              disabled={busy}
              className="a-btn a-btn--secondary a-btn--sm"
            >
              {busy ? <span className="a-spinner a-spinner--sm" aria-hidden /> : null}
              {toggleLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Editor
// ═══════════════════════════════════════════════════════════════

function ProductEditor({ initialDraft, isCopy, categories, onClose }) {
  const [draft, setDraft] = useState(initialDraft)
  // Una copia nunca está "guardada": baseline null = siempre dirty.
  const [baseline, setBaseline] = useState(() => (isCopy ? null : JSON.stringify(buildPayload(initialDraft))))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [imgUploads, setImgUploads] = useState([])
  const [fileUploads, setFileUploads] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCompare, setShowCompare] = useState(() =>
    initialDraft.variants.some((v) => v.compare_mxn !== '' || v.compare_usd !== ''))
  const [fx, setFx] = useState({ rate: 0, at: '', stale: false })
  const fxRate = fx.rate
  const noticeTimer = useRef(null)

  useEffect(() => {
    let alive = true
    loadFxRate().then((v) => { if (alive) setFx(v) })
    return () => { alive = false }
  }, [])
  const idBase = useId()

  const payloadString = useMemo(() => JSON.stringify(buildPayload(draft)), [draft])
  const dirty = baseline === null || payloadString !== baseline
  const uploadsBusy = imgUploads.some((u) => u.status !== 'error') || fileUploads.some((u) => u.status !== 'error')
  const effOptions = useMemo(() => effectiveOptions(draft.options), [draft.options])

  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const setOptions = useCallback((fn) => {
    setDraft((d) => {
      const options = fn(d.options)
      const { variants, stash } = syncVariants(options, d.variants, d._stash)
      return { ...d, options, variants, _stash: stash }
    })
  }, [])

  // El precio en MXN sigue al de USD mientras nadie lo haya escrito a mano:
  // si el valor actual está vacío o es exactamente el que habíamos calculado,
  // lo recalculamos; si Oscar puso otro (un 1,299 redondo, por ejemplo), se
  // respeta y deja de seguirlo.
  const trackMxn = useCallback((prev, next, patch) => {
    for (const [usdField, mxnField] of [['price_usd', 'price_mxn'], ['compare_usd', 'compare_mxn']]) {
      if (!(usdField in patch)) continue
      const current = String(prev[mxnField] ?? '').trim()
      if (current === '' || current === mxnFromUsd(prev[usdField], fxRate)) {
        next[mxnField] = mxnFromUsd(next[usdField], fxRate)
      }
    }
    return next
  }, [fxRate])

  const updateVariant = useCallback((key, patch) => {
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v) => (v._key === key ? trackMxn(v, { ...v, ...patch }, patch) : v)),
    }))
  }, [trackMxn])

  const applyToAll = useCallback((field, value) => {
    const patch = { [field]: value }
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v) => trackMxn(v, { ...v, ...patch }, patch)),
    }))
  }, [trackMxn])

  const setEdition = (edition) => {
    setDraft((d) => ({
      ...d,
      edition,
      variants: edition === 'unique'
        ? d.variants.map((v) => (toInt(v.stock) > 1 ? { ...v, stock: '1' } : v))
        : d.variants,
    }))
  }

  // ── Imágenes ──
  // En serie y en el orden elegido: el orden de selección es el orden de la
  // galería, y el hosting compartido agradece no recibir 10 uploads a la vez.
  const addImageFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const queue = files.map((file) => ({ _key: uid('up'), name: file.name, status: 'queued', file }))
    setImgUploads((u) => [...u, ...queue.map(({ file, ...rest }) => rest)])
    for (const item of queue) {
      setImgUploads((u) => u.map((x) => (x._key === item._key ? { ...x, status: 'uploading' } : x)))
      try {
        const path = await uploadProductImage(item.file)
        const image = { _key: uid('img'), url: path, alt_en: '', alt_es: '' }
        setDraft((d) => ({ ...d, images: [...d.images, image] }))
        setImgUploads((u) => u.filter((x) => x._key !== item._key))
      } catch (err) {
        setImgUploads((u) => u.map((x) => (x._key === item._key ? { ...x, status: 'error', error: describeError(err) } : x)))
      }
    }
  }

  const removeImage = (key) => {
    setDraft((d) => {
      const target = d.images.find((i) => i._key === key)
      const images = d.images.filter((i) => i._key !== key)
      const stillUsed = target && images.some((i) => i.url === target.url)
      return {
        ...d,
        images,
        variants: target && !stillUsed
          ? d.variants.map((v) => (v.image_url === target.url ? { ...v, image_url: '' } : v))
          : d.variants,
      }
    })
  }

  const patchImage = (key, patch) => {
    setDraft((d) => ({ ...d, images: d.images.map((i) => (i._key === key ? { ...i, ...patch } : i)) }))
  }

  const reorderImages = (activeId, overId) => {
    setDraft((d) => {
      const from = d.images.findIndex((i) => i._key === activeId)
      const to = d.images.findIndex((i) => i._key === overId)
      if (from < 0 || to < 0) return d
      return { ...d, images: arrayMove(d.images, from, to) }
    })
  }

  // ── Archivos digitales ──
  const addDigitalFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const queue = files.map((file) => ({ _key: uid('up'), name: file.name, size: file.size, status: 'queued', file }))
    setFileUploads((u) => [...u, ...queue.map(({ file, ...rest }) => rest)])
    for (const item of queue) {
      setFileUploads((u) => u.map((x) => (x._key === item._key ? { ...x, status: 'uploading' } : x)))
      try {
        const f = await uploadDigitalFile(item.file)
        const entry = { _key: uid('file'), key: f.key, name: f.name, size: f.size }
        setDraft((d) => ({ ...d, digital_files: [...d.digital_files, entry] }))
        setFileUploads((u) => u.filter((x) => x._key !== item._key))
      } catch (err) {
        setFileUploads((u) => u.map((x) => (x._key === item._key ? { ...x, status: 'error', error: describeError(err) } : x)))
      }
    }
  }

  const removeDigitalFile = (key) => {
    setDraft((d) => ({ ...d, digital_files: d.digital_files.filter((f) => f._key !== key) }))
  }

  // ── Acciones ──
  const flashNotice = (kind, ms) => {
    clearTimeout(noticeTimer.current)
    setNotice(kind)
    if (ms) noticeTimer.current = setTimeout(() => setNotice(null), ms)
  }

  const leave = () => {
    if ((dirty || uploadsBusy) && !window.confirm('You have unsaved changes. Leave without saving?')) return
    onClose()
  }

  const save = async () => {
    if (saving) return
    setError(null)
    if (uploadsBusy) {
      setError(describeError(localError('uploads_pending')))
      return
    }
    const invalid = validateDraft(draft)
    if (invalid) {
      setError(describeError(invalid, draft.variants))
      return
    }
    setSaving(true)
    try {
      const saved = await saveProduct(buildPayload(draft))
      const next = productToDraft(saved)
      setDraft(next)
      setBaseline(JSON.stringify(buildPayload(next)))
      flashNotice('saved', 2500)
    } catch (err) {
      setError(describeError(err, draft.variants))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft.id || deleting) return
    const title = draft.title_es || draft.title_en || draft.archive_auto
    if (!window.confirm(`Delete "${title}"? This cannot be undone.\n(If it has orders it will be archived instead.)`)) return
    setDeleting(true)
    setError(null)
    try {
      const res = await deleteProduct(draft.id)
      if (res.archived) {
        setDraft((d) => ({ ...d, status: 'archived' }))
        setBaseline((b) => (b ? JSON.stringify({ ...JSON.parse(b), status: 'archived' }) : b))
        flashNotice('archived')
      } else {
        onClose()
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setDeleting(false)
    }
  }

  const missing = useMemo(() => ({
    mxn: draft.variants.filter((v) => toMoney(v.price_mxn) === null).length,
    usd: draft.variants.filter((v) => toMoney(v.price_usd) === null).length,
  }), [draft.variants])

  const isNew = !draft.id
  const category = categories.find((c) => String(c.id) === draft.category_id)
  const categoryMissing = draft.category_id && !category
  const busy = saving || deleting

  return (
    <div className="w-full space-y-6">
      {/* top-14 = alto de la barra superior fija del shell en mobile */}
      <div className="sticky top-14 md:top-0 z-30 py-3 sm:py-4 bg-[var(--a-bg)] border-b-2 border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={leave}
            className="a-icon-btn"
            aria-label="Back to products"
            title="Back to products"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="a-title">{isNew ? 'New product' : 'Edit product'}</h1>
            <p className="a-subtitle truncate">
              {isCopy && isNew
                ? 'Copy, not saved yet'
                : isNew
                  ? 'Unsaved draft'
                  : (
                    <>
                      <span className="a-code">{draft.archive_id || draft.archive_auto}</span>
                      {' · '}ID <span className="a-num">{draft.id}</span>
                    </>
                  )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span aria-live="polite" className="inline-flex">
            {notice === 'saved' && <span className="a-badge a-badge--success">Saved</span>}
          </span>
          {dirty && notice !== 'saved' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <span className="a-dot bg-amber-400" aria-hidden />
              Unsaved changes
            </span>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="a-btn a-btn--danger"
            >
              <TrashIcon className="w-4 h-4" aria-hidden />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="a-btn a-btn--primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {notice === 'archived' && (
        <div className="a-alert a-alert--success px-4 py-3" role="status">
          <p>This product has orders, so it was archived instead of deleted.</p>
        </div>
      )}

      {draft.status === 'active' && (missing.mxn > 0 || missing.usd > 0) && (
        <div className="a-alert a-alert--warning px-4 py-3">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            {missing.mxn > 0 && (
              <p>
                {missing.mxn} variant{missing.mxn === 1 ? '' : 's'} without an MXN price can't be bought in regions that pay in MXN.
              </p>
            )}
            {missing.usd > 0 && (
              <p>
                {missing.usd} variant{missing.usd === 1 ? '' : 's'} without a USD price can't be bought in regions that pay in USD.
              </p>
            )}
            <p className="opacity-70">You can still save.</p>
          </div>
        </div>
      )}

      <fieldset disabled={busy} className="min-w-0 border-0 p-0 m-0 space-y-6">
        <Section icon={TagIcon} title="Basics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Title (EN)" value={draft.title_en} onChange={(v) => set({ title_en: v })} maxLength={200} placeholder="Skull Tee" />
            <TextField label="Title (ES)" value={draft.title_es} onChange={(v) => set({ title_es: v })} maxLength={200} placeholder="Playera Skull" />
            <TextArea label="Description (EN)" value={draft.description_en} onChange={(v) => set({ description_en: v })} />
            <TextArea label="Description (ES)" value={draft.description_es} onChange={(v) => set({ description_es: v })} />
          </div>
          <p className="a-help">Plain text. Line breaks are kept. If one language is empty, the store shows the other.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor={`${idBase}-category`}>Category</Label>
              <div className="flex items-center gap-2">
                {category && (
                  <span className="a-dot w-3 h-3" style={{ backgroundColor: category.color }} aria-hidden />
                )}
                <select
                  id={`${idBase}-category`}
                  value={draft.category_id}
                  onChange={(e) => set({ category_id: e.target.value })}
                  className="a-input"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name_es || c.name_en}</option>
                  ))}
                  {categoryMissing && <option value={draft.category_id}>#{draft.category_id} (deleted)</option>}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor={`${idBase}-status`}>Status</Label>
              <select
                id={`${idBase}-status`}
                value={draft.status}
                onChange={(e) => set({ status: e.target.value })}
                className="a-input"
              >
                <option value="draft">Draft — hidden</option>
                <option value="active">Active — on sale</option>
                <option value="archived">Archived — hidden, keeps history</option>
              </select>
            </div>
            <TextField
              label="Archive ID (optional)"
              value={draft.archive_id}
              onChange={(v) => set({ archive_id: v.toUpperCase() })}
              maxLength={40}
              placeholder={`Auto: ${draft.archive_auto || 'SKR-0001'}`}
            />
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={draft.featured}
              aria-labelledby={`${idBase}-featured`}
              aria-describedby={`${idBase}-featured-help`}
              onClick={() => set({ featured: !draft.featured })}
              className="a-switch mt-0.5"
            />
            <div className="min-w-0">
              <span id={`${idBase}-featured`} className="block text-sm font-semibold text-white">Featured</span>
              <p id={`${idBase}-featured-help`} className="a-help">
                The store's featured piece. The override in Storefront wins over this flag.
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="a-btn a-btn--ghost a-btn--sm -ml-3"
            >
              {showAdvanced
                ? <ChevronDownIcon className="w-3.5 h-3.5" aria-hidden />
                : <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />}
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-1.5">
                <TextField
                  label="Slug (optional)"
                  value={draft.slug}
                  onChange={(v) => set({ slug: v })}
                  maxLength={160}
                  placeholder="Generated from the English title"
                />
                <p className="a-help">Leave it empty to generate it from the English title. Changing it breaks links that were already shared.</p>
              </div>
            )}
          </div>
        </Section>

        <Section icon={CubeIcon} title="Type">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Segmented
              label="Kind"
              value={draft.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: 'physical', label: 'Physical' },
                { value: 'digital', label: 'Digital' },
              ]}
            />
            <Segmented
              label="Edition"
              value={draft.edition}
              onChange={setEdition}
              options={[
                { value: 'unique', label: 'Unique 1/1' },
                { value: 'limited', label: 'Limited' },
                { value: 'open', label: 'Open' },
              ]}
            />
          </div>

          {(draft.edition === 'limited' || draft.kind === 'physical') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {draft.edition === 'limited' && (
                <div className="space-y-1.5">
                  <TextField
                    label="Edition size *"
                    type="number"
                    min={1}
                    step={1}
                    value={draft.edition_size}
                    onChange={(v) => set({ edition_size: v })}
                    placeholder="50"
                  />
                  <p className="a-help">Total units in the edition.</p>
                </div>
              )}
              {draft.kind === 'physical' && (
                <div className="space-y-1.5">
                  <TextField
                    label="Weight (g)"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.weight_g}
                    onChange={(v) => set({ weight_g: v })}
                    placeholder="250"
                  />
                  <p className="a-help">Packed weight in grams, used to quote shipping.</p>
                </div>
              )}
            </div>
          )}

          {draft.kind === 'physical' && draft.digital_files.length > 0 && (
            <p className="a-help">
              {draft.digital_files.length} digital file{draft.digital_files.length === 1 ? ' is' : 's are'} still attached.
              {' '}They stay hidden and aren't delivered while the product is physical.
            </p>
          )}
        </Section>

        <ImagesSection
          images={draft.images}
          uploads={imgUploads}
          onFiles={addImageFiles}
          onRemove={removeImage}
          onPatch={patchImage}
          onReorder={reorderImages}
          onDismissUpload={(key) => setImgUploads((u) => u.filter((x) => x._key !== key))}
        />

        {/* Sin opciones, el producto tiene un precio y punto: va en su propia
            sección, arriba. La de variantes solo aparece cuando hay opciones
            — antes el precio se capturaba en una fila "Default" dentro de una
            tabla de variantes que el producto ni siquiera tenía. */}
        {(draft.options || []).length === 0 ? (
          <>
            <Section icon={CurrencyDollarIcon} title="Price">
              <VariantsTable
                draft={draft}
                effOptions={effOptions}
                showCompare={showCompare}
                setShowCompare={setShowCompare}
                updateVariant={updateVariant}
                applyToAll={applyToAll}
                fxRate={fxRate}
                fxStale={fx.stale}
              />
            </Section>
            <Section icon={Squares2X2Icon} title="Options">
              <OptionsEditor options={draft.options} setOptions={setOptions} />
            </Section>
          </>
        ) : (
          <Section icon={Squares2X2Icon} title="Options and variants">
            <OptionsEditor options={draft.options} setOptions={setOptions} />
            <hr className="a-divider" />
            <VariantsTable
              draft={draft}
              effOptions={effOptions}
              showCompare={showCompare}
              setShowCompare={setShowCompare}
              updateVariant={updateVariant}
              applyToAll={applyToAll}
              fxRate={fxRate}
              fxStale={fx.stale}
            />
          </Section>
        )}

        {draft.kind === 'digital' && (
          <DigitalFilesSection
            files={draft.digital_files}
            uploads={fileUploads}
            onFiles={addDigitalFiles}
            onRemove={removeDigitalFile}
            onDismissUpload={(key) => setFileUploads((u) => u.filter((x) => x._key !== key))}
            requiredNow={draft.status === 'active'}
          />
        )}
      </fieldset>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Imágenes
// ═══════════════════════════════════════════════════════════════

function ImagesSection({ images, uploads, onFiles, onRemove, onPatch, onReorder, onDismissUpload }) {
  const inputRef = useRef(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    onReorder(active.id, over.id)
  }

  const pick = () => inputRef.current?.click()

  return (
    <Section
      icon={PhotoIcon}
      title="Images"
      right={
        <button type="button" onClick={pick} className="a-btn a-btn--secondary a-btn--sm">
          <ArrowUpTrayIcon className="w-3.5 h-3.5" aria-hidden />
          Upload images
        </button>
      }
    >
      <p className="a-help">
        The first image is the cover. Drag to reorder. Store cards are square, so square photos fill them best.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {images.length === 0 && uploads.length === 0 ? (
        <button
          type="button"
          onClick={pick}
          className="a-empty w-full flex flex-col items-center gap-2 transition-colors hover:border-white/25 hover:text-white/70"
        >
          <PhotoIcon className="w-8 h-8 text-white/20" aria-hidden />
          No images yet. Click to upload.
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i._key)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <SortableImage
                  key={img._key}
                  image={img}
                  index={i}
                  onRemove={() => onRemove(img._key)}
                  onPatch={(patch) => onPatch(img._key, patch)}
                />
              ))}
              {uploads.map((u) => (
                <UploadTile key={u._key} upload={u} onDismiss={() => onDismissUpload(u._key)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </Section>
  )
}

function SortableImage({ image, index, onRemove, onPatch }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image._key })

  return (
    <div
      ref={setNodeRef}
      className={`a-inset overflow-hidden flex flex-col ${isDragging ? 'border-section-quests' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 150ms ease',
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.9 : 1,
      }}
    >
      <div className="relative aspect-square border-b-2 border-white/10">
        <img
          src={toPublicUrl(image.url)}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
        {/* touch-action none solo en el handle: el resto del tile deja scrollear en mobile */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="a-icon-btn a-icon-btn--sm absolute top-2 left-2 bg-[var(--a-surface)] cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          aria-label={`Drag to reorder image ${index + 1}`}
          title="Drag to reorder"
        >
          <Bars3Icon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="a-icon-btn a-icon-btn--sm a-icon-btn--danger absolute top-2 right-2 bg-[var(--a-surface)]"
          aria-label={`Remove image ${index + 1}`}
          title="Remove image"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
        <span
          className={`a-badge absolute bottom-2 left-2 ${
            index === 0 ? 'bg-section-quests text-[var(--a-on-accent)]' : 'bg-[var(--a-surface)] text-white/70'
          }`}
        >
          {index === 0 ? 'Cover' : `#${index + 1}`}
        </span>
      </div>
      <div className="p-2 space-y-1.5">
        <input
          type="text"
          value={image.alt_en}
          onChange={(e) => onPatch({ alt_en: e.target.value })}
          placeholder="Alt text (EN)"
          aria-label={`Image ${index + 1} alt text (English)`}
          maxLength={255}
          className="a-input px-2.5 py-1.5 text-xs"
        />
        <input
          type="text"
          value={image.alt_es}
          onChange={(e) => onPatch({ alt_es: e.target.value })}
          placeholder="Alt text (ES)"
          aria-label={`Image ${index + 1} alt text (Spanish)`}
          maxLength={255}
          className="a-input px-2.5 py-1.5 text-xs"
        />
      </div>
    </div>
  )
}

function UploadTile({ upload, onDismiss }) {
  const failed = upload.status === 'error'
  return (
    <div className={`a-inset overflow-hidden flex flex-col ${failed ? 'border-red-500/40' : 'border-dashed'}`}>
      <div className="relative aspect-square flex flex-col items-center justify-center gap-2 p-3 text-center">
        {failed ? (
          <>
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400" aria-hidden />
            <span className="text-red-300 text-xs break-words" role="alert">{upload.error}</span>
            <button type="button" onClick={onDismiss} className="a-btn a-btn--ghost a-btn--sm">
              Dismiss
            </button>
          </>
        ) : (
          <>
            <div
              className={`a-spinner ${upload.status === 'uploading' ? '' : 'animate-none opacity-30'}`}
              aria-hidden
            />
            <span className="a-meta">
              {upload.status === 'uploading' ? 'Uploading…' : 'Queued'}
            </span>
          </>
        )}
      </div>
      <p className="px-2.5 pb-2 a-meta truncate">{upload.name}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Opciones y variantes
// ═══════════════════════════════════════════════════════════════

function optionIssues(opt) {
  const issues = []
  if (!opt.name_en.trim() && !opt.name_es.trim()) issues.push('Needs a name. It is ignored until it has one.')
  const seen = new Set()
  const dupes = new Set()
  let esOnly = false
  for (const v of opt.values) {
    const en = v.en.trim()
    if (!en) {
      if (v.es.trim()) esOnly = true
      continue
    }
    const k = en.toLowerCase()
    if (seen.has(k)) dupes.add(en)
    seen.add(k)
  }
  if (esOnly) issues.push('Values without English text are ignored (English is the canonical value).')
  if (dupes.size) issues.push(`Duplicate values ignored: ${[...dupes].join(', ')}.`)
  if (!seen.size && (opt.name_en.trim() || opt.name_es.trim())) issues.push('Add at least one value.')
  return issues
}

function OptionsEditor({ options, setOptions }) {
  const [focusKey, setFocusKey] = useState(null)

  const addOption = () => {
    const opt = { _key: uid('opt'), name_en: '', name_es: '', values: [{ _key: uid('val'), en: '', es: '' }] }
    setOptions((opts) => (opts.length >= MAX_OPTIONS ? opts : [...opts, opt]))
  }
  const removeOption = (key) => setOptions((opts) => opts.filter((o) => o._key !== key))
  const patchOption = (key, patch) => setOptions((opts) => opts.map((o) => (o._key === key ? { ...o, ...patch } : o)))
  const addValue = (optKey) => {
    const val = { _key: uid('val'), en: '', es: '' }
    setFocusKey(val._key)
    setOptions((opts) => opts.map((o) => (o._key === optKey ? { ...o, values: [...o.values, val] } : o)))
  }
  const patchValue = (optKey, valKey, patch) => setOptions((opts) => opts.map((o) => (
    o._key === optKey ? { ...o, values: o.values.map((v) => (v._key === valKey ? { ...v, ...patch } : v)) } : o
  )))
  const removeValue = (optKey, valKey) => setOptions((opts) => opts.map((o) => (
    o._key === optKey ? { ...o, values: o.values.filter((v) => v._key !== valKey) } : o
  )))

  const onValueKeyDown = (optKey) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addValue(optKey)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">
          Options <span className="a-meta ml-1">{options.length}/{MAX_OPTIONS}</span>
        </h3>
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="a-btn a-btn--secondary a-btn--sm"
        >
          <PlusIcon className="w-3.5 h-3.5" aria-hidden />
          Add option
        </button>
      </div>
      <p className="a-help">
        For example color or size. The English value is the canonical one that variants are matched by; the Spanish one is only its label in Spanish. Press Enter to add another value.
      </p>

      {options.length === 0 ? (
        <p className="a-help">
          Add an option only if the product comes in variations — color, size.
          Each combination then gets its own price and stock.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {options.map((opt, i) => {
            const issues = optionIssues(opt)
            return (
              <div key={opt._key} className="a-inset p-3 sm:p-4 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white/80">Option {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeOption(opt._key)}
                    className="a-btn a-btn--danger a-btn--sm"
                  >
                    <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Name (EN)" value={opt.name_en} onChange={(v) => patchOption(opt._key, { name_en: v })} maxLength={60} placeholder="Color" />
                  <TextField label="Name (ES)" value={opt.name_es} onChange={(v) => patchOption(opt._key, { name_es: v })} maxLength={60} placeholder="Color" />
                </div>
                <div className="space-y-1.5">
                  <span className="a-label">Values</span>
                  {opt.values.map((v, vi) => (
                    <div key={v._key} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                      <input
                        type="text"
                        value={v.en}
                        onChange={(e) => patchValue(opt._key, v._key, { en: e.target.value })}
                        onKeyDown={onValueKeyDown(opt._key)}
                        autoFocus={v._key === focusKey}
                        maxLength={60}
                        placeholder="English *"
                        aria-label={`Option ${i + 1}, value ${vi + 1} (English)`}
                        className="a-input min-w-0 px-2.5 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={v.es}
                        onChange={(e) => patchValue(opt._key, v._key, { es: e.target.value })}
                        onKeyDown={onValueKeyDown(opt._key)}
                        maxLength={60}
                        placeholder="Spanish (optional)"
                        aria-label={`Option ${i + 1}, value ${vi + 1} (Spanish)`}
                        className="a-input min-w-0 px-2.5 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeValue(opt._key, v._key)}
                        className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                        aria-label={`Remove value ${vi + 1}`}
                        title="Remove value"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addValue(opt._key)}
                    className="a-btn a-btn--ghost a-btn--sm -ml-3 mt-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                    Add value
                  </button>
                </div>
                {issues.map((msg) => (
                  <p key={msg} className="flex items-start gap-1.5 text-xs text-amber-200">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 mt-px flex-shrink-0 text-amber-400" aria-hidden />
                    {msg}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VariantsTable({ draft, effOptions, showCompare, setShowCompare, updateVariant, applyToAll, fxRate, fxStale }) {
  const { variants, edition, status, images } = draft
  const editionSize = toInt(draft.edition_size)
  const flagMissing = status === 'active'
  const imageIndex = new Map(images.map((img, i) => [img.url, i]))
  const compareId = useId()

  // Producto simple: sin opciones y por lo tanto con una sola variante. Su
  // precio se edita como campo suelto en vez de como fila de tabla.
  const simpleProduct = (effOptions || []).length === 0 && variants.length === 1
  const soleVariant = simpleProduct ? variants[0] : null

  const stockPlaceholder = edition === 'unique' ? '1' : edition === 'limited' ? (editionSize ? String(editionSize) : '') : '∞'
  // El servidor ya topa en 1 para 1/1; topar aquí evita mostrar un "5" que
  // después del save aparecería como 1.
  const clampStock = (value) => (edition === 'unique' && toInt(value) > 1 ? '1' : value)
  const applyField = (field, value) => applyToAll(field, field === 'stock' ? clampStock(value) : value)

  const esLabel = (v) => v.option_values.map((val, i) => {
    const hit = effOptions[i]?.values.find((x) => x.en === val)
    return hit?.es || val
  }).join(' · ')

  const priceInput = (v, field, label) => {
    const empty = toMoney(v[field]) === null
    const warn = flagMissing && empty && (field === 'price_mxn' || field === 'price_usd')
    return (
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={v[field]}
        onChange={(e) => updateVariant(v._key, { [field]: e.target.value })}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder="—"
        aria-label={`${variantLabel(v)}: ${label}`}
        aria-invalid={warn || undefined}
        className={`a-input px-2 py-1.5 text-sm ${warn ? 'border-amber-400/70 focus:border-section-quests' : ''}`}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Sin opciones el encabezado ya lo pone la Section ("Price"); aquí
            solo queda el switch de compare-at, alineado a la derecha. */}
        {simpleProduct ? <span /> : (
          <h3 className="text-sm font-semibold text-white">
            Variants <span className="a-meta ml-1">{variants.length}</span>
          </h3>
        )}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={showCompare}
            aria-labelledby={compareId}
            onClick={() => setShowCompare(!showCompare)}
            className="a-switch"
          />
          <span id={compareId} className="text-sm text-white/70 select-none">Show compare-at prices</span>
        </div>
      </div>

      {edition === 'unique' && (
        <p className="a-help">
          1/1: stock is 1, or 0 once sold. The server caps it at 1.
          {variants.length > 1 ? ' Each variant holds its own single unit.' : ''}
        </p>
      )}
      {edition === 'limited' && (
        <p className="a-help">
          Limited edition{editionSize ? ` of ${editionSize}` : ''}: stock is the units left of the edition. Empty means {editionSize || 'the edition size'}.
        </p>
      )}
      {edition === 'open' && <p className="a-help">Empty stock means unlimited (∞).</p>}
      {showCompare && (
        <p className="a-help">Compare-at is the crossed-out “before” price. Leave it empty for no discount.</p>
      )}

      {variants.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          <span className="text-xs font-semibold text-white/60">Apply to all</span>
          <ApplyAll field="price_mxn" placeholder="MXN price" step="0.01" onApply={applyField} />
          <ApplyAll field="price_usd" placeholder="USD price" step="0.01" onApply={applyField} />
          {showCompare && <ApplyAll field="compare_mxn" placeholder="Compare-at MXN" step="0.01" onApply={applyField} />}
          {showCompare && <ApplyAll field="compare_usd" placeholder="Compare-at USD" step="0.01" onApply={applyField} />}
          <ApplyAll
            field="stock"
            placeholder="Stock"
            step="1"
            max={edition === 'unique' ? 1 : undefined}
            allowEmpty
            emptyLabel={edition === 'open' ? 'Apply ∞' : 'Apply default'}
            onApply={applyField}
          />
        </div>
      )}

      {/* Sin opciones el producto es uno solo: el precio se edita como un
          campo normal y no como una fila "Default" perdida en una tabla que
          además scrollea en horizontal. Por debajo sigue siendo la misma
          variante única — el esquema no cambia. */}
      {simpleProduct ? (
        <div className="a-inset p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <span className="a-label">MXN price</span>
              {priceInput(soleVariant, 'price_mxn', 'MXN price')}
            </div>
            <div className="space-y-1">
              <span className="a-label">USD price</span>
              {priceInput(soleVariant, 'price_usd', 'USD price')}
            </div>
            {showCompare && (
              <div className="space-y-1">
                <span className="a-label">Compare MXN</span>
                {priceInput(soleVariant, 'compare_mxn', 'compare-at MXN')}
              </div>
            )}
            {showCompare && (
              <div className="space-y-1">
                <span className="a-label">Compare USD</span>
                {priceInput(soleVariant, 'compare_usd', 'compare-at USD')}
              </div>
            )}
            <div className="space-y-1">
              <span className="a-label">Stock</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={edition === 'unique' ? 1 : undefined}
                step={1}
                value={soleVariant.stock}
                onChange={(e) => updateVariant(soleVariant._key, { stock: clampStock(e.target.value) })}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder={stockPlaceholder}
                aria-label="Stock"
                className="a-input px-2 py-1.5 text-sm w-full"
              />
            </div>
            <div className="space-y-1">
              <span className="a-label">SKU</span>
              <input
                type="text"
                value={soleVariant.sku}
                onChange={(e) => updateVariant(soleVariant._key, { sku: e.target.value })}
                maxLength={64}
                placeholder="—"
                aria-label="SKU"
                className="a-input px-2 py-1.5 text-sm w-full"
              />
            </div>
          </div>
          <p className="a-help">
            {fxRate
              ? `Type the USD price and MXN fills in by itself, at ${fxRate} per dollar${fxStale ? ' (last rate we could fetch)' : ''}. Change it and it stops following.`
              : 'Type both prices.'}
            {' '}A product with no price in a currency is hidden from the shop
            in the regions that use it: MXN covers Mexico, USD covers US and LATAM.
            {soleVariant.id
              ? ` Available: ${soleVariant.available === null ? '∞' : soleVariant.available}. Sold: ${soleVariant.sold}.`
              : ''}
          </p>
        </div>
      ) : (
      <div className="a-inset overflow-x-auto a-scroll">
        <table className={`a-table ${showCompare ? 'min-w-[980px]' : 'min-w-[780px]'}`}>
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-[var(--a-surface-2)]">Combination</th>
              <th>SKU</th>
              <th>MXN price</th>
              <th>USD price</th>
              {showCompare && <th>Compare MXN</th>}
              {showCompare && <th>Compare USD</th>}
              <th>Stock</th>
              <th>Image</th>
              <th className="text-right" title="Stock minus units held by pending checkouts">Avail.</th>
              <th className="text-right">Sold</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const es = esLabel(v)
              const en = variantLabel(v)
              const imgIdx = imageIndex.get(v.image_url)
              const orphanImage = v.image_url && imgIdx === undefined
              return (
                <tr key={v._key}>
                  <td className="sticky left-0 z-[1] bg-[var(--a-surface-2)] px-3 py-2 min-w-[130px] max-w-[200px]">
                    <div className="text-white font-medium truncate" title={en}>{en}</div>
                    {v.option_values.length > 0 && es !== en && (
                      <div className="text-white/45 text-xs truncate" title={es}>{es}</div>
                    )}
                  </td>
                  <td className="px-1.5 py-2 w-32">
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => updateVariant(v._key, { sku: e.target.value })}
                      maxLength={64}
                      placeholder="—"
                      aria-label={`${en}: SKU`}
                      className="a-input px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-1.5 py-2 w-28">{priceInput(v, 'price_mxn', 'MXN price')}</td>
                  <td className="px-1.5 py-2 w-28">{priceInput(v, 'price_usd', 'USD price')}</td>
                  {showCompare && <td className="px-1.5 py-2 w-28">{priceInput(v, 'compare_mxn', 'compare-at MXN')}</td>}
                  {showCompare && <td className="px-1.5 py-2 w-28">{priceInput(v, 'compare_usd', 'compare-at USD')}</td>}
                  <td className="px-1.5 py-2 w-20">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={edition === 'unique' ? 1 : undefined}
                      step={1}
                      value={v.stock}
                      onChange={(e) => updateVariant(v._key, { stock: clampStock(e.target.value) })}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder={stockPlaceholder}
                      aria-label={`${en}: stock`}
                      className="a-input px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-1.5 py-2 w-48">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 flex-shrink-0 grid place-items-center overflow-hidden rounded-md border-2 border-white/10 bg-[var(--a-bg)]">
                        {v.image_url ? (
                          <img src={toPublicUrl(v.image_url)} alt="" className="w-full h-full object-contain" draggable={false} />
                        ) : (
                          <PhotoIcon className="w-3.5 h-3.5 text-white/20" aria-hidden />
                        )}
                      </div>
                      <select
                        value={v.image_url}
                        onChange={(e) => updateVariant(v._key, { image_url: e.target.value })}
                        aria-label={`${en}: image`}
                        className="a-input min-w-0 pl-2 pr-8 py-1.5 text-sm"
                      >
                        <option value="">None</option>
                        {images.map((img, i) => (
                          <option key={img._key} value={img.url}>{i === 0 ? '#1 Cover' : `#${i + 1}`}</option>
                        ))}
                        {orphanImage && <option value={v.image_url}>Not in gallery</option>}
                      </select>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-right a-num text-white/70 whitespace-nowrap" title={v.reserved ? `${v.reserved} held by pending checkouts` : undefined}>
                    {v.id ? (v.available === null ? '∞' : v.available) : '—'}
                    {v.id && v.reserved > 0 && <span className="text-amber-300"> *</span>}
                  </td>
                  <td className="px-3 py-2 text-right a-num text-white/70 whitespace-nowrap">{v.id ? v.sold : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      {!simpleProduct && (
        <p className="a-help">Available and sold refresh on save. * = units held by checkouts in progress.</p>
      )}
    </div>
  )
}

function ApplyAll({ field, placeholder, step, max, allowEmpty = false, emptyLabel, onApply }) {
  const [value, setValue] = useState('')
  const empty = value.trim() === ''
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder={placeholder}
        aria-label={`${placeholder} for all variants`}
        className="a-input w-32 px-2.5 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={empty && !allowEmpty}
        onClick={() => onApply(field, value.trim())}
        className="a-btn a-btn--secondary a-btn--sm"
      >
        {empty && allowEmpty ? emptyLabel : 'Apply'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Archivos digitales
// ═══════════════════════════════════════════════════════════════

function DigitalFilesSection({ files, uploads, onFiles, onRemove, onDismissUpload, requiredNow }) {
  const inputRef = useRef(null)
  return (
    <Section
      icon={PaperClipIcon}
      title="Digital files"
      right={
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="a-btn a-btn--secondary a-btn--sm"
        >
          <ArrowUpTrayIcon className="w-3.5 h-3.5" aria-hidden />
          Upload files
        </button>
      }
    >
      <p className="a-help">
        Delivered by private link after payment. Link expiry and download limits are set in Store settings.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {files.length === 0 && uploads.length === 0 ? (
        <div className={`a-empty py-8 ${requiredNow ? 'border-amber-400/40 text-amber-200' : ''}`}>
          {requiredNow ? 'An active digital product needs at least one file.' : 'No files yet.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f._key} className="a-inset flex items-center gap-3 px-3 py-2">
              <DocumentIcon className="w-4 h-4 text-white/50 flex-shrink-0" aria-hidden />
              <span className="text-sm text-white truncate flex-1 min-w-0" title={f.key}>{f.name}</span>
              <span className="a-meta whitespace-nowrap">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(f._key)}
                className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                aria-label={`Remove ${f.name}`}
                title="Remove file"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {uploads.map((u) => (
            <li
              key={u._key}
              className={`a-inset flex items-center gap-3 px-3 py-2 ${u.status === 'error' ? 'border-red-500/40' : 'border-dashed'}`}
            >
              {u.status === 'error' ? (
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden />
              ) : (
                <div
                  className={`a-spinner a-spinner--sm flex-shrink-0 ${u.status === 'uploading' ? '' : 'animate-none opacity-30'}`}
                  aria-hidden
                />
              )}
              <span className="text-sm text-white/70 truncate flex-1 min-w-0">{u.name}</span>
              <span
                className={`text-xs whitespace-nowrap ${u.status === 'error' ? 'text-red-300' : 'a-meta'}`}
                role={u.status === 'error' ? 'alert' : undefined}
              >
                {u.status === 'error' ? u.error : u.status === 'uploading' ? `Uploading ${formatBytes(u.size)}…` : 'Queued'}
              </span>
              {u.status === 'error' && (
                <button
                  type="button"
                  onClick={() => onDismissUpload(u._key)}
                  className="a-icon-btn a-icon-btn--sm"
                  aria-label="Dismiss"
                  title="Dismiss"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="a-help">Removed files are deleted from disk on save, unless an order already links to them.</p>
    </Section>
  )
}

// ═══════════════════════════════════════════════════════════════
// UI base
// ═══════════════════════════════════════════════════════════════

function Section({ icon: Icon, title, right, children }) {
  return (
    <section className="a-section space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-[1.125rem] h-[1.125rem] text-white/50" aria-hidden />}
          <h2 className="a-section-title">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`a-label ${className}`}>
      {children}
    </label>
  )
}

function TextField({ label, value, onChange, type = 'text', ...rest }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onWheel={type === 'number' ? (e) => e.currentTarget.blur() : undefined}
        className="a-input"
        {...rest}
      />
    </div>
  )
}

function TextArea({ label, value, onChange }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="a-input"
      />
    </div>
  )
}

function Segmented({ label, value, options, onChange }) {
  const id = useId()
  return (
    <div>
      <span id={id} className="a-label">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className="a-chip"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
