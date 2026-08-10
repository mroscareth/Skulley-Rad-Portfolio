/**
 * Shop editor — banners del hero + featured product override.
 *
 * Carga la config de /api/shop-config.php, lista los productos de Shopify
 * (via ShopDataProvider que ya está montado arriba del admin) y permite:
 *   - CRUD de banners con drag-reorder y upload de imagen EN/ES.
 *   - Seleccionar featured product (override del tag "featured" de Shopify).
 *
 * Estrategia de save: un solo botón "save" que manda todo el state. Simple y
 * robusto; si el usuario pierde conexión no hay estado medio-guardado.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  PhotoIcon,
  ArrowUpTrayIcon,
  StarIcon,
  PlayIcon,
} from '@heroicons/react/24/solid'
import { useShopData } from '../lib/shopDataContext.jsx'

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

export default function ShopEditor({ onBack }) {
  const { products, loading: shopLoading } = useShopData()
  const [banners, setBanners] = useState([])
  const [featuredProductId, setFeaturedProductId] = useState('')
  const [heroSlideshow, setHeroSlideshow] = useState('auto')
  const [cardSlideshow, setCardSlideshow] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded hover:bg-blue-500/10 transition-colors"
            title="back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-blue-400" />
          </button>
          <div>
            <h1 className="admin-section-title text-lg">shop</h1>
            <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
              // hero banners & featured product override
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message === 'saved' && (
            <span className="text-green-400 text-xs admin-terminal-font">&gt; saved_ok</span>
          )}
          <button
            onClick={save}
            disabled={saving || loading}
            className="admin-btn-primary px-5 py-2.5 rounded text-sm"
          >
            {saving ? 'saving...' : '> save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error px-4 py-3 rounded text-sm">
          &gt; ERROR: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Featured product selector */}
          <section className="admin-card p-5 rounded space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <StarIcon className="w-4 h-4 text-yellow-400" />
              <h2 className="admin-section-title text-sm">featured_product</h2>
            </div>
            <p className="admin-comment">
              overrides the "featured" tag in Shopify. empty = use Shopify tag.
            </p>
            <select
              value={featuredProductId || ''}
              onChange={(e) => setFeaturedProductId(e.target.value)}
              disabled={shopLoading}
              className="admin-input w-full px-3 py-2 rounded text-sm"
            >
              <option value="">// auto (Shopify "featured" tag)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.title_en || p.title_es || p.handle) + ' — ' + (p.categoryLabel || p.category)}
                </option>
              ))}
            </select>
            {shopLoading && (
              <p className="text-blue-500/40 text-xs admin-terminal-font">
                &gt; loading_shopify_products...
              </p>
            )}
          </section>

          {/* Slideshow */}
          <section className="admin-card p-5 rounded space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <PlayIcon className="w-4 h-4 text-blue-400" />
              <h2 className="admin-section-title text-sm">slideshow</h2>
            </div>
            <p className="admin-comment">
              manual = arrows and dots, no auto-rotation · off = single image · hidden = gone
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SlideshowMode
                label="hero_banner"
                hint="the big banner at the top · hidden removes the whole section"
                value={heroSlideshow}
                onChange={setHeroSlideshow}
                canHide
              />
              <SlideshowMode
                label="product_cards"
                hint="the gallery inside each card"
                value={cardSlideshow}
                onChange={setCardSlideshow}
              />
            </div>
          </section>

          {/* Banners */}
          <section className="admin-card p-5 rounded space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhotoIcon className="w-4 h-4 text-blue-400" />
                <h2 className="admin-section-title text-sm">hero_banners</h2>
              </div>
              <button
                onClick={addBanner}
                className="admin-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                add_banner
              </button>
            </div>
            <p className="admin-comment">
              drag to reorder · image_en is required, image_es falls back to en
            </p>

            {banners.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-blue-500/20 rounded">
                <p className="text-blue-500/40 text-sm admin-terminal-font">
                  // no banners yet — click add_banner
                </p>
              </div>
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
          </section>
        </>
      )}
    </div>
  )
}

