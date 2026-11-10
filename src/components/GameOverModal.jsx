import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircleIcon, TrophyIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { useShopData } from '../lib/shopDataContext.jsx'
import { lastRunStats } from '../lib/gameSession.js'
import { TicketArt } from './GoldenTicketBadge.jsx'
import { PRIZE_RAYS, Sparkle } from './argusArt.jsx'

// ============= REWARD TIER SYSTEM (prepared for future discount codes) =============
// Threshold for the gold skin unlock (must match App.jsx GOLD_SKIN_THRESHOLD
// y GOLD_SKIN_SCORE en profile.php). Los tickets van aparte: Silver con 3,000 y
// Golden con 9,999, en public/api/game-tickets.php (llegan por `tickets`).
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

const ES = {
  dialogAria: 'Fin del juego',
  close: 'Cerrar',
  tier: (tier) => `Nivel ${TIER_LABEL_ES[tier.tier] || tier.label}`,
  // El título dice cómo te fue: el número ya dice cuánto.
  verdict: {
    none: 'Apenas calentando',
    bronze: 'Nada mal',
    silver: 'Bien jugado',
    gold: '¡Qué puntería!',
    diamond: '¡Imparable!',
    legendary: '¡Leyenda!',
  },
  unit: 'puntos',
  newRecord: '¡Nuevo récord!',
  stats: { captures: 'Esferas', correct: 'Aciertos', streak: 'Mejor racha' },
  goals: { silver: 'Silver', skin: 'Skin dorada', gold: 'Golden' },
  goalName: { silver: 'el Silver Ticket', skin: 'la skin dorada', gold: 'el Golden Ticket' },
  toNext: (n, name) => `Te faltan ${n} puntos para ${name}`,
  allGoals: 'Llegaste hasta el Golden Ticket',
  savedBest: 'Nuevo récord personal. Quedó guardado en tu perfil.',
  saved: 'Puntaje guardado en tu perfil.',
  best: (n) => `Tu mejor marca: ${n}`,
  loginHint: 'Tu puntaje está apartado. Inicia sesión para guardarlo.',
  loginHintTicket: (name) => `Hiciste puntos para el ${name}. Inicia sesión para reclamarlo antes de salir.`,
  loginCta: 'Iniciar sesión y reclamar',
  claiming: 'Reclamando…',
  ticketTitle: (name) => `Ganaste el ${name}`,
  ticketUpgraded: 'Tu Silver ahora es Golden',
  ticketBody: (pct) => `${pct} % de descuento en una compra de la tienda. Ya está en tu carrito.`,
  soldOutSilver: 'Se acabaron los Golden de este mes, así que te llevas el Silver.',
  noTicket: {
    holding: 'Ya tienes un ticket sin usar: úsalo en la tienda antes de ganar otro.',
    monthly_limit: (date) => `Ya ganaste tu ticket de este mes. Puedes ganar otro a partir del ${date}.`,
    gold_sold_out: 'Se acabaron los Golden de este mes. Tu Silver sigue en tu cuenta.',
    ip_limit: 'Desde esta conexión ya se ganaron los tickets de este mes.',
  },
}

const EN = {
  dialogAria: 'Game over',
  close: 'Close',
  tier: (tier) => `${tier.label} tier`,
  verdict: {
    none: 'Just warming up',
    bronze: 'Not bad',
    silver: 'Well played',
    gold: 'Sharpshooter!',
    diamond: 'Unstoppable!',
    legendary: 'Legend!',
  },
  unit: 'points',
  newRecord: 'New record!',
  stats: { captures: 'Orbs', correct: 'Hits', streak: 'Best streak' },
  goals: { silver: 'Silver', skin: 'Gold skin', gold: 'Golden' },
  goalName: { silver: 'the Silver Ticket', skin: 'the gold skin', gold: 'the Golden Ticket' },
  toNext: (n, name) => `${n} points to go for ${name}`,
  allGoals: 'You made it to the Golden Ticket',
  savedBest: 'New personal best. Saved to your profile.',
  saved: 'Score saved to your profile.',
  best: (n) => `Personal best: ${n}`,
  loginHint: 'Your score is being held. Log in to save it.',
  loginHintTicket: (name) => `You scored enough for the ${name}. Log in to claim it before you leave.`,
  loginCta: 'Log in and claim',
  claiming: 'Claiming…',
  ticketTitle: (name) => `${name} earned`,
  ticketUpgraded: 'Your Silver is now Golden',
  ticketBody: (pct) => `${pct}% off one order in the shop. It’s already in your cart.`,
  soldOutSilver: 'This month’s Golden tickets are gone, so you get the Silver.',
  noTicket: {
    holding: 'You already have an unused ticket: use it in the shop before winning another.',
    monthly_limit: (date) => `You already won this month’s ticket. You can win another from ${date}.`,
    gold_sold_out: 'This month’s Golden tickets are gone. Your Silver is still in your account.',
    ip_limit: 'This connection already won this month’s tickets.',
  },
}

