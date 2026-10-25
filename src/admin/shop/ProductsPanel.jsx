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
  EyeIcon,
  EyeSlashIcon,
  ArrowUturnLeftIcon,
  ScaleIcon,
  ListBulletIcon,
} from '@heroicons/react/24/solid'
import {
  listProducts,
  saveProduct,
  deleteProduct,
  listCategories,
  uploadProductImage,
  uploadDigitalFile,
  toPublicUrl,
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
  title_required: 'Escribe el nombre en inglés o en español.',
  edition_size_required: 'Una edición limitada necesita cuántas piezas tiene el tiraje.',
  variants_required: 'El producto necesita al menos una variante.',
  variant_duplicate: 'Dos variantes tienen la misma combinación de opciones.',
  variant_options_mismatch: 'Una variante no coincide con las opciones actuales. Recarga el producto e intenta de nuevo.',
  variant_option_unknown: 'Una variante usa un valor de opción que ya no existe.',
  digital_files_required: 'Un producto digital activo necesita al menos un archivo.',
  invalid_price: 'Un precio no es una cantidad válida. Usa un número de 0 o más.',
  invalid_number: 'Existencias, peso y tiraje van en números enteros de 0 o más.',
  too_many_options: `Un producto puede tener hasta ${MAX_OPTIONS} opciones.`,
  unique_no_options: 'Una pieza única (1/1) es una sola pieza. Quítale las opciones o cámbiala a edición limitada.',
  not_found: 'Este producto ya no existe. Puede que alguien lo haya eliminado.',
  unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo.',
  server_error: 'Falló el servidor. Intenta de nuevo; si sigue pasando, el detalle queda en el registro de errores de PHP.',
  invalid_file_type: 'Ese tipo de archivo no está permitido.',
  file_too_large: 'El archivo es demasiado grande.',
  upload_failed: 'No se pudo subir el archivo.',
  move_failed: 'El servidor no pudo guardar el archivo.',
  rate_limit: 'Demasiadas subidas a la vez. Espera un momento e intenta de nuevo.',
  uploads_pending: 'Espera a que terminen de subirse los archivos antes de guardar.',
}

const STATUS_LABEL = { active: 'Activo', draft: 'Borrador', archived: 'Archivado' }
const STATUS_FILTER_LABEL = { all: 'Todos', active: 'Activos', draft: 'Borradores', archived: 'Archivados' }
const STATUS_TONE = { active: 'text-[#86efac]', draft: 'text-[#fde68a]', archived: '' }

const KIND_LABEL = { physical: 'Físico', digital: 'Digital' }

// Objetivos táctiles de 44px en pantallas chicas o con dedo: los botones
// --sm y los inputs densos del sistema miden ~30–36px.
const TAP = 'max-sm:min-h-11 pointer-coarse:min-h-11'
const TAP_ICON = 'max-sm:size-11 pointer-coarse:size-11'

// Montos como en la tienda: sin centavos cuando son exactos, la moneda aparte.
const formatAmount = (n) => `$${Number(n).toLocaleString('es-MX', {
  minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
  maximumFractionDigits: 2,
})}`

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
    title_en: d.title_en ? `${d.title_en} (copia)` : '',
    title_es: d.title_es ? `${d.title_es} (copia)` : '',
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

const variantLabel = (v) => (v.option_values.length ? v.option_values.join(' · ') : 'Sin opciones')

function describeError(err, variants) {
  const code = err?.message || 'error'
  const extra = err?.payload || {}
  let msg = ERROR_MESSAGES[code]
    || (code.startsWith('upload_error_') ? ERROR_MESSAGES.upload_failed : `Algo salió mal. Intenta de nuevo. (${code})`)
  if (Number.isInteger(extra.index) && variants?.[extra.index]) {
    msg += ` Variante ${extra.index + 1}: ${variantLabel(variants[extra.index])}.`
  }
  if (extra.value) msg += ` Valor: "${extra.value}".`
  return msg
}

// Mismas palabras que la línea de detalle de la tienda (ProductMeta.jsx).
function editionLabel(edition, size) {
  if (edition === 'unique') return 'Pieza única'
  if (edition === 'limited') return size ? `Tiraje de ${size}` : 'Edición limitada'
  return 'Edición abierta'
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
    available: unlimited ? null : vs.reduce((s, v) => s + (v.available || 0), 0),
    reserved: vs.reduce((s, v) => s + (v.reserved || 0), 0),
    warnings,
  }
}

