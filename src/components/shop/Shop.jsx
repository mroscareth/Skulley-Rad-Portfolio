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

  // Añadir al carrito + disparar toast + sfx
  const handleAdd = (product, qty = 1, size = null) => {
    cart.add(product.id, qty, size)
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

      {/* Spacer entre hero y nota — transparente para que muestre el bg
          magenta de la sección. 16px mobile / 32px desktop. */}
      <div className="h-4 sm:h-8" aria-hidden />

      {/* Nota de bienvenida satírica — sin padding vertical propio */}
      <WelcomeNote lang={lang} />

      {/* Featured */}
      <FeaturedArtifact
        lang={lang}
        onAdd={handleAdd}
        onInspect={handleInspect}
      />

      {/* Grid */}
      <div ref={gridSectionRef}>
        <ProductGrid lang={lang} onAdd={handleAdd} onInspect={handleInspect} />
      </div>

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
