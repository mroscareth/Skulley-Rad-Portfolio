// Cart hook — persiste en localStorage. Thin layer sobre useState; el checkout
// real delega a Shopify via Storefront API (cartCreate → redirect a checkoutUrl).
//
// Item shape:
//   { productId, variantId, qty, selectedOptions: {Color: 'Black', Size: 'M'}, addedAt }
// variantId es el GID único de Shopify para la combinación elegida → dedupe
// key natural.

import { useCallback, useEffect, useState } from 'react'
import { useShopData } from './shopDataContext.jsx'
import { createCart, marketForLang } from './shopifyClient.js'

const STORAGE_KEY = 'skulleyShopCart'

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Drop entries del schema antiguo (sin variantId) — no podemos
    // resolverlas al schema nuevo sin conocer las variantes actuales.
    return parsed.filter(it => it && it.variantId)
  } catch {
    return []
  }
}

function writeStored(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { }
}

export function useShopCart() {
  const [items, setItems] = useState(() => readStored())
  const { byId } = useShopData()

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
    if (!variantId) return
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

  // Derived: cada item expande { product, variant, maxQty }. maxQty es el
  // stock disponible de la variante; Infinity si no trackea inventario.
  // Si byId o la variant ya no existen (producto retirado, variante
  // descontinuada), filtramos silenciosamente.
  const detailed = items.map((it) => {
    const product = byId(it.productId)
    const variant = product?.variants?.find(v => v.id === it.variantId) || null
    const maxQty = typeof variant?.quantityAvailable === 'number' ? variant.quantityAvailable : Infinity
    return { ...it, product, variant, maxQty }
  }).filter(it => !!it.product && !!it.variant)

  const totalItems = detailed.reduce((sum, it) => sum + it.qty, 0)
  const subtotal = detailed.reduce((sum, it) => sum + (it.qty * (it.variant?.price || 0)), 0)

  // Checkout real — crea Cart en Shopify y devuelve checkoutUrl.
  const createShopifyCheckout = useCallback(async ({ lang = 'en', discountCodes = [] } = {}) => {
    if (!detailed.length) throw new Error('Cart vacío')
    const market = marketForLang(lang)
    const lines = detailed.map(it => ({ variantId: it.variantId, quantity: it.qty }))
    const cart = await createCart({ lines, discountCodes, ...market })
    return cart?.checkoutUrl || null
  }, [detailed])

  return {
    items: detailed,
    rawItems: items,
    add,
    remove,
    setQty,
    clear,
    totalItems,
    subtotal,
    createShopifyCheckout,
  }
}
