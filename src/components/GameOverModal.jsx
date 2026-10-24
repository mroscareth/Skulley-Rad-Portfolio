import React, { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, TrophyIcon, TicketIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { useShopData } from '../lib/shopDataContext.jsx'

// ============= REWARD TIER SYSTEM (prepared for future discount codes) =============
// Threshold for the gold skin unlock (must match App.jsx GOLD_SKIN_THRESHOLD)
// y para el Golden Ticket (35% en una compra de la tienda). Backend:
// GOLDEN_TICKET_SCORE_THRESHOLD en public/api/profile.php debe coincidir.
export const GOLD_SKIN_THRESHOLD = 5000

export function getRewardTier(score) {
  if (score >= 5000) return { tier: 'legendary', label: 'Legendary', discount: 35, minScore: 5000, color: '#ffaa00' }
  if (score >= 2000) return { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' }
  if (score >= 1000) return { tier: 'gold', label: 'Gold', discount: 15, minScore: 1000, color: '#ffd700' }
  if (score >= 500) return { tier: 'silver', label: 'Silver', discount: 10, minScore: 500, color: '#c0c0c0' }
  if (score >= 100) return { tier: 'bronze', label: 'Bronze', discount: 5, minScore: 100, color: '#cd7f32' }
  return { tier: 'none', label: null, discount: 0, minScore: 0, color: null }
}

export const REWARD_TIERS = [
  { tier: 'bronze', label: 'Bronze', discount: 5, minScore: 100, color: '#cd7f32' },
  { tier: 'silver', label: 'Silver', discount: 10, minScore: 500, color: '#c0c0c0' },
  { tier: 'gold', label: 'Gold', discount: 15, minScore: 1000, color: '#ffd700' },
  { tier: 'diamond', label: 'Diamond', discount: 25, minScore: 2000, color: '#b9f2ff' },
  { tier: 'legendary', label: 'Legendary', discount: 35, minScore: 5000, color: '#ffaa00' },
]

// Los labels de REWARD_TIERS se quedan en inglés: otros módulos los leen.
const TIER_LABEL_ES = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', diamond: 'Diamante', legendary: 'Legendario' }

const SCORE_POSITIVE = '#f5ff00'
const SCORE_NEGATIVE = '#ef4444'

const ES = {
  dialogAria: 'Fin del juego',
  close: 'Cerrar',
  tier: (tier) => `Nivel ${TIER_LABEL_ES[tier.tier] || tier.label}`,
  savedBest: 'Nuevo récord personal. Quedó guardado en tu perfil.',
  saved: 'Puntaje guardado en tu perfil.',
  best: (n) => `Tu mejor marca: ${n}`,
  loginHint: 'Tu puntaje está apartado. Inicia sesión para guardarlo.',
  loginHintTicket: 'Ganaste el golden ticket. Inicia sesión para reclamarlo antes de salir.',
  loginCta: 'Iniciar sesión y reclamar',
  claiming: 'Reclamando…',
  ticketTitle: 'Ganaste el golden ticket',
  ticketBody: (pct) => `${pct}% de descuento en una compra de la tienda.`,
}

const EN = {
  dialogAria: 'Game over',
  close: 'Close',
  tier: (tier) => `${tier.label} tier`,
  savedBest: 'New personal best. Saved to your profile.',
  saved: 'Score saved to your profile.',
  best: (n) => `Personal best: ${n}`,
  loginHint: 'Your score is being held. Log in to save it.',
  loginHintTicket: 'You earned the golden ticket. Log in to claim it before you leave.',
  loginCta: 'Log in and claim',
  claiming: 'Claiming…',
  ticketTitle: 'Golden ticket earned',
  ticketBody: (pct) => `${pct}% off one order in the shop.`,
}

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#f5ff00]'

/**
 * GameOverModal — pantalla final del juego de esferas. Hermano de
 * SphereGameModal: panel Argus plano (§14), display Luckiest Guy para el
 * puntaje, acento amarillo, cero glow. Revela el puntaje por fases (título →
 * conteo → acciones) y guarda el score en el perfil si hay sesión.
 */
function GameOverModal({ t, open, finalScore = 0, onExit, onPlayAgain, onLogin, authenticated = false, userProfile = {} }) {
  const { lang } = useLanguage()
  // El % real del ticket lo fija el backend (catálogo); el del tier es solo el umbral.
  const { goldenTicketPct } = useShopData()
  const [phase, setPhase] = useState('idle')
  const [displayScore, setDisplayScore] = useState(0)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const animRef = useRef(null)
  const phaseTimerRef = useRef(null)
  const savingRef = useRef(false)
  const [claimed, setClaimed] = useState(false)
  const [ticketWon, setTicketWon] = useState(false)

  // El reclamo lo ejecuta useUserProfile, que sobrevive a una recarga de
  // Privy; si el modal sigue abierto, avisa por evento para confirmarlo.
  useEffect(() => {
    if (!open) return undefined
    const onClaimed = (e) => {
      setClaimed(true)
      setTicketWon(!!e?.detail?.profile?.golden_ticket)
    }
    window.addEventListener('score-claimed', onClaimed)
    return () => window.removeEventListener('score-claimed', onClaimed)
  }, [open])

  const rewardTier = getRewardTier(finalScore)
  const rewardRef = useRef(rewardTier)
  useEffect(() => { rewardRef.current = rewardTier }, [rewardTier])

  // Save score to server when game ends (if authenticated)
  useEffect(() => {
    if (!open || !authenticated || !userProfile?.saveScore || savingRef.current) return
    if (finalScore === 0) return // Don't save zero scores

    savingRef.current = true
    const tier = getRewardTier(finalScore)
    const hadTicket = !!userProfile.hasGoldenTicket
    userProfile.saveScore(finalScore, tier.tier).then((result) => {
      if (result) {
        setScoreSaved(true)
        setIsNewHighScore(result.newHighScore || false)
        setTicketWon(!hadTicket && !!result.profile?.golden_ticket)
      }
    }).catch(() => {}).finally(() => {
      savingRef.current = false
    })
  }, [open, authenticated, finalScore])

  // Animation sequence
  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setDisplayScore(0)
      setScoreSaved(false)
      setIsNewHighScore(false)
      setClaimed(false)
      setTicketWon(false)
      savingRef.current = false
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
      if (e?.key !== 'Escape') return
      // Con el login de Privy encima, Escape es para cerrarlo a él: si tambien
      // cerrara esto, el usuario perderia de vista el premio sin reclamar.
      if (document.getElementById('privy-dialog')) return
      onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, phase, onExit])

  if (!open) return null

  const es = lang === 'es'
  const tr = es ? ES : EN
  const fmt = (n) => Number(n || 0).toLocaleString(es ? 'es-MX' : 'en-US')

  const isPositive = finalScore >= 0
  const scoreColor = isPositive ? SCORE_POSITIVE : SCORE_NEGATIVE
  const scorePrefix = isPositive ? '+' : ''
  const showTitle = phase === 'title' || phase === 'score' || phase === 'done'
  const showScore = phase === 'score' || phase === 'done'
  const showButtons = phase === 'done'
  // El valor de la key trae ":" de cuando era prompt de terminal.
  const title = String(t('game.totalScore') || '').replace(/\s*:\s*$/, '')

  const showSaved = authenticated && scoreSaved
  const showBest = authenticated && userProfile?.highScore > 0
  const showLoginHint = !authenticated && finalScore > 0 && !claimed
  // El ticket lo otorga el servidor, no el marcador: puede recortar el score o
  // negarlo, y quien ya tenía uno no gana otro.
  const showTicket = authenticated && rewardTier.tier === 'legendary' && (scoreSaved || claimed) && ticketWon
  const hasStatus = showSaved || showBest || showLoginHint || showTicket || claimed

  const reveal = (visible, dy = 20) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${dy}px)`,
  })

  const handleExit = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onExit?.()
  }
  const handlePlayAgain = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    onPlayAgain?.()
  }
  const hoverSfx = () => { try { playSfx('hover', { volume: 0.9 }) } catch { } }

  // Con puntaje sin reclamar, el primario es el login: reclamar importa mas que
  // volver a jugar, y es lo que se pierde al salir. Nunca dos primarios.
  const showLoginCta = showLoginHint && Boolean(onLogin)
  const primaryBtn = `shop-btn argus-btn--primary h-12 px-8 text-sm ${FOCUS_RING}`
  const ghostBtn = `shop-btn shop-btn--ghost h-12 px-6 text-xs ${FOCUS_RING}`

  return (
    <div
      className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 shop-inspect-enter"
      role="dialog"
      aria-modal="true"
      aria-label={tr.dialogAria}
    >
      {/* Pop plano (escala, sin glow) para el récord y el golden ticket. */}
      <style>{`
        @keyframes gameOverPop {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        .game-over-pop {
          transform-origin: left center;
          animation: gameOverPop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .game-over-pop { animation: none; }
        }
      `}</style>

      {/* Backdrop — §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      {/* Panel §14 — mismo ancho que SphereGameModal */}
      <div className="argus-panel relative w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto modal-scroll px-7 sm:px-10 pt-9 pb-9 text-white">
        {showButtons && (
          <button
            type="button"
            onClick={handleExit}
            className={`argus-actions-in absolute top-3 right-3 w-11 h-11 grid place-items-center rounded-full text-white/35 hover:text-white text-2xl leading-none transition-colors ${FOCUS_RING}`}
            aria-label={tr.close}
          >
            ×
          </button>
        )}

        <h1
          className="argus-display text-white text-4xl sm:text-5xl pr-10 transition-all duration-500 ease-expo-out"
          style={reveal(showTitle)}
        >
          {title}
        </h1>

        <div className="transition-all duration-500 ease-expo-out" style={reveal(showScore)}>
          <p
            className="argus-display whitespace-nowrap mt-5"
            style={{ fontSize: 'clamp(3.25rem, 15vw, 7rem)', lineHeight: 0.9, color: scoreColor }}
          >
            {scorePrefix}{fmt(displayScore)}
          </p>

          {finalScore < 0 && (
            <p className="argus-display text-white/50 text-xl sm:text-2xl mt-4">
              {t('game.negativeMessage')}
            </p>
          )}

          {isPositive && rewardTier.tier !== 'none' && (
            <span
              className="flex w-fit items-center h-8 px-4 mt-5 rounded-full text-xs font-bold uppercase tracking-[0.16em] text-[#0a0510]"
              style={{ backgroundColor: rewardTier.color }}
            >
              {tr.tier(rewardTier)}
            </span>
          )}
        </div>

        {showButtons && hasStatus && (
          <div className="argus-beat mt-7 pt-6 border-t-2 border-white/10 flex flex-col gap-3">
            {showTicket && (
              <div className="game-over-pop flex items-start gap-3">
                <TicketIcon className="w-7 h-7 shrink-0" style={{ color: rewardTier.color }} aria-hidden />
                <div>
                  <p className="argus-display text-2xl sm:text-[1.75rem]" style={{ color: rewardTier.color }}>
                    {tr.ticketTitle}
                  </p>
                  <p className="text-white/70 text-sm mt-1.5">{tr.ticketBody(goldenTicketPct)}</p>
                </div>
              </div>
            )}
            {showSaved && (
              isNewHighScore ? (
                <p className="game-over-pop flex items-center gap-2.5 text-[#f5ff00] font-bold text-sm sm:text-base">
                  <TrophyIcon className="w-5 h-5 shrink-0" aria-hidden />
                  {tr.savedBest}
                </p>
              ) : (
                <p className="flex items-center gap-2.5 text-white/75 font-semibold text-sm">
                  <CheckCircleIcon className="w-5 h-5 shrink-0 text-white/50" aria-hidden />
                  {tr.saved}
                </p>
              )
            )}
            {showBest && (
              <p className="text-white/50 text-sm">{tr.best(fmt(userProfile.highScore))}</p>
            )}
            {showLoginHint && (
              <p className="text-white/70 text-sm">
                {rewardTier.tier === 'legendary' ? tr.loginHintTicket : tr.loginHint}
              </p>
            )}
            {claimed && (
              <p className="game-over-pop flex items-center gap-2.5 text-[#f5ff00] font-bold text-sm sm:text-base">
                <TrophyIcon className="w-5 h-5 shrink-0" aria-hidden />
                {tr.savedBest}
              </p>
            )}
          </div>
        )}

        {/* Acciones — mismo par que SphereGameModal: primario amarillo + ghost */}
        <div
          className="flex items-center gap-3 flex-wrap mt-8 transition-all duration-500 ease-expo-out"
          style={{ ...reveal(showButtons), pointerEvents: showButtons ? 'auto' : 'none' }}
          inert={!showButtons}
        >
          {showLoginCta && (
            <button
              type="button"
              onClick={onLogin}
              onMouseEnter={hoverSfx}
              className={primaryBtn}
            >
              {tr.loginCta}
            </button>
          )}
          <button
            type="button"
            onClick={handlePlayAgain}
            onMouseEnter={hoverSfx}
            className={showLoginCta ? ghostBtn : primaryBtn}
          >
            {t('game.playAgain')}
          </button>
          <button
            type="button"
            onClick={handleExit}
            onMouseEnter={hoverSfx}
            className={ghostBtn}
          >
            {t('game.exit')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameOverModal
