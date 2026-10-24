/**
 * CodesEditor — discount codes, straight from Stripe.
 *
 * This panel used to manage the `cheat_codes` table. That system's frontend
 * was removed in April 2026, so the screen was listing codes that no longer
 * discounted anything. The codes that do are Stripe promotion codes, and
 * until now they only existed in Stripe's own dashboard.
 *
 * Why this screen is simpler than the old one: a Stripe promotion code is
 * nearly immutable. You create it and you deactivate it — there is no editing
 * the discount, and no deleting, because the redemption history belongs to
 * the code. So there is no inline edit and no delete button, and that is the
 * API's shape, not an omission.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TicketIcon, XMarkIcon } from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/shop-coupons.php`

const EMPTY_FORM = {
  code: '',
  type: 'percent',
  percent_off: 10,
  amount_off: '',
  currency: 'mxn',
  max_redemptions: '',
  expires_at: '',
}

export default function CodesEditor() {
  const [coupons, setCoupons] = useState([])
  const [testMode, setTestMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const call = useCallback(async (action, body = null) => {
    const res = await fetch(`${API}?action=${action}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.detail || json.error || 'Something went wrong')
    return json
  }, [])

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const json = await call('coupons.list')
      setCoupons(json.coupons || [])
      setTestMode(Boolean(json.test_mode))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.code.trim()) return
    try {
      setSaving(true)
      setError(null)
      const body = { code: form.code.trim().toUpperCase() }
      if (form.type === 'percent') {
        body.percent_off = Number(form.percent_off)
      } else {
        body.amount_off = Number(form.amount_off)
        body.currency = form.currency
      }
      if (form.max_redemptions) body.max_redemptions = Number(form.max_redemptions)
      if (form.expires_at) body.expires_at = form.expires_at

      await call('coupon.create', body)
      setShowForm(false)
      setForm(EMPTY_FORM)
      fetchCoupons()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (row) => {
    if (!confirm(`Deactivate "${row.code}"? It stops working immediately and cannot be turned back on. Its redemption history is kept.`)) return
    try {
      setBusyId(row.id)
      setError(null)
      await call('coupon.deactivate', { id: row.id })
      fetchCoupons()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className="w-full a-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="a-title">Discount codes</h1>
          <p className="a-subtitle">
            Buyers type these at checkout. They live in Stripe, so what you see here is what Stripe charges.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {testMode && <span className="a-badge a-badge--warning">Test mode</span>}
          <button type="button" onClick={() => setShowForm((v) => !v)} className="a-btn a-btn--primary">
            {showForm ? <XMarkIcon className="w-4 h-4" aria-hidden /> : <PlusIcon className="w-4 h-4" aria-hidden />}
            {showForm ? 'Cancel' : 'New code'}
          </button>
        </div>
      </header>

      {error && <div className="a-alert a-alert--danger mb-6">{error}</div>}

      {/* a-section, no a-card: el sistema pide un solo nivel de contenedor,
          y el divisor contra la lista lo pone `.a-section + .a-section`. */}
      {showForm && (
        <form onSubmit={handleCreate} className="a-section space-y-5">
          <h2 className="a-section-title">New code</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label htmlFor="coupon-code" className="a-label">Code</label>
              <input
                id="coupon-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="a-input"
                placeholder="VERANO25"
                aria-describedby="coupon-code-help"
                required
              />
              <p id="coupon-code-help" className="a-help mt-1.5">3–40 characters: letters, numbers, dash, underscore.</p>
            </div>

            <div>
              <label htmlFor="coupon-type" className="a-label">Discount</label>
              <select
                id="coupon-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="a-input"
              >
                <option value="percent">Percentage off</option>
                <option value="amount">Fixed amount off</option>
              </select>
            </div>

            {form.type === 'percent' ? (
              <div>
                <label htmlFor="coupon-percent" className="a-label">Percent off</label>
                <input
                  id="coupon-percent"
                  type="number"
                  min="1"
                  max="100"
                  value={form.percent_off}
                  onChange={(e) => setForm((f) => ({ ...f, percent_off: e.target.value }))}
                  className="a-input"
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <div>
                  <label htmlFor="coupon-amount" className="a-label">Amount off</label>
                  <input
                    id="coupon-amount"
                    type="number"
                    min="1"
                    step="any"
                    value={form.amount_off}
                    onChange={(e) => setForm((f) => ({ ...f, amount_off: e.target.value }))}
                    className="a-input"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="coupon-currency" className="a-label">Currency</label>
                  <select
                    id="coupon-currency"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="a-input"
                  >
                    <option value="mxn">MXN</option>
                    <option value="usd">USD</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="coupon-max" className="a-label">Max uses</label>
              <input
                id="coupon-max"
                type="number"
                min="1"
                value={form.max_redemptions}
                onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                className="a-input"
                aria-describedby="coupon-max-help"
              />
              <p id="coupon-max-help" className="a-help mt-1.5">Leave empty for unlimited.</p>
            </div>

            <div>
              <label htmlFor="coupon-expires" className="a-label">Expires</label>
              <input
                id="coupon-expires"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="a-input [color-scheme:dark]"
                aria-describedby="coupon-expires-help"
              />
              <p id="coupon-expires-help" className="a-help mt-1.5">Leave empty to never expire.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="a-btn a-btn--primary">
              {saving ? 'Creating…' : 'Create code'}
            </button>
          </div>
        </form>
      )}

      <section className="a-section space-y-4">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="a-spinner" role="status" aria-label="Loading codes" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="a-empty flex flex-col items-center gap-3">
          <TicketIcon className="w-8 h-8 text-white/25" aria-hidden />
          <p>No discount codes yet. Create the first one with New code.</p>
        </div>
      ) : (
        <div className="a-card overflow-hidden">
          <div className="overflow-x-auto a-scroll">
            <table className="a-table a-table--hover min-w-[680px]">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col" className="w-[8rem]">Discount</th>
                  <th scope="col" className="w-[6rem]">Uses</th>
                  <th scope="col" className="w-[8rem]">Expires</th>
                  <th scope="col" className="w-[6rem]">Status</th>
                  <th scope="col" className="w-[8rem]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((row) => {
                  const dim = row.active ? '' : 'opacity-50'
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className={dim}>
                          <span className="a-code text-white font-semibold">{row.code}</span>
                          <p className="a-meta mt-1">Created {fmtDate(row.created_at)}</p>
                        </div>
                      </td>
                      <td><span className={dim}>{row.discount || '—'}</span></td>
                      <td>
                        <span className={dim}>
                          {row.times_redeemed}
                          {row.max_redemptions ? ` / ${row.max_redemptions}` : ''}
                        </span>
                      </td>
                      <td><span className={`${dim} a-meta`}>{fmtDate(row.expires_at)}</span></td>
                      <td>
                        {row.active
                          ? <span className="a-badge a-badge--success">Active</span>
                          : <span className="a-badge">Off</span>}
                      </td>
                      <td>
                        {row.active && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(row)}
                            disabled={busyId === row.id}
                            className="a-btn a-btn--ghost a-btn--sm"
                          >
                            {busyId === row.id ? 'Working…' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

        <p className="a-help">
          Codes cannot be edited or deleted — that is how Stripe works. Deactivating one stops it from
          working while keeping the record of who used it.
        </p>
      </section>
    </div>
  )
}
