import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRightOnRectangleIcon, ArrowTopRightOnSquareIcon, UserCircleIcon,
  ShoppingBagIcon, TicketIcon, CheckCircleIcon, XMarkIcon, ArrowDownTrayIcon,
  CheckIcon, ClockIcon, PauseCircleIcon, LockClosedIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'
import { ACHIEVEMENTS, localizeAchievement, PIXEL_SKIN_SCORE_THRESHOLD } from '../../lib/achievementsCatalog.js'
import { useSlimeSlugs } from '../../lib/slimeSlugs.js'
import { useHoloSections, HOLO_SECTIONS } from '../../hooks/useSectionVisitTracking.js'
import { fetchMyOrders, fetchMyDownloads, requestDownloadLink } from '../../lib/shopApi.js'
import { useAuth } from '../../auth/authContext.js'
import { GOLD_SKIN_THRESHOLD } from '../GameOverModal.jsx'
import { useShopData } from '../../lib/shopDataContext.jsx'
import HelpLink from '../help/HelpLink.jsx'
import SoldOutTape from '../shop/SoldOutTape.jsx'

const API_BASE = `${import.meta.env.BASE_URL}api/profile.php`

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

// Modal "Mi Cuenta" — tabs Logros / Ranking / Pedidos (+ Descargas si compró algo digital).
// Misma anatomía que la card de la tienda (DESIGN.md §14.6): arriba el nombre
// y una línea de detalle, en medio el contenido, y abajo una barra fija con el
// valor a la izquierda (tu mejor puntaje, como el precio) y una sola acción a
// la derecha. Superficie plana con borde de 2px, cero glow, un solo nivel de
// contenedor (las secciones se separan con divisores, no con cajas).
// Consume auth/profile/achievements vía props (los hooks viven en App.jsx)
// para no duplicar instancias ni fetches.
export default function AccountModal({
  open = false,
  // Pestaña con la que abre ('downloads' desde el correo, el pedido o el carrito).
  initialTab = null,
  onClose,
  userProfile,
  achievements,
  unlockedAt = {},
  onLogout,
  lang = 'en',
  t,
}) {
  const [tab, setTab] = useState('achievements')
  const uid = useId()
  const panelRef = useRef(null)
  const isEs = lang === 'es'
  const profile = userProfile?.profile || null
  const privyId = userProfile?.privyId || null
  const { getAccessToken } = useAuth()
  // Lo digital que compró la cuenta ({items, dailyLimit}; null mientras carga).
  // La pestaña Descargas solo aparece si hay algo, o si se pidió abrirla:
  // casi nadie compra digital y una pestaña siempre vacía estorba.
  const [downloads, setDownloads] = useState(null)

  useEffect(() => {
    if (!open || !privyId) { setDownloads(null); return }
    let cancelled = false
    getAccessToken()
      .then(token => {
        if (!token) throw new Error('sin token')
        return fetchMyDownloads(token)
      })
      .then(res => { if (!cancelled) setDownloads(res) })
      .catch(() => { if (!cancelled) setDownloads({ items: [], dailyLimit: 5 }) })
    return () => { cancelled = true }
  }, [open, privyId, getAccessToken])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setTab(initialTab || 'achievements')
    panelRef.current?.focus({ preventScroll: true })
  }, [open, initialTab])

  if (!open) return null

  // Sin íconos: los chips de filtro de la tienda tampoco llevan (H04). Logros
  // va primero: es lo que uno abre la cuenta a ver. Ya no hay "Perfil": lo
  // que mostraba (boleto, skin dorada, puntaje) vive en Logros y en la barra.
  const tabs = [
    { id: 'achievements', label: isEs ? 'Logros' : 'Achievements' },
    { id: 'score', label: 'Ranking' },
    { id: 'orders', label: isEs ? 'Pedidos' : 'Orders' },
    ...(downloads?.items?.length || initialTab === 'downloads' ? [{ id: 'downloads', label: isEs ? 'Descargas' : 'Downloads' }] : []),
  ]
  const tabId = (id) => `${uid}-tab-${id}`
  const panelId = `${uid}-panel`
  const titleId = `${uid}-title`

  const selectTab = (id) => { try { playSfx('click', { volume: 0.8 }) } catch { }; setTab(id) }

  // Patrón ARIA de tabs: flechas / Home / End mueven selección y foco.
  const onTabsKeyDown = (e) => {
    const i = tabs.findIndex(x => x.id === tab)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    selectTab(tabs[next].id)
    document.getElementById(tabId(tabs[next].id))?.focus()
  }

  const close = () => { try { playSfx('click', { volume: 0.8 }) } catch { }; onClose?.() }
  const logout = () => { try { playSfx('click', { volume: 1.0 }) } catch { }; onLogout?.() }

  // El nombre es el título del modal; si no hay nombre, el correo ocupa su
  // lugar y no se repite debajo.
  const title = profile?.display_name || profile?.email || (isEs ? 'Usuario' : 'User')
  const subtitle = profile?.display_name && profile?.email ? profile.email : null
  const avatar = profile?.avatar_url || null
  const highScore = userProfile?.highScore ?? 0

  return (
    <div
      className="fixed inset-0 z-[999998] flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8 shop-inspect-enter"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="site-modal text-white outline-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className={`absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all ${FOCUS_RING}`}
          aria-label={t ? t('common.close') : (isEs ? 'Cerrar' : 'Close')}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Nombre + una línea de detalle, como la card y el detalle de
            producto (Outfit 700, no display: el display es para títulos de
            módulo, no para el nombre de una cosa). */}
        <header className="flex flex-col gap-5 px-5 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10">
          <div className="flex items-center gap-4 pr-14">
            {avatar
              ? <img src={avatar} alt="" className="h-14 w-14 flex-shrink-0 rounded-full object-cover" />
              : (
                <div className="h-14 w-14 flex-shrink-0 rounded-full bg-[#150a1d] grid place-items-center" aria-hidden>
                  <UserCircleIcon className="w-8 h-8 text-white/35" />
                </div>
              )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="shop-detail__title !text-[clamp(1.5rem,2.2vw,2rem)]">{title}</h2>
              {subtitle && <p className="shop-meta shop-meta--lg mt-1"><span className="truncate">{subtitle}</span></p>}
            </div>
          </div>

          {/* En mobile la fila scrollea horizontal si no caben.
              El px-1 de sm deja aire para que el scroller no corte el anillo de foco. */}
          <div
            role="tablist"
            aria-label={isEs ? 'Mi cuenta' : 'My account'}
            onKeyDown={onTabsKeyDown}
            className="flex gap-2 overflow-x-auto no-native-scrollbar -mx-5 px-5 sm:-mx-1 sm:px-1 py-1"
          >
            {tabs.map(({ id, label }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  id={tabId(id)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={panelId}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(id)}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
                  className={`shop-chip flex-shrink-0 inline-flex items-center min-h-[44px] px-4 sm:px-5 text-[11px] sm:text-xs whitespace-nowrap ${FOCUS_RING}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </header>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(tab)}
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-6 sm:py-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:-outline-offset-2"
        >
          {tab === 'score' && (
            <ScoreTab privyId={privyId} displayName={profile?.display_name || profile?.email} isEs={isEs} />
          )}
          {tab === 'achievements' && (
            <AchievementsTab achievements={achievements} unlockedAt={unlockedAt} userProfile={userProfile} lang={lang} isEs={isEs} t={t} />
          )}
          {tab === 'orders' && (
            <OrdersTab privyId={privyId} isEs={isEs} />
          )}
          {tab === 'downloads' && (
            downloads === null
              ? <Spinner isEs={isEs} />
              : <DownloadsTab items={downloads.items} dailyLimit={downloads.dailyLimit} isEs={isEs} />
          )}
        </div>

        {/* Barra fija, como la de compra del detalle: el valor a la izquierda
            (tu mejor puntaje, con la anatomía del precio: número grande y la
            unidad chica aparte) y la única acción de la cuenta a la derecha.
            Es la misma en las tres pestañas: el puntaje ya no se repite
            arriba del ranking. */}
        <div className="shrink-0 border-t-2 border-white/10 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="shop-price">
              {formatNumber(highScore, isEs)}
              <span className="shop-price__currency">PTS</span>
            </p>
            <p className="mt-1 text-sm text-white/50">{isEs ? 'Tu mejor puntaje' : 'Your best score'}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className={`shop-btn shop-btn--primary shrink-0 min-h-[44px] px-5 text-xs ${FOCUS_RING}`}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" aria-hidden />
            {isEs ? 'Cerrar sesión' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ranking ─────────────────────────────────────────────────────────
function ScoreTab({ privyId, displayName, isEs }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [scores, setScores] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const lb = fetch(`${API_BASE}?action=leaderboard`).then(r => r.json()).catch(() => null)
    const sc = privyId
      ? fetch(`${API_BASE}?action=scores&pid=${encodeURIComponent(privyId)}`).then(r => r.json()).catch(() => null)
      : Promise.resolve(null)
    Promise.all([lb, sc]).then(([lbRes, scRes]) => {
      if (cancelled) return
      // null = no se pudo cargar; [] = de verdad no hay puntajes. Antes los
      // dos decían "Sin puntajes todavía" (H09).
      setLeaderboard(lbRes?.ok ? (lbRes.leaderboard || []) : null)
      setScores(scRes?.ok ? (scRes.scores || []) : [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [privyId, attempt])

  if (loading) return <Spinner isEs={isEs} />
  if (!leaderboard) {
    return (
      <LoadError
        text={isEs ? 'No pudimos cargar el ranking.' : "We couldn't load the ranking."}
        onRetry={() => setAttempt((a) => a + 1)}
        isEs={isEs}
      />
    )
  }

  // Oro / plata / bronce para el podio; el resto en tinta tenue.
  const rankTone = (i) => (i === 0 ? 'text-[#facc15]' : i === 1 ? 'text-white/80' : i === 2 ? 'text-amber-600' : 'text-white/40')

  // Con el modal estándar hay ancho para las dos listas lado a lado.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
      <section aria-labelledby="account-ranking">
        <h3 id="account-ranking" className="text-sm font-bold text-white mb-1">{isEs ? 'Ranking global' : 'Global ranking'}</h3>
        {leaderboard.length === 0 ? (
          <Empty text={isEs ? 'Sin puntajes todavía. ¡Sé el primero!' : 'No scores yet. Be the first!'} />
        ) : (
          <ol className="divide-y divide-white/10 border-y border-white/10">
            {leaderboard.map((row, i) => {
              const isMe = displayName && row.name === displayName
              return (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className={`w-7 text-center text-sm font-bold tabular-nums ${rankTone(i)}`}>{i + 1}</span>
                  {row.avatar_url
                    ? <img src={row.avatar_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                    : <div className="h-8 w-8 flex-shrink-0 rounded-full bg-[#150a1d]" aria-hidden />}
                  <span className={`flex-1 min-w-0 flex items-center gap-2 text-sm ${isMe ? 'font-bold text-white' : 'text-white/80'}`}>
                    <span className="truncate">{row.name}</span>
                    {!!row.golden_ticket && (
                      <>
                        <TicketIcon className={`w-4 h-4 flex-shrink-0 ${row.ticket_tier === 'silver' ? 'text-[#cbd5e1]' : 'text-[#facc15]'}`} />
                        <span className="sr-only">
                          {isEs ? 'Tiene un ' : 'Has a '}{row.ticket_tier === 'silver' ? 'Silver Ticket' : 'Golden Ticket'}
                        </span>
                      </>
                    )}
                    {/* Neutro: un pill magenta relleno se lee como botón (H04). */}
                    {isMe && (
                      <span className="flex-shrink-0 rounded-full bg-white/12 text-white text-[11px] font-bold leading-none px-2 py-1">
                        {isEs ? 'Tú' : 'You'}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-white">{formatNumber(row.high_score, isEs)}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {scores && scores.length > 0 && (
        <section aria-labelledby="account-recent">
          <h3 id="account-recent" className="text-sm font-bold text-white mb-1">{isEs ? 'Tus partidas recientes' : 'Your recent games'}</h3>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {scores.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-white/55">{formatDate(s.played_at, isEs)}</span>
                {/* Un puntaje negativo es la penalización del easter egg de
                    las trampas (arrastrar esferas con el mouse): se dice qué
                    fue, no solo el número (H02). */}
                {Number(s.score) < 0
                  ? (
                    <span className="tabular-nums">
                      <span className="text-white/45 mr-2">{isEs ? 'Penalización por trampa' : 'Cheating penalty'}</span>
                      <span className="font-bold text-red-400">{formatNumber(s.score, isEs)}</span>
                    </span>
                  )
                  : <span className="font-bold tabular-nums">{formatNumber(s.score, isEs)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Logros ──────────────────────────────────────────────────────────
// Una sola pestaña para todo lo que se gana. Antes Perfil y Logros repetían
// el boleto y la skin dorada. Dos grupos: lo que ya ganaste (con su fecha) y
// lo que falta, cada uno con la pista de cómo se gana y su avance cuando se
// puede medir (H01, H06, H10). El boleto dorado además dice si sigue activo
// o ya se usó: es el único premio que se gasta.
function AchievementsTab({ achievements, unlockedAt, userProfile, lang, isEs, t }) {
  const { tickets } = useShopData()
  const slime = useSlimeSlugs()
  const holo = useHoloSections()
  const highScore = userProfile?.highScore ?? 0
  const ticketBurned = !!userProfile?.profile?.ticket_burned
  // Silver (10 %) o Golden (35 %): game-tickets.php.
  const ticketTier = userProfile?.profile?.ticket_tier || 'gold'
  const ticketPct = userProfile?.profile?.ticket_pct || 35
  const ticketName = ticketTier === 'silver' ? 'Silver Ticket' : 'Golden Ticket'

  const items = useMemo(() => ACHIEVEMENTS.map(a => {
    const loc = localizeAchievement(a, lang)
    let unlocked = false
    let date = null
    if (a.source === 'gold_skin') unlocked = !!userProfile?.hasGoldSkin
    else if (a.source === 'golden_ticket') unlocked = !!userProfile?.hasGoldenTicket
    else { unlocked = achievements?.has?.(a.key) || false; date = unlockedAt?.[a.key] || null }
    return { ...loc, unlocked, date }
  }), [achievements, unlockedAt, userProfile, lang])

  // Avance medible de lo que falta: puntaje del juego o babosas encontradas.
  // El holograma lleva sus chips de secciones.
  const progressFor = (key) => {
    if (key === 'gold_skin') return { value: highScore, goal: GOLD_SKIN_THRESHOLD }
    // El primer ticket es el Silver (game-tickets.php).
    if (key === 'golden_ticket') return { value: highScore, goal: tickets?.silver?.score ?? 3000 }
    if (key === 'skin_pixel') return { value: highScore, goal: PIXEL_SKIN_SCORE_THRESHOLD }
    if (key === 'skin_slime') return { value: slime.count, goal: slime.total }
    return null
  }

  const won = items.filter(i => i.unlocked)
  const pending = items.filter(i => !i.unlocked)
  const summary = isEs ? `${won.length} de ${items.length} logros` : `${won.length} of ${items.length} achievements`

  return (
    <div className="flex flex-col gap-8">
      <Progress value={won.length} goal={items.length} label={summary} text={summary} />

      {won.length > 0 && (
        <section aria-labelledby="account-won">
          <h3 id="account-won" className="text-sm font-bold text-white mb-1">{isEs ? 'Ganados' : 'Earned'}</h3>
          <ul className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12 border-b border-white/10">
            {won.map((a) => (
              <AchievementRow
                key={a.key}
                a={a}
                aside={a.date && <p className="text-xs text-white/45 tabular-nums whitespace-nowrap mt-1">{formatDate(a.date, isEs)}</p>}
              >
                <p className="text-sm text-white/60 mt-1 leading-relaxed">
                  {a.key === 'golden_ticket'
                    ? (ticketBurned
                      ? (isEs ? 'Canjeado: ya lo usaste en una compra.' : 'Redeemed: you already used it on an order.')
                      : <><b className={ticketTier === 'silver' ? 'text-[#cbd5e1]' : 'text-[#facc15]'}>{isEs ? `${ticketName} activo` : `${ticketName} active`}</b>{isEs ? `: ${ticketPct} % de descuento, se aplica solo en tu carrito.` : `: ${ticketPct}% off, auto-applied to your cart.`}</>)
                    : a.description}
                </p>
              </AchievementRow>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="account-pending">
          <h3 id="account-pending" className="text-sm font-bold text-white mb-1">{isEs ? 'Por ganar' : 'Still to earn'}</h3>
          <ul className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12 border-b border-white/10">
            {pending.map((a) => {
              const progress = progressFor(a.key)
              return (
                <AchievementRow key={a.key} a={a}>
                  <p className="text-sm text-white/60 mt-1 leading-relaxed">{a.hint}</p>
                  {progress && (
                    <Progress
                      small
                      value={progress.value}
                      goal={progress.goal}
                      label={a.title}
                      text={`${formatNumber(Math.min(progress.value, progress.goal), isEs)} / ${formatNumber(progress.goal, isEs)}`}
                    />
                  )}
                  {/* Holograma: las 5 secciones (check = ya visitada >=15s). */}
                  {a.key === 'skin_hologram' && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {HOLO_SECTIONS.map((sid) => {
                        const done = holo.has(sid)
                        return (
                          <span
                            key={sid}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold leading-none ${done
                              ? 'bg-emerald-400/15 text-emerald-200'
                              : 'bg-white/[0.06] text-white/45'}`}
                          >
                            {done
                              ? <CheckCircleIcon className="w-3 h-3" aria-hidden />
                              : <span className="w-3 h-3 rounded-full border border-current opacity-60" aria-hidden />}
                            {t ? t(`nav.${sid}`) : sid}
                          </span>
                        )
                      })}
                      <span className="text-[11px] text-white/45 tabular-nums ml-0.5">{holo.count}/{holo.total}</span>
                    </div>
                  )}
                </AchievementRow>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

