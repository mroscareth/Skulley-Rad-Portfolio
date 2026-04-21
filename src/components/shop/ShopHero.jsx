import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { HERO_BULLETINS } from '../../lib/shopMockData.js'

const AUTOPLAY_MS = 6000
const TRANSITION_MS = 650

// Slideshow de "ARCHIVE BULLETINS". Cada slide es una IMAGEN editorial que
// Skulley diseña (texto, tipografía, estética dentro del asset). Acá solo
// montamos el chrome: código del bulletin, fecha, CTA, progress bar y dots.
export default function ShopHero({ lang = 'en', onCtaClick }) {
  const [index, setIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)
  const lastTickRef = useRef(0)
  const pausedRef = useRef(false)
  const containerRef = useRef(null)

  const slides = HERO_BULLETINS
  const slide = slides[index]

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

  // Autoplay + progress bar sincronizada
  useEffect(() => {
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
  }, [next, isTransitioning])

  useEffect(() => {
    const onVis = () => { pausedRef.current = document.visibilityState === 'hidden' }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const onMouseEnter = () => { pausedRef.current = true }
  const onMouseLeave = () => { pausedRef.current = false }

  const isEn = lang === 'en'
  const image = (isEn ? slide.image_en : slide.image_es) || slide.image_en
  const alt = (isEn ? slide.alt_en : slide.alt_es) || slide.code
  const ariaPrev = isEn ? 'Previous bulletin' : 'Bulletin anterior'
  const ariaNext = isEn ? 'Next bulletin' : 'Bulletin siguiente'

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden border-y-2 border-[#e600ff]/60 bg-black"
      style={{ minHeight: 'clamp(320px, 50vh, 560px)' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-shop-hero
    >
      {/* Banner image — ocupa todo el hero */}
      <div
        key={slide.id}
        className={`absolute inset-0 transition-all duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isTransitioning ? 'opacity-0 scale-[1.02] shop-glitch-out' : 'opacity-100 scale-100'}`}
      >
        <img
          src={image}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {/* Gradient overlay para legibilidad del chrome */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
      </div>

      {/* Scanlines + halftone encima (parte del look CRT) */}
      <div className="pointer-events-none absolute inset-0 z-[2] shop-scanlines" />
      <div className="pointer-events-none absolute inset-0 z-[2] shop-halftone opacity-20" />

      {/* Chrome: solo bulletin metadata top-left. Los CTAs por slide fueron
          removidos porque se amontonaban con la composición de los banners —
          el mismo arte ya puede tener su call-to-action visual interno. */}
      <div className="relative z-[3] flex flex-col min-h-[inherit] px-4 sm:px-10 py-5 sm:py-8 pointer-events-none" style={{ minHeight: 'clamp(320px, 50vh, 560px)' }}>
        <div
          className="flex items-center gap-3 text-xs sm:text-sm uppercase tracking-widest pointer-events-auto"
          style={{ color: slide.accent, fontFamily: '"Cascadia Code", monospace', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          <span className="opacity-80">&gt;</span>
          <span className="font-bold">{slide.code}</span>
          <span className="opacity-40">—</span>
          <span className="opacity-80">{slide.date}</span>
        </div>
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label={ariaPrev}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-[5] w-9 h-9 sm:w-12 sm:h-12 grid place-items-center border-2 border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-all"
      >
        <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label={ariaNext}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-[5] w-9 h-9 sm:w-12 sm:h-12 grid place-items-center border-2 border-[#e600ff]/60 bg-black/60 backdrop-blur-sm text-[#e600ff] hover:bg-[#e600ff] hover:text-black active:scale-90 transition-all"
      >
        <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Dots — centrados cerca del bottom, encima de la timer bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[5] flex gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { if (i !== index) go(i) }}
            aria-label={`${isEn ? 'Go to bulletin' : 'Ir al bulletin'} ${i + 1}`}
            className={`transition-all ${i === index ? 'w-8 h-2 bg-[#e600ff]' : 'w-2 h-2 bg-[#e600ff]/30 hover:bg-[#e600ff]/60'}`}
            style={{ borderRadius: '1px' }}
          />
        ))}
      </div>

      {/* Timer bar — FULL WIDTH, pegada al borde inferior del banner.
          Color cyan (DESIGN.md §1.2 terminal-prompt). Sin transition CSS:
          el RAF actualiza cada ~16ms → la barra fluye en tiempo real. */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cyan-400/15 z-[5] overflow-hidden">
        <div
          className="h-full bg-cyan-400"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 10px rgba(34, 211, 238, 0.9)',
          }}
        />
      </div>
    </section>
  )
}
