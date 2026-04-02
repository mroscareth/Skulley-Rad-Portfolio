/**
 * UsersPanel — Terminal-style CMS view for managing registered user profiles.
 * Follows the same CRT admin design as CodesEditor and ContactInbox.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/profile.php`

// Filter tabs
const FILTERS = [
  { value: '', label: 'ALL' },
  { value: 'golden_ticket', label: '🎫 TICKET' },
  { value: 'gold_skin', label: '✨ SKIN' },
  { value: 'burned', label: '🔥 BURNED' },
]

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
    <div className="w-full admin-terminal-font">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="admin-section-title text-lg">USER_PROFILES</h1>
        <span className="text-blue-500/40 text-xs">{total} registered</span>
      </div>
      <p className="admin-comment mb-6">manage privy users, rewards, and game history</p>

      {/* Error banner */}
      {error && (
        <div className="admin-error rounded px-4 py-2 mb-4 text-xs">
          &gt; ERROR: {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Filter tabs and search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex-1 flex gap-1 flex-wrap">
          {FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(1) }}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                filter === opt.value
                  ? 'admin-btn-primary'
                  : 'admin-btn-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setActiveSearch(searchTerm); setPage(1); }} className="flex gap-2">
            <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="search user..." 
                className="admin-input px-3 py-1.5 rounded text-xs w-full sm:w-64"
            />
            {activeSearch && (
                <button 
                  type="button" 
                  onClick={() => { setSearchTerm(''); setActiveSearch(''); setPage(1); }}
                  className="admin-btn-secondary px-3 py-1.5 rounded text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10"
                  title="Clear search"
                >
                  ✕
                </button>
            )}
            <button type="submit" className="admin-btn-primary px-4 py-1.5 rounded text-xs flex items-center justify-center min-w-[50px]">
                &gt;_
            </button>
        </form>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-blue-400/70 text-xs">&gt; loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="admin-card rounded-lg p-8 text-center">
          <UserGroupIcon className="w-10 h-10 text-blue-500/30 mx-auto mb-3" />
          <p className="text-blue-400/60 text-sm">No users found.</p>
        </div>
      ) : (
        <div className="admin-card rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_70px_50px_50px_50px_50px_50px_80px] gap-2 px-4 py-2 text-xs text-blue-500/50 border-b"
            style={{ borderColor: 'rgba(59,130,246,0.15)' }}>
            <span>USER</span>
            <span className="text-center">SCORE</span>
            <span className="text-center">🎫</span>
            <span className="text-center">✨</span>
            <span className="text-center">🔥</span>
            <span className="text-center">GAMES</span>
            <span className="text-center">CODES</span>
            <span>DATE</span>
          </div>

          {/* Rows */}
          {users.map((u) => {
            const isExpanded = expandedUser === u.id

            return (
              <React.Fragment key={u.id}>
                {/* Main row */}
                <div
                  className={`grid grid-cols-[1fr_70px_50px_50px_50px_50px_50px_80px] gap-2 px-4 py-3 items-center text-xs border-b transition-colors hover:bg-blue-500/5 cursor-pointer ${isExpanded ? 'bg-blue-500/[0.03]' : ''}`}
                  style={{ borderColor: 'rgba(59,130,246,0.08)' }}
                  onClick={() => toggleExpand(u.id)}
                >
                  {/* User info */}
                  <div className="min-w-0">
                    <span className="text-blue-300 font-bold">{u.display_name || 'anonymous'}</span>
                    <p className="text-blue-500/40 text-[10px] mt-0.5 truncate">{u.email || u.privy_id?.slice(0, 20)}</p>
                  </div>

                  {/* High score */}
                  <span className={`text-center font-mono font-bold ${
                    (u.high_score || 0) >= 3000 ? 'text-amber-400' :
                    (u.high_score || 0) >= 1000 ? 'text-yellow-400/80' :
                    'text-blue-400/70'
                  }`}>
                    {u.high_score || 0}
                  </span>

                  {/* Ticket */}
                  <span className="text-center">
                    {u.golden_ticket == 1
                      ? <span className="text-amber-400">✓</span>
                      : <span className="text-blue-500/20">—</span>}
                  </span>

                  {/* Skin */}
                  <span className="text-center">
                    {u.gold_skin == 1
                      ? <span className="text-yellow-400">✓</span>
                      : <span className="text-blue-500/20">—</span>}
                  </span>

                  {/* Burned */}
                  <span className="text-center">
                    {u.ticket_burned == 1
                      ? <span className="text-red-400">✓</span>
                      : <span className="text-blue-500/20">—</span>}
                  </span>

                  {/* Games */}
                  <span className="text-center text-blue-400/70">{u.games_played || 0}</span>

                  {/* Codes */}
                  <span className="text-center text-blue-400/70">{u.codes_redeemed || 0}</span>

                  {/* Date */}
                  <span className="text-blue-500/40 text-[10px]">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                  </span>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div className="px-4 py-4 border-b" style={{ background: 'rgba(0,10,30,0.3)', borderColor: 'rgba(59,130,246,0.1)' }}>
                    {detailLoading ? (
                      <p className="text-blue-400/40 text-[10px] text-center py-4">&gt; loading details...</p>
                    ) : userDetail ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Admin controls */}
                        <div>
                          <p className="text-blue-500/50 text-[10px] mb-3">&gt; ADMIN_FLAGS</p>
                          <div className="space-y-2">
                            {[
                              { key: 'golden_ticket', label: '🎫 golden_ticket', color: 'accent-amber-400' },
                              { key: 'gold_skin', label: '✨ gold_skin', color: 'accent-yellow-400' },
                              { key: 'ticket_burned', label: '🔥 ticket_burned', color: 'accent-red-400' },
                            ].map(flag => (
                              <label key={flag.key} className="flex items-center gap-2 text-[11px] text-blue-300/70 cursor-pointer hover:text-blue-200 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={!!userDetail.user?.[flag.key]}
                                  onChange={(e) => updateUser(u.id, { [flag.key]: e.target.checked ? 1 : 0 })}
                                  className={flag.color}
                                />
                                {flag.label}
                              </label>
                            ))}
                          </div>
                          <p className="text-blue-500/30 text-[9px] mt-3 break-all">privy: {u.privy_id}</p>
                          {userDetail.user?.ticket_source && (
                            <p className="text-blue-500/30 text-[9px]">source: {userDetail.user.ticket_source}</p>
                          )}
                        </div>

                        {/* Score history */}
                        <div>
                          <p className="text-blue-500/50 text-[10px] mb-3">&gt; SCORE_HISTORY</p>
                          {userDetail.scores?.length ? (
                            <div className="max-h-40 overflow-y-auto admin-scroll space-y-1">
                              {userDetail.scores.map((s, i) => (
                                <div key={i} className="grid grid-cols-3 text-[10px] px-2 py-1 rounded hover:bg-blue-500/5 transition-colors"
                                  style={{ borderBottom: '1px solid rgba(59,130,246,0.05)' }}>
                                  <span className={`font-mono font-bold ${
                                    s.score >= 3000 ? 'text-amber-400' :
                                    s.score >= 1000 ? 'text-yellow-400/80' :
                                    'text-blue-400/70'
                                  }`}>
                                    {s.score}
                                  </span>
                                  <span className="text-blue-500/40">{s.tier || '—'}</span>
                                  <span className="text-blue-500/30">
                                    {new Date(s.played_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-blue-500/30 text-[10px]">no games played</p>
                          )}
                        </div>

                        {/* Redemptions */}
                        <div>
                          <p className="text-blue-500/50 text-[10px] mb-3">&gt; CODE_REDEMPTIONS</p>
                          {userDetail.redemptions?.length ? (
                            <div className="max-h-40 overflow-y-auto admin-scroll space-y-1">
                              {userDetail.redemptions.map((r, i) => (
                                <div key={i} className="grid grid-cols-3 text-[10px] px-2 py-1 rounded hover:bg-blue-500/5 transition-colors"
                                  style={{ borderBottom: '1px solid rgba(59,130,246,0.05)' }}>
                                  <span className="text-green-400/80 font-mono">{r.code}</span>
                                  <span className="text-blue-400/50 truncate">{r.label}</span>
                                  <span className="text-blue-500/30">
                                    {new Date(r.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-blue-500/30 text-[10px]">no codes redeemed</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </React.Fragment>
            )
          })}

          {/* Footer stats */}
          <div className="px-4 py-2 text-[10px] text-blue-500/40 flex gap-4"
            style={{ borderTop: '1px solid rgba(59,130,246,0.1)' }}>
            <span>total: {total}</span>
            <span>page: {page}/{totalPages}</span>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-[10px]">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`px-2 py-1 rounded admin-btn-secondary ${page <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            &lt; prev
          </button>
          <span className="text-blue-500/50">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-2 py-1 rounded admin-btn-secondary ${page >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            next &gt;
          </button>
        </div>
      )}
    </div>
  )
}
