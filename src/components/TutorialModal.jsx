import React, { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, Cog6ToothIcon, MusicalNoteIcon, VideoCameraIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

// Icono de gamepad inline (mismo que en App.jsx)
function GamepadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 7H6.5C4.01 7 2 9.01 2 11.5v1C2 14.99 4.01 17 6.5 17h11c2.49 0 4.5-2.01 4.5-4.5v-1C22 9.01 19.99 7 17.5 7zM8 14H6v-1.5H4.5V11H6V9.5h2V11h1.5v1.5H8V14zm7.5-1.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm3 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
    </svg>
  )
}

const STORAGE_KEY = 'tutorial_shown'

/**
 * TutorialModal - Modal slideshow con instrucciones de controles
 */
function TutorialModal({ t, open, onClose }) {
  const [slide, setSlide] = useState(0)
  const totalSlides = 3

  // Reset slide cuando se abre
  useEffect(() => {
    if (open) setSlide(0)
  }, [open])

  // Escape para cerrar
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
    try { playSfx('click', { volume: 0.8 }) } catch {}
    if (slide < totalSlides - 1) {
      setSlide(slide + 1)
    } else {
      onClose?.()
    }
  }

  const goPrev = () => {
    try { playSfx('click', { volume: 0.8 }) } catch {}
    setSlide(Math.max(0, slide - 1))
  }

  const goToSlide = (idx) => {
    try { playSfx('click', { volume: 0.8 }) } catch {}
    setSlide(idx)
  }

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" />
      
      {/* Modal content */}
      <div className="relative w-[min(480px,92vw)] rounded-2xl bg-white text-black shadow-2xl border border-black/10 overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 grid place-items-center transition-colors"
          onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch {}; onClose?.() }}
          aria-label={t('common.close')}
        >
          <XMarkIcon className="h-5 w-5 text-black/60" />
        </button>

        {/* Slides container */}
        <div className="relative overflow-hidden">
          <div 
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* Slide 1: WASD Movement */}
            <div className="w-full flex-shrink-0 p-6 pt-12 pb-4">
              <div className="text-center">
                <h2 className="font-marquee uppercase tracking-wide text-xl mb-2">
                  {t('tutorial.slide1.title')}
                </h2>
                <p className="text-sm text-black/60 mb-6">
                  {t('tutorial.slide1.desc')}
                </p>
                
                {/* WASD Keys Visual */}
                <div className="flex flex-col items-center gap-1.5 mb-4">
                  {/* W key */}
                  <div className="flex justify-center">
                    <Key letter="W" />
                  </div>
                  {/* A S D keys */}
                  <div className="flex gap-1.5">
                    <Key letter="A" />
                    <Key letter="S" />
                    <Key letter="D" />
                  </div>
                </div>

                <p className="text-xs text-black/50 mt-4">
                  {t('tutorial.slide1.hint')}
                </p>
              </div>
            </div>

            {/* Slide 2: Spacebar Power */}
            <div className="w-full flex-shrink-0 p-6 pt-12 pb-4">
              <div className="text-center">
                <h2 className="font-marquee uppercase tracking-wide text-xl mb-2">
                  {t('tutorial.slide2.title')}
                </h2>
                <p className="text-sm text-black/60 mb-6">
                  {t('tutorial.slide2.desc')}
                </p>
                
                {/* Spacebar Visual */}
                <div className="flex flex-col items-center gap-3 mb-4">
                  <SpacebarKey />
                  
                  {/* Power indicator */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-3 w-24 rounded-full bg-black/10 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 animate-pulse"
                        style={{ width: '75%' }}
                      />
                    </div>
                    <span className="text-xs text-black/50">{t('tutorial.slide2.power')}</span>
                  </div>
                </div>

                <p className="text-xs text-black/50 mt-4">
                  {t('tutorial.slide2.hint')}
                </p>
              </div>
            </div>

            {/* Slide 3: Settings */}
            <div className="w-full flex-shrink-0 p-6 pt-12 pb-4">
              <div className="text-center">
                <h2 className="font-marquee uppercase tracking-wide text-xl mb-2">
                  {t('tutorial.slide3.title')}
                </h2>
                <p className="text-sm text-black/60 mb-6">
                  {t('tutorial.slide3.desc')}
                </p>
                
                {/* Settings icon + options */}
                <div className="flex flex-col items-center gap-4 mb-4">
                  {/* Settings button visual */}
                  <div className="h-14 w-14 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 border border-gray-300 shadow-md flex items-center justify-center">
                    <Cog6ToothIcon className="w-7 h-7 text-gray-600" />
                  </div>
                  
                  {/* Options list */}
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-black/5">
                      <MusicalNoteIcon className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-black/70">{t('tutorial.slide3.music')}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-black/5">
                      <VideoCameraIcon className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-black/70">{t('tutorial.slide3.camera')}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-black/5">
                      <GamepadIcon className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-black/70">{t('tutorial.slide3.interface')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/10 bg-black/[0.02]">
          {/* Previous button */}
          <button
            type="button"
            onClick={goPrev}
            disabled={slide === 0}
            className={`h-9 w-9 rounded-full grid place-items-center transition-all ${
              slide === 0 
                ? 'bg-black/5 text-black/20 cursor-not-allowed' 
                : 'bg-black/10 hover:bg-black/15 active:bg-black/20 text-black/60'
            }`}
            aria-label={t('tutorial.prev')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          {/* Dots indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`h-2.5 rounded-full transition-all ${
                  idx === slide 
                    ? 'w-6 bg-black/70' 
                    : 'w-2.5 bg-black/20 hover:bg-black/30'
                }`}
                aria-label={`${t('tutorial.goToSlide')} ${idx + 1}`}
                aria-current={idx === slide ? 'true' : undefined}
              />
            ))}
          </div>

          {/* Next / Close button */}
          <button
            type="button"
            onClick={goNext}
            className="h-9 px-4 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 active:bg-black/70 transition-colors"
          >
            {slide === totalSlides - 1 ? t('tutorial.gotIt') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Componente de tecla individual */
function Key({ letter }) {
  return (
    <div className="h-12 w-12 rounded-lg bg-gradient-to-b from-gray-100 to-gray-200 border border-gray-300 shadow-[0_2px_0_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.5)] flex items-center justify-center">
      <span className="font-mono font-bold text-lg text-gray-700">{letter}</span>
    </div>
  )
}

/** Componente de barra espaciadora */
function SpacebarKey() {
  return (
    <div className="h-12 w-40 rounded-lg bg-gradient-to-b from-gray-100 to-gray-200 border border-gray-300 shadow-[0_2px_0_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.5)] flex items-center justify-center">
      <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">SPACE</span>
    </div>
  )
}

/** Hook para manejar si el tutorial ya fue mostrado */
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
    } catch {}
  }

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setShown(false)
    } catch {}
  }

  return { shown, markAsShown, reset }
}

export default TutorialModal
