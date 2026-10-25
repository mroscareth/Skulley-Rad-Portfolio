/**
 * Shop editor ("Portada de la tienda" en el menú) — banners del hero + featured product override.
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
  load_failed: 'No se pudieron cargar los ajustes de la portada.',
  save_failed: 'No se pudieron guardar los cambios de la portada.',
  banners_save_failed: 'No se pudieron guardar los banners.',
  nothing_to_update: 'No había nada que guardar.',
  unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo.',
  invalid_file_type: 'Ese tipo de archivo no está permitido.',
  file_too_large: 'El archivo es demasiado grande.',
  upload_failed: 'No se pudo subir el archivo.',
  move_failed: 'El servidor no pudo guardar el archivo.',
  rate_limit: 'Demasiadas subidas a la vez. Espera un momento e intenta de nuevo.',
}

function describeError(code) {
  const c = code || 'error'
  if (ERROR_MESSAGES[c]) return ERROR_MESSAGES[c]
  if (c.startsWith('upload_error_')) return ERROR_MESSAGES.upload_failed
  return `Algo salió mal. Intenta de nuevo. (${c})`
}

// Objetivos táctiles de 44px en pantallas chicas o con dedo: los botones
// --sm del sistema miden ~30px.
const TAP = 'max-sm:min-h-11 pointer-coarse:min-h-11'

// Qué hace cada modo en la tienda (DESIGN.md §14.9; ShopHero.jsx y
// ProductCard.jsx). El mismo nombre en el select y en la explicación.
const SLIDESHOW_MODES = [
  {
    value: 'auto',
    option: 'Automático: cambia solo',
    name: 'Automático',
    rule: 'Las fotos cambian solas: el banner cada 6 segundos, con una barra que marca el tiempo; las fotos de cada card, cada 2.8 segundos.',
  },
  {
    value: 'manual',
    option: 'Manual: flechas y puntos',
    name: 'Manual',
    rule: 'Flechas y puntos para pasar de foto; nada se mueve solo. Sirve cuando hay muchas cards con varias fotos: el movimiento compite con las piezas.',
  },
  {
    value: 'off',
    option: 'Fijo: una sola imagen',
    name: 'Fijo',
    rule: 'Solo la primera imagen, sin flechas ni puntos. En las cards las demás fotos ni se cargan.',
  },
  {
    value: 'hidden',
    option: 'Oculto: quita la sección',
    name: 'Oculto',
    rule: 'Solo para el banner: la sección desaparece completa, sin dejar hueco. Una card sin foto no es card, así que en las cards no existe.',
    heroOnly: true,
  },
]

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
    <div className="w-full">
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Portada de la tienda</h1>
          <p className="a-subtitle">
            Lo primero que se ve al entrar a la tienda: la pieza destacada, los banners de arriba y cómo se mueven las fotos.
          </p>
        </div>
        <div className="a-page-head__actions justify-end">
          <span aria-live="polite" className="inline-flex">
            {message === 'saved' && <span className="a-badge a-badge--success">Guardado</span>}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className={`a-btn a-btn--primary ${TAP}`}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger mb-6" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{describeError(error)}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Cargando la portada de la tienda" />
        </div>
      ) : (
        <>
          <Section icon={StarIcon} title="Producto destacado">
            <p className="a-help max-w-3xl">
              La pieza grande que sale arriba de la cuadrícula. En Automático se usa el primer producto marcado como
              Destacado y, si no hay ninguno, el primero del catálogo.
            </p>
            <div className="max-w-xl">
              <label htmlFor={featuredId} className="a-label">Pieza</label>
              <select
                id={featuredId}
                value={featuredProductId || ''}
                onChange={(e) => setFeaturedProductId(e.target.value)}
                disabled={shopLoading}
                aria-describedby={`${featuredId}-help`}
                className="a-input"
              >
                <option value="">Automático (el marcado como Destacado)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.title_es || p.title_en || p.handle) + ' — ' + (p.categoryLabel || 'Sin categoría')}
                  </option>
                ))}
              </select>
              <p id={`${featuredId}-help`} className="a-help mt-2">
                La lista muestra los productos activos que se venden en tu región. Si la pieza elegida no tiene precio en
                la moneda de quien visita la tienda, ahí se usa la automática.
              </p>
            </div>
            {shopLoading && (
              <p className="a-help flex items-center gap-2" role="status">
                <span className="a-spinner a-spinner--sm" aria-hidden />
                Cargando productos…
              </p>
            )}
          </Section>

          <Section icon={PlayIcon} title="Movimiento de las fotos">
            <p className="a-help max-w-3xl">
              Cómo pasan las fotos del banner de arriba y de cada card de producto. Los cambios se ven al recargar la tienda.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SlideshowMode
                label="Banner de arriba"
                hint="El banner grande que se ve al entrar a la tienda."
                value={heroSlideshow}
                onChange={setHeroSlideshow}
                canHide
              />
              <SlideshowMode
                label="Cards de producto"
                hint="Las fotos dentro de cada card de la cuadrícula."
                value={cardSlideshow}
                onChange={setCardSlideshow}
              />
            </div>
            <ul className="a-rules max-w-3xl">
              {SLIDESHOW_MODES.map((m) => (
                <li key={m.value}><strong>{m.name}.</strong> {m.rule}</li>
              ))}
            </ul>
          </Section>

          <Section
            icon={PhotoIcon}
            title="Banners de arriba"
            right={
              <button type="button" onClick={addBanner} className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}>
                <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                Agregar banner
              </button>
            }
          >
            <div className="space-y-2 max-w-3xl">
              <p className="a-help">
                Arrastra con el ícono de tres rayas para cambiar el orden. Cada banner necesita al menos una imagen; si
                falta la de un idioma, se usa la del otro. Un banner sin imagen no se muestra.
              </p>
              <p className="a-help">
                El banner llena todo el ancho y se recorta por las orillas según la pantalla: deja lo importante al centro.
                Sin banners, la tienda muestra unos de ejemplo; para quitar la sección, pon el banner de arriba en Oculto.
              </p>
            </div>

            {banners.length === 0 ? (
              <div className="a-empty">
                Todavía no hay banners, así que la tienda muestra unos de ejemplo. Crea el primero con Agregar banner.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={banners.map((b) => b._key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-5">
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
    <section className="a-section space-y-5">
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
      className={`a-inset relative p-4 sm:p-6 space-y-5 min-w-0 ${isDragging ? 'border-section-quests' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* touch-none solo en el handle: sin él, en mobile el navegador se queda
            el gesto para scrollear y el PointerSensor nunca arranca el drag. */}
        <div
          {...attributes}
          {...listeners}
          className={`inline-flex items-center gap-2 -ml-1.5 px-1.5 py-1 rounded-full text-white/60 hover:text-white cursor-grab active:cursor-grabbing touch-none ${TAP}`}
          aria-label={`Banner ${index + 1}: arrastra para cambiar el orden`}
          title="Arrastra para cambiar el orden"
        >
          <Bars3Icon className="w-4 h-4" aria-hidden />
          <span className="text-sm font-semibold">Banner {index + 1}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={`a-btn a-btn--danger a-btn--sm ${TAP}`}
          aria-label={`Quitar el banner ${index + 1}`}
        >
          <TrashIcon className="w-3.5 h-3.5" aria-hidden />
          Quitar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BannerImageField
          label="Imagen en inglés"
          value={banner.image_en}
          onChange={(val) => onChange({ image_en: val })}
        />
        <BannerImageField
          label="Imagen en español"
          value={banner.image_es}
          onChange={(val) => onChange({ image_es: val })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Texto alternativo en inglés"
          value={banner.alt_en}
          onChange={(v) => onChange({ alt_en: v })}
          placeholder="Final clearance banner"
        />
        <Field
          label="Texto alternativo en español"
          value={banner.alt_es}
          onChange={(v) => onChange({ alt_es: v })}
          placeholder="Banner de liquidación final"
        />
      </div>

      {/* Verificado en ShopHero.jsx: de estos cuatro solo el código se usa,
          y solo como texto alternativo de respaldo. Decirlo evita que alguien
          los llene esperando ver algo en la tienda. */}
      <div className="border-t-2 border-white/10 pt-5 space-y-4">
        <p className="a-help max-w-3xl">
          La tienda hoy no muestra el código, la fecha, el enlace ni el color: se guardan por si se vuelven a usar. El
          código sirve de texto alternativo si no escribes uno.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Código"
            value={banner.code}
            onChange={(v) => onChange({ code: v })}
            placeholder="BULLETIN #0042"
          />
          <Field
            label="Fecha"
            value={banner.date}
            onChange={(v) => onChange({ date: v })}
            placeholder="2049.06.21"
          />
          <Field
            label="Enlace (opcional)"
            value={banner.link_url}
            onChange={(v) => onChange({ link_url: v })}
            placeholder="/shop#featured"
          />
          <div className="min-w-0">
            <label htmlFor={accentId} className="a-label">Color de acento</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={banner.accent || '#e600ff'}
                onChange={(e) => onChange({ accent: e.target.value })}
                aria-label="Elegir color de acento"
                className="w-11 h-11 flex-shrink-0 p-1 rounded-[var(--a-radius-sm)] border-2 border-white/10 bg-[var(--a-surface)] cursor-pointer"
              />
              <input
                id={accentId}
                type="text"
                value={banner.accent || ''}
                onChange={(e) => onChange({ accent: e.target.value })}
                placeholder="#e600ff"
                className="a-input a-code min-w-0"
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
              <span>Subiendo…</span>
            </>
          ) : (
            <>
              {value
                ? <ArrowUpTrayIcon className="w-5 h-5" aria-hidden />
                : <PhotoIcon className="w-8 h-8 text-white/20" aria-hidden />}
              <span>{value ? 'Reemplazar imagen' : 'Subir imagen'}</span>
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
        <div className="mt-2 flex items-center gap-2 min-w-0">
          <span className="a-code truncate flex-1 min-w-0" title={value}>{value}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}
          >
            Reemplazar
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}
          >
            Quitar
          </button>
        </div>
      )}
      {err && <p className="text-red-300 text-xs mt-2" role="alert">{describeError(err)}</p>}
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
        {/* Solo el banner puede desaparecer del todo: una card de producto sin
            imagen no es una card. */}
        {SLIDESHOW_MODES.filter((m) => canHide || !m.heroOnly).map((m) => (
          <option key={m.value} value={m.value}>{m.option}</option>
        ))}
      </select>
      <p id={`${id}-hint`} className="a-help mt-2">{hint}</p>
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
