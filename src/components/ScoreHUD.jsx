import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import scoreStore from '../lib/scoreStore'

/**
 * ScoreHUD - Componente aislado para mostrar el score
 * 
 * Se suscribe directamente al scoreStore y solo se re-renderiza
 * cuando cambia el score, sin afectar al resto de la app.
 */
function ScoreHUDImpl({ t, isCompactUi = false }) {
  // Estado local para el score (solo este componente re-renderiza)
  const [score, setScore] = useState(() => scoreStore.get())
  const [resetScoreOpen, setResetScoreOpen] = useState(false)
  const [resetHoldProgress, setResetHoldProgress] = useState(0)
  
  const resetHoldRafRef = useRef(0)
  const resetHoldStartRef = useRef(0)
  const resetHoldActiveRef = useRef(false)
  const RESET_HOLD_MS = 3000

  // Suscribirse al store
  useEffect(() => {
    return scoreStore.subscribe(setScore)
  }, [])

  const stopResetHold = useCallback(() => {
    resetHoldActiveRef.current = false
    if (resetHoldRafRef.current) {
      cancelAnimationFrame(resetHoldRafRef.current)
      resetHoldRafRef.current = 0
    }
    setResetHoldProgress(0)
  }, [])

  const startResetHold = useCallback(() => {
    if (resetHoldActiveRef.current) return
    resetHoldActiveRef.current = true
    resetHoldStartRef.current = performance.now()
    
    const tick = () => {
      if (!resetHoldActiveRef.current) return
      const now = performance.now()
      const dt = now - resetHoldStartRef.current
      const p = Math.min(1, Math.max(0, dt / RESET_HOLD_MS))
      setResetHoldProgress(p)
      if (p >= 1) {
        scoreStore.reset()
        setResetScoreOpen(false)
        stopResetHold()
        return
      }
      resetHoldRafRef.current = requestAnimationFrame(tick)
    }
    resetHoldRafRef.current = requestAnimationFrame(tick)
  }, [stopResetHold])

  // Escape para cerrar modal
  useEffect(() => {
    if (!resetScoreOpen) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') {
        stopResetHold()
        setResetScoreOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [resetScoreOpen, stopResetHold])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resetHoldRafRef.current) {
        cancelAnimationFrame(resetHoldRafRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* HUD del score */}
      <div
        className="fixed z-[29999] pointer-events-none"
        style={{ top: isCompactUi ? 12 : 24, left: isCompactUi ? 12 : 24 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 text-white shadow-md font-marquee uppercase tracking-wide pointer-events-auto">
          <button
            type="button"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={t('hud.resetScore.openAria')}
            onClick={() => { stopResetHold(); setResetScoreOpen(true) }}
          >
            <ArrowPathIcon className="h-5 w-5 text-white" />
          </button>
          <span className={`leading-none ${isCompactUi ? 'text-xl' : 'text-2xl'}`}>
            {t('hud.score')}:{' '}
            <span style={{ color: score >= 0 ? '#3b82f6' : '#ef4444' }}>
              {score >= 0 ? `+${score}` : score}
            </span>
          </span>
        </div>
      </div>

      {/* Modal reset score */}
      {resetScoreOpen && (
        <div
          className="fixed inset-0 z-[40000] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={t('hud.resetScore.dialogAria')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              stopResetHold()
              setResetScoreOpen(false)
            }
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <div className="relative w-[min(520px,92vw)] rounded-2xl bg-white text-black shadow-2xl border border-black/10 p-6 font-marquee">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="uppercase tracking-wide leading-[0.95] text-[clamp(22px,4.2vw,34px)]">
                  {t('hud.resetScore.title')}
                </div>
                <div className="mt-1 text-sm opacity-80">{t('hud.resetScore.desc', { seconds: 3 })}</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-3 w-full rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-[width] duration-75"
                  style={{ width: `${resetHoldProgress * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-full border border-black/20 bg-white hover:bg-black/5 active:bg-black/10 text-black uppercase tracking-wide"
                onClick={() => { stopResetHold(); setResetScoreOpen(false) }}
              >
                {t('hud.resetScore.no')}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-full border border-black bg-white text-black uppercase tracking-wide select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} ; startResetHold() }}
                onPointerUp={() => { stopResetHold() }}
                onPointerCancel={() => { stopResetHold() }}
                onPointerLeave={() => { stopResetHold() }}
              >
                {t('hud.resetScore.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Memo para evitar re-renders por props del padre
const ScoreHUD = memo(ScoreHUDImpl)
export default ScoreHUD
