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

import React, { useState, useEffect, useCallback, useId } from 'react'
import { PlusIcon, TicketIcon, XMarkIcon, XCircleIcon } from '@heroicons/react/24/solid'

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

// Códigos de error de shop-coupons.php → frase para humanos. Lo que no esté
// aquí se muestra tal cual llega (el backend ya manda su detalle en español).
const ERROR_MESSAGES = {
  stripe_not_configured: 'Faltan las llaves de Stripe, así que aquí no se pueden ver ni crear códigos.',
  stripe_error: 'Stripe rechazó la solicitud.',
  invalid_code: 'El código debe tener de 3 a 40 caracteres: letras, números, guion o guion bajo.',
  invalid_percent: 'El porcentaje debe ser de 1 a 100.',
  invalid_amount: 'El monto debe ser mayor que 0.',
  invalid_currency: 'La moneda debe ser MXN o USD.',
  missing_discount: 'Elige un porcentaje o un monto fijo.',
  invalid_expiry: 'La fecha de vencimiento tiene que ser en el futuro.',
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento y vuelve a intentar.',
  server_error: 'Algo falló en el servidor. Intenta de nuevo.',
}

function errorText(e) {
  // Respuesta que no es JSON (error de PHP) o sin conexión: el mensaje del
  // navegador viene en inglés y no le dice nada a nadie.
  if (e?.name === 'SyntaxError') return 'El servidor no respondió bien. Intenta de nuevo.'
  if (e?.name === 'TypeError') return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'
  const base = ERROR_MESSAGES[e?.code]
  if (!base) return e?.message || 'Algo salió mal. Intenta de nuevo.'
  return e.code === 'stripe_error' && e.detail ? `${base.replace(/\.$/, '')}: ${e.detail}` : base
}

// En celular los botones chicos crecen a 44 px para el dedo.
const TAP = 'max-sm:min-h-11'

