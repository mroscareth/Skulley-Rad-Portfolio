import React, { useRef, useState } from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'
import ProductMeta from './ProductMeta.jsx'
import PriceTag from './PriceTag.jsx'
import AddButton from './AddButton.jsx'
import SoldOutTape from './SoldOutTape.jsx'

/**
 * Pieza destacada, arriba de la retícula: una card como las de abajo, más
 * grande y centrada — no un módulo a todo lo ancho. Misma anatomía (DESIGN.md
 * §14.6): nombre + línea de detalle, foto, descripción, y el precio a la
 * izquierda con la única acción a la derecha. En mobile se apila igual que
 * una card; desde lg la foto va a la izquierda y lo demás a la derecha. El
 * orden lo ponen las áreas del grid de `.shop-featured`, no DOM duplicado.
 *
 * Como en la retícula, la card entera abre el detalle (heurística 04); la
 * ficha técnica vive ahí.
 *
 * Mockup con parallax CSS (hover tilt) en vez de Canvas extra para mantener
 * el bundle ligero — el sitio ya tiene un Canvas global.
 */
export default function FeaturedArtifact({ lang = 'en', onAdd, onInspect }) {
  const { featured: product } = useShopData()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const mediaRef = useRef(null)
  const { finalPrice, originalPrice, hasDiscount, pct } = usePriceWithDiscount(
    product?.price ?? 0,
    product?.priceOriginal ?? null,
  )
  if (!product) return null

  const onMouseMove = (e) => {
    if (!mediaRef.current) return
    const r = mediaRef.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setTilt({ x: (y - 0.5) * -10, y: (x - 0.5) * 10 })
  }
  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const description = isEn ? product.description_en : product.description_es
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const inspect = () => onInspect && onInspect(product)

  const tr = {
    sectionTitle: isEn ? 'Featured item' : 'Objeto destacado',
    soldOut: isEn ? 'Sold out' : 'Agotado',
  }

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-10 py-10 sm:py-20">
      {/* Título del MÓDULO, centrado. */}
      <header className="mb-8 sm:mb-14 text-center">
        <h2 className="shop-display shop-display--lg">{tr.sectionTitle}</h2>
      </header>

      <article
        className="shop-card shop-featured cursor-pointer"
        onClick={inspect}
        role="button"
        tabIndex={0}
        aria-label={title}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inspect()
          }
        }}
      >
        <header className="shop-featured__head">
          <h3 className="shop-detail__title">{title}</h3>
          <ProductMeta product={product} lang={lang} className="shop-meta--lg mt-2" />
        </header>

        {/* Marco con paspartú como el de la card: un control dentro de la
            card, no otra caja (§15.1.7). */}
        <div
          ref={mediaRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="shop-featured__media"
          style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
        >
          <div
            className="absolute inset-5 sm:inset-8 z-[1] flex items-center justify-center transition-transform duration-200 ease-out"
            style={{
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.03 : 1})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <img
              src={product.image}
              alt={title}
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
          {isSoldOut && <SoldOutTape label={tr.soldOut} tiles={12} />}
        </div>

        {description && (
          <p className="shop-featured__body text-white/75 text-base sm:text-lg leading-relaxed whitespace-pre-line">
            {description}
          </p>
        )}

        <footer className="shop-featured__foot">
          <PriceTag
            size="lg"
            amount={finalPrice}
            struck={hasDiscount ? originalPrice : product.priceOriginal}
            pct={hasDiscount ? pct : 0}
          />
          <AddButton product={product} lang={lang} onAdd={onAdd} className="min-h-[52px] px-7 text-sm" />
        </footer>
      </article>
    </section>
  )
}
