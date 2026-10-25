// ShopDataProvider — catálogo de la tienda (MySQL vía /api/shop.php).
//
// Estrategia:
//   1. Al montar, UNA llamada trae productos en los dos idiomas y las dos
//      monedas, más categorías y regiones de envío.
//   2. La región elegida (México / USA / Latinoamérica) decide la moneda; el
//      idioma decide textos. Cambiar cualquiera de los dos solo re-adapta lo
//      que ya está en memoria — no hay re-fetch.
//   3. Productos sin precio en la moneda de la región no se muestran ahí.
//
// Expone el mismo contrato que consumía la UI (products, featured, byId,
// byCategory, formatPrice…) más lo nuevo de regiones y checkout.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { fetchCatalog } from './shopApi.js'
import { adaptProduct, formatPriceWithCurrency } from './shopProduct.js'

const ShopDataContext = createContext(null)
const REGION_KEY = 'skulleyShopRegion'

// Mientras carga el catálogo (o si falla): los mismos valores que
// game-tickets.php, para que el juego nunca prometa números vacíos.
export const DEFAULT_TICKETS = {
  silver: { score: 5000, pct: 10, name: 'Silver Ticket', monthly_cap: null },
  gold: { score: 9999, pct: 35, name: 'Golden Ticket', monthly_cap: 10 },
}

function readStoredRegion() {
  try { return localStorage.getItem(REGION_KEY) || null } catch { return null }
}

// Primera visita: la región sale del locale del navegador ("es-AR" → latam,
// "en-US" → us). Si no dice país, el idioma decide: español → México.
function guessRegion(regions, lang) {
  if (!regions.length) return null
  const byCountry = (cc) => regions.find(r => r.countries?.includes(cc))
  const locales = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []
  for (const loc of locales) {
    const cc = String(loc || '').split('-')[1]?.toUpperCase()
    const hit = cc && byCountry(cc)
    if (hit) return hit.code
  }
  const fallback = lang === 'es' ? byCountry('MX') : byCountry('US')
  return (fallback || regions[0]).code
}

export function ShopDataProvider({ children }) {
  const { lang } = useLanguage()
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [regionCode, setRegionCode] = useState(() => readStoredRegion())
  // CMS overrides: banners del hero + featured product id + modos de slideshow.
  const [banners, setBanners] = useState([])
  const [featuredProductId, setFeaturedProductId] = useState(null)
  const [slideshow, setSlideshow] = useState({ hero: 'auto', card: 'auto' })

  const load = useCallback(() => {
    let cancelled = false
    fetchCatalog()
      .then((data) => {
        if (cancelled) return
        setCatalog(data)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[ShopData] fetch failed:', err)
        setError(err)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => load(), [load])

  // Separado del catálogo: si shop-config falla, la tienda sigue en pie.
  useEffect(() => {
    let cancelled = false
    fetch('/api/shop-config.php', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled || !json?.ok) return
        setBanners(Array.isArray(json.banners) ? json.banners : [])
        setFeaturedProductId(json.featured_product_id || null)
        if (json.slideshow) {
          setSlideshow({
            hero: json.slideshow.hero || 'auto',
            card: json.slideshow.card || 'auto',
          })
        }
      })
      .catch(() => { /* silent fallback */ })
    return () => { cancelled = true }
  }, [])

  const regions = useMemo(() => catalog?.regions || [], [catalog])
  const region = useMemo(() => {
    if (!regions.length) return null
    return regions.find(r => r.code === regionCode)
      || regions.find(r => r.code === guessRegion(regions, lang))
      || regions[0]
  }, [regions, regionCode, lang])
  const currency = region?.currency || (lang === 'es' ? 'MXN' : 'USD')

  const setRegion = useCallback((code) => {
    setRegionCode(code)
    try { localStorage.setItem(REGION_KEY, code) } catch { }
  }, [])

  const allProducts = useMemo(() => (
    (catalog?.products || []).map(p => adaptProduct(p, { lang, currency }))
  ), [catalog, lang, currency])

  const products = useMemo(() => allProducts.filter(p => p.sellableInRegion), [allProducts])

  // Solo categorías que tienen algo a la venta en esta región, en el orden del CMS.
  const categories = useMemo(() => {
    const used = new Set(products.map(p => p.category))
    return (catalog?.categories || [])
      .filter(c => used.has(c.slug))
      .map(c => ({ id: c.slug, label_en: c.name_en, label_es: c.name_es, color: c.color }))
  }, [catalog, products])

  const value = useMemo(() => {
    const byId = (id) => products.find(p => String(p.id) === String(id)) || null
    // Featured: el override del CMS gana sobre el flag "featured" del producto.
    const cmsFeatured = featuredProductId ? byId(featuredProductId) : null
    const featured = cmsFeatured || products.find(p => p.featured) || products[0] || null
    const byCategory = (cat) => {
      if (!cat || cat === 'all') return products
      return products.filter(p => p.category === cat)
    }
    const formatPrice = (amount, cur) => formatPriceWithCurrency(amount, cur || currency)
    return {
      products,
      featured,
      categories,
      banners,
      featuredProductId,
      slideshow,
      byId,
      byCategory,
      currency,
      regions,
      region,
      setRegion,
      checkoutEnabled: !!catalog?.checkout_enabled,
      goldenTicketPct: catalog?.golden_ticket_pct ?? 35,
      // Niveles de ticket del minigame (game-tickets.php): cuánto pide y da cada uno.
      tickets: catalog?.tickets || DEFAULT_TICKETS,
      loading,
      error,
      refresh: load,
      formatPrice,
    }
  }, [products, categories, banners, featuredProductId, slideshow, currency, regions, region, setRegion, catalog, loading, error, load])

  return (
    <ShopDataContext.Provider value={value}>
      {children}
    </ShopDataContext.Provider>
  )
}

export function useShopData() {
  const ctx = useContext(ShopDataContext)
  if (!ctx) throw new Error('useShopData must be used within ShopDataProvider')
  return ctx
}

// Hook "ligero" para componentes que solo necesitan el formatter.
export function useShopFormatter() {
  const ctx = useContext(ShopDataContext)
  if (!ctx) {
    return {
      formatPrice: (a) => formatPriceWithCurrency(a, 'MXN'),
      currency: 'MXN',
    }
  }
  return { formatPrice: ctx.formatPrice, currency: ctx.currency }
}
