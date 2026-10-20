// Cart hook — persiste en localStorage. El cobro se hace en Stripe: el
// backend arma la Checkout Session con precios de MySQL y nos regresa la URL.
//
// Item shape:
//   { productId, variantId, qty, selectedOptions, addedAt }
// variantId es el id de la variante en MySQL → dedupe key natural.

import { useCallback, useEffect, useState } from 'react'
import { useShopData } from './shopDataContext.jsx'
import { createCheckout } from './shopApi.js'

const STORAGE_KEY = 'skulleyShopCart'
// Token del último checkout abierto desde este navegador. Si el comprador
// vuelve de Stripe con "atrás" y paga de nuevo, el backend cierra ese intento
// antes de apartar otra vez — si no, una pieza 1/1 se vería agotada por él mismo.
const PENDING_KEY = 'skulleyPendingCheckout'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Los ids de variante ahora son numéricos (MySQL). Lo que quedó del
    // catálogo anterior (GIDs de texto) ya no existe en ningún lado.
    return parsed.filter(it => it && typeof it.variantId === 'number')
  } catch {
    return []
  }
}

function writeStored(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { }
}

export function readPendingCheckout() {
  try { return localStorage.getItem(PENDING_KEY) || null } catch { return null }
}

export function clearPendingCheckout() {
  try { localStorage.removeItem(PENDING_KEY) } catch { }
}

export function useShopCart() {
  const [items, setItems] = useState(() => readStored())
  const { byId, region } = useShopData()

  useEffect(() => { writeStored(items) }, [items])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try { setItems(JSON.parse(e.newValue || '[]')) } catch { }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((productId, qty = 1, variantId = null, selectedOptions = null) => {
    if (variantId === null || variantId === undefined) return
    setItems((prev) => {
      const idx = prev.findIndex(it => it.productId === productId && it.variantId === variantId)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
        return copy
      }
      return [...prev, { productId, variantId, qty, selectedOptions: selectedOptions || null, addedAt: Date.now() }]
    })
  }, [])

  const remove = useCallback((productId, variantId) => {
    setItems((prev) => prev.filter(it => !(it.productId === productId && it.variantId === variantId)))
  }, [])

  const setQty = useCallback((productId, variantId, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        return prev.filter(it => !(it.productId === productId && it.variantId === variantId))
      }
      return prev.map(it => (
        it.productId === productId && it.variantId === variantId
          ? { ...it, qty }
          : it
      ))
    })
  }, [])

  const clear = useCallback(() => { setItems([]) }, [])

  // Derived: cada item expande { product, variant, maxQty }. Lo que no tiene
  // precio en la región elegida queda fuera (sigue guardado: si el comprador
  // regresa a la región anterior, reaparece).
  const detailed = items.map((it) => {
    const product = byId(it.productId)
    const variant = product?.variants?.find(v => v.id === it.variantId) || null
    const maxQty = typeof variant?.quantityAvailable === 'number' ? variant.quantityAvailable : Infinity
    return { ...it, product, variant, maxQty }
  }).filter(it => !!it.product && !!it.variant && it.variant.price > 0)

  const hiddenCount = items.length - detailed.length
  const totalItems = detailed.reduce((sum, it) => sum + it.qty, 0)
  const subtotal = detailed.reduce((sum, it) => sum + (it.qty * (it.variant?.price || 0)), 0)
  const hasPhysical = detailed.some(it => !it.product.digital)

  // Crea el cobro en Stripe y devuelve la URL a la que hay que ir. NO vacía el
  // carrito: eso pasa al regresar con el pago confirmado (OrderStatusModal).
  const checkout = useCallback(async ({ lang = 'es', authToken = null, useGoldenTicket = false } = {}) => {
    if (!detailed.length) throw new Error('empty_cart')
    if (!region) throw new Error('invalid_region')
    const res = await createCheckout({
      items: detailed,
      region: region.code,
      lang,
      authToken,
      useGoldenTicket,
      replaceToken: readPendingCheckout(),
    })
    try { localStorage.setItem(PENDING_KEY, res.token) } catch { }
    return res.url
  }, [detailed, region])

  return {
    items: detailed,
    rawItems: items,
    hiddenCount,
    add,
    remove,
    setQty,
    clear,
    totalItems,
    subtotal,
    hasPhysical,
    checkout,
  }
}
