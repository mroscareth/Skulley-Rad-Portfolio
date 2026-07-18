import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightOnRectangleIcon, UserCircleIcon, TrophyIcon,
  SparklesIcon, ShoppingBagIcon, LockClosedIcon, TicketIcon,
} from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'
import Button from '../ui/Button.jsx'
import { ACHIEVEMENTS, localizeAchievement } from '../../lib/achievementsCatalog.js'
import { useSlimeSlugs } from '../../lib/slimeSlugs.js'
import { useHoloSections, HOLO_SECTIONS } from '../../hooks/useSectionVisitTracking.js'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

const API_BASE = `${import.meta.env.BASE_URL}api/profile.php`

// Modal "Mi Cuenta" — overlay con tabs Perfil / Ranking / Logros / Pedidos.
// Lenguaje visual TERMINAL (DESIGN.md §0, §6.2, §6.2b): container #0a0a14 con
// borde azul + glow, header chrome traffic-lights, Cascadia Code, scanlines CRT,
// prompts `>` / `//`. Consume auth/profile/achievements vía props (los hooks
// viven en App.jsx) para no duplicar instancias ni fetches.
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
  const isEs = lang === 'es'
  const profile = userProfile?.profile || null
  const privyId = userProfile?.privyId || null

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (open) setTab('profile') }, [open])

  if (!open) return null

  const tabs = [
    { id: 'profile', slug: 'account', label: isEs ? 'PERFIL' : 'PROFILE', Icon: UserCircleIcon },
    { id: 'score', slug: 'ranking', label: isEs ? 'RANKING' : 'RANKING', Icon: TrophyIcon },
    { id: 'achievements', slug: 'logros', label: isEs ? 'LOGROS' : 'ACHIEVEMENTS', Icon: SparklesIcon },
    { id: 'orders', slug: 'pedidos', label: isEs ? 'PEDIDOS' : 'ORDERS', Icon: ShoppingBagIcon },
  ]
  const activeSlug = tabs.find(x => x.id === tab)?.slug || 'account'

  const displayName = profile?.display_name || profile?.email || (isEs ? 'usuario' : 'user')
  const avatar = profile?.avatar_url || null

  return (
    <div
      className="fixed inset-0 z-[999998] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      <style>{`
        @keyframes accountGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3), inset 0 0 60px rgba(59,130,246,0.05); }
          50% { box-shadow: 0 0 30px rgba(59,130,246,0.4), inset 0 0 80px rgba(59,130,246,0.08); }
        }
      `}</style>

      <div className="animate-ui-enter-scale relative w-[min(860px,96vw)] max-h-[88vh] flex">
        <div
          className="relative w-full flex flex-col rounded-lg overflow-hidden crt-scanlines"
          style={{
            backgroundColor: '#0a0a14',
            border: '2px solid #3b82f6',
            fontFamily: '"Cascadia Code", monospace',
            animation: 'accountGlow 3s ease-in-out infinite',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Terminal chrome header (traffic-lights) — §6.2b */}
          <header className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 -m-1.5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; onClose?.() }}
                aria-label={t ? t('common.close') : 'Close'}
              >
                <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
              </button>
              <div className="w-3 h-3 rounded-full bg-white/20" />
              <div className="w-3 h-3 rounded-full bg-white/20" />
            </div>
            <span className="text-blue-500/70 text-xs truncate">M.A.D.R.E.@mausoleum:~/{activeSlug}</span>
            <div className="w-6" />
          </header>

          {/* whoami subheader */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-blue-500/20 bg-blue-500/[0.04] relative z-20">
            {avatar
              ? <img src={avatar} alt="" className="h-10 w-10 rounded border border-blue-500/40 object-cover" />
              : <div className="h-10 w-10 rounded border border-blue-500/40 bg-blue-500/10 grid place-items-center"><UserCircleIcon className="w-6 h-6 text-blue-400/70" /></div>}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-blue-300 text-sm truncate">{`> ${displayName}`}</div>
              {profile?.email && <div className="text-blue-500/50 text-[11px] truncate">{profile.email}</div>}
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 px-3 pt-3 relative z-20">
            {tabs.map(({ id, label, Icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; setTab(id) }}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wide rounded-t border-b-2 transition-colors ${
                    active
                      ? 'text-blue-200 bg-blue-500/15 border-blue-400'
                      : 'text-blue-500/45 border-transparent hover:text-blue-200 hover:bg-blue-500/5'
                  }`}
                  style={active ? { textShadow: '0 0 8px rgba(59,130,246,0.5)' } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="relative z-20 flex-1 overflow-y-auto p-4 md:p-5 text-blue-100">
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
    </div>
  )
}

