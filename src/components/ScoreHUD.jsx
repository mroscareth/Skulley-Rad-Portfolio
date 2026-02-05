import React, { useState, useEffect, useRef } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import scoreStore from '../lib/scoreStore'

const RESET_HOLD_MS = 3000

/**
 * ScoreHUD - Isolated component for displaying the score
 */
function ScoreHUD({ t, isCompactUi = false }) {
  const [score, setScore] = useState(() => scoreStore.get())
  const [resetScoreOpen, setResetScoreOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  
  const startTimeRef = useRef(0)
  const intervalRef = useRef(null)

  // Subscribe to store
  useEffect(() => {
    return scoreStore.subscribe(setScore)
  }, [])

  // Start hold
  const startHold = () => {
    if (intervalRef.current) return
    setHolding(true)
    startTimeRef.current = Date.now()
    setProgress(0)
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const p = Math.min(1, elapsed / RESET_HOLD_MS)
      setProgress(p)
      
      if (p >= 1) {
        // Completed
        clearInterval(intervalRef.current)
        intervalRef.current = null
        scoreStore.reset()
        setResetScoreOpen(false)
        setHolding(false)
        setProgress(0)
      }
    }, 16) // ~60fps
  }

  // Stop hold
  const stopHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setHolding(false)
    setProgress(0)
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Escape to close modal
  useEffect(() => {
    if (!resetScoreOpen) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') {
        stopHold()
        setResetScoreOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [resetScoreOpen])

  return (
    <>
      {/* Score HUD */}
      <div
        className="fixed z-[999990] pointer-events-none"
        style={{ top: isCompactUi ? 12 : 24, left: isCompactUi ? 12 : 24 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 text-white shadow-md font-marquee uppercase tracking-wide pointer-events-auto">
          <button
            type="button"
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={t('hud.resetScore.openAria')}
            onClick={() => { stopHold(); setResetScoreOpen(true) }}
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
          className="fixed inset-0 z-[9999999] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={t('hud.resetScore.dialogAria')}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              stopHold()
              setResetScoreOpen(false)
            }
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" />
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
              <div className="h-4 w-full rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600"
                  style={{ width: `${progress * 100}%`, transition: 'width 50ms linear' }}
                />
              </div>
              {holding && <div className="mt-2 text-center text-sm opacity-60">Holding...</div>}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-full border border-black/20 bg-white hover:bg-black/5 active:bg-black/10 text-black uppercase tracking-wide"
                onClick={() => { stopHold(); setResetScoreOpen(false) }}
              >
                {t('hud.resetScore.no')}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-full border-2 uppercase tracking-wide select-none focus:outline-none touch-none transition-colors ${holding ? 'border-red-600 bg-red-600 text-white scale-95' : 'border-red-500 bg-red-500 text-white hover:bg-red-600'}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
                  startHold()
                }}
                onPointerUp={(e) => {
                  e.preventDefault()
                  try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
                  stopHold()
                }}
                onPointerCancel={(e) => {
                  try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
                  stopHold()
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {holding ? `${Math.ceil((1 - progress) * 3)}s...` : `${t('hud.resetScore.yes')} (3s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ScoreHUD
