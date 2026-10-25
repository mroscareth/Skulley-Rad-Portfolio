/**
 * McpTokensPanel — access keys for the site's Claude connector.
 *
 * The site runs a remote MCP server at /mcp. A collaborator adds it in Claude
 * as a custom connector, Claude opens the site's own authorization page, and
 * they paste the key created here. From then on they manage the site (the
 * store, mostly) by talking to Claude. Each person gets their own key so it can
 * be revoked on its own, and the activity log (private/mcp.log) says which key
 * did what. Revoking a key also ends every Claude connection made with it.
 *
 * Shape of the screen follows the API (mcp-tokens.php): create and revoke,
 * no edit, no delete. A key is never reused for someone else — revoke it and
 * make a new one — and a revoked row stays so the log keeps its name.
 *
 * The key is shown exactly once, right after it is created. The server only
 * keeps a hash, so there is no "show it again".
 */

import React, { useState, useEffect, useCallback } from 'react'
import { PlusIcon, XMarkIcon, KeyIcon, ClipboardDocumentIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

const API = `${import.meta.env.VITE_API_URL || ''}/api/mcp-tokens.php`

const SCOPES = [
  { id: 'shop', label: 'Store', badge: 'a-badge--accent', help: 'Orders, products and discount codes. Can also read projects and posts. Cannot refund or move money.' },
  { id: 'write', label: 'Everything', badge: 'a-badge--warning', help: 'The store, plus creating and editing projects and Memories posts, and publishing posts. For you, or someone you fully trust.' },
  { id: 'read', label: 'Read only', badge: 'a-badge--info', help: 'Can look at projects, posts and an order summary. Changes nothing.' },
]
const scopeOf = (id) => SCOPES.find((s) => s.id === id) || SCOPES[2]

const EMPTY_FORM = { name: '', scope: 'shop' }

/** Copy button with its own "Copied" confirmation. */
function CopyButton({ text, label, variant = 'a-btn--secondary', onError }) {
  const [copied, setCopied] = useState(false)
  const copy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onError?.('Could not copy. Select the text and copy it by hand.')
    }
  }
  return (
    <button type="button" onClick={copy} className={`a-btn ${variant} shrink-0`}>
      {copied ? <CheckIcon className="w-4 h-4" aria-hidden /> : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/** A value to copy, in its own well: the key, the connector URL. */
function CopyField({ id, label, value, buttonLabel, primary = false, onError }) {
  return (
    <div>
      <span id={id} className="a-label">{label}</span>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <code
          aria-labelledby={id}
          className="a-code block flex-1 min-w-0 break-all select-all text-white text-sm leading-relaxed rounded-[var(--a-radius-sm)] bg-[var(--a-bg)] border-2 border-[var(--a-border)] px-4 py-3"
        >
          {value}
        </code>
        <CopyButton text={value} label={buttonLabel} variant={primary ? 'a-btn--primary' : 'a-btn--secondary'} onError={onError} />
      </div>
    </div>
  )
}

/** The steps a collaborator follows in Claude. Used after creating a key and in the help section. */
function ConnectSteps({ connectorUrl }) {
  return (
    <ol className="space-y-3 pl-5 list-decimal text-sm text-[var(--a-text-2)] leading-relaxed marker:text-[var(--a-text-3)]">
      <li>
        In Claude (web, desktop or phone), open <strong className="text-white">Settings → Connectors</strong> and choose{' '}
        <strong className="text-white">Add custom connector</strong>.
      </li>
      <li>
        Name it <strong className="text-white">mroscar.xyz</strong> and paste the connector URL:{' '}
        <span className="a-code text-white break-all">{connectorUrl}</span>
      </li>
      <li>
        Press <strong className="text-white">Connect</strong>. A mroscar.xyz page opens and asks for the key — paste it there.
      </li>
      <li>Done. In any chat, turn the connector on and ask Claude for what you need: “mark order SR-1008 as shipped”, “create a 15% code”…</li>
    </ol>
  )
}

export default function McpTokensPanel() {
  const [tokens, setTokens] = useState([])
  const [connectorUrl, setConnectorUrl] = useState('https://mroscar.xyz/mcp')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [created, setCreated] = useState(null) // { token, row } — shown once

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

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const json = await call('list')
      setTokens(json.tokens || [])
      if (json.connector_url) setConnectorUrl(json.connector_url)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      setSaving(true)
      setError(null)
      const json = await call('create', { name: form.name.trim(), scope: form.scope })
      setCreated({ token: json.token, row: json.row })
      setShowForm(false)
      setForm(EMPTY_FORM)
      fetchTokens()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (row) => {
    const conn = row.connections ? ` It is connected in Claude ${row.connections === 1 ? 'once' : `${row.connections} times`}; those connections stop too.` : ''
    if (!confirm(`Revoke "${row.name}"? Whoever uses it loses access on their next request.${conn} This cannot be undone — to give access again, create a new key.`)) return
    try {
      setBusyId(row.id)
      setError(null)
      await call('revoke', { id: row.id })
      fetchTokens()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const fmtDate = (value) => {
    if (!value) return null
    try {
      return new Date(value.replace(' ', 'T')).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return value
    }
  }

  const active = tokens.filter((t) => !t.revoked_at)
  const revoked = tokens.filter((t) => t.revoked_at)

  return (
    <div className="w-full a-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="a-title">Access keys</h1>
          <p className="a-subtitle">
            Let trusted people run the site from Claude — the store, mostly — without the CMS. One key per person.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setCreated(null) }}
          className="a-btn a-btn--primary self-start sm:self-auto"
        >
          {showForm ? <XMarkIcon className="w-4 h-4" aria-hidden /> : <PlusIcon className="w-4 h-4" aria-hidden />}
          {showForm ? 'Cancel' : 'New key'}
        </button>
      </header>

      {error && <div className="a-alert a-alert--danger mb-6" role="alert">{error}</div>}

      {/* Shown once. The server keeps only a hash: leaving this screen loses it.
          One box at page level (a-inset), never inside another (§15.1.7). */}
      {created && (
        <section className="a-section" aria-labelledby="mcp-created-title">
          <div className="a-inset border-[rgba(34,197,94,0.45)] p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 shrink-0 text-[var(--a-success)]" aria-hidden />
              <div className="min-w-0">
                <h2 id="mcp-created-title" className="a-section-title text-lg">Key for “{created.row.name}” is ready</h2>
                <p className="a-help mt-1.5">
                  Copy it now and send it to them privately: this is the only time it is shown. The site keeps a
                  fingerprint of it, not the key.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <CopyField id="mcp-new-key" label="Access key" value={created.token} buttonLabel="Copy key" primary onError={setError} />
              <CopyField id="mcp-new-url" label="Connector URL" value={connectorUrl} buttonLabel="Copy URL" onError={setError} />
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-bold text-white mb-3">What they do with it</h3>
              <ConnectSteps connectorUrl={connectorUrl} />
            </div>

            <div className="mt-7 pt-5 border-t-2 border-[var(--a-border)] flex justify-end">
              <button type="button" onClick={() => setCreated(null)} className="a-btn a-btn--secondary">I sent it</button>
            </div>
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="a-section space-y-6">
          <h2 className="a-section-title">New key</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label htmlFor="mcp-name" className="a-label">Who is it for</label>
              <input
                id="mcp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="a-input"
                placeholder="Ana — store"
                maxLength={120}
                aria-describedby="mcp-name-help"
                required
              />
              <p id="mcp-name-help" className="a-help mt-1.5">
                How you will recognize it here and in the activity log.
              </p>
            </div>

            <fieldset>
              <legend className="a-label">What they can do</legend>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={form.scope === s.id}
                    onClick={() => setForm((f) => ({ ...f, scope: s.id }))}
                    className="a-chip"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="a-help mt-1.5">{scopeOf(form.scope).help}</p>
            </fieldset>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving || !form.name.trim()} className="a-btn a-btn--primary">
              {saving ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </form>
      )}

      <section className="a-section">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="a-spinner" role="status" aria-label="Loading keys" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="a-empty flex flex-col items-center gap-3">
            <KeyIcon className="w-8 h-8 text-white/25" aria-hidden />
            <p>No keys yet. Create one with New key and send it to the person who will run the store.</p>
          </div>
        ) : (
          <div className="a-card overflow-hidden">
            <div className="overflow-x-auto a-scroll">
              <table className="a-table a-table--hover min-w-[820px]">
                <thead>
                  <tr>
                    <th scope="col">Who</th>
                    <th scope="col" className="w-[8rem]">Can do</th>
                    <th scope="col" className="w-[8rem]">In Claude</th>
                    <th scope="col" className="w-[11rem]">Created</th>
                    <th scope="col" className="w-[11rem]">Last used</th>
                    <th scope="col" className="w-[7rem]"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[...active, ...revoked].map((row) => {
                    const off = Boolean(row.revoked_at)
                    const dim = off ? 'opacity-50' : ''
                    const scope = scopeOf(row.scope)
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={`${dim} py-1`}>
                            <span className="text-white font-semibold">{row.name}</span>
                            <p className="a-meta mt-1">
                              {row.hint ? <span className="a-code">{row.hint}…</span> : 'Set up by hand on the server'}
                            </p>
                          </div>
                        </td>
                        <td>
                          {off
                            ? <span className="a-badge">Revoked</span>
                            : <span className={`a-badge ${scope.badge}`}>{scope.label}</span>}
                        </td>
                        <td>
                          <span className={`${dim} a-meta`}>
                            {off ? '—' : row.connections ? `${row.connections} connected` : 'Not connected'}
                          </span>
                        </td>
                        <td>
                          <div className={`${dim} a-meta`}>
                            {fmtDate(row.created_at)}
                            {row.created_by && <p className="mt-1 truncate max-w-[11rem]">{row.created_by}</p>}
                          </div>
                        </td>
                        <td>
                          <div className={`${dim} a-meta`}>
                            {off
                              ? <>Revoked {fmtDate(row.revoked_at)}</>
                              : row.last_used_at
                                ? <>{fmtDate(row.last_used_at)}{row.last_used_ip && <p className="mt-1">{row.last_used_ip}</p>}</>
                                : 'Never'}
                          </div>
                        </td>
                        <td>
                          {!off && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(row)}
                              disabled={busyId === row.id}
                              className="a-btn a-btn--danger a-btn--sm"
                            >
                              {busyId === row.id ? 'Revoking…' : 'Revoke'}
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
      </section>

      {/* Help where the question comes up (heuristic 10): how a key becomes a
          working connector, for when you send one to someone later. */}
      <section className="a-section" aria-labelledby="mcp-howto-title">
        <h2 id="mcp-howto-title" className="a-section-title">How someone connects</h2>
        <p className="a-help mt-1.5 mb-5">Send them their key and these steps. Nothing to install.</p>
        <div className="space-y-6 max-w-3xl">
          <CopyField id="mcp-url" label="Connector URL" value={connectorUrl} buttonLabel="Copy URL" onError={setError} />
          <ConnectSteps connectorUrl={connectorUrl} />
          <p className="a-help">
            Keys can never refund orders, move money or create other keys. Revoking one cuts every Claude connected
            with it on its next request. To change what someone can do, revoke their key and create a new one.
          </p>
        </div>
      </section>
    </div>
  )
}
