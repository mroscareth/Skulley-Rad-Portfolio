import React, { useEffect } from 'react'
import { playSfx } from '../lib/sfx.js'

/**
 * SphereGameModal — Tutorial modal explaining the sphere game mechanics.
 * Wide modal with infinite marquee title, spacious scoring cards, and opt-in button.
 */
function SphereGameModal({ t, open, onClose, gameActive = false, onStartGame }) {
  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handlePlay = () => {
    try { playSfx('click', { volume: 0.8 }) } catch {}
    try { onStartGame?.() } catch {}
    onClose?.()
  }

  // Build the marquee title text repeated enough times for seamless loop
  const titleText = t('spheresTutorial.title')
  const marqueeSegment = `${titleText}\u00A0\u00A0\u00A0★\u00A0\u00A0\u00A0`

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('spheresTutorial.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" />

      {/* Modal content — wider */}
      <div className="relative w-[min(720px,94vw)] max-h-[90vh] overflow-y-auto rounded-3xl bg-white text-black shadow-2xl border border-black/10">
        {/* Marquee title — seamless infinite scroll (two identical halves) */}
        <div className="w-full overflow-hidden pt-8 pb-2">
          <div
            className="whitespace-nowrap font-marquee uppercase text-5xl sm:text-7xl tracking-wider will-change-transform"
            style={{ animation: 'marquee-seamless 18s linear infinite', display: 'inline-block' }}
          >
            {/* First half */}
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={`a${i}`} className="inline-block">{marqueeSegment}</span>
            ))}
            {/* Second half — identical copy for seamless loop */}
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={`b${i}`} className="inline-block">{marqueeSegment}</span>
            ))}
          </div>
        </div>

        <div className="px-8 pb-6 pt-2 sm:px-10">
          {/* Subtitle */}
          <p className="text-xs text-black/40 text-center mb-6 font-mono uppercase tracking-widest">
            {t('spheresTutorial.subtitle')}
          </p>

          {/* How to play + scoring description combined */}
          <p className="text-sm sm:text-base text-black/70 text-center mb-8 leading-relaxed">
            {t('spheresTutorial.howToPlay')} {t('spheresTutorial.scoringDesc')}
          </p>

          {/* Scoring visual — horizontal cards using full width */}
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              {/* Small sphere */}
              <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl bg-blue-50/60 border border-blue-100">
                <div className="w-5 h-5 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #93c5fd, #3b82f6)', boxShadow: '0 0 14px rgba(59,130,246,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide font-medium">{t('spheresTutorial.small')}</span>
                <span className="font-marquee text-2xl sm:text-3xl text-blue-500">100</span>
              </div>
              {/* Medium sphere */}
              <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl bg-pink-50/60 border border-pink-100">
                <div className="w-7 h-7 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #f9a8d4, #ec4899)', boxShadow: '0 0 14px rgba(236,72,153,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide font-medium">{t('spheresTutorial.medium')}</span>
                <span className="font-marquee text-2xl sm:text-3xl text-pink-500">30</span>
              </div>
              {/* Large sphere */}
              <div className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl bg-green-50/60 border border-green-100">
                <div className="w-10 h-10 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #86efac, #22c55e)', boxShadow: '0 0 14px rgba(34,197,94,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide font-medium">{t('spheresTutorial.large')}</span>
                <span className="font-marquee text-2xl sm:text-3xl text-green-500">5</span>
              </div>
            </div>
          </div>

          {/* Warning box */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-center">
            <span className="text-amber-600 font-bold text-sm">{t('spheresTutorial.warning')}</span>
            <p className="text-xs sm:text-sm text-amber-700/80 leading-relaxed mt-1.5">
              {t('spheresTutorial.warningDesc')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-black/10 bg-black/[0.02] rounded-b-3xl">
          {gameActive ? (
            /* Game already active — just dismiss */
            <button
              type="button"
              onClick={() => {
                try { playSfx('click', { volume: 0.8 }) } catch {}
                onClose?.()
              }}
              className="h-11 px-10 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 active:bg-black/70 transition-colors font-marquee uppercase tracking-wide"
            >
              {t('spheresTutorial.gotIt')}
            </button>
          ) : (
            /* Game not active — opt-in CTA */
            <>
              <button
                type="button"
                onClick={() => {
                  try { playSfx('click', { volume: 0.8 }) } catch {}
                  onClose?.()
                }}
                className="h-11 px-6 rounded-full border border-black/20 bg-white text-black/60 text-sm font-medium hover:bg-black/5 active:bg-black/10 transition-colors font-marquee uppercase tracking-wide"
              >
                {t('spheresTutorial.notNow')}
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="h-11 px-10 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-sm font-bold hover:from-yellow-300 hover:to-amber-400 active:from-yellow-500 active:to-amber-600 transition-all shadow-md shadow-amber-500/30 font-marquee uppercase tracking-wide"
              >
                {t('spheresTutorial.play')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SphereGameModal
