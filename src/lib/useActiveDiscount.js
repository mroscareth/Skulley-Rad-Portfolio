// Descuento activo del carrito. Hoy el único es el golden ticket (35%, se gana
// en el minigame): vive en user_profiles y el backend lo aplica al crear el
// cobro en Stripe. Este slot solo refleja en la UI si va o no en esta compra.
//
// Shape: { code, pct, label, rarity, action, redeemedAt }
//
// Vive en memoria, NO en localStorage: cada carga arranca sin descuento y solo
// App.jsx lo enciende después de que el perfil del servidor confirma un ticket
// vivo. Persistirlo hacía que un navegador donde alguien entró con ticket le
// siguiera mostrando precios rebajados a cualquier visitante sin sesión.
//
// "Guardar para después": si el comprador quita el ticket del carrito, se
// marca SAVED_KEY y App.jsx deja de auto-aplicarlo. Así puede reservarlo para
// una pieza más cara sin perderlo. Eso sí persiste: solo apaga, nunca enciende.

import { useCallback, useEffect, useState } from 'react'

const LEGACY_LS_KEY = 'skulleyActiveDiscount'
const SAVED_KEY = 'skulleyGoldenTicketSaved'

try { localStorage.removeItem(LEGACY_LS_KEY) } catch { }

export const GOLDEN_TICKET_DISCOUNT = {
  code: 'GOLDEN_TICKET',
  label: 'Golden Ticket',
  rarity: 'legendary',
  action: 'goldSkin',
}

let current = null

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
  const [active, setActive] = useState(current)

  useEffect(() => {
    const onChange = () => setActive(current)
    window.addEventListener('discount-changed', onChange)
    // Pudo cambiar entre el primer render y la suscripción.
    onChange()
    return () => window.removeEventListener('discount-changed', onChange)
  }, [])

  const apply = useCallback((payload) => {
    if (!payload || !payload.code) return
    current = {
      code: payload.code,
      pct: Number(payload.pct ?? 0),
      label: payload.label || payload.code,
      rarity: payload.rarity || 'common',
      action: payload.action || null,
      redeemedAt: Date.now(),
    }
    emit()
  }, [])

  const clear = useCallback(() => {
    if (!current) return
    current = null
    emit()
  }, [])

  return { active, apply, clear }
}
