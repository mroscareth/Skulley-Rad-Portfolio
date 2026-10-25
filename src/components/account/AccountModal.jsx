import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRightOnRectangleIcon, ArrowTopRightOnSquareIcon, UserCircleIcon,
  ShoppingBagIcon, LockClosedIcon, TicketIcon, CheckCircleIcon, XMarkIcon, SparklesIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'
import { ACHIEVEMENTS, localizeAchievement } from '../../lib/achievementsCatalog.js'
import { useSlimeSlugs } from '../../lib/slimeSlugs.js'
import { useHoloSections, HOLO_SECTIONS } from '../../hooks/useSectionVisitTracking.js'
import { fetchMyOrders } from '../../lib/shopApi.js'
import { useAuth } from '../../auth/authContext.js'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { GOLD_SKIN_THRESHOLD } from '../GameOverModal.jsx'

const API_BASE = `${import.meta.env.BASE_URL}api/profile.php`

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

// Modal "Mi Cuenta" — tabs Perfil / Ranking / Logros / Pedidos.
// Misma anatomía que la card de la tienda (DESIGN.md §14.6): arriba el nombre
// y una línea de detalle, en medio el contenido, y abajo una barra fija con el
// valor a la izquierda (tu mejor puntaje, como el precio) y una sola acción a
// la derecha. Superficie plana con borde de 2px, cero glow, un solo nivel de
// contenedor (las secciones se separan con divisores, no con cajas).
// Consume auth/profile/achievements vía props (los hooks viven en App.jsx)
// para no duplicar instancias ni fetches.
export default function AccountModal({
  open = false,
  onClose,
  userProfile,
  achievements,
  unlockedAt = {},
  onLogout,
  lang = 'en',
  t,
}) {
  const [tab, setTab] = useState('profile')
  const uid = useId()
  const panelRef = useRef(null)
  const isEs = lang === 'es'
  const profile = userProfile?.profile || null
  const privyId = userProfile?.privyId || null

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setTab('profile')
    panelRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!open) return null

  // Sin íconos: los chips de filtro de la tienda tampoco llevan (H04).
  const tabs = [
    { id: 'profile', label: isEs ? 'Perfil' : 'Profile' },
    { id: 'score', label: 'Ranking' },
    { id: 'achievements', label: isEs ? 'Logros' : 'Achievements' },
    { id: 'orders', label: isEs ? 'Pedidos' : 'Orders' },
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
        className="relative w-full h-full sm:h-[min(38rem,88vh)] sm:max-w-[760px] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-[1.25rem] overflow-hidden text-white outline-none"
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
        <header className="flex flex-col gap-5 px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10">
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

          {/* En mobile la fila scrollea horizontal; desde sm caben las cuatro.
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
          className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:-outline-offset-2"
        >
          {tab === 'profile' && (
            <ProfileTab profile={profile} userProfile={userProfile} isEs={isEs} />
          )}
          {tab === 'score' && (
            <ScoreTab privyId={privyId} displayName={profile?.display_name || profile?.email} isEs={isEs} />
          )}
          {tab === 'achievements' && (
            <AchievementsTab achievements={achievements} unlockedAt={unlockedAt} userProfile={userProfile} lang={lang} isEs={isEs} t={t} />
          )}
          {tab === 'orders' && (
            <OrdersTab privyId={privyId} isEs={isEs} />
          )}
        </div>

        {/* Barra fija, como la de compra del detalle: el valor a la izquierda
            (tu mejor puntaje, con la anatomía del precio: número grande y la
            unidad chica aparte) y la única acción de la cuenta a la derecha.
            Es la misma en las cuatro pestañas: el puntaje ya no se repite
            arriba del ranking. */}
        <div className="shrink-0 border-t-2 border-white/10 px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
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

// ── Perfil ──────────────────────────────────────────────────────────
// Lo que el juego te da: el boleto dorado y la skin dorada. Cada uno con la
// anatomía de la card (nombre + una línea de detalle, y el estado a la
// derecha). Si falta alguno, abajo dice cuánto te falta y cómo se gana (H01,
// H10): las dos se ganan con el mismo puntaje.
function ProfileTab({ profile, userProfile, isEs }) {
  const { goldenTicketPct } = useShopData()
  const hasTicket = !!profile?.golden_ticket && !profile?.ticket_burned
  const ticketBurned = !!profile?.golden_ticket && !!profile?.ticket_burned
  const hasGoldSkin = !!userProfile?.hasGoldSkin
  const highScore = userProfile?.highScore ?? 0
  const missing = Math.max(0, GOLD_SKIN_THRESHOLD - highScore)
  const showProgress = (!hasTicket && !ticketBurned) || !hasGoldSkin

  const ticketState = hasTicket
    ? { label: isEs ? 'Activo' : 'Active', tone: 'text-[#facc15]' }
    : ticketBurned
      ? { label: isEs ? 'Canjeado' : 'Redeemed', tone: 'text-white/60' }
      : { label: isEs ? 'Bloqueado' : 'Locked', tone: 'text-white/45' }
  const ticketDetail = hasTicket
    ? (isEs ? `${goldenTicketPct} % de descuento. Se aplica solo en tu carrito.` : `${goldenTicketPct}% off. Auto-applied to your cart.`)
    : ticketBurned
      ? (isEs ? 'Ya lo usaste. ¡Gracias por tu compra!' : 'Already used. Thanks for your order!')
      : (isEs ? `${goldenTicketPct} % de descuento en una compra de la tienda.` : `${goldenTicketPct}% off one order in the store.`)

  return (
    <section aria-labelledby="account-rewards">
      <h3 id="account-rewards" className="text-sm font-bold text-white mb-1">{isEs ? 'Recompensas' : 'Rewards'}</h3>
      <ul className="border-b border-white/10">
        <RewardRow
          Icon={TicketIcon}
          on={hasTicket}
          title={isEs ? 'Boleto dorado' : 'Golden ticket'}
          detail={ticketDetail}
          state={ticketState}
        />
        <RewardRow
          Icon={SparklesIcon}
          on={hasGoldSkin}
          title={isEs ? 'Skin dorada' : 'Gold skin'}
          detail={isEs ? 'Viste de oro a tu personaje en el juego.' : 'Dresses your character in gold.'}
          state={hasGoldSkin
            ? { label: isEs ? 'Desbloqueada' : 'Unlocked', tone: 'text-[#facc15]' }
            : { label: isEs ? 'Bloqueada' : 'Locked', tone: 'text-white/45' }}
        />
      </ul>

      {showProgress && missing > 0 && (
        <div className="mt-6">
          <p className="text-sm text-white/70 leading-relaxed">
            {isEs
              ? <>Se ganan anotando <b className="text-white">{formatNumber(GOLD_SKIN_THRESHOLD, isEs)}</b> en el juego de las esferas. Te faltan <b className="text-white tabular-nums">{formatNumber(missing, isEs)}</b>.</>
              : <>Score <b className="text-white">{formatNumber(GOLD_SKIN_THRESHOLD, isEs)}</b> in the orb game to earn them. <b className="text-white tabular-nums">{formatNumber(missing, isEs)}</b> to go.</>}
          </p>
          <div
            className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"
            role="progressbar"
            aria-label={isEs ? 'Avance hacia las recompensas' : 'Progress toward rewards'}
            aria-valuemin={0}
            aria-valuemax={GOLD_SKIN_THRESHOLD}
            aria-valuenow={Math.min(highScore, GOLD_SKIN_THRESHOLD)}
          >
            <div className="h-full bg-[#facc15]" style={{ width: `${Math.min(100, (highScore / GOLD_SKIN_THRESHOLD) * 100)}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}

function RewardRow({ Icon, on, title, detail, state }) {
  return (
    <li className="flex items-start gap-4 py-4 border-t border-white/10">
      <Icon className={`w-6 h-6 mt-0.5 flex-shrink-0 ${on ? 'text-[#facc15]' : 'text-white/30'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-white">{title}</p>
        <p className="text-sm text-white/55 mt-1 leading-relaxed">{detail}</p>
      </div>
      <p className={`text-sm font-bold whitespace-nowrap mt-0.5 ${state.tone}`}>{state.label}</p>
    </li>
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

  return (
    <div className="flex flex-col">
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
                        <TicketIcon className="w-4 h-4 flex-shrink-0 text-[#facc15]" />
                        <span className="sr-only">{isEs ? 'Tiene boleto dorado' : 'Has a golden ticket'}</span>
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
        <section aria-labelledby="account-recent" className="mt-8">
          <h3 id="account-recent" className="text-sm font-bold text-white mb-1">{isEs ? 'Tus partidas recientes' : 'Your recent games'}</h3>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {scores.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-white/55">{formatDate(s.played_at, isEs)}</span>
                <span className="font-bold tabular-nums">{formatNumber(s.score, isEs)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Logros ──────────────────────────────────────────────────────────
function AchievementsTab({ achievements, unlockedAt, userProfile, lang, isEs, t }) {
  const slime = useSlimeSlugs()
  const holo = useHoloSections()
  const items = useMemo(() => ACHIEVEMENTS.map(a => {
    const loc = localizeAchievement(a, lang)
    let unlocked = false
    let date = null
    if (a.source === 'gold_skin') unlocked = !!userProfile?.hasGoldSkin
    else if (a.source === 'golden_ticket') unlocked = !!userProfile?.hasGoldenTicket
    else { unlocked = achievements?.has?.(a.key) || false; date = unlockedAt?.[a.key] || null }
    // Slime: progreso en el hint mientras esté bloqueado (reto oculto — el
    // hint NO revela ubicaciones, solo cuántas llevas).
    let hint = loc.hint
    if (a.key === 'skin_slime' && !unlocked) {
      hint = `${loc.hint} ${isEs ? `Llevas ${slime.count} de ${slime.total}.` : `${slime.count} of ${slime.total} found.`}`
    }
    return { ...loc, hint, unlocked, date }
  }), [achievements, unlockedAt, userProfile, lang, isEs, slime.count, slime.total])

  const count = items.filter(i => i.unlocked).length
  const pct = items.length ? Math.round((count / items.length) * 100) : 0
  const progressLabel = isEs ? `${count} de ${items.length} desbloqueados` : `${count} of ${items.length} unlocked`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <p className="text-sm text-white/70 whitespace-nowrap tabular-nums">{progressLabel}</p>
        <div
          className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={count}
        >
          <div className="h-full bg-[#e600ff]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Cada logro con la anatomía de la card: nombre + una línea de
          detalle, y el estado a la derecha, en palabras (no solo un ícono). */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8 border-b border-white/10">
        {items.map((a) => (
          <li key={a.key} className="flex gap-3 py-4 border-t border-white/10">
            <div className={`text-2xl leading-none ${a.unlocked ? '' : 'grayscale opacity-40'}`} aria-hidden>{a.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="flex items-start justify-between gap-3">
                <span className={`text-sm font-bold ${a.unlocked ? 'text-white' : 'text-white/60'}`}>{a.title}</span>
                {a.unlocked
                  ? <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" aria-hidden />
                  : <LockClosedIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/35" aria-hidden />}
                <span className="sr-only">{a.unlocked ? (isEs ? 'Desbloqueado' : 'Unlocked') : (isEs ? 'Bloqueado' : 'Locked')}</span>
              </p>
              <p className="text-[13px] text-white/55 mt-1 leading-relaxed">
                {a.unlocked ? a.description : a.hint}
              </p>
              {/* Hologram: progreso de las 5 secciones (check = ya visitada
                  >=15s). Solo mientras esté bloqueado. */}
              {a.key === 'skin_hologram' && !a.unlocked && (
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
              {a.unlocked && a.date && (
                <p className="text-xs text-white/40 tabular-nums mt-1.5">{formatDate(a.date, isEs)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
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
    <ul className="divide-y-2 divide-white/10">
      {orders.map((o) => {
        const tracking = o.tracking_number
          ? `${o.carrier ? `${o.carrier} · ` : ''}${o.tracking_number}`
          : null
        return (
          <li key={o.number} className="py-5 first:pt-0 last:pb-0">
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
