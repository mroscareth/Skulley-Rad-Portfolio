// ShopDataProvider — carga productos de Shopify (colección lost-and-found-items)
// al montar, re-fetch cuando cambia el idioma para actualizar moneda/traducción.
//
// Estrategia:
//   1. Al montar, fetch EN/US + ES/MX en paralelo y cachea ambos resultados.
//   2. Merge por ID → cada producto tiene title_en/title_es/description_en/es.
//   3. El "active set" son los productos del idioma actual (precios correctos
//      para la moneda). Cuando cambia lang, simplemente rota qué array es
//      primary (no re-fetch, todo ya está en memoria).
//
// Expone el mismo shape que el antiguo shopMockData.js (PRODUCTS, getById,
// getFeaturedProduct, productsByCategory) para minimizar el refactor.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import {
  SHOPIFY_CONFIGURED,
  fetchCollectionProducts,
  marketForLang,
} from './shopifyClient.js'
import { adaptProduct, mergeLocalized, formatPriceWithCurrency } from './shopifyAdapter.js'

const ShopDataContext = createContext(null)
const COLLECTION_HANDLE = import.meta.env.VITE_SHOPIFY_COLLECTION_HANDLE || 'lost-and-found-items'

export function ShopDataProvider({ children }) {
  const { lang } = useLanguage()
  const [rawEn, setRawEn] = useState(null)   // array de productos adaptados con lang=en
  const [rawEs, setRawEs] = useState(null)   // idem con lang=es
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // CMS overrides: banners del hero + featured product id. Fetch independiente
  // de Shopify — falla silenciosa si el endpoint no responde (fallback a mock).
  const [banners, setBanners] = useState([])
  const [featuredProductId, setFeaturedProductId] = useState(null)
  // Modo de slideshow por superficie: 'auto' | 'manual' | 'off'. Se administra
  // desde el CMS (ShopEditor). Default 'auto' para que si el endpoint no
  // responde la tienda siga comportándose como siempre.
  const [slideshow, setSlideshow] = useState({ hero: 'auto', card: 'auto' })

  // Fetch inicial (una sola vez — ambos idiomas en paralelo).
  useEffect(() => {
    let cancelled = false
    if (!SHOPIFY_CONFIGURED) {
      setError(new Error('Shopify no configurado'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const en = marketForLang('en')
    const es = marketForLang('es')
    Promise.all([
      fetchCollectionProducts({ handle: COLLECTION_HANDLE, ...en }),
      fetchCollectionProducts({ handle: COLLECTION_HANDLE, ...es }),
    ])
      .then(([enResp, esResp]) => {
        if (cancelled) return
        const enAdapted = enResp.products.map(n => adaptProduct(n, { lang: 'en' }))
        const esAdapted = esResp.products.map(n => adaptProduct(n, { lang: 'es' }))
        setRawEn(enAdapted)
        setRawEs(esAdapted)
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

  // Fetch CMS overrides (banners + featured id). Separado del fetch de
  // Shopify porque es otro backend (PHP) y no queremos que un fallo bloquee
  // los productos.
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

  // Vista mergeada y "activa" según idioma actual. El primary define el precio
  // y la moneda; el secondary solo completa títulos/descripciones traducidos.
  const products = useMemo(() => {
    if (!rawEn || !rawEs) return []
    if (lang === 'es') {
      return mergeLocalized(rawEs, rawEn, { primaryLang: 'es', secondaryLang: 'en' })
    }
    return mergeLocalized(rawEn, rawEs, { primaryLang: 'en', secondaryLang: 'es' })
  }, [rawEn, rawEs, lang])

  const currency = products[0]?.currency || (lang === 'es' ? 'MXN' : 'USD')

  const value = useMemo(() => {
    const byId = (id) => products.find(p => p.id === id) || null
    // Featured: CMS override gana sobre el tag "featured" de Shopify. Si el
    // id del CMS no existe en el catálogo (producto despublicado), fallback.
    const cmsFeatured = featuredProductId ? products.find(p => p.id === featuredProductId) : null
    const featured = cmsFeatured || products.find(p => p.featured) || products[0] || null
    const byCategory = (cat) => {
      if (!cat || cat === 'all') return products
      return products.filter(p => p.category === cat)
    }
    const formatPrice = (amount, cur) => formatPriceWithCurrency(amount, cur || currency)
    return {
      products,
      featured,
      banners,
      featuredProductId,
      slideshow,
      byId,
      byCategory,
      currency,
      loading,
      error,
      configured: SHOPIFY_CONFIGURED,
      formatPrice,
    }
  }, [products, banners, featuredProductId, slideshow, currency, loading, error])

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

// Hook "ligero" para componentes que solo necesitan el formatter (ej. el cart
// global que vive en App.jsx y no siempre está debajo del provider de la tienda
// — aunque en este proyecto sí lo está).
export function useShopFormatter() {
  const ctx = useContext(ShopDataContext)
  if (!ctx) {
    return {
      formatPrice: (a) => formatPriceWithCurrency(a, 'USD'),
      currency: 'USD',
    }
  }
  return { formatPrice: ctx.formatPrice, currency: ctx.currency }
}
