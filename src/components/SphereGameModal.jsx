import React, { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

/**
 * SphereGameModal — Tutorial modal explaining the sphere game mechanics.
 * Single-page modal with scoring info, cheating warning, and opt-in button.
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

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('spheresTutorial.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" />

      {/* Modal content */}
      <div className="relative w-[min(480px,92vw)] max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-black shadow-2xl border border-black/10">
        {/* Close button */}
        <button
          type="button"
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 grid place-items-center transition-colors"
          onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch {}; onClose?.() }}
          aria-label={t('common.close')}
        >
          <XMarkIcon className="h-5 w-5 text-black/60" />
        </button>

        <div className="p-6 pt-10">
          {/* Title */}
          <h2 className="font-marquee uppercase tracking-wide text-2xl text-center mb-1">
            {t('spheresTutorial.title')}
          </h2>
          <p className="text-xs text-black/40 text-center mb-5 font-mono uppercase tracking-widest">
            {t('spheresTutorial.subtitle')}
          </p>

          {/* How to play */}
          <p className="text-sm text-black/70 text-center mb-6 leading-relaxed">
            {t('spheresTutorial.howToPlay')}
          </p>

          {/* Scoring visual */}
          <div className="mb-6">
            <h3 className="font-marquee uppercase tracking-wide text-sm text-center text-black/40 mb-3">
              {t('spheresTutorial.scoring')}
            </h3>
            <div className="flex justify-center gap-4">
              {/* Small sphere */}
              <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-black/[0.03]">
                <div className="w-4 h-4 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #93c5fd, #3b82f6)', boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide">{t('spheresTutorial.small')}</span>
                <span className="font-marquee text-xl text-blue-500">100</span>
              </div>
              {/* Medium sphere */}
              <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-black/[0.03]">
                <div className="w-6 h-6 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #f9a8d4, #ec4899)', boxShadow: '0 0 10px rgba(236,72,153,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide">{t('spheresTutorial.medium')}</span>
                <span className="font-marquee text-xl text-pink-500">30</span>
              </div>
              {/* Large sphere */}
              <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-black/[0.03]">
                <div className="w-9 h-9 rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #86efac, #22c55e)', boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                <span className="text-[10px] text-black/40 uppercase tracking-wide">{t('spheresTutorial.large')}</span>
                <span className="font-marquee text-xl text-green-500">5</span>
              </div>
            </div>
          </div>

          {/* Color matching note */}
          <p className="text-sm text-black/60 text-center mb-5 leading-relaxed">
            {t('spheresTutorial.scoringDesc')}
          </p>

          {/* Warning box */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-amber-600 font-bold text-sm">{t('spheresTutorial.warning')}</span>
            </div>
            <p className="text-xs text-amber-700/80 leading-relaxed">
              {t('spheresTutorial.warningDesc')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-4 py-3.5 border-t border-black/10 bg-black/[0.02]">
          {gameActive ? (
            /* Game already active — just dismiss */
            <button
              type="button"
              onClick={() => {
                try { playSfx('click', { volume: 0.8 }) } catch {}
                onClose?.()
              }}
              className="h-10 px-8 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 active:bg-black/70 transition-colors font-marquee uppercase tracking-wide"
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
                className="h-10 px-5 rounded-full border border-black/20 bg-white text-black/60 text-sm font-medium hover:bg-black/5 active:bg-black/10 transition-colors font-marquee uppercase tracking-wide"
              >
                {t('spheresTutorial.notNow')}
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="h-10 px-8 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-sm font-bold hover:from-yellow-300 hover:to-amber-400 active:from-yellow-500 active:to-amber-600 transition-all shadow-md shadow-amber-500/30 font-marquee uppercase tracking-wide"
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
