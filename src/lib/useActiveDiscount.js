// Descuento activo del carrito. Hoy el único es el golden ticket (35%, se gana
// en el minigame): vive en user_profiles y el backend lo aplica al crear el
// cobro en Stripe. Este slot solo refleja en la UI si va o no en esta compra.
//
// Stored shape: { code, pct, label, rarity, action, redeemedAt }
//
// "Guardar para después": si el comprador quita el ticket del carrito, se
// marca SAVED_KEY y App.jsx deja de auto-aplicarlo. Así puede reservarlo para
// una pieza más cara sin perderlo.

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'skulleyActiveDiscount'
const SAVED_KEY = 'skulleyGoldenTicketSaved'

export const GOLDEN_TICKET_DISCOUNT = {
  code: 'GOLDEN_TICKET',
  label: 'Golden Ticket',
  rarity: 'legendary',
  action: 'goldSkin',
}

function readStored() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.code) return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(payload) {
  try {
    if (payload) localStorage.setItem(LS_KEY, JSON.stringify(payload))
    else localStorage.removeItem(LS_KEY)
  } catch { }
}

function emit() {
  try { window.dispatchEvent(new CustomEvent('discount-changed')) } catch { }
}

export function isGoldenTicketSaved() {
  try { return localStorage.getItem(SAVED_KEY) === '1' } catch { return false }
}

export function setGoldenTicketSaved(saved) {
  try {
    if (saved) localStorage.setItem(SAVED_KEY, '1')
    else localStorage.removeItem(SAVED_KEY)
  } catch { }
}

export function useActiveDiscount() {
  const [active, setActive] = useState(() => readStored())

  // Sync across tabs AND across hook instances (emit on same-tab changes).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_KEY) setActive(readStored())
    }
    const onLocal = () => setActive(readStored())
    window.addEventListener('storage', onStorage)
    window.addEventListener('discount-changed', onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('discount-changed', onLocal)
    }
  }, [])

  const apply = useCallback((payload) => {
    if (!payload || !payload.code) return
    const toStore = {
      code: payload.code,
      pct: Number(payload.pct ?? 0),
      label: payload.label || payload.code,
      rarity: payload.rarity || 'common',
      action: payload.action || null,
      redeemedAt: Date.now(),
    }
    writeStored(toStore)
    setActive(toStore)
    emit()
  }, [])

  const clear = useCallback(() => {
    writeStored(null)
    setActive(null)
    emit()
  }, [])

  return { active, apply, clear }
}