// Lo que cambia la decisión, como en la tienda: si no hay, si está apartado
// por un pago en curso o cuántas quedan. En una pieza única con su pieza
// disponible no dice nada: "Pieza única" ya lo dice.
function stockNote(p, stats) {
  if (!(p.variants || []).length) return null
  if (stats.available === null) return { text: 'Sin límite', tone: '' }
  if (stats.available === 0) {
    return stats.reserved > 0
      ? { text: 'Apartado en un pago', tone: 'text-[#fde68a]' }
      : { text: 'Agotado', tone: 'text-red-400 font-bold' }
  }
  if (p.edition === 'unique') return null
  return { text: `Quedan ${stats.available.toLocaleString('es-MX')}`, tone: '' }
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
    <div className="w-full">
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Productos</h1>
          <p className="a-subtitle">Las piezas de la tienda: precios en pesos y dólares, existencias y si se ven o no.</p>
        </div>
        <div className="a-page-head__actions justify-end">
          <button type="button" onClick={onNew} className={`a-btn a-btn--primary ${TAP}`}>
            <PlusIcon className="w-4 h-4" aria-hidden />
            Nuevo producto
          </button>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger mb-6" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {['all', 'active', 'draft', 'archived'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, status: s }))}
              aria-pressed={filters.status === s}
              className={`a-chip ${TAP}`}
            >
              {STATUS_FILTER_LABEL[s]}
              <span className="a-chip__count">{(counts[s] || 0).toLocaleString('es-MX')}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Busca por nombre, ID de archivo o SKU"
              aria-label="Buscar productos"
              className="a-input pl-10"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            aria-label="Filtrar por categoría"
            className="a-input"
          >
            <option value="">Todas las categorías</option>
            <option value="__none">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name_es || c.name_en}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !products.length ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Cargando productos" />
        </div>
      ) : visible.length === 0 ? (
        <div className="a-empty">
          {products.length
            ? 'Ningún producto coincide con estos filtros.'
            : 'Todavía no hay productos. Crea el primero con Nuevo producto.'}
        </div>
      ) : (
        <div className="a-item-grid">
          {visible.map((p) => (
            <ProductCard
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

// Un precio con su moneda chica aparte, como PriceTag en la tienda. MXN va
// grande (es la moneda de México); USD, en la línea de abajo.
function CardPrice({ amount, varies, currency, primary = false }) {
  const code = <span className="text-[0.6875rem] font-bold tracking-[0.14em] text-white/50">{currency}</span>
  if (amount === null) {
    return (
      <p className="flex items-baseline gap-1.5" title={`Sin precio en ${currency}: no aparece en las regiones que pagan en ${currency === 'MXN' ? 'pesos' : 'dólares'}.`}>
        <span className="text-sm font-semibold text-[#fde68a]">Sin precio</span>
        {code}
      </p>
    )
  }
  return (
    <p className={`flex items-baseline gap-1.5 font-bold leading-none a-num ${primary ? 'text-xl text-white' : 'text-[0.9375rem] text-white/75'}`}>
      {varies && <span className="text-xs font-semibold text-white/50">desde</span>}
      {formatAmount(amount)}
      {code}
    </p>
  )
}

// Misma anatomía que la card de la tienda (DESIGN.md §14.6 / §15.5): nombre +
// una línea de detalle, la foto completa y al pie el precio a la izquierda con
// una sola acción con texto a la derecha. Lo demás va en botones de ícono.
// La card entera abre el editor con el mouse; con teclado y lector de pantalla
// el camino es el botón Editar (así no hay botones dentro de otro botón).
const QUICK_STATUS = {
  active: { verb: 'Ocultar', help: 'pasa a borrador y deja de verse en la tienda', Icon: EyeSlashIcon },
  draft: { verb: 'Publicar', help: 'pasa a activo y se ve en la tienda', Icon: EyeIcon },
  archived: { verb: 'Desarchivar', help: 'pasa a borrador, todavía oculto', Icon: ArrowUturnLeftIcon },
}

const sameWord = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

function ProductCard({ product: p, busy, onEdit, onDuplicate, onQuickStatus }) {
  const stats = productStats(p)
  const cover = p.images?.[0]?.url
  const title = p.title_es || p.title_en || 'Sin nombre'
  const muted = p.status !== 'active'
  const quick = QUICK_STATUS[p.status] || QUICK_STATUS.draft
  const stock = stockNote(p, stats)
  const missingSome = [
    stats.warnings.includes('no_mxn') && stats.minMxn !== null && 'Faltan precios en MXN',
    stats.warnings.includes('no_usd') && stats.minUsd !== null && 'Faltan precios en USD',
  ].filter(Boolean)
  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }

  return (
    <article
      onClick={onEdit}
      className={`a-item a-item--interactive ${muted ? 'a-item--muted' : ''}`}
    >
      <header className="a-item__head">
        <div className="min-w-0">
          <h2 className="a-item__title">{title}</h2>
          <p className="a-item__meta">
            {p.category && (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="a-dot" style={{ backgroundColor: p.category.color }} aria-hidden />
                {p.category.name_es || p.category.name_en}
              </span>
            )}
            {/* Si la categoría ya se llama Digital, no se repite. */}
            {p.kind === 'digital' && !sameWord(p.category?.name_es || p.category?.name_en, KIND_LABEL.digital) && <span>{KIND_LABEL.digital}</span>}
            <span>{editionLabel(p.edition, p.edition_size)}</span>
            {stock && <span className={stock.tone}>{stock.text}</span>}
            <span className={`font-semibold ${STATUS_TONE[p.status] || ''}`}>{STATUS_LABEL[p.status] || p.status}</span>
          </p>
        </div>
        {p.featured && (
          <span className="a-badge a-badge--accent mt-0.5" title="La pieza grande de la tienda">
            <StarIcon className="w-3 h-3" aria-hidden />
            Destacado
          </span>
        )}
      </header>

      <div className="a-item__media">
        {cover ? (
          <img src={cover} alt="" draggable={false} loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-[#fde68a]">
            <PhotoIcon className="w-7 h-7 text-white/20" aria-hidden />
            Sin imágenes
          </div>
        )}
      </div>

      {missingSome.length > 0 && (
        <div className="a-item__body flex flex-wrap gap-2">
          {missingSome.map((t) => <span key={t} className="a-badge a-badge--warning">{t}</span>)}
        </div>
      )}

      {/* flex-wrap: en una card angosta las acciones bajan a su propia línea
          y se quedan a la derecha (ml-auto) en vez de aplastar el precio. */}
      <footer className="a-item__foot flex-wrap gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <CardPrice amount={stats.minMxn} varies={stats.mxnVaries} currency="MXN" primary />
          <CardPrice amount={stats.minUsd} varies={stats.usdVaries} currency="USD" />
        </div>
        <div className="a-item__actions ml-auto">
          <button
            type="button"
            onClick={stop(onDuplicate)}
            className={`a-icon-btn ${TAP_ICON}`}
            aria-label={`Duplicar «${title}»`}
            title="Duplicar como borrador nuevo"
          >
            <DocumentDuplicateIcon className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={stop(onQuickStatus)}
            disabled={busy}
            className={`a-icon-btn ${TAP_ICON}`}
            aria-label={`${quick.verb} «${title}»`}
            title={`${quick.verb}: ${quick.help}`}
          >
            {busy
              ? <span className="a-spinner a-spinner--sm" aria-hidden />
              : <quick.Icon className="w-4 h-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={stop(onEdit)}
            className={`a-btn a-btn--primary a-btn--sm ${TAP}`}
            aria-label={`Editar «${title}»`}
          >
            Editar
          </button>
        </div>
      </footer>
    </article>
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
    if ((dirty || uploadsBusy) && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')) return
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
    if (!window.confirm(`¿Eliminar «${title}»? No se puede deshacer.\n(Si ya tiene pedidos, se archiva en vez de eliminarse.)`)) return
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

  // Sin precio en ninguna variante, el producto ni aparece en esa región
  // (shopProduct.js → sellableInRegion); con algunas, solo esas no se venden.
  const missingText = (count, code, paidIn) => (
    count === draft.variants.length
      ? `Sin precio en ${code}, el producto no aparece en las regiones que pagan en ${paidIn}.`
      : `${count} de ${draft.variants.length} variantes no tienen precio en ${code}: no se pueden comprar en las regiones que pagan en ${paidIn}.`
  )

  return (
    <div className="w-full">
      {/* top-14 = alto de la barra superior fija del shell en mobile */}
      <div className="a-page-head mb-6 sm:items-center sticky top-14 md:top-0 z-30 py-3 sm:py-4 bg-[var(--a-bg)] border-b-2 border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={leave}
            className={`a-icon-btn ${TAP_ICON}`}
            aria-label="Volver a productos"
            title="Volver a productos"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="a-title">{isNew ? 'Nuevo producto' : 'Editar producto'}</h1>
            <p className="a-subtitle truncate">
              {isCopy && isNew
                ? 'Copia sin guardar'
                : isNew
                  ? 'Borrador sin guardar'
                  : (
                    <>
                      <span className="a-code">{draft.archive_id || draft.archive_auto}</span>
                      {' · '}ID <span className="a-num">{draft.id}</span>
                    </>
                  )}
            </p>
          </div>
        </div>
        {/* Eliminar va como ícono y lejos de Guardar: la acción importante es
            la única de color y queda al final, a la derecha. */}
        <div className="a-page-head__actions justify-end">
          {!isNew && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className={`a-icon-btn a-icon-btn--danger ${TAP_ICON}`}
              aria-label={deleting ? 'Eliminando producto…' : 'Eliminar producto'}
              title="Eliminar producto"
            >
              {deleting
                ? <span className="a-spinner a-spinner--sm" aria-hidden />
                : <TrashIcon className="w-4 h-4" aria-hidden />}
            </button>
          )}
          <span aria-live="polite" className="inline-flex">
            {notice === 'saved' && <span className="a-badge a-badge--success">Guardado</span>}
          </span>
          {dirty && notice !== 'saved' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <span className="a-dot bg-amber-400" aria-hidden />
              Cambios sin guardar
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={`a-btn a-btn--primary ${TAP}`}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {(error || notice === 'archived' || (draft.status === 'active' && (missing.mxn > 0 || missing.usd > 0))) && (
        <div className="space-y-3 mb-6">
          {error && (
            <div className="a-alert a-alert--danger" role="alert">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {notice === 'archived' && (
            <div className="a-alert a-alert--success" role="status">
              <p>Este producto tiene pedidos, así que se archivó en vez de eliminarse.</p>
            </div>
          )}

          {draft.status === 'active' && (missing.mxn > 0 || missing.usd > 0) && (
            <div className="a-alert a-alert--warning">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1">
                {missing.mxn > 0 && <p>{missingText(missing.mxn, 'MXN', 'pesos')}</p>}
                {missing.usd > 0 && <p>{missingText(missing.usd, 'USD', 'dólares')}</p>}
                <p className="opacity-70">Puedes guardar de todos modos.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <fieldset disabled={busy} className="min-w-0 border-0 p-0 m-0">
        <Section icon={TagIcon} title="Datos básicos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Nombre en inglés" value={draft.title_en} onChange={(v) => set({ title_en: v })} maxLength={200} placeholder="Skull Tee" />
            <TextField label="Nombre en español" value={draft.title_es} onChange={(v) => set({ title_es: v })} maxLength={200} placeholder="Playera Skull" />
            <TextArea label="Descripción en inglés" value={draft.description_en} onChange={(v) => set({ description_en: v })} />
            <TextArea label="Descripción en español" value={draft.description_es} onChange={(v) => set({ description_es: v })} />
          </div>
          <p className="a-help">Texto simple; se respetan los saltos de línea. Si un idioma queda vacío, la tienda muestra el otro.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor={`${idBase}-category`}>Categoría</Label>
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
                  <option value="">Ninguna</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name_es || c.name_en}</option>
                  ))}
                  {categoryMissing && <option value={draft.category_id}>#{draft.category_id} (eliminada)</option>}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor={`${idBase}-status`}>Estado</Label>
              <select
                id={`${idBase}-status`}
                value={draft.status}
                onChange={(e) => set({ status: e.target.value })}
                className="a-input"
              >
                <option value="draft">Borrador: no se ve en la tienda</option>
                <option value="active">Activo: a la venta</option>
                <option value="archived">Archivado: oculto, conserva su historial</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <TextField
                label="ID de archivo (opcional)"
                value={draft.archive_id}
                onChange={(v) => set({ archive_id: v.toUpperCase() })}
                maxLength={40}
                placeholder={`Automático: ${draft.archive_auto || 'SKR-0001'}`}
              />
              <p className="a-help">Sale en la ficha del producto. Vacío, se pone solo.</p>
            </div>
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
              <span id={`${idBase}-featured`} className="block text-sm font-semibold text-white">Destacado</span>
              <p id={`${idBase}-featured-help`} className="a-help mt-1">
                Sale como la pieza grande de la tienda, arriba de la cuadrícula. Si en Portada de la tienda elegiste otra pieza, gana esa.
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className={`a-btn a-btn--ghost a-btn--sm -ml-3 ${TAP}`}
            >
              {showAdvanced
                ? <ChevronDownIcon className="w-3.5 h-3.5" aria-hidden />
                : <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />}
              Avanzado
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-1.5">
                <TextField
                  label="URL (opcional)"
                  value={draft.slug}
                  onChange={(v) => set({ slug: v })}
                  maxLength={160}
                  placeholder="Se genera del nombre en inglés"
                />
                <p className="a-help">
                  La dirección de la página del producto. Déjala vacía para que se genere del nombre en inglés. Si la cambias, dejan de funcionar los enlaces que ya compartiste.
                </p>
              </div>
            )}
          </div>
        </Section>

        <Section icon={CubeIcon} title="Formato y edición">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Segmented
              label="Formato"
              value={draft.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: 'physical', label: 'Físico' },
                { value: 'digital', label: 'Digital' },
              ]}
            />
            <Segmented
              label="Edición"
              value={draft.edition}
              onChange={setEdition}
              options={[
                { value: 'unique', label: 'Pieza única (1/1)' },
                { value: 'limited', label: 'Edición limitada' },
                { value: 'open', label: 'Edición abierta' },
              ]}
            />
          </div>

          {(draft.edition === 'limited' || draft.kind === 'physical') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {draft.edition === 'limited' && (
                <div className="space-y-1.5">
                  <TextField
                    label="Piezas del tiraje *"
                    type="number"
                    min={1}
                    step={1}
                    value={draft.edition_size}
                    onChange={(v) => set({ edition_size: v })}
                    placeholder="50"
                  />
                  <p className="a-help">Cuántas piezas existen en total.</p>
                </div>
              )}
              {draft.kind === 'physical' && (
                <div className="space-y-1.5">
                  <TextField
                    label="Peso (g)"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.weight_g}
                    onChange={(v) => set({ weight_g: v })}
                    placeholder="250"
                  />
                  <p className="a-help">
                    Peso con empaque, en gramos. Por ahora solo se guarda: el envío se cobra con la tarifa de cada zona, no por peso.
                  </p>
                </div>
              )}
            </div>
          )}

          {draft.kind === 'physical' && draft.digital_files.length > 0 && (
            <p className="a-help">
              {draft.digital_files.length === 1
                ? 'Todavía tiene 1 archivo digital adjunto.'
                : `Todavía tiene ${draft.digital_files.length} archivos digitales adjuntos.`}
              {' '}No se muestran ni se entregan mientras el producto sea físico.
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
            <Section icon={CurrencyDollarIcon} title="Precio y existencias">
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
            <Section icon={Squares2X2Icon} title="Opciones">
              <OptionsEditor options={draft.options} setOptions={setOptions} unique={draft.edition === 'unique'} />
            </Section>
          </>
        ) : (
          <Section icon={Squares2X2Icon} title="Opciones y variantes">
            <OptionsEditor options={draft.options} setOptions={setOptions} unique={draft.edition === 'unique'} />
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

        {/* Ayuda donde surge la duda (heurística 10). Los pasos solo al crear:
            al editar algo que ya existe estorban. */}
        {isNew && (
          <Section icon={ListBulletIcon} title="Cómo publicar un producto">
            <ol className="a-steps max-w-3xl">
              <li>Escribe el <strong>nombre</strong> en inglés y en español, y elige la <strong>categoría</strong>.</li>
              <li>Elige el <strong>formato</strong> (físico o digital) y la <strong>edición</strong>: pieza única, limitada o abierta.</li>
              <li>Sube las <strong>imágenes</strong>. La primera es la portada.</li>
              <li>Pon el <strong>precio en USD</strong> y revisa el de MXN, que se llena solo con el tipo de cambio. Si viene en tallas o colores, agrega <strong>opciones</strong>.</li>
              <li>Si es digital, sube sus <strong>archivos</strong>.</li>
              <li>Cambia el estado a <strong>Activo</strong> y guarda. Mientras sea borrador, nadie lo ve en la tienda.</li>
            </ol>
          </Section>
        )}

        <Section icon={ScaleIcon} title="Reglas">
          <ul className="a-rules max-w-3xl">
            <li>Solo los productos <strong>activos</strong> se ven en la tienda. Los borradores y los archivados quedan ocultos.</li>
            <li>Una <strong>pieza única (1/1)</strong> es una sola pieza: no lleva opciones y sus existencias son 1, o 0 cuando se vende.</li>
            <li>Una <strong>edición limitada</strong> necesita cuántas piezas tiene el tiraje. Si dejas vacías las existencias, se llenan con el tiraje.</li>
            <li>En una <strong>edición abierta</strong>, existencias vacías quiere decir sin límite.</li>
            <li>
              <strong>Disponibles = existencias − apartadas.</strong> Un pedido que todavía no se paga aparta sus piezas: 35 minutos
              mientras alguien está en el pago, 4 días si sacó una ficha OXXO. Así una pieza única no se puede pagar dos veces.
              Las existencias bajan cuando Stripe confirma el pago.
            </li>
            <li>
              Sin precio en <strong>MXN</strong>, el producto no aparece en las regiones que pagan en pesos (México); sin precio
              en <strong>USD</strong>, en las que pagan en dólares (Estados Unidos y Latinoamérica).
            </li>
            <li>El <strong>precio anterior</strong> solo se muestra tachado si es mayor que el precio.</li>
            <li>Un producto <strong>digital activo</strong> necesita al menos un archivo.</li>
            <li>Hasta <strong>{MAX_OPTIONS} opciones</strong> por producto. Cada combinación es una variante con su propio precio y existencias.</li>
            <li><strong>Eliminar</strong> un producto que ya tiene pedidos lo archiva en vez de borrarlo, para no perder su historial.</li>
          </ul>
        </Section>
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
      title="Imágenes"
      right={
        <button type="button" onClick={pick} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
          <ArrowUpTrayIcon className="w-3.5 h-3.5" aria-hidden />
          Subir imágenes
        </button>
      }
    >
      <p className="a-help">
        La primera es la portada. Arrastra con el ícono de tres rayas para cambiar el orden. Las cards de la tienda son
        cuadradas: las fotos cuadradas las llenan mejor. El texto alternativo describe la foto para quien usa lector de pantalla.
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
          Todavía no hay imágenes. Haz clic aquí para subir la primera.
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
          className={`a-icon-btn a-icon-btn--sm absolute top-2 left-2 bg-[var(--a-surface)] cursor-grab active:cursor-grabbing ${TAP_ICON}`}
          style={{ touchAction: 'none' }}
          aria-label={`Arrastra para mover la imagen ${index + 1}`}
          title="Arrastra para cambiar el orden"
        >
          <Bars3Icon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger absolute top-2 right-2 bg-[var(--a-surface)] ${TAP_ICON}`}
          aria-label={`Quitar la imagen ${index + 1}`}
          title="Quitar imagen"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
        <span
          className={`a-badge absolute bottom-2 left-2 ${
            index === 0 ? 'bg-section-quests text-[var(--a-on-accent)]' : 'bg-[var(--a-surface)] text-white/70'
          }`}
        >
          {index === 0 ? 'Portada' : `#${index + 1}`}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={image.alt_en}
          onChange={(e) => onPatch({ alt_en: e.target.value })}
          placeholder="Texto alternativo (EN)"
          aria-label={`Imagen ${index + 1}: texto alternativo en inglés`}
          maxLength={255}
          className={`a-input px-2.5 py-1.5 text-xs ${TAP}`}
        />
        <input
          type="text"
          value={image.alt_es}
          onChange={(e) => onPatch({ alt_es: e.target.value })}
          placeholder="Texto alternativo (ES)"
          aria-label={`Imagen ${index + 1}: texto alternativo en español`}
          maxLength={255}
          className={`a-input px-2.5 py-1.5 text-xs ${TAP}`}
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
            <button type="button" onClick={onDismiss} className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}>
              Descartar
            </button>
          </>
        ) : (
          <>
            <div
              className={`a-spinner ${upload.status === 'uploading' ? '' : 'animate-none opacity-30'}`}
              aria-hidden
            />
            <span className="a-meta">
              {upload.status === 'uploading' ? 'Subiendo…' : 'En cola'}
            </span>
          </>
        )}
      </div>
      <p className="px-3 pb-3 a-meta truncate">{upload.name}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Opciones y variantes
// ═══════════════════════════════════════════════════════════════

function optionIssues(opt) {
  const issues = []
  if (!opt.name_en.trim() && !opt.name_es.trim()) issues.push('Le falta un nombre. No cuenta hasta que tenga uno.')
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
  if (esOnly) issues.push('Los valores sin texto en inglés no cuentan: el inglés es el que identifica a cada variante.')
  if (dupes.size) issues.push(`Valores repetidos que no cuentan: ${[...dupes].join(', ')}.`)
  if (!seen.size && (opt.name_en.trim() || opt.name_es.trim())) issues.push('Agrega al menos un valor.')
  return issues
}

function OptionsEditor({ options, setOptions, unique = false }) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-white">
          Opciones <span className="a-meta ml-1">{options.length}/{MAX_OPTIONS}</span>
        </h3>
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
        >
          <PlusIcon className="w-3.5 h-3.5" aria-hidden />
          Agregar opción
        </button>
      </div>
      <p className="a-help">
        Por ejemplo color o talla. El valor en inglés es el que identifica a cada variante; el de español es solo cómo se lee en español. Enter agrega otro valor.
      </p>
      {unique && options.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-[#fde68a]">
          <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
          Una pieza única no lleva opciones y así no se puede guardar. Quítalas, o cambia la edición a limitada o abierta.
        </p>
      )}

      {options.length === 0 ? (
        <p className="a-help">
          {unique
            ? 'Una pieza única no lleva opciones: es una sola pieza. Para vender algo en tallas o colores, cambia la edición a limitada o abierta.'
            : 'Agrega una opción solo si el producto viene en variaciones, como color o talla. Cada combinación tiene entonces su propio precio y existencias.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {options.map((opt, i) => {
            const issues = optionIssues(opt)
            return (
              <div key={opt._key} className="a-inset p-4 sm:p-5 space-y-4 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white/80">Opción {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeOption(opt._key)}
                    className={`a-btn a-btn--danger a-btn--sm ${TAP}`}
                    aria-label={`Quitar la opción ${i + 1}`}
                  >
                    <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <TextField label="Nombre en inglés" value={opt.name_en} onChange={(v) => patchOption(opt._key, { name_en: v })} maxLength={60} placeholder="Color" />
                  <TextField label="Nombre en español" value={opt.name_es} onChange={(v) => patchOption(opt._key, { name_es: v })} maxLength={60} placeholder="Color" />
                </div>
                <div className="space-y-2">
                  <span className="a-label">Valores</span>
                  {opt.values.map((v, vi) => (
                    <div key={v._key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={v.en}
                        onChange={(e) => patchValue(opt._key, v._key, { en: e.target.value })}
                        onKeyDown={onValueKeyDown(opt._key)}
                        autoFocus={v._key === focusKey}
                        maxLength={60}
                        placeholder="Inglés *"
                        aria-label={`Opción ${i + 1}, valor ${vi + 1} en inglés`}
                        className={`a-input min-w-0 px-2.5 py-1.5 text-sm ${TAP}`}
                      />
                      <input
                        type="text"
                        value={v.es}
                        onChange={(e) => patchValue(opt._key, v._key, { es: e.target.value })}
                        onKeyDown={onValueKeyDown(opt._key)}
                        maxLength={60}
                        placeholder="Español (opcional)"
                        aria-label={`Opción ${i + 1}, valor ${vi + 1} en español`}
                        className={`a-input min-w-0 px-2.5 py-1.5 text-sm ${TAP}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeValue(opt._key, v._key)}
                        className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${TAP_ICON}`}
                        aria-label={`Quitar el valor ${vi + 1}`}
                        title="Quitar valor"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addValue(opt._key)}
                    className={`a-btn a-btn--ghost a-btn--sm -ml-3 mt-1 ${TAP}`}
                  >
                    <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                    Agregar valor
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
  const fieldId = useId()

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

  const priceInput = (v, field, label, { dense = true, id } = {}) => {
    const empty = toMoney(v[field]) === null
    const warn = flagMissing && empty && (field === 'price_mxn' || field === 'price_usd')
    return (
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={v[field]}
        onChange={(e) => updateVariant(v._key, { [field]: e.target.value })}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder="—"
        aria-label={id ? undefined : `${variantLabel(v)}: ${label}`}
        aria-invalid={warn || undefined}
        className={`a-input ${dense ? `px-2 py-1.5 text-sm ${TAP}` : ''} ${warn ? 'border-amber-400/70 focus:border-section-quests' : ''}`}
      />
    )
  }

  const fxText = fxRate
    ? `Escribe el precio en USD y el de MXN se llena solo, a ${fxRate.toLocaleString('es-MX', { maximumFractionDigits: 4 })} pesos por dólar${fxStale ? ' (el último tipo de cambio que se pudo obtener)' : ''}. Si lo cambias a mano, deja de seguirlo.`
    : 'Escribe los dos precios.'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Sin opciones el encabezado ya lo pone la Section; aquí solo queda
            el switch del precio anterior, alineado a la derecha. */}
        {simpleProduct ? <span /> : (
          <h3 className="text-sm font-semibold text-white">
            Variantes <span className="a-meta ml-1">{variants.length.toLocaleString('es-MX')}</span>
          </h3>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={showCompare}
            aria-labelledby={compareId}
            onClick={() => setShowCompare(!showCompare)}
            className="a-switch"
          />
          <span id={compareId} className="text-sm text-white/70 select-none">Mostrar precio anterior</span>
        </div>
      </div>

      {edition === 'unique' && (
        <p className="a-help">
          Pieza única: existencias 1, o 0 cuando se vende. Nunca se guarda más de 1.
          {variants.length > 1 ? ' Cada variante tiene su propia pieza.' : ''}
        </p>
      )}
      {edition === 'limited' && (
        <p className="a-help">
          Edición limitada{editionSize ? ` de ${editionSize.toLocaleString('es-MX')}` : ''}: las existencias son las piezas que quedan del tiraje.
          {' '}Vacías, se llenan con {editionSize ? editionSize.toLocaleString('es-MX') : 'el tiraje'}.
        </p>
      )}
      {edition === 'open' && <p className="a-help">Existencias vacías quiere decir sin límite (∞).</p>}
      {showCompare && (
        <p className="a-help">
          El precio anterior sale tachado junto al precio. Déjalo vacío si no hay descuento; solo se muestra si es mayor que el precio.
        </p>
      )}

      {variants.length > 1 && (
        <div className="flex flex-wrap gap-x-5 gap-y-3 items-center">
          <span className="text-xs font-semibold text-white/60">Aplicar a todas</span>
          <ApplyAll field="price_mxn" placeholder="Precio MXN" step="0.01" onApply={applyField} />
          <ApplyAll field="price_usd" placeholder="Precio USD" step="0.01" onApply={applyField} />
          {showCompare && <ApplyAll field="compare_mxn" placeholder="Anterior MXN" step="0.01" onApply={applyField} />}
          {showCompare && <ApplyAll field="compare_usd" placeholder="Anterior USD" step="0.01" onApply={applyField} />}
          <ApplyAll
            field="stock"
            placeholder="Existencias"
            step="1"
            max={edition === 'unique' ? 1 : undefined}
            allowEmpty
            emptyLabel={edition === 'open' ? 'Aplicar ∞' : 'Restablecer'}
            emptyTitle={edition === 'open'
              ? 'Deja todas las variantes sin límite'
              : 'Vacía las existencias: el servidor las llena con lo que marca la edición'}
            onApply={applyField}
          />
        </div>
      )}

      {/* Sin opciones el producto es uno solo: el precio se edita como un
          campo normal y no como una fila "Default" perdida en una tabla que
          además scrollea en horizontal. Por debajo sigue siendo la misma
          variante única — el esquema no cambia. Sin caja alrededor: es parte
          de la sección, no un objeto aparte (§15.1.7). */}
      {simpleProduct ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="min-w-0">
              <Label htmlFor={`${fieldId}-mxn`}>Precio en MXN</Label>
              {priceInput(soleVariant, 'price_mxn', 'precio en MXN', { dense: false, id: `${fieldId}-mxn` })}
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${fieldId}-usd`}>Precio en USD</Label>
              {priceInput(soleVariant, 'price_usd', 'precio en USD', { dense: false, id: `${fieldId}-usd` })}
            </div>
            {showCompare && (
              <div className="min-w-0">
                <Label htmlFor={`${fieldId}-cmxn`}>Precio anterior MXN</Label>
                {priceInput(soleVariant, 'compare_mxn', 'precio anterior en MXN', { dense: false, id: `${fieldId}-cmxn` })}
              </div>
            )}
            {showCompare && (
              <div className="min-w-0">
                <Label htmlFor={`${fieldId}-cusd`}>Precio anterior USD</Label>
                {priceInput(soleVariant, 'compare_usd', 'precio anterior en USD', { dense: false, id: `${fieldId}-cusd` })}
              </div>
            )}
            <div className="min-w-0">
              <Label htmlFor={`${fieldId}-stock`}>Existencias</Label>
              <input
                id={`${fieldId}-stock`}
                type="number"
                inputMode="numeric"
                min={0}
                max={edition === 'unique' ? 1 : undefined}
                step={1}
                value={soleVariant.stock}
                onChange={(e) => updateVariant(soleVariant._key, { stock: clampStock(e.target.value) })}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder={stockPlaceholder}
                className="a-input w-full"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`${fieldId}-sku`}>SKU</Label>
              <input
                id={`${fieldId}-sku`}
                type="text"
                value={soleVariant.sku}
                onChange={(e) => updateVariant(soleVariant._key, { sku: e.target.value })}
                maxLength={64}
                placeholder="—"
                className="a-input a-code w-full"
              />
            </div>
          </div>
          <p className="a-help max-w-3xl">
            {fxText}
            {' '}Sin precio en una moneda, el producto no aparece en las regiones que pagan con ella: MXN es para México;
            USD, para Estados Unidos y Latinoamérica.
          </p>
          {soleVariant.id && (
            <p className="a-meta text-sm">
              Disponibles: {soleVariant.available === null ? '∞' : soleVariant.available.toLocaleString('es-MX')}
              {soleVariant.reserved > 0 ? ` · Apartadas en pagos en curso: ${soleVariant.reserved.toLocaleString('es-MX')}` : ''}
              {' · '}Vendidos: {(soleVariant.sold || 0).toLocaleString('es-MX')}
            </p>
          )}
        </div>
      ) : (
      <div className="a-inset overflow-x-auto a-scroll">
        <table className={`a-table ${showCompare ? 'min-w-[1000px]' : 'min-w-[800px]'}`}>
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-[var(--a-surface-2)]">Combinación</th>
              <th>SKU</th>
              <th>Precio MXN</th>
              <th>Precio USD</th>
              {showCompare && <th>Anterior MXN</th>}
              {showCompare && <th>Anterior USD</th>}
              <th>Existencias</th>
              <th>Imagen</th>
              <th className="text-right" title="Existencias menos lo apartado por pagos en curso">Disp.</th>
              <th className="text-right">Vendidos</th>
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
                      className={`a-input a-code px-2 py-1.5 text-sm ${TAP}`}
                    />
                  </td>
                  <td className="px-1.5 py-2 w-28">{priceInput(v, 'price_mxn', 'precio en MXN')}</td>
                  <td className="px-1.5 py-2 w-28">{priceInput(v, 'price_usd', 'precio en USD')}</td>
                  {showCompare && <td className="px-1.5 py-2 w-28">{priceInput(v, 'compare_mxn', 'precio anterior en MXN')}</td>}
                  {showCompare && <td className="px-1.5 py-2 w-28">{priceInput(v, 'compare_usd', 'precio anterior en USD')}</td>}
                  <td className="px-1.5 py-2 w-24">
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
                      aria-label={`${en}: existencias`}
                      className={`a-input px-2 py-1.5 text-sm ${TAP}`}
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
                        aria-label={`${en}: imagen`}
                        className={`a-input min-w-0 pl-2 pr-8 py-1.5 text-sm ${TAP}`}
                      >
                        <option value="">Ninguna</option>
                        {images.map((img, i) => (
                          <option key={img._key} value={img.url}>{i === 0 ? '#1 Portada' : `#${i + 1}`}</option>
                        ))}
                        {orphanImage && <option value={v.image_url}>No está en la galería</option>}
                      </select>
                    </div>
                  </td>
                  <td
                    className="px-1.5 py-2 text-right a-num text-white/70 whitespace-nowrap"
                    title={v.reserved ? `${v.reserved.toLocaleString('es-MX')} apartadas por pagos en curso` : undefined}
                  >
                    {v.id ? (v.available === null ? '∞' : v.available.toLocaleString('es-MX')) : '—'}
                    {v.id && v.reserved > 0 && <span className="text-amber-300"> *</span>}
                  </td>
                  <td className="px-3 py-2 text-right a-num text-white/70 whitespace-nowrap">
                    {v.id ? (v.sold || 0).toLocaleString('es-MX') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      {!simpleProduct && (
        <div className="space-y-2 max-w-3xl">
          <p className="a-help">{fxText}</p>
          <p className="a-help">Disponibles y vendidos se actualizan al guardar. * = piezas apartadas por pagos en curso.</p>
        </div>
      )}
    </div>
  )
}

function ApplyAll({ field, placeholder, step, max, allowEmpty = false, emptyLabel, emptyTitle, onApply }) {
  const [value, setValue] = useState('')
  const empty = value.trim() === ''
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder={placeholder}
        aria-label={`${placeholder} para todas las variantes`}
        className={`a-input w-32 px-2.5 py-1.5 text-sm ${TAP}`}
      />
      <button
        type="button"
        disabled={empty && !allowEmpty}
        onClick={() => onApply(field, value.trim())}
        title={empty && allowEmpty ? emptyTitle : undefined}
        className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
      >
        {empty && allowEmpty ? emptyLabel : 'Aplicar'}
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
      title="Archivos digitales"
      right={
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
        >
          <ArrowUpTrayIcon className="w-3.5 h-3.5" aria-hidden />
          Subir archivos
        </button>
      }
    >
      <p className="a-help">
        Se entregan con un enlace privado cuando Stripe confirma el pago. Cuántos días dura el enlace y cuántas descargas permite se ajusta en Ajustes de la tienda.
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
          {requiredNow ? 'Un producto digital activo necesita al menos un archivo.' : 'Todavía no hay archivos.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f._key} className="a-inset flex items-center gap-3 px-4 py-3">
              <DocumentIcon className="w-4 h-4 text-white/50 flex-shrink-0" aria-hidden />
              <span className="text-sm text-white truncate flex-1 min-w-0" title={f.key}>{f.name}</span>
              <span className="a-meta whitespace-nowrap">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(f._key)}
                className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${TAP_ICON}`}
                aria-label={`Quitar ${f.name}`}
                title="Quitar archivo"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {uploads.map((u) => (
            <li
              key={u._key}
              className={`a-inset flex items-center gap-3 px-4 py-3 ${u.status === 'error' ? 'border-red-500/40' : 'border-dashed'}`}
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
                className={`text-xs ${u.status === 'error' ? 'text-red-300 min-w-0' : 'a-meta whitespace-nowrap'}`}
                role={u.status === 'error' ? 'alert' : undefined}
              >
                {u.status === 'error' ? u.error : u.status === 'uploading' ? `Subiendo ${formatBytes(u.size)}…` : 'En cola'}
              </span>
              {u.status === 'error' && (
                <button
                  type="button"
                  onClick={() => onDismissUpload(u._key)}
                  className={`a-icon-btn a-icon-btn--sm ${TAP_ICON}`}
                  aria-label="Descartar"
                  title="Descartar"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="a-help">Los archivos que quites se borran del servidor al guardar, salvo que un pedido ya tenga un enlace a ellos.</p>
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
