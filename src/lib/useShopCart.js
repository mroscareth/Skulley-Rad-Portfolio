// Cart hook — persiste en localStorage. Thin layer sobre useState para que el
// día que exista Shopify real, solo reemplazamos el mockCheckout por un POST
// al endpoint de checkout y todo lo demás se queda igual.

import { useCallback, useEffect, useState } from 'react'
import { getProductById } from './shopMockData.js'

const STORAGE_KEY = 'skulleyShopCart'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStored(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { }
}

export function useShopCart() {
  // items: [{ productId, qty, size?, addedAt }]
  const [items, setItems] = useState(() => readStored())

  // Sync a localStorage cada vez que cambia
  useEffect(() => { writeStored(items) }, [items])

  // Sync entre tabs abiertas (nice-to-have)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try { setItems(JSON.parse(e.newValue || '[]')) } catch { }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((productId, qty = 1, size = null) => {
    setItems((prev) => {
      // Mismo producto + mismo size = suma qty
      const idx = prev.findIndex(it => it.productId === productId && (it.size || null) === (size || null))
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
        return copy
      }
      return [...prev, { productId, qty, size: size || null, addedAt: Date.now() }]
    })
  }, [])

  const remove = useCallback((productId, size = null) => {
    setItems((prev) => prev.filter(it => !(it.productId === productId && (it.size || null) === (size || null))))
  }, [])

  const setQty = useCallback((productId, size, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        return prev.filter(it => !(it.productId === productId && (it.size || null) === (size || null)))
      }
      return prev.map(it => (
        it.productId === productId && (it.size || null) === (size || null)
          ? { ...it, qty }
          : it
      ))
    })
  }, [])

  const clear = useCallback(() => { setItems([]) }, [])

  // Derived: detalles expandidos con datos del producto
  const detailed = items.map((it) => {
    const product = getProductById(it.productId)
    return { ...it, product }
  }).filter(it => !!it.product)

  const totalItems = detailed.reduce((sum, it) => sum + it.qty, 0)
  const subtotal = detailed.reduce((sum, it) => sum + (it.qty * (it.product?.price || 0)), 0)

  // Mock checkout — sustituir por fetch a Shopify Storefront API cuando exista
  const mockCheckout = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 1200))
    return { ok: true, archiveId: `CHK-${Date.now().toString(36).toUpperCase()}` }
  }, [])

  return {
    items: detailed,
    rawItems: items,
    add,
    remove,
    setQty,
    clear,
    totalItems,
    subtotal,
    mockCheckout,
  }
}
