/**
 * UsersPanel — CMS view for managing registered user profiles.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/profile.php`

// En celular los controles chicos crecen a 44px para poder tocarlos; desde sm
// vuelven a su tamaño de escritorio.
const TAP = 'min-h-11 sm:min-h-0'
const TAP_ICON = 'w-11 h-11 sm:w-10 sm:h-10'

// Filter tabs
const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'golden_ticket', label: 'Con ticket' },
  { value: 'gold_skin', label: 'Con skin dorada' },
  { value: 'burned', label: 'Ticket usado' },
]

// Admin-editable flags shown in the expanded row. `help` dice qué pasa al
// prenderlo; las consecuencias completas están en RULES.
const FLAGS = [
  { key: 'golden_ticket', label: 'Ticket de descuento', help: 'Silver (10 %) o Golden (35 %), en una compra' },
  { key: 'gold_skin', label: 'Skin dorada', help: 'Solo cambia el look del personaje' },
  { key: 'ticket_burned', label: 'Ticket usado', help: 'Ya lo gastó: no hay descuento' },
]

// Verificado en game-tickets.php (reglas y niveles), profile.php (save_score),
// shop-checkout.php (solo aplica si golden_ticket=1 y ticket_burned=0),
// shop-lib.php (markPaid lo quema) y useGoldSkinSystem.js (la skin se
// sincroniza en ambos sentidos).
const RULES = [
  <>Hay dos tickets: <strong>Silver</strong> (10 % de descuento) con <strong>3,000 puntos</strong> y <strong>Golden</strong> (35 %) con <strong>9,999</strong>. Se aplican al pagar y se gastan cuando Stripe confirma el cobro.</>,
  <>Se ganan solos en el minijuego. <strong>Solo hay 10 Golden al mes</strong> en todo el sitio; cuando se acaban, 9,999 da el Silver. Cada cuenta gana <strong>un ticket al mes</strong> y tiene uno a la vez; un Silver sin usar sube a Golden con 9,999. Las partidas sospechosas no dan premio.</>,
  <><strong>Ticket usado</strong> quiere decir que ya lo gastó. Mientras esté prendido no hay descuento, aunque tenga ticket. Apágalo solo para devolverle el descuento.</>,
  <>Si le das un ticket a mano, elige su <strong>nivel</strong> abajo del interruptor. Un ticket dado a mano no cuenta para los 10 Golden del mes.</>,
  <><strong>Skin dorada</strong> se gana con 5,000 puntos y es solo cosmética: pinta de dorado al personaje y no da descuento. Si se la quitas, desaparece la próxima vez que entre con su cuenta.</>,
]

const TICKET_TIER_LABEL = { silver: 'Silver ticket', gold: 'Golden ticket' }

const TIER_LABELS = {
  legendary: 'Legendario',
  diamond: 'Diamante',
  gold: 'Oro',
  silver: 'Plata',
  bronze: 'Bronce',
}

const TICKET_SOURCE_LABELS = {
  game: 'Lo ganó jugando',
  code: 'Con un código',
}

const COLS = 7

const scoreTone = (score) =>
  score >= 3000 ? 'text-feedback-warning' :
  score >= 1000 ? 'text-white' :
  'text-white/60'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

export default function UsersPanel({ authHeaders }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState(null)
  const [userDetail, setUserDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fetch users list
  const fetchUsers = useCallback(async (pg = 1, f = '', s = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ action: 'users', page: pg })
      if (f) params.set('filter', f)
      if (s) params.set('search', s)
      const res = await fetch(`${API}?${params}`, {
        credentials: 'include',
        headers: authHeaders || {},
      })
      const json = await res.json()
      if (json.ok) {
        setUsers(json.users || [])
        setPage(json.page)
        setTotalPages(json.total_pages)
        setTotal(json.total)
      } else {
        setError(json.error || 'No se pudieron cargar los usuarios. Intenta de nuevo.')
      }
    } catch (err) {
      setError('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { fetchUsers(page, filter, activeSearch) }, [page, filter, activeSearch, fetchUsers])

  // Fetch single user detail
  const fetchDetail = useCallback(async (userId) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`${API}?action=user_detail&id=${userId}`, {
        credentials: 'include',
        headers: authHeaders || {},
      })
      const json = await res.json()
      if (json.ok) setUserDetail(json)
    } catch (err) {
      console.warn('[UsersPanel] detail fetch failed:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [authHeaders])

  const toggleExpand = (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null)
      setUserDetail(null)
    } else {
      setExpandedUser(userId)
      fetchDetail(userId)
    }
  }

  // Update user flags (admin toggle)
  const updateUser = async (userId, updates) => {
    try {
      const res = await fetch(`${API}?action=update_user`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ id: userId, ...updates }),
      })
      const json = await res.json()
      if (json.ok) {
        fetchUsers(page, filter, activeSearch)
        if (expandedUser === userId) fetchDetail(userId)
      }
    } catch (err) {
      console.warn('[UsersPanel] update failed:', err)
    }
  }

  const emptyCopy = activeSearch
    ? `Nadie coincide con “${activeSearch}”.`
    : filter
      ? 'No hay usuarios con este filtro.'
      : 'Todavía no hay usuarios registrados.'

  return (
    <div className="w-full">
      {/* Header */}
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Usuarios</h1>
          <p className="a-subtitle">
            Las cuentas de quienes juegan en el sitio, con sus puntajes y sus premios.
          </p>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger items-center pl-4 pr-2 py-2 mb-6" role="alert">
          <span className="flex-1 min-w-0 break-words py-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="a-icon-btn a-icon-btn--sm w-11 h-11 sm:w-8 sm:h-8 border-transparent"
            aria-label="Cerrar aviso"
          >
            <XMarkIcon className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      <section className="a-section" aria-label="Lista de usuarios">
        {/* Filters and search */}
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mb-6">
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar usuarios">
            {FILTERS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setFilter(opt.value); setPage(1) }}
                className={`a-chip ${TAP}`}
                aria-pressed={filter === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Buscar es la acción del formulario: va al final, a la derecha. */}
          <form
            onSubmit={(e) => { e.preventDefault(); setActiveSearch(searchTerm); setPage(1); }}
            className="flex items-center justify-end gap-3 w-full lg:w-auto"
            role="search"
          >
            <div className="relative flex-1 min-w-0 lg:w-72 lg:flex-none">
              <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
                aria-hidden
              />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o correo"
                aria-label="Buscar usuarios"
                className="a-input pl-9"
              />
            </div>
            {activeSearch && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setActiveSearch(''); setPage(1); }}
                className={`a-icon-btn ${TAP_ICON}`}
                title="Borrar búsqueda"
                aria-label="Borrar búsqueda"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden />
              </button>
            )}
            <button type="submit" className={`a-btn a-btn--primary shrink-0 ${TAP}`}>
              Buscar
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="a-spinner" role="status" aria-label="Cargando usuarios" />
          </div>
        ) : users.length === 0 ? (
          <div className="a-empty flex flex-col items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-white/25" aria-hidden />
            <p>{emptyCopy}</p>
          </div>
        ) : (
          <div className="a-card overflow-hidden">
            {/* @container: el detalle desplegado mide el ancho visible de la
                tabla (100cqw) y se queda pegado a la izquierda al hacer scroll
                horizontal en celular, en vez de medir lo que mide la tabla.
                `relative`: los sr-only (position absolute) de la tabla se
                recortan aquí; sin esto se salen y ensanchan la página en celular. */}
            <div className="@container relative overflow-x-auto a-scroll">
              <table className="a-table a-table--hover min-w-[760px]">
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col" className="text-right">Mejor puntaje</th>
                    <th scope="col">Premios</th>
                    <th scope="col" className="text-right">Partidas</th>
                    <th scope="col" className="text-right">Códigos</th>
                    <th scope="col">Registro</th>
                    <th scope="col" className="w-12"><span className="sr-only">Detalle</span></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isExpanded = expandedUser === u.id
                    const name = u.display_name || 'Sin nombre'
                    const hasFlags = u.golden_ticket == 1 || u.gold_skin == 1 || u.ticket_burned == 1
                    const sourceLabel = userDetail?.user?.ticket_source
                      ? TICKET_SOURCE_LABELS[userDetail.user.ticket_source] || userDetail.user.ticket_source
                      : null

                    return (
                      <React.Fragment key={u.id}>
                        <tr
                          className={`cursor-pointer ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                          onClick={() => toggleExpand(u.id)}
                        >
                          <td className="max-w-[18rem]">
                            <div className="text-white font-semibold truncate">{name}</div>
                            <div className="truncate mt-1">
                              {u.email
                                ? <span className="text-[0.8125rem] text-white/55">{u.email}</span>
                                : <span className="a-code">{u.privy_id?.slice(0, 20)}</span>}
                            </div>
                          </td>

                          <td className={`text-right a-num font-bold ${scoreTone(u.high_score || 0)}`}>
                            {fmt(u.high_score)}
                          </td>

                          <td>
                            {hasFlags ? (
                              <div className="flex flex-wrap gap-1.5">
                                {u.golden_ticket == 1 && (
                                  <span className={`a-badge ${u.ticket_tier === 'silver' ? 'a-badge--silver' : 'a-badge--gold'}`}>
                                    {TICKET_TIER_LABEL[u.ticket_tier] || TICKET_TIER_LABEL.gold}
                                  </span>
                                )}
                                {u.gold_skin == 1 && <span className="a-badge a-badge--warning">Skin dorada</span>}
                                {u.ticket_burned == 1 && <span className="a-badge">Ticket usado</span>}
                              </div>
                            ) : (
                              <span className="text-white/30">—</span>
                            )}
                          </td>

                          <td className="text-right a-num">{fmt(u.games_played)}</td>

                          <td className="text-right a-num">{fmt(u.codes_redeemed)}</td>

                          <td className="a-meta whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          </td>

                          <td className="text-right">
                            {/* No handler of its own: the click bubbles to the row, which toggles. */}
                            <button
                              type="button"
                              className="a-icon-btn a-icon-btn--sm"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} el detalle de ${name}`}
                            >
                              {isExpanded ? <ChevronUpIcon className="w-4 h-4" aria-hidden /> : <ChevronDownIcon className="w-4 h-4" aria-hidden />}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={COLS} className="bg-white/[0.02]">
                              <div className="sticky left-3 max-w-[calc(100cqw-1.5rem)]">
                                {detailLoading ? (
                                  <div className="flex justify-center py-6">
                                    <div className="a-spinner a-spinner--sm" role="status" aria-label="Cargando detalle" />
                                  </div>
                                ) : userDetail ? (
                                  <div className="grid grid-cols-1 lg:grid-cols-3 py-3 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-white/10">
                                    {/* Admin controls */}
                                    <div className="min-w-0 py-5 first:pt-0 last:pb-0 lg:py-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                                      <h3 className="a-section-title text-sm mb-3">Premios</h3>
                                      <div className="space-y-2">
                                        {FLAGS.map(flag => {
                                          const on = !!userDetail.user?.[flag.key]
                                          return (
                                            <label key={flag.key} className={`flex items-center justify-between gap-4 cursor-pointer py-1 ${TAP}`}>
                                              <span className="min-w-0">
                                                <span className="block text-sm text-white/80">{flag.label}</span>
                                                <span className="block a-help mt-0.5">{flag.help}</span>
                                              </span>
                                              <button
                                                type="button"
                                                role="switch"
                                                aria-checked={on}
                                                aria-label={flag.label}
                                                onClick={() => updateUser(u.id, { [flag.key]: on ? 0 : 1 })}
                                                className="a-switch"
                                              />
                                            </label>
                                          )
                                        })}
                                        {/* Nivel del ticket: solo cuando tiene uno. Sin nivel
                                            guardado (tickets de antes) cuenta como Golden. */}
                                        {!!userDetail.user?.golden_ticket && (
                                          <label className={`flex items-center justify-between gap-4 py-1 ${TAP}`}>
                                            <span className="text-sm text-white/80">Nivel del ticket</span>
                                            <select
                                              className="a-input w-auto py-1.5"
                                              value={userDetail.user?.ticket_tier === 'silver' ? 'silver' : 'gold'}
                                              onChange={(e) => updateUser(u.id, { ticket_tier: e.target.value })}
                                            >
                                              <option value="silver">Silver (10 %)</option>
                                              <option value="gold">Golden (35 %)</option>
                                            </select>
                                          </label>
                                        )}
                                      </div>
                                      <hr className="a-divider my-5" />
                                      <dl className="space-y-3">
                                        <div>
                                          <dt className="a-kicker mb-1">Privy ID</dt>
                                          <dd className="a-code break-all">{u.privy_id}</dd>
                                        </div>
                                        {sourceLabel && (
                                          <div>
                                            <dt className="a-kicker mb-1">Cómo obtuvo el ticket</dt>
                                            <dd className="text-sm text-white/70 break-words">{sourceLabel}</dd>
                                          </div>
                                        )}
                                      </dl>
                                    </div>

                                    {/* Score history */}
                                    <div className="min-w-0 py-5 first:pt-0 last:pb-0 lg:py-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                                      <h3 className="a-section-title text-sm mb-3">Historial de puntajes</h3>
                                      {userDetail.scores?.length ? (
                                        <ul className="max-h-48 overflow-y-auto a-scroll pr-1">
                                          {userDetail.scores.map((s, i) => (
                                            <li key={i} className="grid grid-cols-3 gap-3 items-baseline py-2 text-sm border-b border-white/10 last:border-b-0">
                                              <span className={`a-num font-bold ${scoreTone(s.score)}`}>
                                                {fmt(s.score)}
                                              </span>
                                              <span className="text-white/55 truncate">{s.tier ? TIER_LABELS[s.tier] || s.tier : '—'}</span>
                                              <span className="a-meta text-right">
                                                {new Date(s.played_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="a-muted text-sm">Todavía no ha jugado.</p>
                                      )}
                                    </div>

                                    {/* Redemptions */}
                                    <div className="min-w-0 py-5 first:pt-0 last:pb-0 lg:py-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                                      <h3 className="a-section-title text-sm mb-3">Códigos canjeados</h3>
                                      {userDetail.redemptions?.length ? (
                                        <ul className="max-h-48 overflow-y-auto a-scroll pr-1">
                                          {userDetail.redemptions.map((r, i) => (
                                            <li key={i} className="grid grid-cols-3 gap-3 items-baseline py-2 text-sm border-b border-white/10 last:border-b-0">
                                              <span className="a-code text-white truncate">{r.code}</span>
                                              <span className="text-white/55 truncate">{r.label}</span>
                                              <span className="a-meta text-right">
                                                {new Date(r.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="a-muted text-sm">No ha canjeado códigos.</p>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer stats */}
            <div className="px-4 sm:px-5 py-3 border-t-2 border-white/10 a-meta">
              {fmt(total)} {Number(total) === 1 ? 'usuario' : 'usuarios'}
              {activeSearch || filter ? ' coinciden' : ' registrados'}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" aria-hidden />
              Anterior
            </button>
            <span className="a-meta">Página {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
            >
              Siguiente
              <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        )}
      </section>

      {/* Ayuda donde surge la duda (heurística 10): qué pasa al mover cada premio. */}
      <section className="a-section" aria-labelledby="users-rules-title">
        <h2 id="users-rules-title" className="a-section-title">Reglas</h2>
        <ul className="a-rules mt-4 max-w-3xl">
          {RULES.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </section>
    </div>
  )
}
