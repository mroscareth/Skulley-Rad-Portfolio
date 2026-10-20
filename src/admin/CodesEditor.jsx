/**
 * CodesEditor — CMS view for managing cheat / discount codes.
 * Features: inline editing, action dropdown, expandable redemption log with pagination.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  PlusIcon,
  TrashIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/codes.php`

// Available frontend actions for dropdown
const ACTIONS = [
  { value: 'none', label: 'None' },
  { value: 'goldSkin', label: 'Gold skin unlock' },
]

// Rarity tiers. Purely curatorial — drives UI color/chip, not validation or %.
const RARITIES = [
  { value: 'common',    label: 'Common' },
  { value: 'rare',      label: 'Rare' },
  { value: 'legendary', label: 'Legendary' },
]

const RARITY_BADGES = {
  common:    'a-badge',
  rare:      'a-badge a-badge--info',
  legendary: 'a-badge a-badge--gold',
}

const COLS = 6

// onBack still arrives from AdminApp, but top-level views navigate through the sidebar.
export default function CodesEditor({ onBack }) {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  // New code form
  const [form, setForm] = useState({
    code: '',
    rarity: 'common',
    label: '',
    action: 'none',
    discount_pct: 10,
    max_uses: 0,
    expires_at: '',
  })

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(API, { credentials: 'include' })
      const json = await res.json()
      if (json.ok) setCodes(json.codes || [])
      else setError(json.error)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  // ── Create ──

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.label.trim()) return
    try {
      setSaving(true)
      const body = {
        code: form.code.trim(),
        rarity: form.rarity,
        label: form.label.trim(),
        action: form.action,
        discount_pct: Number(form.discount_pct) || 10,
        max_uses: Number(form.max_uses) || 0,
        expires_at: form.expires_at || null,
      }
      const res = await fetch(API, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.ok) {
        setShowForm(false)
        setForm({ code: '', rarity: 'common', label: '', action: 'none', discount_pct: 10, max_uses: 0, expires_at: '' })
        fetchCodes()
      } else {
        setError(json.error)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ──

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditForm({
      label: row.label,
      rarity: row.rarity || 'common',
      action: row.action || 'none',
      discount_pct: row.discount_pct || 10,
      max_uses: row.max_uses ?? 0,
      expires_at: row.expires_at ? row.expires_at.replace(' ', 'T').slice(0, 16) : '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (id) => {
    try {
      setSaving(true)
      const body = {
        id,
        label: editForm.label,
        rarity: editForm.rarity,
        action: editForm.action,
        discount_pct: Number(editForm.discount_pct) || 10,
        max_uses: Number(editForm.max_uses) || 0,
        expires_at: editForm.expires_at || null,
      }
      const res = await fetch(API, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.ok) {
        setEditingId(null)
        fetchCodes()
      } else {
        setError(json.error)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle / Delete ──

  const handleToggle = async (id, active) => {
    try {
      await fetch(API, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active }),
      })
      fetchCodes()
    } catch { }
  }

  const handleDelete = async (id, code) => {
    if (!confirm(`Delete code "${code}"? This cannot be undone.`)) return
    try {
      await fetch(`${API}?id=${id}`, { method: 'DELETE', credentials: 'include' })
      fetchCodes()
    } catch { }
  }

  const isExpired = (row) => row.expires_at && new Date(row.expires_at) < new Date()
  const isExhausted = (row) => Number(row.max_uses) > 0 && Number(row.times_used) >= Number(row.max_uses)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="a-title">Codes</h1>
          <p className="a-subtitle">Activation and discount codes, with their redemption log.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={`a-btn ${showForm ? 'a-btn--secondary' : 'a-btn--primary'} self-start sm:self-auto`}
          aria-expanded={showForm}
        >
          {showForm ? <XMarkIcon className="w-4 h-4" aria-hidden /> : <PlusIcon className="w-4 h-4" aria-hidden />}
          {showForm ? 'Cancel' : 'New code'}
        </button>
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

      {/* ── New code form ── */}
      {showForm && (
        <form onSubmit={handleCreate} className="a-card a-fade-in p-5 sm:p-6 mb-6">
          <h2 className="a-section-title flex items-center gap-2 mb-5">
            <CommandLineIcon className="w-5 h-5 text-white/50" aria-hidden />
            New code
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <label htmlFor="new-code-code" className="a-label">Code</label>
              <input id="new-code-code" type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SUMMER25" className="a-input" required autoFocus />
            </div>
            <div>
              <label htmlFor="new-code-label" className="a-label">Label</label>
              <input id="new-code-label" type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Summer sale 25% off" className="a-input" required />
            </div>
            <div>
              <label htmlFor="new-code-rarity" className="a-label">Rarity</label>
              <select id="new-code-rarity" value={form.rarity} onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}
                className="a-input">
                {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-code-discount" className="a-label">Discount (%)</label>
              <input id="new-code-discount" type="number" min="1" max="100" value={form.discount_pct}
                onChange={(e) => setForm((f) => ({ ...f, discount_pct: e.target.value }))}
                className="a-input" required />
            </div>
            <div>
              <label htmlFor="new-code-action" className="a-label">Action</label>
              <select id="new-code-action" value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="a-input">
                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-code-max-uses" className="a-label">Max uses</label>
              <input id="new-code-max-uses" type="number" min="0" value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                className="a-input" aria-describedby="new-code-max-uses-help" />
              <p id="new-code-max-uses-help" className="a-help mt-1.5">0 means unlimited.</p>
            </div>
            <div>
              <label htmlFor="new-code-expires" className="a-label">Expires</label>
              <input id="new-code-expires" type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="a-input [color-scheme:dark]" aria-describedby="new-code-expires-help" />
              <p id="new-code-expires-help" className="a-help mt-1.5">Optional. Leave empty to never expire.</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button type="submit" disabled={saving} className="a-btn a-btn--primary">
              {saving ? 'Creating…' : 'Create code'}
            </button>
          </div>
        </form>
      )}

      {/* ── Codes list ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="a-spinner" role="status" aria-label="Loading codes" />
        </div>
      ) : codes.length === 0 ? (
        <div className="a-empty flex flex-col items-center gap-3">
          <CommandLineIcon className="w-8 h-8 text-white/25" aria-hidden />
          <p>No codes yet. Create the first one with New code.</p>
        </div>
      ) : (
        <div className="a-card overflow-hidden">
          <div className="overflow-x-auto a-scroll">
            <table className="a-table a-table--hover min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col" className="w-[9.5rem]">Rarity</th>
                  <th scope="col" className="w-[6.5rem]">Discount</th>
                  <th scope="col" className="w-[5.5rem]">Uses</th>
                  <th scope="col" className="w-[5rem]">Active</th>
                  <th scope="col" className="w-[8.5rem]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((row) => {
                  const expired = isExpired(row)
                  const exhausted = isExhausted(row)
                  const dimmed = !Number(row.active) || expired || exhausted
                  const isEditing = editingId === row.id
                  const isExpanded = expandedId === row.id
                  const actionLabel = ACTIONS.find((a) => a.value === (row.action || 'none'))?.label || row.action || '—'
                  const dim = dimmed && !isEditing ? 'opacity-50' : ''

                  return (
                    <React.Fragment key={row.id}>
                      <tr>
                        {/* Code + label + action */}
                        <td>
                          <div className={dim}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="a-code text-white font-semibold">{row.code}</span>
                              {expired && <span className="a-badge a-badge--warning">Expired</span>}
                              {exhausted && <span className="a-badge">Used up</span>}
                            </div>
                            {isEditing ? (
                              <input type="text" value={editForm.label} aria-label="Label"
                                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                                className="a-input text-sm px-2.5 py-1.5 mt-2" />
                            ) : (
                              <p className="text-[0.8125rem] text-white/55 mt-1 truncate max-w-[22rem]">{row.label}</p>
                            )}
                            {isEditing ? (
                              <select value={editForm.action} aria-label="Action"
                                onChange={(e) => setEditForm((f) => ({ ...f, action: e.target.value }))}
                                className="a-input text-sm px-2.5 py-1.5 mt-2">
                                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                              </select>
                            ) : (
                              row.action && row.action !== 'none' && (
                                <p className="a-meta mt-0.5">Action: {actionLabel}</p>
                              )
                            )}
                          </div>
                        </td>

                        {/* Rarity */}
                        <td>
                          {isEditing ? (
                            <select value={editForm.rarity} aria-label="Rarity"
                              onChange={(e) => setEditForm((f) => ({ ...f, rarity: e.target.value }))}
                              className="a-input text-sm px-2.5 py-1.5">
                              {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ) : row.rarity ? (
                            <span className={`${RARITY_BADGES[row.rarity] || 'a-badge'} ${dim}`}>
                              {RARITIES.find((r) => r.value === row.rarity)?.label || row.rarity}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* Discount % */}
                        <td>
                          {isEditing ? (
                            <input type="number" min="1" max="100" value={editForm.discount_pct} aria-label="Discount (%)"
                              onChange={(e) => setEditForm((f) => ({ ...f, discount_pct: e.target.value }))}
                              className="a-input text-sm px-2.5 py-1.5" placeholder="%" />
                          ) : row.discount_pct != null && row.discount_pct !== '' ? (
                            <span className={`a-num text-white ${dim}`}>{row.discount_pct}% off</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>

                        {/* Uses */}
                        <td>
                          <span className={`a-num ${dim}`}>
                            {row.times_used} / {Number(row.max_uses) === 0 ? '∞' : row.max_uses}
                          </span>
                        </td>

                        {/* Active toggle */}
                        <td>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!!Number(row.active)}
                            aria-label={`Active: ${row.code}`}
                            onClick={() => handleToggle(row.id, !!Number(row.active))}
                            className="a-switch"
                          />
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex items-center gap-1.5 justify-end">
                            {isEditing ? (
                              <>
                                <button type="button" onClick={cancelEdit} className="a-btn a-btn--ghost a-btn--sm">
                                  Cancel
                                </button>
                                <button type="button" onClick={() => saveEdit(row.id)} disabled={saving}
                                  className="a-btn a-btn--primary a-btn--sm">
                                  Save
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startEdit(row)}
                                  className="a-icon-btn a-icon-btn--sm" title="Edit" aria-label={`Edit ${row.code}`}>
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                  className="a-icon-btn a-icon-btn--sm"
                                  title="Redemptions"
                                  aria-label={`${isExpanded ? 'Hide' : 'Show'} redemptions for ${row.code}`}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                </button>
                                <button type="button" onClick={() => handleDelete(row.id, row.code)}
                                  className="a-icon-btn a-icon-btn--sm a-icon-btn--danger" title="Delete" aria-label={`Delete ${row.code}`}>
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Edit extras: max uses + expiry */}
                      {isEditing && (
                        <tr>
                          <td colSpan={COLS} className="bg-white/[0.02]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                              <div>
                                <label htmlFor={`edit-max-uses-${row.id}`} className="a-label">Max uses</label>
                                <input id={`edit-max-uses-${row.id}`} type="number" min="0" value={editForm.max_uses}
                                  onChange={(e) => setEditForm((f) => ({ ...f, max_uses: e.target.value }))}
                                  className="a-input text-sm px-2.5 py-1.5" />
                                <p className="a-help mt-1">0 means unlimited.</p>
                              </div>
                              <div>
                                <label htmlFor={`edit-expires-${row.id}`} className="a-label">Expires</label>
                                <input id={`edit-expires-${row.id}`} type="datetime-local" value={editForm.expires_at}
                                  onChange={(e) => setEditForm((f) => ({ ...f, expires_at: e.target.value }))}
                                  className="a-input text-sm px-2.5 py-1.5 [color-scheme:dark]" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {isExpanded && (
                        <tr>
                          <td colSpan={COLS} className="bg-white/[0.02]">
                            <RedemptionLog codeId={row.id} />
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
            <span>{codes.length} total</span>
            <span>{codes.filter((c) => Number(c.active) && !isExpired(c) && !isExhausted(c)).length} active</span>
            <span>{codes.reduce((s, c) => s + Number(c.times_used), 0)} redeemed</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Redemption Log (paginated sub-component) ──────────────

function RedemptionLog({ codeId }) {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(async (p) => {
    try {
      setLoading(true)
      const res = await fetch(`${API}?action=redemptions&code_id=${codeId}&page=${p}`, { credentials: 'include' })
      const json = await res.json()
      if (json.ok) {
        setRows(json.redemptions || [])
        setPage(json.page)
        setTotalPages(json.total_pages)
        setTotal(json.total)
      }
    } catch { }
    finally { setLoading(false) }
  }, [codeId])

  useEffect(() => { fetchPage(1) }, [fetchPage])

  return (
    <div className="a-inset p-4">
      <h3 className="a-section-title text-sm flex items-baseline gap-2 mb-3">
        Redemptions
        <span className="a-meta">{total}</span>
      </h3>

      {loading ? (
        <div className="py-3">
          <div className="a-spinner a-spinner--sm" role="status" aria-label="Loading redemptions" />
        </div>
      ) : rows.length === 0 ? (
        <p className="a-muted text-sm py-1">No redemptions yet.</p>
      ) : (
        <>
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">User</th>
                <th scope="col">IP</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-white max-w-[16rem] truncate">{r.email}</td>
                  <td className="max-w-[12rem] truncate">
                    {r.user_id ? (r.user_display_name || r.user_email || 'Profile #' + r.user_id) : <span className="text-white/30">—</span>}
                  </td>
                  <td>{r.ip_address ? <span className="a-code">{r.ip_address}</span> : '—'}</td>
                  <td className="a-meta whitespace-nowrap">
                    {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1}
                className="a-btn a-btn--secondary a-btn--sm"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" aria-hidden />
                Previous
              </button>
              <span className="a-meta">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages}
                className="a-btn a-btn--secondary a-btn--sm"
              >
                Next
                <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
