import React, { useEffect, useRef, useState, useCallback } from 'react'
import { playSfx } from '../lib/sfx.js'

// ============= REWARD TIER SYSTEM (prepared for future discount codes) =============
// Maps score ranges to reward tiers. Each tier can hold a discount code,
// percentage, label, and any custom data needed for the reward system.
//
// Usage (future):
//   const tier = getRewardTier(finalScore)
//   if (tier.tier !== 'none') {
//     // Show reward UI, send tier.tier to backend to generate a code, etc.
//   }
//
export function getRewardTier(score) {
  if (score >= 2000) return { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' }
  if (score >= 1000) return { tier: 'gold', label: 'Gold', discount: 15, minScore: 1000, color: '#ffd700' }
  if (score >= 500)  return { tier: 'silver', label: 'Silver', discount: 10, minScore: 500, color: '#c0c0c0' }
  if (score >= 100)  return { tier: 'bronze', label: 'Bronze', discount: 5, minScore: 100, color: '#cd7f32' }
  return { tier: 'none', label: null, discount: 0, minScore: 0, color: null }
}

// All available tiers (for future UI that shows what's achievable)
export const REWARD_TIERS = [
  { tier: 'bronze',  label: 'Bronze',  discount: 5,  minScore: 100,  color: '#cd7f32' },
  { tier: 'silver',  label: 'Silver',  discount: 10, minScore: 500,  color: '#c0c0c0' },
  { tier: 'gold',    label: 'Gold',    discount: 15, minScore: 1000, color: '#ffd700' },
  { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' },
]

/**
 * GameOverModal — Full-screen game over screen with animated score reveal.
 *
 * Props:
 *   t            — i18n translation function
 *   open         — whether the modal is visible
 *   finalScore   — the score to display (captured at end-game)
 *   onExit       — called when user clicks Exit (close modal, don't restart)
 *   onPlayAgain  — called when user clicks Play Again (reset + restart)
 */
function GameOverModal({ t, open, finalScore = 0, onExit, onPlayAgain }) {
  const [phase, setPhase] = useState('idle') // 'idle' | 'title' | 'score' | 'done'
  const [displayScore, setDisplayScore] = useState(0)
  const animRef = useRef(null)
  const phaseTimerRef = useRef(null)

  // Compute reward tier (prepared for future use — not shown to user yet)
  const rewardTier = getRewardTier(finalScore)
  // Store in a ref for external consumption (e.g., analytics, future API call)
  const rewardRef = useRef(rewardTier)
  useEffect(() => { rewardRef.current = rewardTier }, [rewardTier])

  // Start animation sequence when modal opens
  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setDisplayScore(0)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    // Phase 1: Show title (fade in)
    setPhase('title')
    setDisplayScore(0)

    // Phase 2: After title settles, animate score
    phaseTimerRef.current = setTimeout(() => {
      setPhase('score')
      const target = finalScore
      const duration = Math.min(2500, Math.max(800, Math.abs(target) * 2))
      const startTime = performance.now()

      const step = () => {
        const elapsed = performance.now() - startTime
        const progress = Math.min(1, elapsed / duration)
        // easeOutExpo for dramatic counting
        const eased = 1 - Math.pow(2, -10 * progress)
        const current = Math.round(target * eased)
        setDisplayScore(current)

        if (progress < 1) {
          animRef.current = requestAnimationFrame(step)
        } else {
          setDisplayScore(target)
          // Phase 3: Show buttons
          setTimeout(() => setPhase('done'), 400)
        }
      }
      animRef.current = requestAnimationFrame(step)
    }, 1200)

    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [open, finalScore])

  // Escape to exit
  useEffect(() => {
    if (!open || phase !== 'done') return
    const onKey = (e) => {
      if (e?.key === 'Escape') onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, phase, onExit])

  if (!open) return null

  const scoreColor = finalScore >= 0 ? '#3b82f6' : '#ef4444'
  const scorePrefix = finalScore >= 0 ? '+' : ''
  const showTitle = phase === 'title' || phase === 'score' || phase === 'done'
  const showScore = phase === 'score' || phase === 'done'
  const showButtons = phase === 'done'

  return (
    <div
      className="fixed inset-0 z-[99999999] flex flex-col items-center justify-center"
      style={{ background: '#000' }}
    >
      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Title: TOTAL SCORE */}
        <div
          className="transition-all duration-700 ease-out"
          style={{
            opacity: showTitle ? 1 : 0,
            transform: showTitle ? 'translateY(0)' : 'translateY(30px)',
          }}
        >
          <h1
            className="font-marquee uppercase tracking-wider text-center"
            style={{
              fontSize: 'clamp(24px, 6vw, 48px)',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.15em',
            }}
          >
            {t('game.totalScore')}
          </h1>
        </div>

        {/* Animated score number */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            opacity: showScore ? 1 : 0,
            transform: showScore ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
          }}
        >
          <div
            className="font-marquee text-center"
            style={{
              fontSize: 'clamp(100px, 28vw, 280px)',
              color: scoreColor,
              textShadow: `0 0 60px ${scoreColor}66, 0 0 120px ${scoreColor}33`,
              lineHeight: 1,
            }}
          >
            {scorePrefix}{displayScore}
          </div>
        </div>

        {/* Negative score taunt */}
        {finalScore < 0 && (
          <div
            className="transition-all duration-500 ease-out"
            style={{
              opacity: showScore ? 1 : 0,
              transform: showScore ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <p
              className="font-marquee text-center uppercase tracking-wide"
              style={{
                fontSize: 'clamp(14px, 3vw, 22px)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {t('game.negativeMessage')}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div
          className="flex items-center gap-4 mt-8 transition-all duration-500 ease-out"
          style={{
            opacity: showButtons ? 1 : 0,
            transform: showButtons ? 'translateY(0)' : 'translateY(20px)',
            pointerEvents: showButtons ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={() => {
              try { playSfx('click', { volume: 0.8 }) } catch {}
              onExit?.()
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="h-12 px-8 rounded-full border-2 border-white/30 bg-transparent text-white/70 font-marquee uppercase tracking-wide text-sm hover:bg-white/10 hover:border-white/50 active:bg-white/15 transition-all"
          >
            {t('game.exit')}
          </button>
          <button
            type="button"
            onClick={() => {
              try { playSfx('click', { volume: 0.8 }) } catch {}
              onPlayAgain?.()
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="h-12 px-8 rounded-full bg-white text-black font-marquee uppercase tracking-wide text-sm font-bold hover:bg-white/90 active:bg-white/80 transition-all shadow-lg shadow-white/20"
          >
            {t('game.playAgain')}
          </button>
        </div>
      </div>

      {/* 
        REWARD SYSTEM (prepared for future implementation)
        
        The reward tier is computed via getRewardTier(finalScore) and stored in rewardRef.
        When ready to implement:
        
        1. Import getRewardTier and REWARD_TIERS from this file
        2. Show the tier badge/label below the score (currently hidden)
        3. Call your backend API to generate a discount code for the tier:
           POST /api/rewards { score: finalScore, tier: rewardRef.current.tier }
        4. Display the returned code to the user
        5. REWARD_TIERS array can be used to show a "tier ladder" UI
        
        Tier data available in rewardRef.current:
        {
          tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'none',
          label: string | null,
          discount: number (percentage),
          minScore: number,
          color: string (hex),
        }
      */}
    </div>
  )
}

export default GameOverModal
