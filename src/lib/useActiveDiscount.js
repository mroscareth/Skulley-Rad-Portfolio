// Active discount for the shop cart. Single slot (not stackable — Shopify's
// default behavior is one discount code per cart, and we enforce that here so
// the user sees the same thing the checkout will enforce anyway).
//
// Stored shape:
//   {
//     code,             // cheat master code (CMS) — para UI/label
//     pct,              // discount %
//     label, rarity, action,
//     redeemedAt,       // epoch ms
//     shopify_code,     // ephemeral Shopify code — lo que va al cart real (Fase 6)
//     shopifyExpiresAt, // epoch ms. null si no hay shopify_code.
//   }
//
// Lifecycle:
//   - setActive(payload)  → persists + emits 'discount-changed' (for toasts, UI sync)
//   - clear()             → remove
//   - replaceWithConfirm(newPayload) → if one active, confirm via window.confirm;
//                                       otherwise just setActive. Returns true if applied.
//
// Expiración: si shopifyExpiresAt existe y ya pasó, el hook devuelve active=null
// y limpia el storage automáticamente al leer.

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'skulleyActiveDiscount'

// Parsea "2026-04-22 13:45:00" (MySQL DATETIME UTC) o ISO a epoch ms.
function parseShopifyExpiresAt(raw) {
  if (!raw) return null
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  // Treat MySQL DATETIME as UTC
  const iso = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2} /.test(raw)
    ? raw.replace(' ', 'T') + 'Z'
    : raw
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function isExpired(payload) {
  if (!payload || !payload.shopifyExpiresAt) return false
  return Date.now() >= payload.shopifyExpiresAt
}

function readStored() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.code) return null
    // Auto-expire si el shopify_code venció.
    if (isExpired(parsed)) {
      try { localStorage.removeItem(LS_KEY) } catch {}
      return null
    }
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
      pct: Number(payload.pct ?? payload.discount_pct ?? 0),
      label: payload.label || payload.code,
      rarity: payload.rarity || 'common',
      action: payload.action || null,
      redeemedAt: Date.now(),
      shopify_code: payload.shopify_code || null,
      shopifyExpiresAt: parseShopifyExpiresAt(payload.shopify_code_expires_at ?? payload.shopifyExpiresAt),
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

  // Replace with a confirm dialog if something is already active and it is a
  // different code. Returns true if the new payload was applied.
  const replaceWithConfirm = useCallback((payload) => {
    if (!payload || !payload.code) return false
    const current = readStored()
    if (current && current.code && current.code.toLowerCase() !== payload.code.toLowerCase()) {
      const ok = window.confirm(
        `Ya tienes el código ${current.code} (${current.pct}% off) activo.\n\n` +
        `¿Reemplazarlo con ${payload.code} (${payload.pct ?? payload.discount_pct}% off)?\n\n` +
        'Sólo puedes usar un código por compra.',
      )
      if (!ok) return false
    }
    const toStore = {
      code: payload.code,
      pct: Number(payload.pct ?? payload.discount_pct ?? 0),
      label: payload.label || payload.code,
      rarity: payload.rarity || 'common',
      action: payload.action || null,
      redeemedAt: Date.now(),
      shopify_code: payload.shopify_code || null,
      shopifyExpiresAt: parseShopifyExpiresAt(payload.shopify_code_expires_at ?? payload.shopifyExpiresAt),
    }
    writeStored(toStore)
    setActive(toStore)
    emit()
    return true
  }, [])

  // Expiration watchdog: si hay shopifyExpiresAt futuro, armar timer para
  // auto-limpiar cuando venza (y emitir así UI refresca).
  useEffect(() => {
    if (!active?.shopifyExpiresAt) return
    const delay = active.shopifyExpiresAt - Date.now()
    if (delay <= 0) {
      // Ya venció — limpiar inmediatamente.
      writeStored(null)
      setActive(null)
      emit()
      return
    }
    const id = setTimeout(() => {
      writeStored(null)
      setActive(null)
      emit()
    }, delay + 250) // +250ms buffer contra clock skew
    return () => clearTimeout(id)
  }, [active?.shopifyExpiresAt])

  return { active, apply, clear, replaceWithConfirm }
}
