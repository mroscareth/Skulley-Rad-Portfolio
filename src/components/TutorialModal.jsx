import React, { useState, useEffect } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import Button from './ui/Button.jsx'

const STORAGE_KEY = 'tutorial_shown'

/**
 * TutorialModal - Terminal-style modal slideshow.
 * Slide 0: bienvenida. Slides 1-3: movimiento / poder / cámara, cada uno
 * mostrando los controles reales de DESKTOP y MOBILE lado a lado.
 */
function TutorialModal({ t, open, onClose }) {
  const [slide, setSlide] = useState(0)
  const totalSlides = 4

  // Reset slide when opened
  useEffect(() => {
    if (open) setSlide(0)
  }, [open])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') onClose?.()
      if (e?.key === 'ArrowLeft') setSlide((s) => Math.max(0, s - 1))
      if (e?.key === 'ArrowRight') setSlide((s) => Math.min(totalSlides - 1, s + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const goNext = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    if (slide < totalSlides - 1) setSlide(slide + 1)
    else onClose?.()
  }
  const goPrev = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setSlide(Math.max(0, slide - 1))
  }
  const goToSlide = (idx) => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setSlide(idx)
  }

  return (
    <div
      className="fixed inset-0 z-tutorial flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial.dialogAria')}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      {/* Terminal styles */}
      <style>{`
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 60px rgba(59, 130, 246, 0.05); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), inset 0 0 80px rgba(59, 130, 246, 0.08); }
        }
      `}</style>

      {/* Modal content - Terminal style */}
      <div
        className="relative w-[min(540px,92vw)] rounded-lg overflow-hidden crt-scanlines"
        style={{
          backgroundColor: '#0a0a14',
          border: '2px solid #3b82f6',
          fontFamily: '"Cascadia Code", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >
        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; onClose?.() }}
              aria-label={t('common.close')}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-xs">M.A.D.R.E.@mausoleum:~/tutorial</span>
          <div className="w-6" />
        </div>

        {/* Slides container */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* Slide 0: Welcome */}
            <SlideShell title={t('tutorial.welcome.title')} heading="> ARCHIVO_INTERACTIVO">
              <div className="flex justify-center mb-4">
                <div
                  className="h-14 w-14 rounded-lg border-2 border-blue-500/50 bg-blue-500/10 flex items-center justify-center"
                  style={{ boxShadow: '0 0 18px rgba(59, 130, 246, 0.35)' }}
                >
                  <SparklesIcon className="w-7 h-7 text-cyan-400" />
                </div>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed max-w-[40ch] mx-auto">
                {t('tutorial.welcome.desc')}
              </p>
              <p className="text-blue-500/50 text-xs mt-4">{`/* ${t('tutorial.welcome.hint')} */`}</p>
            </SlideShell>

            {/* Slide 1: Movement */}
            <SlideShell title={t('tutorial.move.title')} heading="> MOVIMIENTO" desc={t('tutorial.move.desc')}>
              <div className="flex flex-col gap-2.5">
                <PlatformRow t={t} kind="desktop" text={t('tutorial.move.desktop')}>
                  <WasdGlyph />
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.move.mobile')}>
                  <JoystickGlyph />
                </PlatformRow>
              </div>
            </SlideShell>

            {/* Slide 2: Power */}
            <SlideShell title={t('tutorial.power.title')} heading="> CARGAR_PODER" desc={t('tutorial.power.desc')}>
              <div className="flex flex-col gap-2.5">
                <PlatformRow t={t} kind="desktop" text={t('tutorial.power.desktop')}>
                  <SpaceGlyph />
                </PlatformRow>
                <PlatformRow t={t} kind="mobile" text={t('tutorial.power.mobile')}>
                  <BoltGlyph />
                </PlatformRow>
              </div>
              {/* Power meter */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-3 w-32 rounded border border-blue-500/50 bg-black/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{ width: '75%', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
                  />
                </div>
                <span className="text-blue-400 text-xs font-mono">{t('tutorial.power.power')}</span>
              </div>
              <p className="text-blue-500/50 text-xs mt-3">{`/* ${t('tutorial.power.hint')} */`}</p>
            </SlideShell>

            {/* Slide 3: Camera & explore */}
            <SlideShell title={t('tutorial.camera.title')} heading="> CAMARA_EXPLORA" desc={t('tutorial.camera.desc')}>
              <div className="flex flex-col gap-2.5">
                <PlatformRow t={t} kind="desktop" text={t('tutorial.camera.desktop')} />
                <PlatformRow t={t} kind="mobile" text={t('tutorial.camera.mobile')} />
              </div>
              <p className="text-cyan-400/70 text-xs mt-4">{`/* ${t('tutorial.camera.hint')} */`}</p>
            </SlideShell>
          </div>
        </div>

        {/* Navigation - Terminal style */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-blue-500/30 bg-blue-500/5">
          <button
            type="button"
            onClick={goPrev}
            disabled={slide === 0}
            className={`h-9 w-9 rounded grid place-items-center transition-all border ${slide === 0
              ? 'border-blue-500/20 text-blue-500/30 cursor-not-allowed'
              : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400'
              }`}
            aria-label={t('tutorial.prev')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`h-2 rounded-full transition-all ${idx === slide
                  ? 'w-6 bg-blue-400'
                  : 'w-2 bg-blue-500/30 hover:bg-blue-500/50'
                  }`}
                style={idx === slide ? { boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' } : {}}
                aria-label={`${t('tutorial.goToSlide')} ${idx + 1}`}
                aria-current={idx === slide ? 'true' : undefined}
              />
            ))}
          </div>

          <Button variant="terminal-action" size="sm" onClick={goNext}>
            {slide === totalSlides - 1 ? `> ${t('tutorial.gotIt').toUpperCase()}` : `> ${t('tutorial.next').toUpperCase()}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Common slide wrapper: header comment + heading + optional desc, then children. */
function SlideShell({ title, heading, desc, children }) {
  return (
    <div className="w-full flex-shrink-0 p-6 pt-8 pb-5">
      <div className="text-center">
        <p className="text-cyan-400 text-xs mb-1">{`// ${title}`}</p>
        <h2 className="text-blue-400 text-xl mb-2 font-bold" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>
          {heading}
        </h2>
        {desc ? <p className="text-gray-400 text-sm mb-5">{desc}</p> : <div className="mb-2" />}
        {children}
      </div>
    </div>
  )
}

/** A labeled platform row: [icon + DESKTOP/MOBILE] : [glyph] [instruction]. */
function PlatformRow({ t, kind, text, children }) {
  const Icon = kind === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon
  const label = kind === 'mobile' ? t('tutorial.mobile') : t('tutorial.desktop')
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded border border-blue-500/20 bg-blue-500/5">
      <div className="flex items-center gap-1.5 w-[88px] shrink-0 text-blue-400/80">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
      <div className="flex-1 text-left text-[13px] text-gray-300 leading-snug">{text}</div>
    </div>
  )
}

/** Mini WASD key cluster (desktop movement). */
function WasdGlyph() {
  return (
    <div className="flex flex-col items-center gap-1">
      <MiniKey letter="W" />
      <div className="flex gap-1">
        <MiniKey letter="A" />
        <MiniKey letter="S" />
        <MiniKey letter="D" />
      </div>
    </div>
  )
}

/** Mini spacebar (desktop power). */
function SpaceGlyph() {
  return (
    <div
      className="h-7 w-24 rounded border border-blue-500/60 bg-blue-500/10 flex items-center justify-center"
      style={{ boxShadow: 'inset 0 0 14px rgba(59, 130, 246, 0.08)' }}
    >
      <span className="font-mono text-[10px] text-blue-400/80 uppercase tracking-widest">SPACE</span>
    </div>
  )
}

/** Mini joystick (mobile movement). */
function JoystickGlyph() {
  return (
    <div
      className="relative h-9 w-9 rounded-full border-2 border-blue-500/50 bg-blue-500/10 grid place-items-center"
      style={{ boxShadow: 'inset 0 0 14px rgba(59, 130, 246, 0.12)' }}
      aria-hidden
    >
      <span
        className="h-4 w-4 rounded-full bg-blue-400/80"
        style={{ boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}
      />
    </div>
  )
}

/** Mini bolt button (mobile power) — matches the in-game yellow bolt. */
function BoltGlyph() {
  return (
    <div
      className="h-9 w-9 rounded-full bg-yellow-400 grid place-items-center border border-black/20"
      style={{ boxShadow: '0 0 12px rgba(250, 204, 21, 0.55)' }}
      aria-hidden
    >
      <BoltIcon className="w-5 h-5 text-black" />
    </div>
  )
}

/** Small terminal-style key. */
function MiniKey({ letter }) {
  return (
    <div
      className="h-7 w-7 rounded border border-blue-500/60 bg-blue-500/10 flex items-center justify-center"
      style={{ boxShadow: 'inset 0 0 12px rgba(59, 130, 246, 0.06)' }}
    >
      <span className="font-mono font-bold text-sm text-blue-400" style={{ textShadow: '0 0 6px rgba(59, 130, 246, 0.6)' }}>{letter}</span>
    </div>
  )
}

/** Hook to manage whether the tutorial has been shown */
export function useTutorialShown() {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const markAsShown = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
      setShown(true)
    } catch { }
  }

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setShown(false)
    } catch { }
  }

  return { shown, markAsShown, reset }
}

export default TutorialModal