const TICKET_NAME = { gold: 'Golden Ticket', silver: 'Silver Ticket' }

// "2026-11-01" → "1 de noviembre" / "November 1"
function fmtDay(iso, es) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, d || 1).toLocaleDateString(es ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long' })
}

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#f5ff00]'

/**
 * GameOverModal — pantalla final del juego de esferas, en el lenguaje de Argus
 * (§14): el puntaje en una banda amarilla con los rayos del premio girando detrás
 * (roja si quedó en negativo), un sello que cae encima, la partida en números y
 * lo que falta para el siguiente premio. Revela por fases (título → conteo →
 * resto) y guarda el score en el perfil si hay sesión.
 */
function GameOverModal({ t, open, finalScore = 0, onExit, onPlayAgain, onLogin, authenticated = false, userProfile = {} }) {
  const { lang } = useLanguage()
  // Puntajes de cada ticket (catálogo de la tienda = game-tickets.php).
  const { tickets } = useShopData()
  const [phase, setPhase] = useState('idle')
  const [displayScore, setDisplayScore] = useState(0)
  const [scoreSaved, setScoreSaved] = useState(false)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const animRef = useRef(null)
  const phaseTimerRef = useRef(null)
  const savingRef = useRef(false)
  const [claimed, setClaimed] = useState(false)
  // Lo que decidió el servidor con esta partida:
  // { awarded: silver|gold|null, upgraded, reason, pct, resets_at }.
  const [ticketResult, setTicketResult] = useState(null)
  // La partida en números: se lee al abrir, de las capturas que ya se cerraron.
  const stats = useMemo(() => (open ? lastRunStats() : null), [open])

  // El reclamo lo ejecuta useUserProfile, que sobrevive a una recarga de
  // Privy; si el modal sigue abierto, avisa por evento para confirmarlo.
  useEffect(() => {
    if (!open) return undefined
    const onClaimed = (e) => {
      setClaimed(true)
      setTicketResult(e?.detail?.ticket || null)
    }
    window.addEventListener('score-claimed', onClaimed)
    return () => window.removeEventListener('score-claimed', onClaimed)
  }, [open])

  const rewardTier = getRewardTier(finalScore)

  // Save score to server when game ends (if authenticated)
  useEffect(() => {
    if (!open || !authenticated || !userProfile?.saveScore || savingRef.current) return
    if (finalScore === 0) return // Don't save zero scores

    savingRef.current = true
    const tier = getRewardTier(finalScore)
    userProfile.saveScore(finalScore, tier.tier).then((result) => {
      if (result) {
        setScoreSaved(true)
        setIsNewHighScore(result.newHighScore || false)
        setTicketResult(result.ticket || null)
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
      setTicketResult(null)
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
    }, 700)

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
  const scorePrefix = finalScore > 0 ? '+' : ''
  const showTitle = phase !== 'idle'
  const showScore = phase === 'score' || phase === 'done'
  const done = phase === 'done'
  const verdict = isPositive ? tr.verdict[rewardTier.tier] : t('game.negativeMessage')

  const showSaved = authenticated && scoreSaved
  const showBest = authenticated && userProfile?.highScore > 0
  const showLoginHint = !authenticated && finalScore > 0 && !claimed
  // El ticket lo otorga el servidor, no el marcador: puede recortar el score o
  // negarlo (uno al mes, uno a la vez, 10 Golden al mes). Se muestra lo que
  // decidió, y si no hubo premio, por qué (H09).
  const ticketKnown = authenticated && (scoreSaved || claimed) && !!ticketResult
  const wonTier = ticketKnown ? ticketResult.awarded : null
  const showTicket = !!wonTier
  const noTicketReason = ticketKnown && !wonTier ? ticketResult.reason : null
  const noTicketText = noTicketReason === 'monthly_limit'
    ? tr.noTicket.monthly_limit(fmtDay(ticketResult.resets_at, es))
    : (noTicketReason ? tr.noTicket[noTicketReason] : null)
  // Invitado con puntos para un ticket: se le dice cuál está por reclamar.
  const silverScore = tickets?.silver?.score ?? 3000
  const goldScore = tickets?.gold?.score ?? 9999
  const guestTier = finalScore >= goldScore ? 'gold' : finalScore >= silverScore ? 'silver' : null
  const hasStatus = showSaved || showBest || showLoginHint || !!noTicketText || claimed

  // Las metas de la barra: los dos tickets y la skin dorada, de menor a mayor. La
  // barra se llena con el conteo, así que avanza junto con el número.
  const goals = [
    { key: 'silver', score: silverScore },
    { key: 'skin', score: GOLD_SKIN_THRESHOLD },
    { key: 'gold', score: goldScore },
  ].sort((a, b) => a.score - b.score)
  const goalTop = goals[goals.length - 1].score
  const fill = Math.max(0, Math.min(1, displayScore / goalTop))
  const nextGoal = goals.find((g) => g.score > finalScore)

  // Sello sobre la banda: el récord manda sobre el nivel.
  const sticker = !done ? null
    : isNewHighScore ? tr.newRecord
      : (isPositive && rewardTier.tier !== 'none' ? tr.tier(rewardTier) : null)

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
      {/* Pop plano (escala, sin glow) para el récord y los avisos que llegan después. */}
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

      <div className="argus-panel relative w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto modal-scroll p-5 sm:p-7 text-white">
        {/* Encabezado: cómo te fue y cerrar (el botón redondo del sitio, §4.2). */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <h1
            className="argus-display text-[2rem] sm:text-[2.5rem] pt-1 transition-all duration-500 ease-expo-out"
            style={reveal(showTitle, 12)}
          >
            {verdict}
          </h1>
          <button
            type="button"
            onClick={handleExit}
            className={`shrink-0 w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${FOCUS_RING}`}
            style={{ visibility: done ? 'visible' : 'hidden' }}
            aria-label={tr.close}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* El puntaje: banda de Argus con los rayos del premio y destellos. */}
        <div
          className={`argus-score ${isPositive ? '' : 'argus-score--neg'} transition-all duration-500 ease-expo-out`}
          style={reveal(showScore, 16)}
        >
          <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
            <path d={PRIZE_RAYS} fill="#0a0510" opacity={isPositive ? 0.07 : 0.09} />
          </svg>
          {isPositive && (
            <>
              <Sparkle style={{ left: '1rem', top: '0.9rem', width: 18 }} />
              <Sparkle style={{ left: '22%', bottom: '1rem', width: 14, animationDelay: '-1.1s' }} />
              <Sparkle style={{ right: '18%', bottom: '1.4rem', width: 20, animationDelay: '-0.6s' }} />
            </>
          )}
          {sticker && <span className="argus-sticker">{sticker}</span>}
          <p className={`argus-display argus-score__num whitespace-nowrap ${done ? 'is-landed' : ''}`}>
            {scorePrefix}{fmt(displayScore)}
          </p>
          <p className="argus-score__unit">{tr.unit}</p>
        </div>

        {/* La partida en números. */}
        {stats && stats.captures > 0 && (
          <dl
            className="argus-stats mt-6 transition-all duration-500 ease-expo-out"
            style={reveal(done, 14)}
          >
            <div>
              <dt>{tr.stats.captures}</dt>
              <dd>{fmt(stats.captures)}</dd>
            </div>
            <div>
              <dt>{tr.stats.correct}</dt>
              <dd>{fmt(stats.correct)}</dd>
            </div>
            <div>
              <dt>{tr.stats.streak}</dt>
              <dd>{fmt(stats.bestStreak)}</dd>
            </div>
          </dl>
        )}

        {/* Lo que falta para el siguiente premio. La barra corre con el conteo. */}
        <div className="mt-6 transition-all duration-500 ease-expo-out" style={reveal(showScore, 14)}>
          <p className="text-sm font-semibold text-white/80 mb-2.5">
            {nextGoal
              ? tr.toNext(fmt(nextGoal.score - Math.max(0, finalScore)), tr.goalName[nextGoal.key])
              : tr.allGoals}
          </p>
          <div
            className="argus-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goalTop}
            aria-valuenow={Math.max(0, Math.min(goalTop, finalScore))}
            aria-label={tr.goalName.gold}
          >
            <div className="argus-track__fill" style={{ width: `${fill * 100}%` }} />
            {goals.slice(0, -1).map((g) => (
              <span key={g.key} className="argus-track__mark" style={{ left: `${(g.score / goalTop) * 100}%` }} />
            ))}
          </div>
          <div className="argus-track__labels" aria-hidden>
            {goals.map((g) => (
              <span
                key={g.key}
                className={displayScore >= g.score ? 'is-reached' : ''}
                style={{ left: `${(g.score / goalTop) * 100}%` }}
              >
                {tr.goals[g.key]}
              </span>
            ))}
          </div>
        </div>

        {/* El premio que dio el servidor, en la banda del trato de Argus. */}
        {done && showTicket && (
          <div className="argus-premio game-over-pop" style={{ margin: '1.5rem 0 0' }}>
            <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
              <path d={PRIZE_RAYS} fill="#0a0510" opacity="0.07" />
            </svg>
            <Sparkle style={{ right: '1rem', top: '0.75rem', width: 20, animationDelay: '-0.7s' }} />
            <TicketArt tier={wonTier} pct={ticketResult.pct} className="golden-ticket--idle argus-premio__boleto" />
            <div className="argus-premio__texto">
              <p className="argus-display argus-premio__titulo">
                {ticketResult.upgraded ? tr.ticketUpgraded : tr.ticketTitle(TICKET_NAME[wonTier])}
              </p>
              <p className="argus-premio__dato">{tr.ticketBody(ticketResult.pct)}</p>
              {ticketResult.reason === 'gold_sold_out' && (
                <p className="argus-premio__quedan">{tr.soldOutSilver}</p>
              )}
            </div>
          </div>
        )}

        {done && hasStatus && (
          <div className="argus-beat mt-6 pt-5 border-t-2 border-white/10 flex flex-col gap-3">
            {noTicketText && (
              <p className="flex items-start gap-2.5 text-white/70 text-sm">
                <InformationCircleIcon className="w-5 h-5 shrink-0 text-white/45" aria-hidden />
                {noTicketText}
              </p>
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
                {guestTier ? tr.loginHintTicket(TICKET_NAME[guestTier]) : tr.loginHint}
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

        {/* Acciones: ghost primero y el primario amarillo al final (§4.6). */}
        <div
          className="flex items-center justify-end gap-3 flex-wrap mt-7 transition-all duration-500 ease-expo-out"
          style={{ ...reveal(done), pointerEvents: done ? 'auto' : 'none' }}
          inert={!done}
        >
          <button
            type="button"
            onClick={handleExit}
            onMouseEnter={hoverSfx}
            className={ghostBtn}
          >
            {t('game.exit')}
          </button>
          <button
            type="button"
            onClick={handlePlayAgain}
            onMouseEnter={hoverSfx}
            className={showLoginCta ? ghostBtn : primaryBtn}
          >
            {t('game.playAgain')}
          </button>
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
        </div>
      </div>
    </div>
  )
}

export default GameOverModal
