/**
 * CodesEditor — Terminal-style CMS view for managing cheat / discount codes.
 * Features: inline editing, action dropdown, expandable redemption log with pagination.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  PlusIcon,
  TrashIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/codes.php`

// Available frontend actions for dropdown
const ACTIONS = [
  { value: 'none', label: '— None —' },
  { value: 'goldSkin', label: '✨ Gold Skin Unlock' },
]

// Rarity tiers. Purely curatorial — drives UI color/chip, not validation or %.
const RARITIES = [
  { value: 'common',    label: '⚪ Common' },
  { value: 'rare',      label: '🔵 Rare' },
  { value: 'legendary', label: '🟡 Legendary' },
]

const RARITY_COLORS = {
  common:    'text-slate-300',
  rare:      'text-blue-300',
  legendary: 'text-yellow-300',
}

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
    <div className="w-full admin-terminal-font">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="admin-section-title text-lg">CHEAT_CODES</h1>
        {onBack && (
          <button onClick={onBack} className="admin-btn-secondary text-xs px-3 py-1.5 rounded">&lt; back</button>
        )}
      </div>
      <p className="admin-comment mb-6">manage activation codes, discounts, and redemption log</p>

      {/* Error banner */}
      {error && (
        <div className="admin-error rounded px-4 py-2 mb-4 text-xs">
          &gt; ERROR: {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Create button */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="admin-btn-primary flex items-center gap-2 px-4 py-2 rounded text-xs mb-6"
      >
        <PlusIcon className="w-4 h-4" />
        {showForm ? 'CANCEL' : 'NEW_CODE'}
      </button>

      {/* ── New code form ── */}
      {showForm && (
        <form onSubmit={handleCreate} className="admin-card rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">code</label>
              <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SUMMER25" className="admin-input w-full rounded px-3 py-2 text-sm" required autoFocus />
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">label</label>
              <input type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Summer Sale 25% Off" className="admin-input w-full rounded px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">rarity</label>
              <select value={form.rarity} onChange={(e) => setForm((f) => ({ ...f, rarity: e.target.value }))}
                className="admin-input w-full rounded px-3 py-2 text-sm">
                {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">discount %</label>
              <input type="number" min="1" max="100" value={form.discount_pct}
                onChange={(e) => setForm((f) => ({ ...f, discount_pct: e.target.value }))}
                className="admin-input w-full rounded px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">action</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="admin-input w-full rounded px-3 py-2 text-sm">
                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">max uses <span className="text-blue-500/40">(0 = unlimited)</span></label>
              <input type="number" min="0" value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                className="admin-input w-full rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-blue-400/70 mb-1">expires at <span className="text-blue-500/40">(optional)</span></label>
              <input type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="admin-input w-full rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="admin-btn-primary px-5 py-2 rounded text-xs mt-2">
            {saving ? '> CREATING...' : '> CREATE_CODE'}
          </button>
        </form>
      )}

      {/* ── Codes list ── */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-blue-400/70 text-xs">&gt; loading codes...</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="admin-card rounded-lg p-8 text-center">
          <CommandLineIcon className="w-10 h-10 text-blue-500/30 mx-auto mb-3" />
          <p className="text-blue-400/60 text-sm">No codes yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="admin-card rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_70px_50px_70px] sm:grid-cols-[1fr_140px_90px_60px_80px] gap-2 px-4 py-2 text-xs text-blue-500/50 border-b"
            style={{ borderColor: 'rgba(59,130,246,0.15)' }}>
            <span>CODE</span>
            <span>RARITY / %</span>
            <span>USES</span>
            <span>ON</span>
            <span></span>
          </div>

          {/* Rows */}
          {codes.map((row) => {
            const expired = isExpired(row)
            const exhausted = isExhausted(row)
            const dimmed = !Number(row.active) || expired || exhausted
            const isEditing = editingId === row.id
            const isExpanded = expandedId === row.id
            const actionLabel = ACTIONS.find((a) => a.value === (row.action || 'none'))?.label || row.action || '—'

            return (
              <React.Fragment key={row.id}>
                {/* Main row */}
                <div
                  className={`grid grid-cols-[1fr_110px_70px_50px_70px] sm:grid-cols-[1fr_140px_90px_60px_80px] gap-2 px-4 py-3 items-center text-xs border-b transition-colors hover:bg-blue-500/5 ${dimmed ? 'opacity-50' : ''}`}
                  style={{ borderColor: 'rgba(59,130,246,0.08)' }}
                >
                  {/* Code + label */}
                  <div className="min-w-0">
                    <span className="text-blue-300 font-bold">{row.code}</span>
                    {isEditing ? (
                      <input type="text" value={editForm.label}
                        onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                        className="admin-input w-full rounded px-2 py-1 text-[11px] mt-1" />
                    ) : (
                      <p className="text-blue-500/40 text-[10px] mt-0.5 truncate">{row.label}</p>
                    )}
                    {isEditing ? (
                      <select value={editForm.action}
                        onChange={(e) => setEditForm((f) => ({ ...f, action: e.target.value }))}
                        className="admin-input w-full rounded px-2 py-1 text-[10px] mt-1">
                        {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    ) : (
                      row.action && <p className="text-cyan-400/40 text-[10px]">→ {actionLabel}</p>
                    )}
                  </div>

                  {/* Rarity + discount % */}
                  <div>
                    {isEditing ? (
                      <>
                        <select value={editForm.rarity}
                          onChange={(e) => setEditForm((f) => ({ ...f, rarity: e.target.value }))}
                          className="admin-input w-full rounded px-2 py-1 text-[10px]">
                          {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <input type="number" min="1" max="100" value={editForm.discount_pct}
                          onChange={(e) => setEditForm((f) => ({ ...f, discount_pct: e.target.value }))}
                          className="admin-input w-full rounded px-2 py-1 text-[10px] mt-1" placeholder="%" />
                      </>
                    ) : (
                      <div className="flex flex-col">
                        <span className={`${RARITY_COLORS[row.rarity] || 'text-slate-300'} text-[11px] uppercase tracking-wider`}>
                          {RARITIES.find((r) => r.value === row.rarity)?.label || row.rarity}
                        </span>
                        <span className="text-green-400/80 text-[11px]">{row.discount_pct}% off</span>
                      </div>
                    )}
                  </div>

                  {/* Uses */}
                  <span className="text-blue-400/70">
                    {row.times_used}/{Number(row.max_uses) === 0 ? '∞' : row.max_uses}
                  </span>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggle(row.id, !!Number(row.active))}
                    className={`w-10 h-5 rounded-full flex items-center transition-colors ${Number(row.active) ? 'bg-blue-500/40 justify-end' : 'bg-blue-900/40 justify-start'}`}
                  >
                    <span className={`w-4 h-4 rounded-full mx-0.5 transition-colors ${Number(row.active) ? 'bg-blue-400' : 'bg-blue-700'}`} />
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(row.id)} disabled={saving}
                          className="text-green-400 hover:text-green-300 p-1" title="Save">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="text-blue-400 hover:text-blue-300 p-1" title="Cancel">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(row)} className="text-blue-500/40 hover:text-blue-400 p-1" title="Edit">
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          className="text-blue-500/40 hover:text-blue-400 p-1" title="Redemptions"
                        >
                          {isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDelete(row.id, row.code)}
                          className="text-red-500/40 hover:text-red-400 p-1" title="Delete">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit extras: max_uses + expires */}
                {isEditing && (
                  <div className="px-4 py-2 grid grid-cols-2 gap-3 text-[10px]" style={{ background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid rgba(59,130,246,0.08)' }}>
                    <div>
                      <label className="text-blue-500/50 block mb-1">max uses (0=∞)</label>
                      <input type="number" min="0" value={editForm.max_uses}
                        onChange={(e) => setEditForm((f) => ({ ...f, max_uses: e.target.value }))}
                        className="admin-input w-full rounded px-2 py-1 text-[10px]" />
                    </div>
                    <div>
                      <label className="text-blue-500/50 block mb-1">expires at</label>
                      <input type="datetime-local" value={editForm.expires_at}
                        onChange={(e) => setEditForm((f) => ({ ...f, expires_at: e.target.value }))}
                        className="admin-input w-full rounded px-2 py-1 text-[10px]" />
                    </div>
                  </div>
                )}

                {/* Expandable redemption log */}
                {isExpanded && <RedemptionLog codeId={row.id} />}
              </React.Fragment>
            )
          })}

          {/* Footer stats */}
          <div className="px-4 py-2 text-[10px] text-blue-500/40 flex gap-4"
            style={{ borderTop: '1px solid rgba(59,130,246,0.1)' }}>
            <span>total: {codes.length}</span>
            <span>active: {codes.filter((c) => Number(c.active) && !isExpired(c) && !isExhausted(c)).length}</span>
            <span>redeemed: {codes.reduce((s, c) => s + Number(c.times_used), 0)}</span>
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
    <div className="px-4 py-3" style={{ background: 'rgba(0,10,30,0.3)', borderBottom: '1px solid rgba(59,130,246,0.1)' }}>
      <p className="text-[10px] text-blue-500/50 mb-2">
        &gt; REDEMPTION_LOG ({total} total)
      </p>

      {loading ? (
        <p className="text-[10px] text-blue-400/40 py-2">&gt; loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-[10px] text-blue-400/30 py-2">No redemptions yet.</p>
      ) : (
        <>
          {/* Log header */}
          <div className="grid grid-cols-[1fr_0.8fr_0.7fr_100px] gap-2 text-[9px] text-blue-500/40 mb-1 px-1">
            <span>EMAIL</span>
            <span>USER</span>
            <span>IP</span>
            <span>DATE</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_0.8fr_0.7fr_100px] gap-2 text-[10px] px-1 py-1 hover:bg-blue-500/5 rounded transition-colors">
              <span className="text-blue-300 truncate">{r.email}</span>
              <span className="text-cyan-400/60 truncate">
                {r.user_id ? `👤 ${r.user_display_name || r.user_email || 'Profile #' + r.user_id}` : <span className="text-blue-500/30">—</span>}
              </span>
              <span className="text-blue-500/40 truncate">{r.ip_address || '—'}</span>
              <span className="text-blue-500/40">
                {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3 text-[10px]">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1}
                className={`px-2 py-1 rounded admin-btn-secondary ${page <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                &lt; prev
              </button>
              <span className="text-blue-500/50">{page} / {totalPages}</span>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages}
                className={`px-2 py-1 rounded admin-btn-secondary ${page >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                next &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