function SortableBannerRow({ banner, index, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner._key })
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
      className="rounded p-4 space-y-3"
      // Terminal border style matching admin-card look
    >
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{ display: 'none' }}
      />
      <div
        className="relative rounded p-4 space-y-3"
        style={{
          backgroundColor: 'rgba(0, 10, 30, 0.35)',
          border: isDragging
            ? '1px solid rgba(59, 130, 246, 0.6)'
            : '1px solid rgba(59, 130, 246, 0.15)',
          boxShadow: isDragging ? '0 0 25px rgba(59, 130, 246, 0.25)' : 'none',
        }}
      >
        {/* Header row: drag handle + index + remove */}
        <div className="flex items-center justify-between gap-2">
          <div
            {...attributes}
            {...listeners}
            className="inline-flex items-center gap-2 px-2 py-1 rounded cursor-grab active:cursor-grabbing text-blue-400/70"
            title="drag to reorder"
          >
            <Bars3Icon className="w-4 h-4" />
            <span className="text-xs admin-terminal-font">banner[{index}]</span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors admin-terminal-font"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            remove
          </button>
        </div>

        {/* Image uploads side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BannerImageField
            label="image_en"
            value={banner.image_en}
            onChange={(val) => onChange({ image_en: val })}
          />
          <BannerImageField
            label="image_es (optional)"
            value={banner.image_es}
            onChange={(val) => onChange({ image_es: val })}
          />
        </div>

        {/* Text fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="code"
            value={banner.code}
            onChange={(v) => onChange({ code: v })}
            placeholder="BULLETIN #0042"
          />
          <Field
            label="date"
            value={banner.date}
            onChange={(v) => onChange({ date: v })}
            placeholder="2049.06.21"
          />
          <Field
            label="alt_en"
            value={banner.alt_en}
            onChange={(v) => onChange({ alt_en: v })}
            placeholder="Final clearance banner"
          />
          <Field
            label="alt_es"
            value={banner.alt_es}
            onChange={(v) => onChange({ alt_es: v })}
            placeholder="Banner de liquidación final"
          />
          <Field
            label="link_url (optional)"
            value={banner.link_url}
            onChange={(v) => onChange({ link_url: v })}
            placeholder="/shop#featured"
          />
          <div>
            <label className="block text-xs admin-terminal-font text-blue-500/60 mb-1">
              accent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={banner.accent || '#e600ff'}
                onChange={(e) => onChange({ accent: e.target.value })}
                className="w-10 h-9 rounded border border-blue-500/20 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={banner.accent || ''}
                onChange={(e) => onChange({ accent: e.target.value })}
                placeholder="#e600ff"
                className="admin-input flex-1 px-3 py-2 rounded text-sm"
              />
            </div>
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

  return (
    <div>
      <label className="block text-xs admin-terminal-font text-blue-500/60 mb-1">
        {label}
      </label>
      <div
        className="relative rounded overflow-hidden"
        style={{
          border: '1px solid rgba(59, 130, 246, 0.15)',
          backgroundColor: 'rgba(0, 10, 30, 0.3)',
          aspectRatio: '16 / 9',
        }}
      >
        {value ? (
          <img
            src={toPublicUrl(value)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PhotoIcon className="w-10 h-10 text-blue-500/15" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 w-full h-full flex items-center justify-center gap-2 text-xs admin-terminal-font opacity-0 hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: 'rgba(0, 10, 30, 0.75)',
            color: '#60a5fa',
          }}
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>uploading...</span>
            </>
          ) : (
            <>
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>{value ? 'replace_image' : 'upload_image'}</span>
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
        <div className="mt-1 flex items-center gap-2">
          <span className="text-blue-500/40 text-[10px] admin-terminal-font truncate flex-1">{value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-red-400/60 hover:text-red-400 text-[10px] admin-terminal-font"
          >
            clear
          </button>
        </div>
      )}
      {err && <p className="text-red-400 text-xs mt-1 admin-terminal-font">&gt; {err}</p>}
    </div>
  )
}

// Tres modos en vez de un switch on/off: lo que suele estorbar de una galería
// es la rotación automática, no la galería. `manual` deja pasar imágenes a
// voluntad sin que nada se mueva solo.
function SlideshowMode({ label, hint, value, onChange, canHide = false }) {
  return (
    <div>
      <label className="block text-xs admin-terminal-font text-blue-500/60 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input w-full px-3 py-2 rounded text-sm"
      >
        <option value="auto">auto — rotates by itself</option>
        <option value="manual">manual — arrows and dots only</option>
        <option value="off">off — single image, no controls</option>
        {/* Solo el banner puede desaparecer del todo: una card de producto sin
            imagen no es una card. */}
        {canHide && <option value="hidden">hidden — remove it entirely</option>}
      </select>
      <p className="admin-comment mt-1">{hint}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs admin-terminal-font text-blue-500/60 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-input w-full px-3 py-2 rounded text-sm"
      />
    </div>
  )
}
