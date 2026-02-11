import React, { useEffect, useRef, useState } from 'react'
import { playSfx } from '../lib/sfx.js'

// ============= REWARD TIER SYSTEM (prepared for future discount codes) =============
export function getRewardTier(score) {
  if (score >= 2000) return { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' }
  if (score >= 1000) return { tier: 'gold', label: 'Gold', discount: 15, minScore: 1000, color: '#ffd700' }
  if (score >= 500)  return { tier: 'silver', label: 'Silver', discount: 10, minScore: 500, color: '#c0c0c0' }
  if (score >= 100)  return { tier: 'bronze', label: 'Bronze', discount: 5, minScore: 100, color: '#cd7f32' }
  return { tier: 'none', label: null, discount: 0, minScore: 0, color: null }
}

export const REWARD_TIERS = [
  { tier: 'bronze',  label: 'Bronze',  discount: 5,  minScore: 100,  color: '#cd7f32' },
  { tier: 'silver',  label: 'Silver',  discount: 10, minScore: 500,  color: '#c0c0c0' },
  { tier: 'gold',    label: 'Gold',    discount: 15, minScore: 1000, color: '#ffd700' },
  { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' },
]

/**
 * GameOverModal — Terminal-style game over screen with animated score reveal.
 */
function GameOverModal({ t, open, finalScore = 0, onExit, onPlayAgain }) {
  const [phase, setPhase] = useState('idle')
  const [displayScore, setDisplayScore] = useState(0)
  const animRef = useRef(null)
  const phaseTimerRef = useRef(null)

  const rewardTier = getRewardTier(finalScore)
  const rewardRef = useRef(rewardTier)
  useEffect(() => { rewardRef.current = rewardTier }, [rewardTier])

  // Animation sequence
  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setDisplayScore(0)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    setPhase('title')
    setDisplayScore(0)

    phaseTimerRef.current = setTimeout(() => {
      setPhase('score')
      const target = finalScore
      const duration = Math.min(2500, Math.max(800, Math.abs(target) * 2))
      const startTime = performance.now()

      const step = () => {
        const elapsed = performance.now() - startTime
        const progress = Math.min(1, elapsed / duration)
        const eased = 1 - Math.pow(2, -10 * progress)
        const current = Math.round(target * eased)
        setDisplayScore(current)

        if (progress < 1) {
          animRef.current = requestAnimationFrame(step)
        } else {
          setDisplayScore(target)
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

  const isPositive = finalScore >= 0
  const scoreColor = isPositive ? '#3b82f6' : '#ef4444'
  const scorePrefix = isPositive ? '+' : ''
  const showTitle = phase === 'title' || phase === 'score' || phase === 'done'
  const showScore = phase === 'score' || phase === 'done'
  const showButtons = phase === 'done'

  return (
    <div
      className="fixed inset-0 z-[99999999] flex flex-col items-center justify-center"
      style={{ 
        backgroundColor: '#0a0a14',
        fontFamily: '"Cascadia Code", monospace',
      }}
    >
      {/* Terminal styles */}
      <style>{`
        @keyframes terminalScanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes scoreGlow {
          0%, 100% { filter: drop-shadow(0 0 30px ${scoreColor}66); }
          50% { filter: drop-shadow(0 0 60px ${scoreColor}99); }
        }
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Scanlines overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.06] z-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.5) 1px, rgba(0,0,0,0.5) 3px)',
          animation: 'terminalScanlines 0.5s linear infinite',
        }}
      />

      {/* CRT vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-4 z-20">
        {/* Terminal header */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            opacity: showTitle ? 1 : 0,
            transform: showTitle ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <p className="text-cyan-400 text-xs sm:text-sm text-center mb-2">
            {`// game.session.complete()`}
          </p>
          <h1
            className="text-center text-blue-500/60"
            style={{
              fontSize: 'clamp(18px, 4vw, 32px)',
              letterSpacing: '0.2em',
            }}
          >
            {`> ${t('game.totalScore').toUpperCase()}`}
          </h1>
        </div>

        {/* Score display */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            opacity: showScore ? 1 : 0,
            transform: showScore ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
          }}
        >
          <div
            className="text-center font-bold"
            style={{
              fontSize: 'clamp(80px, 24vw, 240px)',
              color: scoreColor,
              textShadow: `0 0 40px ${scoreColor}66, 0 0 80px ${scoreColor}33`,
              lineHeight: 1,
              animation: showScore ? 'scoreGlow 2s ease-in-out infinite' : 'none',
            }}
          >
            {scorePrefix}{displayScore}
            <span 
              className="inline-block ml-2"
              style={{ 
                animation: 'cursorBlink 1s step-end infinite',
                fontSize: '0.6em',
                verticalAlign: 'baseline',
              }}
            >_</span>
          </div>
        </div>

        {/* Negative score message */}
        {finalScore < 0 && (
          <div
            className="transition-all duration-500 ease-out"
            style={{
              opacity: showScore ? 1 : 0,
              transform: showScore ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <p className="text-red-400/70 text-center text-sm sm:text-base">
              {`⚠ ${t('game.negativeMessage')}`}
            </p>
          </div>
        )}

        {/* Reward tier hint (if positive) */}
        {isPositive && rewardTier.tier !== 'none' && (
          <div
            className="transition-all duration-500 ease-out"
            style={{
              opacity: showScore ? 1 : 0,
              transform: showScore ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <p 
              className="text-center text-sm"
              style={{ color: rewardTier.color, textShadow: `0 0 10px ${rewardTier.color}66` }}
            >
              {`// tier: ${rewardTier.label?.toUpperCase()}`}
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
            className="h-12 px-8 rounded border border-blue-700 bg-transparent text-blue-500 text-sm hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all"
          >
            {`> ${t('game.exit').toUpperCase()}`}
          </button>
          <button
            type="button"
            onClick={() => {
              try { playSfx('click', { volume: 0.8 }) } catch {}
              onPlayAgain?.()
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="h-12 px-8 rounded border-2 border-blue-400 bg-blue-500 text-black text-sm font-bold hover:bg-blue-400 active:scale-95 transition-all"
            style={{ 
              textShadow: 'none',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
            }}
          >
            {`> ${t('game.playAgain').toUpperCase()}_`}
          </button>
        </div>

        {/* Terminal prompt at bottom */}
        <div
          className="mt-8 transition-all duration-500 ease-out"
          style={{
            opacity: showButtons ? 0.5 : 0,
          }}
        >
          <p className="text-blue-500/40 text-xs">
            {`mausoleum@game:~$ awaiting input...`}
          </p>
        </div>
      </div>
    </div>
  )
}

export default GameOverModal
