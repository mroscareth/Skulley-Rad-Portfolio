/**
 * Shop editor ("Storefront" en el menú) — banners del hero + featured product override.
 *
 * Carga la config de /api/shop-config.php, lista los productos del catálogo
 * (via ShopDataProvider que ya está montado arriba del admin) y permite:
 *   - CRUD de banners con drag-reorder y upload de imagen EN/ES.
 *   - Seleccionar featured product (override del flag "featured" del producto).
 *
 * Estrategia de save: un solo botón "save" que manda todo el state. Simple y
 * robusto; si el usuario pierde conexión no hay estado medio-guardado.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  PhotoIcon,
  ArrowUpTrayIcon,
  StarIcon,
  PlayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid'
import { useShopData } from '../lib/shopDataContext.jsx'

// Códigos que devuelven shop-config.php / upload.php → texto para la UI.
const ERROR_MESSAGES = {
  load_failed: "Couldn't load the storefront settings.",
  save_failed: "Couldn't save the storefront settings.",
  banners_save_failed: "The banners couldn't be saved.",
  nothing_to_update: 'There was nothing to save.',
  unauthorized: 'Your session expired. Log in again.',
  invalid_file_type: "That file type isn't allowed.",
  file_too_large: 'The file is too large.',
  upload_failed: 'The upload failed.',
  move_failed: "The server couldn't store the file.",
  rate_limit: 'Too many uploads at once. Wait a moment and try again.',
}

function describeError(code) {
  const c = code || 'error'
  if (ERROR_MESSAGES[c]) return ERROR_MESSAGES[c]
  if (c.startsWith('upload_error_')) return ERROR_MESSAGES.upload_failed
  return `Something went wrong (${c}).`
}

function emptyBanner() {
  return {
    _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    image_en: '',
    image_es: '',
    code: '',
    date: '',
    accent: '#e600ff',
    alt_en: '',
    alt_es: '',
    link_url: '',
  }
}

function toPublicUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/')) return p
  return '/' + p
}

// Vista de nivel superior: sin botón back (la navegación vive en el sidebar),
// así que el onBack que manda AdminApp ya no se usa.
export default function ShopEditor() {
  const { products, loading: shopLoading } = useShopData()
  const [banners, setBanners] = useState([])
  const [featuredProductId, setFeaturedProductId] = useState('')
  const [heroSlideshow, setHeroSlideshow] = useState('auto')
  const [cardSlideshow, setCardSlideshow] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const featuredId = useId()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shop-config.php', { credentials: 'include' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'load_failed')
      setBanners((data.banners || []).map((b) => ({
        ...b,
        _key: `row-${b.id}-${Math.random().toString(36).slice(2, 7)}`,
      })))
      setFeaturedProductId(data.featured_product_id || '')
      setHeroSlideshow(data.slideshow?.hero || 'auto')
      setCardSlideshow(data.slideshow?.card || 'auto')
    } catch (err) {
      setError(err.message || 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateBanner = (key, patch) => {
    setBanners((prev) => prev.map((b) => b._key === key ? { ...b, ...patch } : b))
  }

  const addBanner = () => {
    setBanners((prev) => [...prev, emptyBanner()])
  }

  const removeBanner = (key) => {
    setBanners((prev) => prev.filter((b) => b._key !== key))
  }

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setBanners((prev) => {
      const oldIdx = prev.findIndex((b) => b._key === active.id)
      const newIdx = prev.findIndex((b) => b._key === over.id)
      if (oldIdx < 0 || newIdx < 0) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      // Strip _key antes de mandar — solo sirve para dnd.
      const cleanBanners = banners.map(({ _key, ...rest }) => rest)
      const res = await fetch('/api/shop-config.php', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banners: cleanBanners,
          featured_product_id: featuredProductId || null,
          hero_slideshow: heroSlideshow,
          card_slideshow: cardSlideshow,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'save_failed')
      setBanners((data.banners || []).map((b) => ({
        ...b,
        _key: `row-${b.id}-${Math.random().toString(36).slice(2, 7)}`,
      })))
      setFeaturedProductId(data.featured_product_id || '')
      setHeroSlideshow(data.slideshow?.hero || 'auto')
      setCardSlideshow(data.slideshow?.card || 'auto')
      setMessage('saved')
      setTimeout(() => setMessage(null), 2500)
    } catch (err) {
      setError(err.message || 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="a-title">Storefront</h1>
          <p className="a-subtitle">Hero banners, slideshows and the featured product.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span aria-live="polite" className="inline-flex">
            {message === 'saved' && <span className="a-badge a-badge--success">Saved</span>}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="a-btn a-btn--primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{describeError(error)}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Loading" />
        </div>
      ) : (
        <>
          <Section icon={StarIcon} title="Featured product">
            <p className="a-help">
              Overrides the product's Featured flag. Leave it on Auto to use the first product marked as featured.
            </p>
            <div>
              <label htmlFor={featuredId} className="a-label">Product</label>
              <select
                id={featuredId}
                value={featuredProductId || ''}
                onChange={(e) => setFeaturedProductId(e.target.value)}
                disabled={shopLoading}
                className="a-input"
              >
                <option value="">Auto (Featured flag)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.title_en || p.title_es || p.handle) + ' — ' + (p.categoryLabel || p.category)}
                  </option>
                ))}
              </select>
            </div>
            {shopLoading && (
              <p className="a-help flex items-center gap-2" role="status">
                <span className="a-spinner a-spinner--sm" aria-hidden />
                Loading products…
              </p>
            )}
          </Section>

          <Section icon={PlayIcon} title="Slideshow">
            <p className="a-help">
              Manual shows arrows and dots without auto-rotation. Off shows a single image. Hidden removes it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SlideshowMode
                label="Hero banner"
                hint="The big banner at the top. Hidden removes the whole section."
                value={heroSlideshow}
                onChange={setHeroSlideshow}
                canHide
              />
              <SlideshowMode
                label="Product cards"
                hint="The gallery inside each card."
                value={cardSlideshow}
                onChange={setCardSlideshow}
              />
            </div>
          </Section>

          <Section
            icon={PhotoIcon}
            title="Hero banners"
            right={
              <button type="button" onClick={addBanner} className="a-btn a-btn--secondary a-btn--sm">
                <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                Add banner
              </button>
            }
          >
            <p className="a-help">
              Drag to reorder. The English image is required; the Spanish one falls back to it.
            </p>

            {banners.length === 0 ? (
              <div className="a-empty">No banners yet. Use Add banner to create the first one.</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={banners.map((b) => b._key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {banners.map((b, i) => (
                      <SortableBannerRow
                        key={b._key}
                        banner={b}
                        index={i}
                        onChange={(patch) => updateBanner(b._key, patch)}
                        onRemove={() => removeBanner(b._key)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ icon: Icon, title, right, children }) {
  return (
    <section className="a-section space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Icon className="w-[1.125rem] h-[1.125rem] text-white/50" aria-hidden />
          <h2 className="a-section-title">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function SortableBannerRow({ banner, index, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner._key })
  const accentId = useId()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`a-inset relative p-4 sm:p-5 space-y-4 min-w-0 ${isDragging ? 'border-section-quests' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* touch-none solo en el handle: sin él, en mobile el navegador se queda
            el gesto para scrollear y el PointerSensor nunca arranca el drag. */}
        <div
          {...attributes}
          {...listeners}
          className="inline-flex items-center gap-2 -ml-1.5 px-1.5 py-1 rounded-full text-white/60 hover:text-white cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Banner ${index + 1}, drag to reorder`}
          title="Drag to reorder"
        >
          <Bars3Icon className="w-4 h-4" aria-hidden />
          <span className="text-sm font-semibold">Banner {index + 1}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="a-btn a-btn--danger a-btn--sm"
        >
          <TrashIcon className="w-3.5 h-3.5" aria-hidden />
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BannerImageField
          label="English image"
          value={banner.image_en}
          onChange={(val) => onChange({ image_en: val })}
        />
        <BannerImageField
          label="Spanish image (optional)"
          value={banner.image_es}
          onChange={(val) => onChange({ image_es: val })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Code"
          value={banner.code}
          onChange={(v) => onChange({ code: v })}
          placeholder="BULLETIN #0042"
        />
        <Field
          label="Date"
          value={banner.date}
          onChange={(v) => onChange({ date: v })}
          placeholder="2049.06.21"
        />
        <Field
          label="Alt text (EN)"
          value={banner.alt_en}
          onChange={(v) => onChange({ alt_en: v })}
          placeholder="Final clearance banner"
        />
        <Field
          label="Alt text (ES)"
          value={banner.alt_es}
          onChange={(v) => onChange({ alt_es: v })}
          placeholder="Banner de liquidación final"
        />
        <Field
          label="Link URL (optional)"
          value={banner.link_url}
          onChange={(v) => onChange({ link_url: v })}
          placeholder="/shop#featured"
        />
        <div className="min-w-0">
          <label htmlFor={accentId} className="a-label">Accent color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={banner.accent || '#e600ff'}
              onChange={(e) => onChange({ accent: e.target.value })}
              aria-label="Pick accent color"
              className="w-11 h-11 flex-shrink-0 p-1 rounded-[var(--a-radius-sm)] border-2 border-white/10 bg-[var(--a-surface)] cursor-pointer"
            />
            <input
              id={accentId}
              type="text"
              value={banner.accent || ''}
              onChange={(e) => onChange({ accent: e.target.value })}
              placeholder="#e600ff"
              className="a-input min-w-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function BannerImageField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState(null)
  const inputRef = useRef(null)
  const labelId = useId()

  const handleFile = async (file) => {
    if (!file) return
    setErr(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('context', 'shop-banner')
      const res = await fetch('/api/upload.php', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json()
      if (!data.ok || !data.file?.path) throw new Error(data.error || 'upload_failed')
      onChange(data.file.path)
    } catch (e) {
      setErr(e.message || 'error')
    } finally {
      setUploading(false)
    }
  }

  // Con imagen, el overlay solo aparece en hover/focus para no tapar el
  // preview (en touch, "Replace" vive abajo junto a "Clear"); sin imagen se
  // ve siempre.
  const overlayVisible = uploading || !value

  return (
    <div className="min-w-0">
      <span id={labelId} className="a-label">{label}</span>
      {/* contain, no cover: el preview muestra el archivo completo que se subió */}
      <div className="relative aspect-video overflow-hidden rounded-[var(--a-radius-sm)] border-2 border-white/10 bg-[var(--a-surface)]">
        {value ? (
          <img
            src={toPublicUrl(value)}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />
        ) : null}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-describedby={labelId}
          className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-opacity ${
            value ? 'bg-black/70 text-white' : 'text-white/55 hover:text-white'
          } ${overlayVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-visible:opacity-100'}`}
        >
          {uploading ? (
            <>
              <span className="a-spinner a-spinner--sm" aria-hidden />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              {value
                ? <ArrowUpTrayIcon className="w-5 h-5" aria-hidden />
                : <PhotoIcon className="w-8 h-8 text-white/20" aria-hidden />}
              <span>{value ? 'Replace image' : 'Upload image'}</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {value && (
        <div className="mt-1.5 flex items-center gap-2 min-w-0">
          <span className="a-code truncate flex-1 min-w-0" title={value}>{value}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="a-btn a-btn--ghost a-btn--sm"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            className="a-btn a-btn--ghost a-btn--sm"
          >
            Clear
          </button>
        </div>
      )}
      {err && <p className="text-red-300 text-xs mt-1.5" role="alert">{describeError(err)}</p>}
    </div>
  )
}

// Tres modos en vez de un switch on/off: lo que suele estorbar de una galería
// es la rotación automática, no la galería. `manual` deja pasar imágenes a
// voluntad sin que nada se mueva solo.
function SlideshowMode({ label, hint, value, onChange, canHide = false }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="a-label">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
        className="a-input"
      >
        <option value="auto">Auto — rotates by itself</option>
        <option value="manual">Manual — arrows and dots only</option>
        <option value="off">Off — single image, no controls</option>
        {/* Solo el banner puede desaparecer del todo: una card de producto sin
            imagen no es una card. */}
        {canHide && <option value="hidden">Hidden — remove it entirely</option>}
      </select>
      <p id={`${id}-hint`} className="a-help mt-1.5">{hint}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="a-label">{label}</label>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="a-input"
      />
    </div>
  )
}
