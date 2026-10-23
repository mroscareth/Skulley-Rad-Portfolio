import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRightOnRectangleIcon, UserCircleIcon, TrophyIcon, SparklesIcon,
  ShoppingBagIcon, LockClosedIcon, TicketIcon, CheckCircleIcon, XMarkIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'
import { ACHIEVEMENTS, localizeAchievement } from '../../lib/achievementsCatalog.js'
import { useSlimeSlugs } from '../../lib/slimeSlugs.js'
import { useHoloSections, HOLO_SECTIONS } from '../../hooks/useSectionVisitTracking.js'
import { fetchMyOrders } from '../../lib/shopApi.js'
import { useAuth } from '../../auth/authContext.js'
import { useShopData } from '../../lib/shopDataContext.jsx'

const API_BASE = `${import.meta.env.BASE_URL}api/profile.php`

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:outline-offset-2'

// Modal "Mi Cuenta" — overlay con tabs Perfil / Ranking / Logros / Pedidos.
// Lenguaje editorial + toon de la Store (DESIGN.md §14, §15.1): panel plano
// #0d0714 con borde de 2px, cero glow, sin monoespaciado ni prompts, un solo
// nivel de contenedor (las secciones se separan con divisores, no con cajas).
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

  const tabs = [
    { id: 'profile', label: isEs ? 'Perfil' : 'Profile', Icon: UserCircleIcon },
    { id: 'score', label: 'Ranking', Icon: TrophyIcon },
    { id: 'achievements', label: isEs ? 'Logros' : 'Achievements', Icon: SparklesIcon },
    { id: 'orders', label: isEs ? 'Pedidos' : 'Orders', Icon: ShoppingBagIcon },
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

  // El nombre es el título del modal; si no hay nombre, el correo ocupa su
  // lugar y no se repite debajo.
  const title = profile?.display_name || profile?.email || (isEs ? 'Usuario' : 'User')
  const subtitle = profile?.display_name && profile?.email ? profile.email : null
  const avatar = profile?.avatar_url || null

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
        className="relative w-full h-full sm:h-[min(46rem,88vh)] sm:max-w-[860px] flex flex-col bg-[#0d0714] border-0 sm:border-2 sm:border-white/12 rounded-none sm:rounded-2xl overflow-hidden text-white outline-none"
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

        <header className="flex flex-col gap-5 px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10">
          <div className="flex items-center gap-4 pr-14">
            {avatar
              ? <img src={avatar} alt="" className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-white/15 object-cover" />
              : (
                <div className="h-14 w-14 flex-shrink-0 rounded-full bg-[#150a1d] grid place-items-center" aria-hidden>
                  <UserCircleIcon className="w-8 h-8 text-white/35" />
                </div>
              )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="display-title display-title--md [overflow-wrap:anywhere]">{title}</h2>
              {subtitle && <p className="text-sm text-white/45 truncate mt-2">{subtitle}</p>}
            </div>
          </div>

          {/* En mobile la fila scrollea horizontal; desde sm caben las cuatro.
              El px-1 de sm deja aire para que el scroller no corte el anillo de foco. */}
          <div
            role="tablist"
            aria-label={isEs ? 'Mi cuenta' : 'My account'}
            onKeyDown={onTabsKeyDown}
            className="flex gap-2 overflow-x-auto no-native-scrollbar -mx-6 px-6 sm:-mx-1 sm:px-1 py-1"
          >
            {tabs.map(({ id, label, Icon }) => {
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
                  className={`shop-chip flex-shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 sm:px-5 text-[11px] sm:text-xs whitespace-nowrap ${FOCUS_RING}`}
                >
                  <Icon className="hidden sm:block w-4 h-4" aria-hidden />
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
          className="flex-1 min-h-0 overflow-y-auto modal-scroll px-6 sm:px-8 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e600ff] focus-visible:-outline-offset-2"
        >
          {tab === 'profile' && (
            <ProfileTab profile={profile} userProfile={userProfile} isEs={isEs} onLogout={onLogout} />
          )}
          {tab === 'score' && (
            <ScoreTab privyId={privyId} highScore={userProfile?.highScore ?? 0} displayName={profile?.display_name || profile?.email} isEs={isEs} />
          )}
          {tab === 'achievements' && (
            <AchievementsTab achievements={achievements} unlockedAt={unlockedAt} userProfile={userProfile} lang={lang} isEs={isEs} t={t} />
          )}
          {tab === 'orders' && (
            <OrdersTab privyId={privyId} isEs={isEs} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Perfil ──────────────────────────────────────────────────────────
function ProfileTab({ profile, userProfile, isEs, onLogout }) {
  const { goldenTicketPct } = useShopData()
  const hasTicket = !!profile?.golden_ticket && !profile?.ticket_burned
  const ticketBurned = !!profile?.golden_ticket && !!profile?.ticket_burned
  const hasGoldSkin = !!userProfile?.hasGoldSkin
  return (
    <div className="flex flex-col gap-6">
      <dl className="border-t border-white/10">
        <Row
          k={isEs ? 'Mejor puntaje' : 'Best score'}
          v={<span className="text-xl font-bold tabular-nums">{(userProfile?.highScore ?? 0).toLocaleString()}</span>}
        />
        <Row
          k={isEs ? 'Skin dorada' : 'Gold skin'}
          v={
            <span className={hasGoldSkin ? 'text-[#facc15]' : 'text-white/45'}>
              {hasGoldSkin ? (isEs ? 'Desbloqueada' : 'Unlocked') : (isEs ? 'Bloqueada' : 'Locked')}
            </span>
          }
        />
      </dl>

      <div className="flex items-start gap-3">
        <TicketIcon className={`w-6 h-6 flex-shrink-0 ${hasTicket ? 'text-[#facc15]' : 'text-white/30'}`} aria-hidden />
        <div className="min-w-0">
          <p className={`text-base font-bold ${hasTicket ? 'text-[#facc15]' : 'text-white'}`}>
            {isEs ? `Boleto dorado · ${goldenTicketPct}% off` : `Golden ticket · ${goldenTicketPct}% off`}
          </p>
          <p className="text-sm text-white/55 mt-1 leading-relaxed">
            {hasTicket
              ? (isEs ? 'Activo. Se aplica solo en tu carrito.' : 'Active. Auto-applied to your cart.')
              : ticketBurned
                ? (isEs ? 'Canjeado. ¡Gracias por tu compra!' : 'Redeemed. Thanks for your order!')
                : (isEs ? 'Anota 5000 en el juego para ganarlo.' : 'Score 5000 in the game to earn it.')}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onLogout?.() }}
        className={`shop-btn shop-btn--ghost w-full sm:w-auto sm:self-start min-h-[48px] px-6 text-sm ${FOCUS_RING}`}
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" aria-hidden />
        {isEs ? 'Cerrar sesión' : 'Log out'}
      </button>
    </div>
  )
}

// Par clave/valor de ficha (mismo patrón que OrderStatusModal).
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/10">
      <dt className="shop-kicker text-white/45">{k}</dt>
      <dd className="text-white font-semibold text-sm text-right min-w-0 break-words">{v}</dd>
    </div>
  )
}

// ── Score + Ranking ─────────────────────────────────────────────────
function ScoreTab({ privyId, highScore, displayName, isEs }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [scores, setScores] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const lb = fetch(`${API_BASE}?action=leaderboard`).then(r => r.json()).catch(() => null)
    const sc = privyId
      ? fetch(`${API_BASE}?action=scores&pid=${encodeURIComponent(privyId)}`).then(r => r.json()).catch(() => null)
      : Promise.resolve(null)
    Promise.all([lb, sc]).then(([lbRes, scRes]) => {
      if (cancelled) return
      setLeaderboard(lbRes?.ok ? (lbRes.leaderboard || []) : [])
      setScores(scRes?.ok ? (scRes.scores || []) : [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [privyId])

  if (loading) return <Spinner isEs={isEs} />

  // Oro / plata / bronce para el podio; el resto en tinta tenue.
  const rankTone = (i) => (i === 0 ? 'text-[#facc15]' : i === 1 ? 'text-white/80' : i === 2 ? 'text-amber-600' : 'text-white/40')

  return (
    <div className="flex flex-col">
      <dl className="pb-6">
        <dt className="shop-kicker text-white/45">{isEs ? 'Tu mejor puntaje' : 'Your best score'}</dt>
        <dd className="display-title display-title--lg tabular-nums mt-3">{(highScore ?? 0).toLocaleString()}</dd>
      </dl>

      <section className="border-t-2 border-white/10 pt-6">
        <h3 className="text-base font-bold mb-2">{isEs ? 'Ranking global' : 'Global ranking'}</h3>
        {(!leaderboard || leaderboard.length === 0) ? (
          <Empty text={isEs ? 'Sin puntajes todavía. ¡Sé el primero!' : 'No scores yet. Be the first!'} />
        ) : (
          <ol className="divide-y divide-white/10">
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
                    {isMe && (
                      <span className="flex-shrink-0 rounded-full bg-[#e600ff] text-[#0a0510] text-[11px] font-bold leading-none px-2 py-1">
                        {isEs ? 'Tú' : 'You'}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-white">{(row.high_score ?? 0).toLocaleString()}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {scores && scores.length > 0 && (
        <section className="border-t-2 border-white/10 pt-6 mt-6">
          <h3 className="text-base font-bold mb-2">{isEs ? 'Partidas recientes' : 'Recent games'}</h3>
          <ul className="divide-y divide-white/10">
            {scores.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-white/45">{formatDate(s.played_at, isEs)}</span>
                <span className="font-bold tabular-nums">{(s.score ?? 0).toLocaleString()}</span>
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
        <p className="text-sm text-white/60 whitespace-nowrap tabular-nums">{progressLabel}</p>
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

      <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8 border-b border-white/10">
        {items.map((a) => (
          <li key={a.key} className="flex gap-3 py-4 border-t border-white/10">
            <div className={`text-2xl leading-none ${a.unlocked ? '' : 'grayscale opacity-40'}`} aria-hidden>{a.icon}</div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold flex items-center gap-1.5 ${a.unlocked ? 'text-white' : 'text-white/60'}`}>
                {a.title}
                {a.unlocked
                  ? <CheckCircleIcon className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  : <LockClosedIcon className="w-3.5 h-3.5 flex-shrink-0 text-white/35" />}
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
function OrdersTab({ privyId, isEs }) {
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(true)
  const { getAccessToken } = useAuth()

  useEffect(() => {
    if (!privyId) { setLoading(false); setOrders([]); return }
    let cancelled = false
    setLoading(true)
    // El backend identifica la cuenta por el token de Privy, no por el privy_id.
    getAccessToken()
      .then(token => (token ? fetchMyOrders(token) : []))
      .then(list => {
        if (cancelled) return
        setOrders(list)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setOrders([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [privyId, getAccessToken])

  if (loading) return <Spinner isEs={isEs} />
  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <ShoppingBagIcon className="w-14 h-14 text-white/15 mb-4" aria-hidden />
        <p className="text-base font-semibold text-white/80">{isEs ? 'Aún no tienes pedidos.' : "You don't have any orders yet."}</p>
        <button
          type="button"
          className={`shop-btn shop-btn--primary w-full sm:w-auto min-h-[48px] px-6 text-sm mt-6 ${FOCUS_RING}`}
          onClick={() => { try { window.dispatchEvent(new CustomEvent('shop-cart-open-request')) } catch { } }}
        >
          {isEs ? 'Ir a la tienda' : 'Go to the store'}
        </button>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-white/10 border-y border-white/10">
      {orders.map((o) => (
        <li key={o.number} className="py-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold">{o.number}</span>
            <span className="text-sm font-bold tabular-nums whitespace-nowrap">
              {o.total != null ? `${formatMoney(o.total)} ${o.currency || ''}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-white/45">
            <span>{formatDate(o.created_at, isEs)}</span>
            <StatusChip status={o.status} isEs={isEs} />
            {o.tracking_number && (
              o.tracking_url
                ? (
                  <a
                    href={o.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-[#e600ff] underline underline-offset-4 rounded-sm ${FOCUS_RING}`}
                  >
                    {o.carrier ? `${o.carrier} · ` : ''}{o.tracking_number}
                  </a>
                )
                : <span>{o.carrier ? `${o.carrier} · ` : ''}{o.tracking_number}</span>
            )}
          </div>
          {Array.isArray(o.items) && o.items.length > 0 && (
            <ul className="text-[13px] text-white/60 mt-2.5 space-y-1">
              {o.items.map((it, j) => (
                <li key={j} className="flex justify-between gap-3">
                  <span className="truncate">{it.title}{it.options ? ` · ${it.options}` : ''}</span>
                  <span className="text-white/40 tabular-nums">×{it.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
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

function StatusChip({ status, isEs }) {
  const tone = ['shipped', 'delivered', 'paid', 'preparing'].includes(status) ? 'bg-emerald-400/15 text-emerald-300'
    : status === 'awaiting_payment' ? 'bg-amber-400/15 text-amber-200'
      : 'bg-white/[0.08] text-white/60'
  const label = ORDER_STATUS_LABELS[status]?.[isEs ? 0 : 1] || prettyStatus(status)
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold leading-none ${tone}`}>{label}</span>
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

function formatDate(iso, isEs) {
  if (!iso) return ''
  try {
    const d = new Date(String(iso).replace(' ', 'T'))
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(isEs ? 'es-MX' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

function formatMoney(amount) {
  const n = Number(amount)
  if (isNaN(n)) return amount
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function prettyStatus(s) {
  const str = String(s).replace(/_/g, ' ').toLowerCase()
  return str.charAt(0).toUpperCase() + str.slice(1)
}
