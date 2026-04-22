import React, { useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { playSfx } from '../../lib/sfx.js'
import ShopHero from './ShopHero.jsx'
import WelcomeNote from './WelcomeNote.jsx'
import FeaturedArtifact from './FeaturedArtifact.jsx'
import ProductGrid from './ProductGrid.jsx'
import ArchiveToast from './ArchiveToast.jsx'
import ArchiveTape from './ArchiveTape.jsx'
import ProductInspectModal from './ProductInspectModal.jsx'

// Shell de la tienda. Orquesta hero, featured, grid, toasts e inspect modal.
// El cart (botón + panel) es global — vive en App.jsx y lee del ShopCartProvider.
export default function Shop() {
  const { lang } = useLanguage()
  const cart = useShopCartCtx()
  const [inspecting, setInspecting] = useState(null)
  const rootRef = useRef(null)
  const gridSectionRef = useRef(null)

  // Añadir al carrito. Si el producto tiene opciones (Color/Size/etc.) y no
  // llega variantId, forzamos abrir el inspect para que el usuario elija —
  // agregar un default cuando los precios dependen de la variante es un bug.
  //
  // Además capamos la qty al stock disponible de la variante, restando lo que
  // ya esté en el carrito — así nunca mandamos a checkout más del que Shopify
  // tiene en inventario.
  const handleAdd = (product, qty = 1, selectedOptions = null, variantId = null) => {
    if (!variantId && product.hasOptions) {
      setInspecting(product)
      return
    }
    const finalVariantId = variantId || product.defaultVariantId
    const variant = product.variants?.find(v => v.id === finalVariantId)
    // "Continue selling when out of stock" en Shopify → availableForSale:true
    // con quantityAvailable:0. Es efectivamente ilimitado (prints bajo demanda,
    // digitales, etc.) — no aplicar el cap de stock en ese caso.
    const continueSellingPastZero = variant?.quantityAvailable === 0 && variant?.availableForSale
    const tracked = typeof variant?.quantityAvailable === 'number' && !continueSellingPastZero
    const existingQty = cart.items.find(it => it.variantId === finalVariantId)?.qty || 0
    const maxAvailable = tracked ? Math.max(0, variant.quantityAvailable - existingQty) : Infinity
    const finalQty = Math.min(qty, maxAvailable)
    if (finalQty <= 0) return
    cart.add(product.id, finalQty, finalVariantId, selectedOptions)
    try { playSfx('click', { volume: 0.5 }) } catch { }
    try { window.dispatchEvent(new CustomEvent('shop-toast', { detail: { product } })) } catch { }
  }

  // Inspeccionar = abrir modal
  const handleInspect = (product) => setInspecting(product)

  // CTA del hero: scroll al grid
  const handleHeroCta = () => {
    try {
      gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch { }
  }

  // Cards animan via CSS-only stagger (index.css). Mantener la sección sin
  // efectos con scroll por ahora — los glitches de GSAP ScrollTrigger no
  // valen la pena vs el riesgo de dejar items invisibles.

  return (
    <div
      ref={rootRef}
      className="relative w-full min-h-screen text-white"
      data-shop-root
    >
      {/* Tape top */}
      <ArchiveTape lang={lang} />

      {/* Hero slideshow */}
      <ShopHero lang={lang} onCtaClick={handleHeroCta} />

      {/* Spacers transparentes entre contenedores — dejan ver el bg magenta
          de la sección y separan los bloques redondeados. 16px mobile /
          32px desktop, consistente en toda la tienda. */}
      <div className="h-4 sm:h-8" aria-hidden />

      <WelcomeNote lang={lang} />

      <div className="h-4 sm:h-8" aria-hidden />

      <FeaturedArtifact
        lang={lang}
        onAdd={handleAdd}
        onInspect={handleInspect}
      />

      <div className="h-4 sm:h-8" aria-hidden />

      <div ref={gridSectionRef}>
        <ProductGrid lang={lang} onAdd={handleAdd} onInspect={handleInspect} />
      </div>

      {/* Spacer final — deja respirar el contenedor del grid sobre la nav
          flotante del bottom (WORK/ABOUT/STORE/…). */}
      <div className="h-24 sm:h-32" aria-hidden />

      {/* Toast stack (el cart button + panel ahora son globales — viven en App.jsx) */}
      <ArchiveToast lang={lang} />

      {/* Inspect modal */}
      {inspecting && (
        <ProductInspectModal
          product={inspecting}
          lang={lang}
          onClose={() => setInspecting(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
