import React, { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, Cog6ToothIcon, MusicalNoteIcon, VideoCameraIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

// Inline gamepad icon (same as in App.jsx)
function GamepadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 7H6.5C4.01 7 2 9.01 2 11.5v1C2 14.99 4.01 17 6.5 17h11c2.49 0 4.5-2.01 4.5-4.5v-1C22 9.01 19.99 7 17.5 7zM8 14H6v-1.5H4.5V11H6V9.5h2V11h1.5v1.5H8V14zm7.5-1.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm3 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
    </svg>
  )
}

const STORAGE_KEY = 'tutorial_shown'

/**
 * TutorialModal - Terminal-style modal slideshow with control instructions
 */
function TutorialModal({ t, open, onClose }) {
  const [slide, setSlide] = useState(0)
  const totalSlides = 3

  // Reset slide when opened
  useEffect(() => {
    if (open) setSlide(0)
  }, [open])

  // Escape to close
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />
      
      {/* Terminal styles */}
      <style>{`
        @keyframes terminalScanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 60px rgba(59, 130, 246, 0.05); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), inset 0 0 80px rgba(59, 130, 246, 0.08); }
        }
      `}</style>

      {/* Modal content - Terminal style */}
      <div 
        className="relative w-[min(520px,92vw)] rounded-lg overflow-hidden"
        style={{
          backgroundColor: '#0a0a14',
          border: '2px solid #3b82f6',
          fontFamily: '"Cascadia Code", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >
        {/* Scanlines overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.06] z-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.5) 1px, rgba(0,0,0,0.5) 3px)',
            animation: 'terminalScanlines 0.5s linear infinite',
          }}
        />

        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch {}; onClose?.() }}
              aria-label={t('common.close')}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-xs">tutorial@mausoleum:~</span>
          <div className="w-6" /> {/* Spacer for balance */}
        </div>

        {/* Slides container */}
        <div className="relative overflow-hidden">
          <div 
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* Slide 1: WASD Movement */}
            <div className="w-full flex-shrink-0 p-6 pt-8 pb-4">
              <div className="text-center">
                <p className="text-cyan-400 text-xs mb-1">{`// ${t('tutorial.slide1.title')}`}</p>
                <h2 className="text-blue-400 text-xl mb-2 font-bold" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>
                  {`> MOVEMENT_CONTROLS`}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {t('tutorial.slide1.desc')}
                </p>
                
                {/* WASD Keys Visual - Terminal style */}
                <div className="flex flex-col items-center gap-2 mb-4">
                  <div className="flex justify-center">
                    <TerminalKey letter="W" />
                  </div>
                  <div className="flex gap-2">
                    <TerminalKey letter="A" />
                    <TerminalKey letter="S" />
                    <TerminalKey letter="D" />
                  </div>
                </div>

                <p className="text-blue-500/50 text-xs mt-4">
                  {`/* ${t('tutorial.slide1.hint')} */`}
                </p>
              </div>
            </div>

            {/* Slide 2: Spacebar Power */}
            <div className="w-full flex-shrink-0 p-6 pt-8 pb-4">
              <div className="text-center">
                <p className="text-cyan-400 text-xs mb-1">{`// ${t('tutorial.slide2.title')}`}</p>
                <h2 className="text-blue-400 text-xl mb-2 font-bold" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>
                  {`> POWER_CHARGE`}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {t('tutorial.slide2.desc')}
                </p>
                
                {/* Spacebar Visual - Terminal style */}
                <div className="flex flex-col items-center gap-3 mb-4">
                  <TerminalSpacebar />
                  
                  {/* Power indicator */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="h-3 w-28 rounded border border-blue-500/50 bg-black/50 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: '75%', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
                      />
                    </div>
                    <span className="text-blue-400 text-xs font-mono">{t('tutorial.slide2.power')}</span>
                  </div>
                </div>

                <p className="text-blue-500/50 text-xs mt-4">
                  {`/* ${t('tutorial.slide2.hint')} */`}
                </p>
              </div>
            </div>

            {/* Slide 3: Settings */}
            <div className="w-full flex-shrink-0 p-6 pt-8 pb-4">
              <div className="text-center">
                <p className="text-cyan-400 text-xs mb-1">{`// ${t('tutorial.slide3.title')}`}</p>
                <h2 className="text-blue-400 text-xl mb-2 font-bold" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}>
                  {`> SYSTEM_CONFIG`}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {t('tutorial.slide3.desc')}
                </p>
                
                {/* Settings icon + options - Terminal style */}
                <div className="flex flex-col items-center gap-4 mb-4">
                  <div 
                    className="h-14 w-14 rounded-lg border-2 border-blue-500/50 bg-blue-500/10 flex items-center justify-center"
                    style={{ boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' }}
                  >
                    <Cog6ToothIcon className="w-7 h-7 text-blue-400" />
                  </div>
                  
                  {/* Options list */}
                  <div className="flex flex-col gap-2 mt-2 text-left">
                    <div className="flex items-center gap-3 px-4 py-2 rounded border border-blue-500/20 bg-blue-500/5">
                      <MusicalNoteIcon className="w-4 h-4 text-magenta-400 text-pink-400" />
                      <span className="text-sm text-gray-300">{`--${t('tutorial.slide3.music').toLowerCase().replace(/\s/g, '-')}`}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded border border-blue-500/20 bg-blue-500/5">
                      <VideoCameraIcon className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-gray-300">{`--${t('tutorial.slide3.camera').toLowerCase().replace(/\s/g, '-')}`}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded border border-blue-500/20 bg-blue-500/5">
                      <GamepadIcon className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-300">{`--${t('tutorial.slide3.interface').toLowerCase().replace(/\s/g, '-')}`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation - Terminal style */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-blue-500/30 bg-blue-500/5">
          {/* Previous button */}
          <button
            type="button"
            onClick={goPrev}
            disabled={slide === 0}
            className={`h-9 w-9 rounded grid place-items-center transition-all border ${
              slide === 0 
                ? 'border-blue-500/20 text-blue-500/30 cursor-not-allowed' 
                : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400'
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
                className={`h-2 rounded-full transition-all ${
                  idx === slide 
                    ? 'w-6 bg-blue-400' 
                    : 'w-2 bg-blue-500/30 hover:bg-blue-500/50'
                }`}
                style={idx === slide ? { boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' } : {}}
                aria-label={`${t('tutorial.goToSlide')} ${idx + 1}`}
                aria-current={idx === slide ? 'true' : undefined}
              />
            ))}
          </div>

          {/* Next / Close button */}
          <button
            type="button"
            onClick={goNext}
            className="h-9 px-5 rounded border-2 border-blue-400 bg-blue-500 text-black text-sm font-bold hover:bg-blue-400 active:scale-95 transition-all"
            style={{ textShadow: 'none', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}
          >
            {slide === totalSlides - 1 ? `> ${t('tutorial.gotIt').toUpperCase()}` : `> ${t('tutorial.next').toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Terminal-style key component */
function TerminalKey({ letter }) {
  return (
    <div 
      className="h-12 w-12 rounded border-2 border-blue-500/60 bg-blue-500/10 flex items-center justify-center"
      style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.05)' }}
    >
      <span className="font-mono font-bold text-lg text-blue-400" style={{ textShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}>{letter}</span>
    </div>
  )
}

/** Terminal-style spacebar component */
function TerminalSpacebar() {
  return (
    <div 
      className="h-12 w-44 rounded border-2 border-blue-500/60 bg-blue-500/10 flex items-center justify-center"
      style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.05)' }}
    >
      <span className="font-mono text-xs text-blue-400/70 uppercase tracking-widest">SPACE</span>
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
