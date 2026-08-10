import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { HERO_BULLETINS } from '../../lib/shopMockData.js'
import { useShopData } from '../../lib/shopDataContext.jsx'

const AUTOPLAY_MS = 6000
const TRANSITION_MS = 650

// Paths del CMS vienen como relativos ("uploads/shop/banners/foo.webp"); los
// mock vienen como absolutos ("/heritage.jpg"). Normalizar sin perder URLs ya
// completas (http/https) para soportar CDN si se usa en el futuro.
function toPublicUrl(p) {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  if (p.startsWith('/')) return p
  return '/' + p
}

// Slideshow de banners. Cada slide es una IMAGEN editorial que Skulley diseña
// (texto, tipografía y estética viven dentro del asset). Acá solo montamos el
// chrome mínimo: metadata del bulletin, navegación, dots y progress bar.
export default function ShopHero({ lang = 'en', onCtaClick }) {
  const { banners, slideshow } = useShopData()
  // Modo administrado desde el CMS: 'auto' rota sola, 'manual' deja flechas y
  // dots sin rotación, 'off' deja un banner fijo. Ver shop-config.php.
  const mode = slideshow?.hero || 'auto'
  const [index, setIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)
  const lastTickRef = useRef(0)
  const pausedRef = useRef(false)
  const containerRef = useRef(null)

  // Banners del CMS → shape de HERO_BULLETINS. Si el admin no subió nada,
  // usamos los mock como fallback para no dejar un hero vacío en dev/staging.
  const slides = useMemo(() => {
    if (Array.isArray(banners) && banners.length > 0) {
      return banners.map((b, i) => ({
        id: b.id != null ? `cms-${b.id}` : `cms-${i}`,
        code: b.code || '',
        date: b.date || '',
        image_en: toPublicUrl(b.image_en) || toPublicUrl(b.image_es) || '',
        image_es: toPublicUrl(b.image_es) || toPublicUrl(b.image_en) || '',
        alt_en: b.alt_en || b.code || '',
        alt_es: b.alt_es || b.code || '',
        accent: b.accent || '#e600ff',
        link_url: b.link_url || '',
      })).filter(s => s.image_en)
    }
    return HERO_BULLETINS
  }, [banners])
  const slide = slides[index] || slides[0]

  const go = useCallback((next) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setIndex((prev) => (next < 0 ? slides.length - 1 : next % slides.length))
      setProgress(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setIsTransitioning(false)))
    }, TRANSITION_MS / 2)
  }, [slides.length])

  const next = useCallback(() => go(index + 1), [index, go])
  const prev = useCallback(() => go(index - 1), [index, go])

  // Autoplay + progress bar sincronizada. Fuera de modo 'auto' ni siquiera se
  // arma el RAF: la barra de progreso no tendría nada que anunciar.
  useEffect(() => {
    if (mode !== 'auto') { setProgress(0); return undefined }
    lastTickRef.current = performance.now()
    const tick = (t) => {
      const dt = t - lastTickRef.current
      lastTickRef.current = t
      if (!pausedRef.current && !isTransitioning) {
        setProgress((prev) => {
          const p = prev + (dt / AUTOPLAY_MS) * 100
          if (p >= 100) {
            next()
            return 0
          }
          return p
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [next, isTransitioning, mode])

  useEffect(() => {
    const onVis = () => { pausedRef.current = document.visibilityState === 'hidden' }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const onMouseEnter = () => { pausedRef.current = true }
  const onMouseLeave = () => { pausedRef.current = false }

  const isEn = lang === 'en'
  // 'hidden' apaga el módulo COMPLETO desde el CMS: no hay banner, ni sección,
  // ni el espacio que ocupaba. Va después de los hooks — un return temprano
  // arriba rompería el orden de hooks entre renders.
  if (mode === 'hidden') return null
  if (!slide) return null
  const showControls = mode !== 'off' && slides.length > 1
  const image = (isEn ? slide.image_en : slide.image_es) || slide.image_en
  const alt = (isEn ? slide.alt_en : slide.alt_es) || slide.code
  const ariaPrev = isEn ? 'Previous bulletin' : 'Bulletin anterior'
  const ariaNext = isEn ? 'Next bulletin' : 'Bulletin siguiente'

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden bg-black"
      style={{ minHeight: 'clamp(380px, 64vh, 760px)' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-shop-hero
    >
      {/* Banner image — a sangre completa */}
      <div
        key={slide.id}
        className={`absolute inset-0 transition-all duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isTransitioning ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'}`}
      >
        <img
          src={image}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {/* Gradient sutil solo para que el chrome de abajo tenga contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
      </div>

      {/* Sin metadata sobreimpresa (código/fecha del bulletin): era un eyebrow
          y el arte del banner ya trae su propia tipografía. DESIGN.md §0.7.
          Los campos siguen existiendo en el CMS y en `slides` por si se
          necesitan en otro lado. */}

      {/* Chrome de navegación. En modo 'off' no se monta: sin rotación, unas
          flechas que no llevan a ningún lado son una promesa falsa. Tampoco si
          hay un solo banner. */}
      {showControls && (
        <>
      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label={ariaPrev}
        className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 z-[5] w-11 h-11 sm:w-14 sm:h-14 grid place-items-center rounded-full border-2 border-white/40 bg-black/40 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
      >
        <ChevronLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label={ariaNext}
        className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-[5] w-11 h-11 sm:w-14 sm:h-14 grid place-items-center rounded-full border-2 border-white/40 bg-black/40 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
      >
        <ChevronRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-[5] flex gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { if (i !== index) go(i) }}
            aria-label={`${isEn ? 'Go to bulletin' : 'Ir al bulletin'} ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-10 bg-[#e600ff]' : 'w-2 bg-white/40 hover:bg-white/70'}`}
          />
        ))}
      </div>

      {/* Timer bar — FULL WIDTH, pegada al borde inferior. Sin transition CSS:
          el RAF actualiza cada ~16ms → la barra fluye en tiempo real.
          Solo en 'auto': es un contador regresivo, y sin autoplay no cuenta
          nada. */}
      {mode === 'auto' && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-[5] overflow-hidden">
          <div className="h-full bg-[#e600ff]" style={{ width: `${progress}%` }} />
        </div>
      )}
        </>
      )}
    </section>
  )
}