// Un logro con la anatomía de la card: ícono, nombre y una línea de detalle;
// a la derecha lo que importa de un vistazo (la fecha, si ya lo ganaste).
function AchievementRow({ a, aside = null, children }) {
  return (
    <li className="flex gap-4 py-4 border-t border-white/10">
      <div className={`w-7 text-center text-2xl leading-none ${a.unlocked ? '' : 'grayscale opacity-40'}`} aria-hidden>{a.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <p className={`text-base font-bold ${a.unlocked ? 'text-white' : 'text-white/75'}`}>{a.title}</p>
          {aside}
        </div>
        {children}
      </div>
    </li>
  )
}

// Barra de avance plana (sin color de acento: el magenta es de la acción).
function Progress({ value, goal, label, text, small = false }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className={`flex items-center gap-3 ${small ? 'mt-2.5' : ''}`}>
      {!small && <p className="text-sm text-white/70 whitespace-nowrap tabular-nums">{text}</p>}
      <div
        className={`flex-1 ${small ? 'h-1.5' : 'h-2'} rounded-full bg-white/10 overflow-hidden`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(value, goal)}
      >
        <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
      </div>
      {small && <span className="text-xs text-white/55 tabular-nums whitespace-nowrap">{text}</span>}
    </div>
  )
}

