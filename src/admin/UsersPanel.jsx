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

// Filter tabs
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'golden_ticket', label: 'Golden ticket' },
  { value: 'gold_skin', label: 'Gold skin' },
  { value: 'burned', label: 'Ticket burned' },
]

// Admin-editable flags shown in the expanded row.
const FLAGS = [
  { key: 'golden_ticket', label: 'Golden ticket' },
  { key: 'gold_skin', label: 'Gold skin' },
  { key: 'ticket_burned', label: 'Ticket burned' },
]

const COLS = 7

const scoreTone = (score) =>
  score >= 3000 ? 'text-feedback-warning' :
  score >= 1000 ? 'text-white' :
  'text-white/60'

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
        setError(json.error || 'Failed to load users')
      }
    } catch (err) {
      setError(err.message)
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

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="a-title">Users</h1>
        <p className="a-subtitle">
          Privy player accounts, their rewards and game history{' '}· {Number(total || 0).toLocaleString()} registered
        </p>
      </div>

      {error && (
        <div className="a-alert a-alert--danger items-center pl-4 pr-2 py-2 mb-6" role="alert">
          <span className="flex-1 min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="a-icon-btn a-icon-btn--sm border-transparent"
            aria-label="Dismiss error"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between mb-6">
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter users">
          {FILTERS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setFilter(opt.value); setPage(1) }}
              className="a-chip"
              aria-pressed={filter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setActiveSearch(searchTerm); setPage(1); }}
          className="flex gap-2 w-full lg:w-auto"
          role="search"
        >
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <MagnifyingGlassIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search users"
              className="a-input pl-9"
            />
          </div>
          {activeSearch && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setActiveSearch(''); setPage(1); }}
              className="a-icon-btn"
              title="Clear search"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <button type="submit" className="a-btn a-btn--secondary">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="a-spinner" role="status" aria-label="Loading users" />
        </div>
      ) : users.length === 0 ? (
        <div className="a-empty flex flex-col items-center gap-3">
          <UserGroupIcon className="w-8 h-8 text-white/25" aria-hidden />
          <p>No users found.</p>
        </div>
      ) : (
        <div className="a-card overflow-hidden">
          <div className="overflow-x-auto a-scroll">
            <table className="a-table a-table--hover min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col" className="text-right">High score</th>
                  <th scope="col">Rewards</th>
                  <th scope="col" className="text-right">Games</th>
                  <th scope="col" className="text-right">Codes</th>
                  <th scope="col">Joined</th>
                  <th scope="col" className="w-12"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isExpanded = expandedUser === u.id
                  const name = u.display_name || 'Anonymous'
                  const hasFlags = u.golden_ticket == 1 || u.gold_skin == 1 || u.ticket_burned == 1

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        className={`cursor-pointer ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                        onClick={() => toggleExpand(u.id)}
                      >
                        <td className="max-w-[18rem]">
                          <div className="text-white font-semibold truncate">{name}</div>
                          <div className="truncate mt-0.5">
                            {u.email
                              ? <span className="text-[0.8125rem] text-white/55">{u.email}</span>
                              : <span className="a-code">{u.privy_id?.slice(0, 20)}</span>}
                          </div>
                        </td>

                        <td className={`text-right a-num font-bold ${scoreTone(u.high_score || 0)}`}>
                          {u.high_score || 0}
                        </td>

                        <td>
                          {hasFlags ? (
                            <div className="flex flex-wrap gap-1.5">
                              {u.golden_ticket == 1 && <span className="a-badge a-badge--gold">Golden ticket</span>}
                              {u.gold_skin == 1 && <span className="a-badge a-badge--warning">Gold skin</span>}
                              {u.ticket_burned == 1 && <span className="a-badge">Ticket burned</span>}
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        <td className="text-right a-num">{u.games_played || 0}</td>

                        <td className="text-right a-num">{u.codes_redeemed || 0}</td>

                        <td className="a-meta whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        </td>

                        <td className="text-right">
                          {/* No handler of its own: the click bubbles to the row, which toggles. */}
                          <button
                            type="button"
                            className="a-icon-btn a-icon-btn--sm"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${name}`}
                          >
                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={COLS} className="bg-white/[0.02]">
                            {detailLoading ? (
                              <div className="flex justify-center py-6">
                                <div className="a-spinner a-spinner--sm" role="status" aria-label="Loading details" />
                              </div>
                            ) : userDetail ? (
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 py-1">
                                {/* Admin controls */}
                                <div className="a-inset p-4">
                                  <h3 className="a-section-title text-sm mb-3">Flags</h3>
                                  <div className="space-y-3">
                                    {FLAGS.map(flag => {
                                      const on = !!userDetail.user?.[flag.key]
                                      return (
                                        <label key={flag.key} className="flex items-center justify-between gap-3 text-sm text-white/80 cursor-pointer">
                                          {flag.label}
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
                                  </div>
                                  <hr className="a-divider my-4" />
                                  <dl className="space-y-2">
                                    <div>
                                      <dt className="a-kicker mb-1">Privy ID</dt>
                                      <dd className="a-code break-all">{u.privy_id}</dd>
                                    </div>
                                    {userDetail.user?.ticket_source && (
                                      <div>
                                        <dt className="a-kicker mb-1">Ticket source</dt>
                                        <dd className="text-sm text-white/70 break-words">{userDetail.user.ticket_source}</dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>

                                {/* Score history */}
                                <div className="a-inset p-4">
                                  <h3 className="a-section-title text-sm mb-3">Score history</h3>
                                  {userDetail.scores?.length ? (
                                    <ul className="max-h-48 overflow-y-auto a-scroll pr-1">
                                      {userDetail.scores.map((s, i) => (
                                        <li key={i} className="grid grid-cols-3 gap-2 items-baseline py-1.5 text-sm border-b border-white/10 last:border-b-0">
                                          <span className={`a-num font-bold ${scoreTone(s.score)}`}>
                                            {s.score}
                                          </span>
                                          <span className="text-white/55 truncate">{s.tier || '—'}</span>
                                          <span className="a-meta text-right">
                                            {new Date(s.played_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="a-muted text-sm">No games played.</p>
                                  )}
                                </div>

                                {/* Redemptions */}
                                <div className="a-inset p-4">
                                  <h3 className="a-section-title text-sm mb-3">Code redemptions</h3>
                                  {userDetail.redemptions?.length ? (
                                    <ul className="max-h-48 overflow-y-auto a-scroll pr-1">
                                      {userDetail.redemptions.map((r, i) => (
                                        <li key={i} className="grid grid-cols-3 gap-2 items-baseline py-1.5 text-sm border-b border-white/10 last:border-b-0">
                                          <span className="a-code text-white truncate">{r.code}</span>
                                          <span className="text-white/55 truncate">{r.label}</span>
                                          <span className="a-meta text-right">
                                            {new Date(r.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="a-muted text-sm">No codes redeemed.</p>
                                  )}
                                </div>
                              </div>
                            ) : null}
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
          <div className="px-4 py-3 border-t-2 border-white/10 flex flex-wrap gap-x-5 gap-y-1 a-meta">
            <span>{total} total</span>
            <span>Page {page} of {totalPages}</span>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="a-btn a-btn--secondary a-btn--sm"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" aria-hidden />
            Previous
          </button>
          <span className="a-meta">Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="a-btn a-btn--secondary a-btn--sm"
          >
            Next
            <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