// ── Perfil ──────────────────────────────────────────────────────────
function ProfileTab({ profile, userProfile, isEs, onLogout }) {
  const hasTicket = !!profile?.golden_ticket_shopify_code && !profile?.ticket_burned
  const ticketBurned = !!profile?.golden_ticket_shopify_code && !!profile?.ticket_burned
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Cell label="high_score">
          <span className="text-amber-300 text-xl font-bold tabular-nums">{(userProfile?.highScore ?? 0).toLocaleString()}</span>
        </Cell>
        <Cell label="gold_skin">
          <span className={`text-sm font-bold ${userProfile?.hasGoldSkin ? 'text-amber-300' : 'text-blue-500/50'}`}>
            {userProfile?.hasGoldSkin ? (isEs ? 'DESBLOQUEADA' : 'UNLOCKED') : (isEs ? 'BLOQUEADA' : 'LOCKED')}
          </span>
        </Cell>
      </div>

      {/* Golden ticket */}
      <div className={`rounded border p-3.5 flex items-center gap-3 ${hasTicket ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'border-blue-500/20 bg-blue-500/[0.04]'}`}>
        <TicketIcon className={`w-6 h-6 shrink-0 ${hasTicket ? 'text-amber-300' : 'text-blue-500/40'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-blue-100">{isEs ? 'Boleto dorado · 35% off' : 'Golden ticket · 35% off'}</div>
          <div className="text-[11px] text-blue-400/60 mt-0.5">
            {hasTicket
              ? (isEs ? '// activo — se aplica solo en tu carrito' : '// active — auto-applied to your cart')
              : ticketBurned
                ? (isEs ? '// canjeado. ¡gracias por tu compra!' : '// redeemed. thanks for your order!')
                : (isEs ? '// anota 5000 en el juego para ganarlo' : '// score 5000 in the game to earn it')}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onLogout?.() }}
        className="w-full flex items-center justify-center gap-2 h-11 text-sm font-mono rounded border border-red-700 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300 transition-colors"
      >
        <ArrowRightOnRectangleIcon className="w-5 h-5" />
        {isEs ? '> CERRAR_SESIÓN' : '> LOG_OUT'}
      </button>
    </div>
  )
}

// Celda terminal: `// label` + valor.
function Cell({ label, children }) {
  return (
    <div className="rounded border border-blue-500/20 bg-blue-500/[0.04] p-3">
      <div className="text-cyan-400 text-[11px]">{`// ${label}`}</div>
      <div className="mt-1">{children}</div>
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

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="rounded border border-amber-400/30 bg-amber-400/[0.06] p-4 text-center">
        <div className="text-amber-400/70 text-[11px] uppercase tracking-wide">{isEs ? '// tu mejor score' : '// your best score'}</div>
        <div className="text-3xl font-bold text-amber-200 mt-1 tabular-nums" style={{ textShadow: '0 0 14px rgba(251,191,36,0.4)' }}>{(highScore ?? 0).toLocaleString()}</div>
      </div>

      <div>
        <p className="text-cyan-400 text-[11px] mb-2">{isEs ? '// ranking_global' : '// global_ranking'}</p>
        {(!leaderboard || leaderboard.length === 0) ? (
          <Empty text={isEs ? 'sin scores todavía. ¡sé el primero!' : 'no scores yet. be the first!'} />
        ) : (
          <ol className="space-y-1.5">
            {leaderboard.map((row, i) => {
              const isMe = displayName && row.name === displayName
              return (
                <li
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded border ${isMe ? 'bg-blue-500/15 border-blue-400/50' : 'bg-blue-500/[0.03] border-blue-500/15'}`}
                >
                  <span className={`w-6 text-center text-sm font-bold tabular-nums ${i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-blue-500/50'}`}>{i + 1}</span>
                  {row.avatar_url
                    ? <img src={row.avatar_url} alt="" className="h-7 w-7 rounded border border-blue-500/20 object-cover" />
                    : <div className="h-7 w-7 rounded border border-blue-500/20 bg-blue-500/10" />}
                  <span className="flex-1 truncate text-[13px] text-blue-100">{row.name}{row.golden_ticket ? ' 🎫' : ''}</span>
                  <span className="text-[13px] font-bold tabular-nums text-blue-300">{(row.high_score ?? 0).toLocaleString()}</span>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {scores && scores.length > 0 && (
        <div>
          <p className="text-cyan-400 text-[11px] mb-2">{isEs ? '// partidas_recientes' : '// recent_games'}</p>
          <ul className="space-y-1">
            {scores.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-1.5 rounded border border-blue-500/15 bg-blue-500/[0.03] text-[12px]">
                <span className="text-blue-400/60">{formatDate(s.played_at, isEs)}</span>
                <span className="font-bold tabular-nums text-blue-200">{(s.score ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
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
    // Slime: mostrar progreso "X/5" en el hint mientras esté bloqueado (reto
    // oculto — el hint NO revela ubicaciones, solo cuántas llevas).
    let hint = loc.hint
    if (a.key === 'skin_slime' && !unlocked) hint = `${loc.hint} [${slime.count}/${slime.total}]`
    return { ...loc, hint, unlocked, date }
  }), [achievements, unlockedAt, userProfile, lang, slime.count, slime.total])

  const count = items.filter(i => i.unlocked).length

  return (
    <div className="space-y-3">
      <p className="text-cyan-400 text-[11px]">{isEs ? `// desbloqueados [${count}/${items.length}]` : `// unlocked [${count}/${items.length}]`}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {items.map((a) => (
          <div
            key={a.key}
            className={`relative rounded border p-3.5 flex gap-3 ${a.unlocked ? 'bg-emerald-500/[0.06] border-emerald-400/30' : 'bg-blue-500/[0.03] border-blue-500/15'}`}
          >
            <div className={`text-2xl leading-none ${a.unlocked ? '' : 'grayscale opacity-40'}`} aria-hidden>{a.icon}</div>
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-bold flex items-center gap-1.5 ${a.unlocked ? 'text-emerald-200' : 'text-blue-300/70'}`}>
                {a.title}
                {!a.unlocked && <LockClosedIcon className="w-3.5 h-3.5 text-blue-500/50" />}
              </div>
              <div className="text-[11px] text-blue-400/60 mt-0.5">
                {a.unlocked ? a.description : `// ${a.hint}`}
              </div>
              {/* Hologram: progreso visual de las 5 secciones (check = ya visitada
                  >=15s). Solo mientras esté bloqueado. */}
              {a.key === 'skin_hologram' && !a.unlocked && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {HOLO_SECTIONS.map((sid) => {
                    const done = holo.has(sid)
                    return (
                      <span
                        key={sid}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border ${done
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-blue-500/[0.04] border-blue-500/20 text-blue-300/50'}`}
                      >
                        {done
                          ? <CheckCircleIcon className="w-3 h-3" />
                          : <span className="w-3 h-3 rounded-full border border-current opacity-50" />}
                        {t ? t(`nav.${sid}`) : sid}
                      </span>
                    )
                  })}
                  <span className="text-[9px] text-blue-400/50 self-center ml-0.5">[{holo.count}/{holo.total}]</span>
                </div>
              )}
              {a.unlocked && a.date && (
                <div className="text-[10px] text-emerald-400/50 mt-1">{formatDate(a.date, isEs)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pedidos ─────────────────────────────────────────────────────────
function OrdersTab({ privyId, isEs }) {
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!privyId) { setLoading(false); setOrders([]); return }
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}?action=orders&pid=${encodeURIComponent(privyId)}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        setOrders(json?.ok ? (json.orders || []) : [])
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setOrders([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [privyId])

  if (loading) return <Spinner />
  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-4">
        <Empty text={isEs ? 'aún no tienes pedidos.' : "you don't have any orders yet."} />
        <Button
          variant="terminal-action"
          size="md"
          className="w-full"
          onClick={() => { try { window.dispatchEvent(new CustomEvent('shop-cart-open-request')) } catch {} }}
        >
          {isEs ? '> IR_A_LA_TIENDA' : '> GO_TO_STORE'}
        </Button>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {orders.map((o, i) => (
        <li key={i} className="rounded border border-blue-500/20 bg-blue-500/[0.04] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-blue-200">{o.name}</span>
            <span className="text-[13px] font-bold tabular-nums text-blue-100">
              {o.total != null ? `${formatMoney(o.total)} ${o.currency || ''}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-blue-400/60">
            <span>{formatDate(o.processed_at, isEs)}</span>
            {o.fulfillment_status && <StatusChip status={o.fulfillment_status} />}
            {o.financial_status && <StatusChip status={o.financial_status} />}
          </div>
          {Array.isArray(o.items) && o.items.length > 0 && (
            <div className="text-[11px] text-blue-300/70 mt-2 space-y-0.5">
              {o.items.map((it, j) => (
                <div key={j} className="flex justify-between">
                  <span className="truncate">{it.title}</span>
                  <span className="text-blue-500/50 ml-2">×{it.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function StatusChip({ status }) {
  const s = String(status).toUpperCase()
  const tone = s.includes('FULFILLED') || s.includes('PAID') ? 'text-emerald-300 border-emerald-400/40'
    : s.includes('PENDING') || s.includes('UNFULFILLED') ? 'text-amber-300 border-amber-400/40'
      : 'text-blue-400/60 border-blue-500/30'
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide ${tone}`}>{prettyStatus(status)}</span>
}

// ── shared bits ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="py-10 grid place-items-center">
      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Empty({ text }) {
  return <div className="py-8 text-center text-[13px] text-blue-500/50 font-mono">{`// ${text}`}</div>
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
  return String(s).replace(/_/g, ' ').toLowerCase()
}