// ── Pedidos ─────────────────────────────────────────────────────────
// Cada pedido con la anatomía de la card: número + una línea de detalle
// (fecha · estado, el estado con su punto de color como la categoría de una
// pieza), lo que llevaba, y abajo el total a la izquierda con la única acción
// a la derecha: rastrear el envío, si ya tiene guía. En contorno: la acción
// de color de la pantalla es "Cerrar sesión" (H08).
function OrdersTab({ privyId, isEs }) {
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { getAccessToken } = useAuth()

  useEffect(() => {
    if (!privyId) { setLoading(false); setOrders([]); return }
    let cancelled = false
    setLoading(true)
    setFailed(false)
    // El backend identifica la cuenta por el token de Privy, no por el privy_id.
    getAccessToken()
      .then(token => {
        if (!token) throw new Error('sin token')
        return fetchMyOrders(token)
      })
      .then(list => {
        if (cancelled) return
        setOrders(list)
        setLoading(false)
      })
      // Antes un fallo caía en "Aún no tienes pedidos": falso y alarmante
      // para quien sí compró (H09).
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [privyId, getAccessToken, attempt])

  if (loading) return <Spinner isEs={isEs} />
  if (failed) {
    return (
      <LoadError
        text={isEs ? 'No pudimos cargar tus pedidos.' : "We couldn't load your orders."}
        onRetry={() => setAttempt((a) => a + 1)}
        isEs={isEs}
      />
    )
  }
  // Contorno y no color: "Cerrar sesión" ya es la acción de color de la
  // pantalla, y dos compiten (H08).
  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <ShoppingBagIcon className="w-14 h-14 text-white/15 mb-4" aria-hidden />
        <p className="text-base font-semibold text-white/80">{isEs ? 'Aún no tienes pedidos.' : "You don't have any orders yet."}</p>
        <p className="text-sm text-white/55 mt-2">{isEs ? 'Lo que compres en la tienda aparece aquí, con su envío.' : 'What you buy in the store shows up here, with its shipping.'}</p>
        <button
          type="button"
          className={`shop-btn shop-btn--ghost min-h-[44px] px-5 text-xs mt-6 ${FOCUS_RING}`}
          onClick={() => { try { window.dispatchEvent(new CustomEvent('shop-cart-open-request')) } catch { } }}
        >
          {isEs ? 'Ir a la tienda' : 'Go to the store'}
        </button>
      </div>
    )
  }

  return (
    <>
    <ul className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12 border-b-2 border-white/10">
      {orders.map((o) => {
        const tracking = o.tracking_number
          ? `${o.carrier ? `${o.carrier} · ` : ''}${o.tracking_number}`
          : null
        return (
          <li key={o.number} className="py-5 border-t-2 border-white/10">
            <p className="text-base font-bold text-white">{isEs ? `Pedido ${o.number}` : `Order ${o.number}`}</p>
            <p className="shop-meta mt-1">
              <span>{formatDate(o.created_at, isEs)}</span>
              <span aria-hidden className="text-white/30">·</span>
              <OrderStatus status={o.status} isEs={isEs} />
            </p>

            {Array.isArray(o.items) && o.items.length > 0 && (
              <ul className="text-sm text-white/70 mt-3 space-y-1">
                {o.items.map((it, j) => (
                  <li key={j} className="flex justify-between gap-3">
                    <span className="truncate">{it.title}{it.options ? ` · ${it.options}` : ''}</span>
                    <span className="text-white/45 tabular-nums">×{it.qty}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                {o.total != null && (
                  <p className="shop-price !text-[1.375rem]">
                    {formatMoney(o.total, isEs)}
                    {o.currency && <span className="shop-price__currency">{o.currency}</span>}
                  </p>
                )}
                {tracking && !o.tracking_url && (
                  <p className="mt-1 text-sm text-white/55">{isEs ? 'Guía' : 'Tracking'}: {tracking}</p>
                )}
              </div>
              {tracking && o.tracking_url && (
                <a
                  href={o.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shop-btn shop-btn--ghost shrink-0 min-h-[44px] px-5 text-xs ${FOCUS_RING}`}
                  aria-label={isEs ? `Rastrear envío (${tracking})` : `Track shipment (${tracking})`}
                >
                  {isEs ? 'Rastrear envío' : 'Track shipment'}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden />
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
    {/* Donde surge la duda de un pedido (H10). */}
    <p className="mt-6 text-sm text-white/55">
      {isEs ? '¿Dudas con un pedido? ' : 'Questions about an order? '}
      <HelpLink lang={isEs ? 'es' : 'en'} />
    </p>
    </>
  )
}

// ── Descargas ───────────────────────────────────────────────────────
// Lo digital que compraste con esta cuenta: el único lugar donde se baja
// (desde 2026-10-25). Cada clic pide un enlace que sirve una sola vez y dura 5
// minutos, y el archivo sale con los datos de la compra.
//
// Cada compra es una card con la anatomía de la tienda (DESIGN.md §14.6, por
// pedido de Oscar): nombre + línea de detalle arriba, la foto completa en el
// marco cuadrado, los archivos como renglones y abajo una sola acción de color
// a la derecha: Descargar, o Descargar todo si son varios.
// Con las heurísticas (guía Cimientos de UX):
// - Cada archivo dice qué es: tipo y peso, con su etiqueta PDF / ZIP (H06, H02).
// - El botón muestra que trabaja y confirma que la descarga empezó, como el
//   "Agregado ✓" de la card de la tienda (H01, H04).
// - El tope diario se avisa antes de llegar ("Te quedan 2 hoy") y, al llegar,
//   la acción dice "Mañana" en vez de dejar fallar (H05). Una compra en pausa
//   lleva la cinta sobre la foto, como "Agotado", y dice a quién escribir (H09).
// - Varios archivos se bajan de un jalón con Descargar todo (H07); cada
//   renglón conserva su botón para bajar solo uno.
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB']
function formatFileSize(bytes, isEs) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return ''
  let n = Number(bytes)
  let u = 0
  while (n >= 1024 && u < FILE_SIZE_UNITS.length - 1) { n /= 1024; u++ }
  const digits = u === 0 || n >= 10 ? 0 : 1
  return `${n.toLocaleString(isEs ? 'es-MX' : 'en-US', { maximumFractionDigits: digits })} ${FILE_SIZE_UNITS[u]}`
}

// Descarga en un iframe oculto: varias seguidas no sacan de la página (el
// archivo sale como adjunto). iOS no baja adjuntos desde iframes, así que ahí
// "Descargar todo" no se ofrece y cada archivo va por su botón.
const IS_IOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
function downloadInFrame(url) {
  const frame = document.createElement('iframe')
  frame.style.display = 'none'
  frame.src = url
  document.body.appendChild(frame)
  setTimeout(() => frame.remove(), 60000)
}
const STARTED_MS = 6000 // cuánto se queda el "Tu descarga empezó"

function DownloadsTab({ items, dailyLimit, isEs }) {
  const { getAccessToken } = useAuth()
  // Lo que queda hoy de cada archivo; baja al momento con cada descarga.
  const [left, setLeft] = useState(() => Object.fromEntries(items.flatMap((it) => it.files.map((f) => [f.id, f.left_today ?? dailyLimit]))))
  const [busy, setBusy] = useState(null) // id de archivo, o `all:<key>`
  const [started, setStarted] = useState(null) // { key, fileId|null }
  const [failed, setFailed] = useState(null) // { key, fileId, code }
  const startedTimer = useRef(null)
  useEffect(() => () => clearTimeout(startedTimer.current), [])

  const fetchLink = async (fileId) => {
    const token = await getAccessToken()
    if (!token) throw new Error('sin token')
    return requestDownloadLink(token, fileId)
  }

  const markStarted = (key, fileId) => {
    setStarted({ key, fileId })
    clearTimeout(startedTimer.current)
    startedTimer.current = setTimeout(() => setStarted(null), STARTED_MS)
  }

  const handleError = (key, fileId, err) => {
    if (err?.code === 'download_limit') setLeft((l) => ({ ...l, [fileId]: 0 }))
    else setFailed({ key, fileId, code: err?.code || null })
  }

  const downloadOne = async (it, file) => {
    if (busy !== null) return
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setBusy(file.id)
    setFailed(null)
    setStarted(null)
    try {
      const url = await fetchLink(file.id)
      // Uno solo: navegación directa (el adjunto no saca de la página y
      // también funciona en iOS).
      window.location.assign(url)
      setLeft((l) => ({ ...l, [file.id]: Math.max(0, (l[file.id] ?? dailyLimit) - 1) }))
      markStarted(it.key, file.id)
    } catch (err) {
      handleError(it.key, file.id, err)
    } finally {
      setBusy(null)
    }
  }

  const downloadAll = async (it) => {
    if (busy !== null) return
    try { playSfx('click', { volume: 0.8 }) } catch { }
    setBusy(`all:${it.key}`)
    setFailed(null)
    setStarted(null)
    let any = false
    for (const file of it.files) {
      if ((left[file.id] ?? dailyLimit) <= 0) continue
      try {
        downloadInFrame(await fetchLink(file.id))
        setLeft((l) => ({ ...l, [file.id]: Math.max(0, (l[file.id] ?? dailyLimit) - 1) }))
        any = true
        // Un respiro entre archivos para que el navegador no los junte.
        await new Promise((r) => setTimeout(r, 900))
      } catch (err) {
        handleError(it.key, file.id, err)
      }
    }
    if (any) markStarted(it.key, null)
    setBusy(null)
  }

  // Llegó por el correo o el pedido pero esta cuenta no compró nada digital:
  // lo más probable es que haya entrado con otra cuenta (H10: el estado vacío
  // dice qué hacer).
  if (!items.length) {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <ArrowDownTrayIcon className="w-14 h-14 text-white/15 mb-4" aria-hidden />
        <p className="text-base font-semibold text-white/80">{isEs ? 'Esta cuenta no tiene descargas.' : "This account doesn't have any downloads."}</p>
        <p className="text-sm text-white/55 mt-2 max-w-[40ch]">
          {isEs
            ? 'Los archivos solo aparecen en la cuenta con la que se compraron. Si compraste con otra, cierra sesión y entra con esa.'
            : 'Files only show up in the account they were bought with. If you used another one, log out and sign in with it.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {items.map((it) => (
          <li key={it.key} className="flex min-w-0">
            <DownloadCard
              item={it}
              left={left}
              dailyLimit={dailyLimit}
              busy={busy}
              started={started?.key === it.key ? started : null}
              failed={failed?.key === it.key ? failed : null}
              onDownloadOne={(f) => downloadOne(it, f)}
              onDownloadAll={() => downloadAll(it)}
              isEs={isEs}
            />
          </li>
        ))}
      </ul>

      {/* La ayuda justo donde surge la duda (H10), corta. */}
      <div className="mt-8 flex items-start gap-2.5 text-sm text-white/55 leading-relaxed max-w-3xl">
        <LockClosedIcon className="w-4 h-4 shrink-0 mt-0.5 text-white/35" aria-hidden />
        <p>
          {isEs
            ? `Cada descarga usa un enlace de un solo uso y el archivo lleva tus datos de compra. Puedes bajar cada archivo hasta ${dailyLimit} veces al día.`
            : `Each download uses a single-use link, and the file carries your purchase details. You can download each file up to ${dailyLimit} times a day.`}{' '}
          <HelpLink lang={isEs ? 'es' : 'en'} section="digital">
            {isEs ? '¿Problemas con una descarga?' : 'Trouble with a download?'}
          </HelpLink>
        </p>
      </div>
    </>
  )
}

function DownloadCard({ item: it, left, dailyLimit, busy, started, failed, onDownloadOne, onDownloadAll, isEs }) {
  const files = it.files
  const multi = files.length > 1
  const remainingOf = (f) => left[f.id] ?? dailyLimit
  const available = files.filter((f) => remainingOf(f) > 0)
  const allBusy = busy === `all:${it.key}`
  const singleBusy = !multi && busy === files[0].id
  const working = allBusy || singleBusy
  const done = !!started && (started.fileId === null || !multi)

  // La acción de la card: en pausa o sin descargas hoy, dice por qué en vez
  // de un botón apagado que parece roto (H05).
  let action = null
  if (it.paused) {
    action = (
      <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        <PauseCircleIcon className="w-4 h-4" aria-hidden />
        {isEs ? 'En pausa' : 'Paused'}
      </span>
    )
  } else if (!available.length) {
    action = (
      <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        <ClockIcon className="w-4 h-4" aria-hidden />
        {isEs ? 'Mañana' : 'Tomorrow'}
      </span>
    )
  } else if (!multi || !IS_IOS) {
    const label = working
      ? (isEs ? 'Preparando…' : 'Preparing…')
      : done
        ? (isEs ? 'Descargando' : 'Downloading')
        : multi ? (isEs ? 'Descargar todo' : 'Download all') : (isEs ? 'Descargar' : 'Download')
    action = (
      <button
        type="button"
        onClick={() => (multi ? onDownloadAll() : onDownloadOne(files[0]))}
        disabled={busy !== null}
        className={`shop-btn shop-btn--primary shop-card__cta w-full ${FOCUS_RING}`}
        aria-label={multi
          ? (isEs ? `Descargar todos los archivos de ${it.title}` : `Download all files of ${it.title}`)
          : (isEs ? `Descargar ${files[0].name}` : `Download ${files[0].name}`)}
      >
        {working
          ? <span className="w-4 h-4 rounded-full border-2 border-black/25 border-t-black animate-spin" aria-hidden />
          : done ? <CheckIcon className="w-4 h-4 -ml-0.5" aria-hidden /> : <ArrowDownTrayIcon className="w-4 h-4 -ml-0.5" aria-hidden />}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <article className="shop-card shop-card--static flex flex-col w-full h-full p-4 sm:p-5">
      <header className="shop-card__head">
        <h3 className="shop-card__title">{it.title}</h3>
        <p className="shop-meta mt-1.5">
          <span className="truncate">{isEs ? `Pedido ${it.order_number}` : `Order ${it.order_number}`}</span>
          <span aria-hidden className="text-white/30">·</span>
          <span>{formatDate(it.bought_at, isEs)}</span>
        </p>
      </header>

      {/* Marco cuadrado con paspartú, como la card de la tienda (§14.6, §14.7). */}
      <div className="shop-card__frame">
        {it.image
          ? <img src={it.image} alt="" className="absolute inset-0 w-full h-full object-contain z-[1]" />
          : <div className="absolute inset-0 grid place-items-center" aria-hidden><ArrowDownTrayIcon className="w-12 h-12 text-white/15" /></div>}
        {it.paused && <SoldOutTape label={isEs ? 'En pausa' : 'Paused'} />}
      </div>

      {/* Los archivos: qué es cada uno y cuánto pesa (H06). Con varios, cada
          renglón conserva su botón para bajar solo ese. */}
      <ul className="mt-4 divide-y divide-white/10">
        {files.map((f) => {
          const remaining = remainingOf(f)
          const isBusy = busy === f.id
          const meta = [f.type, formatFileSize(f.size, isEs)].filter(Boolean).join(' · ')
          const fileFailed = failed?.fileId === f.id
          return (
            <li key={f.id} className="py-2.5 first:pt-0 flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-lg bg-[#150a1d] grid place-items-center text-[10px] font-bold tracking-[0.08em] text-white/70" aria-hidden>
                {(f.type || '•').slice(0, 4)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate" title={f.name}>{f.name}</p>
                <p className="text-[0.8125rem] text-white/50 truncate">
                  {meta}
                  {!it.paused && remaining === 0 && <span className="text-amber-200">{meta ? ' · ' : ''}{isEs ? 'Disponible mañana' : 'Available tomorrow'}</span>}
                  {!it.paused && remaining > 0 && remaining <= 2 && <span>{meta ? ' · ' : ''}{isEs ? `Te ${remaining === 1 ? 'queda 1' : `quedan ${remaining}`} hoy` : `${remaining} left today`}</span>}
                </p>
                {fileFailed && (
                  <p role="alert" className="mt-0.5 text-[0.8125rem] text-red-300">
                    {isEs ? 'No pudimos prepararlo. Inténtalo de nuevo.' : "We couldn't prepare it. Try again."}
                  </p>
                )}
              </div>
              {multi && !it.paused && remaining > 0 && (
                <button
                  type="button"
                  onClick={() => onDownloadOne(f)}
                  disabled={busy !== null}
                  className={`w-10 h-10 shrink-0 grid place-items-center rounded-full border-2 border-white/25 text-white/85 hover:text-white hover:border-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors ${FOCUS_RING}`}
                  aria-label={isEs ? `Descargar ${f.name}` : `Download ${f.name}`}
                  title={isEs ? 'Descargar este archivo' : 'Download this file'}
                >
                  {isBusy
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/25 border-t-white animate-spin" aria-hidden />
                    : started?.fileId === f.id ? <CheckIcon className="w-4 h-4 text-emerald-300" aria-hidden /> : <ArrowDownTrayIcon className="w-4 h-4" aria-hidden />}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {it.paused && (
        <p className="mt-3 text-[0.8125rem] text-amber-200 leading-relaxed">
          {isEs ? 'Las descargas de esta compra están en pausa. Escríbenos a ' : 'Downloads for this purchase are paused. Email us at '}
          <a href="mailto:hola@mroscar.xyz" className="underline underline-offset-4 decoration-amber-200/50 hover:decoration-amber-200">hola@mroscar.xyz</a>
          {isEs ? ' y lo revisamos.' : " and we'll look into it."}
        </p>
      )}

      {/* Pie de la card: solo la acción, con aire. Aquí el botón va a lo
          ancho de la card (excepción decidida por Oscar el 2026-10-25). Sin
          contador de archivos: los renglones de arriba ya lo dicen ("no
          amontones cosas"). */}
      {action && <footer className="flex justify-center mt-auto pt-6">{action}</footer>}

      <p className="min-h-0 text-[0.8125rem] text-emerald-300 empty:hidden mt-2" aria-live="polite">
        {done ? (isEs ? 'Tu descarga empezó. Búscala en tu carpeta de descargas.' : 'Your download started. Check your downloads folder.') : ''}
      </p>
    </article>
  )
}

const ORDER_STATUS_LABELS = {
  pending: ['Pendiente', 'Pending'],
  awaiting_payment: ['Esperando pago', 'Awaiting payment'],
  paid: ['Pagado', 'Paid'],
  preparing: ['Preparando', 'Preparing'],
  shipped: ['Enviado', 'Shipped'],
  delivered: ['Entregado', 'Delivered'],
  cancelled: ['Cancelado', 'Cancelled'],
  refunded: ['Reembolsado', 'Refunded'],
}

// Estado con su punto de color, como la categoría en ProductMeta.
function OrderStatus({ status, isEs }) {
  const dot = ['shipped', 'delivered', 'paid', 'preparing'].includes(status) ? '#34d399'
    : status === 'awaiting_payment' ? '#fbbf24'
      : 'rgba(255,255,255,0.4)'
  const label = ORDER_STATUS_LABELS[status]?.[isEs ? 0 : 1] || prettyStatus(status)
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}

// ── piezas compartidas ──────────────────────────────────────────────
function Spinner({ isEs }) {
  return (
    <div className="py-12 grid place-items-center" role="status">
      <div className="w-8 h-8 rounded-full border-[3px] border-white/12 border-t-[#e600ff] animate-spin" aria-hidden />
      <span className="sr-only">{isEs ? 'Cargando' : 'Loading'}</span>
    </div>
  )
}

function Empty({ text }) {
  return <p className="py-10 text-center text-sm text-white/45">{text}</p>
}

// Qué pasó y cómo arreglarlo, junto a donde pasó (H09).
function LoadError({ text, onRetry, isEs }) {
  return (
    <div className="py-10 flex flex-col items-center text-center" role="alert">
      <p className="text-sm text-white/75 max-w-[36ch]">
        {text} {isEs ? 'Revisa tu conexión e inténtalo de nuevo.' : 'Check your connection and try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`shop-btn shop-btn--ghost min-h-[44px] px-5 text-xs mt-5 ${FOCUS_RING}`}
      >
        {isEs ? 'Reintentar' : 'Try again'}
      </button>
    </div>
  )
}

function formatDate(iso, isEs) {
  if (!iso) return ''
  try {
    const d = new Date(String(iso).replace(' ', 'T'))
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(isEs ? 'es-MX' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

// Números y montos en el formato del idioma de la página, no del navegador
// (H02).
function formatNumber(n, isEs) {
  return (Number(n) || 0).toLocaleString(isEs ? 'es-MX' : 'en-US')
}

function formatMoney(amount, isEs) {
  const n = Number(amount)
  if (isNaN(n)) return amount
  return n.toLocaleString(isEs ? 'es-MX' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function prettyStatus(s) {
  const str = String(s).replace(/_/g, ' ').toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}