export default function CodesEditor() {
  const [coupons, setCoupons] = useState([])
  const [testMode, setTestMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const rulesId = useId()

  const call = useCallback(async (action, body = null) => {
    const res = await fetch(`${API}?action=${action}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!json.ok) {
      const err = new Error(json.detail || json.error || 'Algo salió mal. Intenta de nuevo.')
      err.code = json.error
      err.detail = json.detail
      throw err
    }
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
      setError(errorText(e))
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
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (row) => {
    if (!confirm(`¿Desactivar “${row.code}”? Deja de funcionar al momento y desde aquí no se puede volver a activar. Su historial de usos se conserva.`)) return
    try {
      setBusyId(row.id)
      setError(null)
      await call('coupon.deactivate', { id: row.id })
      fetchCoupons()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusyId(null)
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className="w-full a-fade-in">
      <header className="a-page-head">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="a-title">Códigos de descuento</h1>
            {testMode && (
              <span className="a-badge a-badge--warning" title="Llaves de prueba de Stripe: estos códigos no existen en la tienda real.">
                Modo de prueba
              </span>
            )}
          </div>
          <p className="a-subtitle">
            Los clientes los escriben en el checkout. Viven en Stripe: lo que ves aquí es lo que Stripe descuenta.
          </p>
        </div>
        {/* Con el formulario abierto la acción principal es Crear código; este
            botón pasa a secundario para no competir con ella. */}
        <div className="a-page-head__actions justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={`a-btn ${showForm ? 'a-btn--secondary' : 'a-btn--primary'} ${TAP}`}
          >
            {showForm ? <XMarkIcon className="w-4 h-4" aria-hidden /> : <PlusIcon className="w-4 h-4" aria-hidden />}
            {showForm ? 'Cancelar' : 'Nuevo código'}
          </button>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3 mb-6" role="alert">
          <XCircleIcon className="w-5 h-5 shrink-0" aria-hidden />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {/* a-section, no a-card: el sistema pide un solo nivel de contenedor,
          y el divisor contra la lista lo pone `.a-section + .a-section`. */}
      {showForm && (
        <form onSubmit={handleCreate} className="a-section space-y-6">
          <h2 className="a-section-title">Nuevo código</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-6">
            <div>
              <label htmlFor="coupon-code" className="a-label">Código</label>
              <input
                id="coupon-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="a-input"
                placeholder="VERANO25"
                aria-describedby="coupon-code-help"
                required
              />
              <p id="coupon-code-help" className="a-help mt-1.5">De 3 a 40 caracteres: letras, números, guion y guion bajo.</p>
            </div>

            <div>
              <label htmlFor="coupon-type" className="a-label">Tipo de descuento</label>
              <select
                id="coupon-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="a-input"
              >
                <option value="percent">Porcentaje</option>
                <option value="amount">Monto fijo</option>
              </select>
            </div>

            {form.type === 'percent' ? (
              <div>
                <label htmlFor="coupon-percent" className="a-label">Porcentaje (%)</label>
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
                  <label htmlFor="coupon-amount" className="a-label">Monto</label>
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
                  <label htmlFor="coupon-currency" className="a-label">Moneda</label>
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
              <label htmlFor="coupon-max" className="a-label">Usos máximos</label>
              <input
                id="coupon-max"
                type="number"
                min="1"
                value={form.max_redemptions}
                onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                className="a-input"
                aria-describedby="coupon-max-help"
              />
              <p id="coupon-max-help" className="a-help mt-1.5">Entre todos los clientes. Déjalo vacío para que no tenga límite.</p>
            </div>

            <div>
              <label htmlFor="coupon-expires" className="a-label">Fecha de vencimiento</label>
              <input
                id="coupon-expires"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="a-input [color-scheme:dark]"
                aria-describedby="coupon-expires-help"
              />
              <p id="coupon-expires-help" className="a-help mt-1.5">Ese día ya no funciona. Déjalo vacío para que nunca venza.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="submit" disabled={saving} className={`a-btn a-btn--primary ${TAP}`}>
              {saving ? 'Creando…' : 'Crear código'}
            </button>
          </div>
        </form>
      )}

      <section className="a-section">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="a-spinner" role="status" aria-label="Cargando códigos" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="a-empty flex flex-col items-center gap-3">
            <TicketIcon className="w-8 h-8 text-white/25" aria-hidden />
            <p>Todavía no hay códigos de descuento. Crea el primero con Nuevo código.</p>
          </div>
        ) : (
          <div className="a-card overflow-hidden">
            <div className="overflow-x-auto a-scroll">
              <table className="a-table a-table--hover min-w-[680px]">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col" className="w-[8rem]">Descuento</th>
                    <th scope="col" className="w-[6rem]">Usos</th>
                    <th scope="col" className="w-[8rem]">Vence</th>
                    <th scope="col" className="w-[7rem]">Estado</th>
                    <th scope="col" className="w-[9rem]"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((row) => {
                    const dim = row.active ? '' : 'opacity-50'
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={`${dim} py-1`}>
                            <span className="a-code text-white font-semibold">{row.code}</span>
                            <p className="a-meta mt-1">Creado el {fmtDate(row.created_at)}</p>
                          </div>
                        </td>
                        <td><span className={dim}>{row.discount || '—'}</span></td>
                        <td>
                          <span className={`${dim} a-num`}>
                            {row.times_redeemed}
                            {row.max_redemptions ? ` / ${row.max_redemptions}` : ''}
                          </span>
                        </td>
                        <td><span className={`${dim} a-meta`}>{fmtDate(row.expires_at)}</span></td>
                        <td>
                          {row.active
                            ? <span className="a-badge a-badge--success">Activo</span>
                            : <span className="a-badge">Desactivado</span>}
                        </td>
                        <td className="text-right">
                          {row.active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(row)}
                              disabled={busyId === row.id}
                              className={`a-btn a-btn--danger a-btn--sm ${TAP}`}
                            >
                              {busyId === row.id ? 'Desactivando…' : 'Desactivar'}
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

      {/* Ayuda donde surge la duda (heurística 10). Cada regla sale de
          shop-coupons.php (crear/desactivar) y shop-checkout.php (cuándo se
          pueden usar en el checkout). */}
      <section className="a-section" aria-labelledby={rulesId}>
        <h2 id={rulesId} className="a-section-title">Reglas</h2>
        <ul className="a-rules mt-4 max-w-3xl">
          <li>
            <strong>No se pueden editar ni eliminar</strong>: así funciona Stripe. Si te equivocaste, desactívalo y crea otro.
          </li>
          <li>
            <strong>Desactivar</strong> lo apaga al momento y conserva el historial de quién lo usó. Desde aquí no se puede
            volver a activar.
          </li>
          <li>
            <strong>Porcentaje o monto fijo.</strong> Un monto fijo lleva moneda y solo sirve en compras en esa moneda: uno en
            MXN no funciona en las zonas que pagan en USD.
          </li>
          <li>
            <strong>Usos máximos</strong> cuenta a todos los clientes juntos, no por persona. Vacío es sin límite.
          </li>
          <li>
            <strong>La fecha de vencimiento</strong> es el primer día en que ya no funciona: con 31 de diciembre, sirve hasta
            el 30.
          </li>
          <li>
            <strong>No se combina con el golden ticket</strong>: si el cliente usa el suyo, el checkout no deja escribir
            códigos. Y si apagas “Permitir códigos de descuento” en Ajustes de la tienda, nadie puede usarlos.
          </li>
        </ul>
      </section>
    </div>
  )
}
