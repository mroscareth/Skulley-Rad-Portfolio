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

// Copy en español mexicano: estas pantallas las usan colaboradores, no solo Oscar.
const SCOPES = [
  { id: 'shop', label: 'Tienda', badge: 'a-badge--accent', help: 'Pedidos, productos (con sus fotos) y códigos de descuento. También puede ver proyectos y entradas de Memorias. No puede reembolsar ni mover dinero.' },
  { id: 'write', label: 'Todo', badge: 'a-badge--warning', help: 'La tienda, y además crear y editar proyectos y entradas de Memorias con sus fotos y videos, y publicarlos. Para ti o para alguien de toda tu confianza.' },
  { id: 'read', label: 'Solo lectura', badge: 'a-badge--info', help: 'Puede ver proyectos, entradas de Memorias y un resumen de pedidos. No cambia nada.' },
]

const RULES = [
  'Una llave por persona. Nunca compartas la misma llave entre dos personas: así sabes quién hizo qué.',
  'La llave solo se ve una vez, al crearla. Si se pierde, revócala y crea otra.',
  'Mándala por un canal privado (un mensaje directo), nunca en un grupo ni en un correo con más gente.',
  'Revocar una llave le quita el acceso al momento, también en Claude.',
  'Ninguna llave puede reembolsar, mover dinero ni crear otras llaves.',
  'Las fotos y los videos se suben con un enlace que Claude pide en el momento: vence en una hora, sirve solo para ese proyecto, producto o entrada, y deja de servir si revocas la llave.',
  'Para cambiar lo que alguien puede hacer, revoca su llave y créale una nueva.',
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
      onError?.('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }
  return (
    <button type="button" onClick={copy} className={`a-btn ${variant} shrink-0`}>
      {copied ? <CheckIcon className="w-4 h-4" aria-hidden /> : <ClipboardDocumentIcon className="w-4 h-4" aria-hidden />}
      {copied ? 'Copiado' : label}
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
    <ol className="a-steps">
      <li>
        En Claude (web, escritorio o celular) entra a <strong>Configuración → Conectores</strong>{' '}
        (<span className="a-code">Settings → Connectors</span>) y elige{' '}
        <strong>Agregar conector personalizado</strong>.
      </li>
      <li>
        Ponle de nombre <strong>mroscar.xyz</strong> y pega la URL del conector:{' '}
        <span className="a-code text-white break-all">{connectorUrl}</span>
      </li>
      <li>
        Dale a <strong>Conectar</strong>. Se abre una página de mroscar.xyz que te pide la llave: pégala ahí.
      </li>
      <li>Listo. En cualquier chat activa el conector y pídele a Claude lo que necesites: “marca el pedido SR-1008 como enviado”, “crea un código del 15%”…</li>
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
    if (!json.ok) throw new Error(json.detail || json.error || 'Algo salió mal. Intenta de nuevo.')
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
    const conn = row.connections ? ` Está conectada en Claude ${row.connections === 1 ? 'una vez' : `${row.connections} veces`} y esas conexiones también se cortan.` : ''
    if (!confirm(`¿Revocar la llave de "${row.name}"? Pierde el acceso en su siguiente petición.${conn} No se puede deshacer: para darle acceso otra vez, crea una llave nueva.`)) return
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
      return new Date(value.replace(' ', 'T')).toLocaleString('es-MX', {
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
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Llaves de acceso</h1>
          <p className="a-subtitle">
            Para que gente de confianza maneje el sitio desde Claude (sobre todo la tienda) sin entrar al CMS.
          </p>
        </div>
        <div className="a-page-head__actions">
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setCreated(null) }}
            className="a-btn a-btn--primary"
          >
            {showForm ? <XMarkIcon className="w-4 h-4" aria-hidden /> : <PlusIcon className="w-4 h-4" aria-hidden />}
            {showForm ? 'Cancelar' : 'Nueva llave'}
          </button>
        </div>
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
                <h2 id="mcp-created-title" className="a-section-title text-lg">La llave de “{created.row.name}” está lista</h2>
                <p className="a-help mt-1.5">
                  Cópiala ahora y mándasela por privado: es la única vez que se muestra. El sitio solo guarda una
                  huella de la llave, no la llave.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <CopyField id="mcp-new-key" label="Llave de acceso" value={created.token} buttonLabel="Copiar llave" primary onError={setError} />
              <CopyField id="mcp-new-url" label="URL del conector" value={connectorUrl} buttonLabel="Copiar URL" onError={setError} />
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-bold text-white mb-3">Qué hace esa persona con ella</h3>
              <ConnectSteps connectorUrl={connectorUrl} />
            </div>

            <div className="mt-7 pt-5 border-t-2 border-[var(--a-border)] flex justify-end">
              <button type="button" onClick={() => setCreated(null)} className="a-btn a-btn--secondary">Ya se la mandé</button>
            </div>
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="a-section space-y-6">
          <h2 className="a-section-title">Nueva llave</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label htmlFor="mcp-name" className="a-label">¿Para quién es?</label>
              <input
                id="mcp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="a-input"
                placeholder="Ana — tienda"
                maxLength={120}
                aria-describedby="mcp-name-help"
                required
              />
              <p id="mcp-name-help" className="a-help mt-1.5">
                Así la vas a reconocer aquí y en la bitácora de actividad.
              </p>
            </div>

            <fieldset>
              <legend className="a-label">¿Qué puede hacer?</legend>
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
              {saving ? 'Creando…' : 'Crear llave'}
            </button>
          </div>
        </form>
      )}

      <section className="a-section">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="a-spinner" role="status" aria-label="Cargando llaves" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="a-empty flex flex-col items-center gap-3">
            <KeyIcon className="w-8 h-8 text-white/25" aria-hidden />
            <p>Todavía no hay llaves. Crea una con Nueva llave y mándasela a quien va a manejar la tienda.</p>
          </div>
        ) : (
          <div className="a-card overflow-hidden">
            <div className="relative overflow-x-auto a-scroll">
              <table className="a-table a-table--hover min-w-[820px]">
                <thead>
                  <tr>
                    <th scope="col">Quién</th>
                    <th scope="col" className="w-[8rem]">Puede</th>
                    <th scope="col" className="w-[9rem]">En Claude</th>
                    <th scope="col" className="w-[11rem]">Creada</th>
                    <th scope="col" className="w-[11rem]">Último uso</th>
                    <th scope="col" className="w-[7rem]"><span className="sr-only">Acciones</span></th>
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
                              {row.hint ? <span className="a-code">{row.hint}…</span> : 'Configurada a mano en el servidor'}
                            </p>
                          </div>
                        </td>
                        <td>
                          {off
                            ? <span className="a-badge">Revocada</span>
                            : <span className={`a-badge ${scope.badge}`}>{scope.label}</span>}
                        </td>
                        <td>
                          <span className={`${dim} a-meta`}>
                            {off ? '—' : row.connections ? (row.connections === 1 ? '1 conexión' : `${row.connections} conexiones`) : 'Sin conectar'}
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
                              ? <>Revocada el {fmtDate(row.revoked_at)}</>
                              : row.last_used_at
                                ? <>{fmtDate(row.last_used_at)}{row.last_used_ip && <p className="mt-1">{row.last_used_ip}</p>}</>
                                : 'Nunca'}
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
                              {busyId === row.id ? 'Revocando…' : 'Revocar'}
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

      {/* Ayuda donde surge la duda (heurística 10): las reglas y cómo se
          conecta alguien, para cuando mandes una llave más adelante. */}
      <section className="a-section" aria-labelledby="mcp-rules-title">
        <h2 id="mcp-rules-title" className="a-section-title">Reglas</h2>
        <ul className="a-rules mt-4 max-w-3xl">
          {RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <section className="a-section" aria-labelledby="mcp-howto-title">
        <h2 id="mcp-howto-title" className="a-section-title">Cómo se conecta alguien</h2>
        <p className="a-help mt-1.5 mb-5">Mándale su llave y estos pasos. No tiene que instalar nada.</p>
        <div className="space-y-6 max-w-3xl">
          <CopyField id="mcp-url" label="URL del conector" value={connectorUrl} buttonLabel="Copiar URL" onError={setError} />
          <ConnectSteps connectorUrl={connectorUrl} />
        </div>
      </section>
    </div>
  )
}
