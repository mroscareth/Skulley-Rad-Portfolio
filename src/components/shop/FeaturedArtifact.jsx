import React, { useRef, useState } from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { usePriceWithDiscount } from '../../lib/usePriceWithDiscount.js'

// Producto destacado. Mockup con parallax CSS (hover tilt) en vez de Canvas
// extra para mantener el bundle ligero — el sitio ya tiene un Canvas global.
export default function FeaturedArtifact({ lang = 'en', onAdd, onInspect }) {
  const { featured: product, formatPrice } = useShopData()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef(null)
  const {
    finalPrice: featuredFinalPrice,
    originalPrice: featuredOriginalPrice,
    hasDiscount: featuredHasDiscount,
  } = usePriceWithDiscount(product?.price ?? 0, product?.priceOriginal ?? null)
  if (!product) return null

  const onMouseMove = (e) => {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setTilt({ x: (y - 0.5) * -10, y: (x - 0.5) * 10 })
  }
  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const description = isEn ? product.description_en : product.description_es

  const tr = {
    sectionTitle: isEn ? 'Featured item' : 'Objeto destacado',
    classLabel: isEn ? 'Class' : 'Clase',
    itemId: isEn ? 'Item' : 'Item',
    recovered: isEn ? 'Recovered' : 'Recuperado',
    unitsRemaining: isEn ? 'Units left' : 'Unidades',
    status: isEn ? 'Status' : 'Estatus',
    available: isEn ? 'Available' : 'Disponible',
    addToCart: isEn ? 'Add to cart' : 'Agregar al carrito',
    inspect: isEn ? 'Inspect' : 'Inspeccionar',
  }

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-10 py-10 sm:py-20">
      <div className="max-w-[2000px] mx-auto">
        {/* Título del MÓDULO, centrado. El nombre del producto no vive acá:
            va dentro de la ficha, junto a su descripción y specs. */}
        <header className="mb-8 sm:mb-14 text-center">
          <h2 className="shop-display shop-display--lg">{tr.sectionTitle}</h2>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 sm:gap-10 lg:gap-16 items-stretch">
          {/* Mockup con parallax tilt */}
          <div
            ref={cardRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="shop-panel relative group aspect-square lg:aspect-auto lg:min-h-[560px] overflow-hidden"
            style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
          >
            <div
              className="absolute inset-6 sm:inset-10 z-[1] flex items-center justify-center transition-transform duration-200 ease-out"
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
          </div>

          {/* Ficha — acá vive el nombre del producto, encabezando su info */}
          <div className="flex flex-col justify-center gap-5 sm:gap-7">
            <h3 className="shop-display shop-display--md">{title}</h3>

            <p className="text-white/75 text-base sm:text-xl leading-relaxed">
              {description}
            </p>

            <dl className="border-t border-white/10">
              <SpecRow k={tr.itemId} v={product.archiveId} />
              <SpecRow k={tr.classLabel} v={product.categoryLabel || product.category} />
              <SpecRow k={tr.recovered} v={product.recoveredDate} />
              <SpecRow
                k={tr.unitsRemaining}
                v={<span className={product.unitsRemaining < 20 ? 'text-red-400' : 'text-white'}>{product.unitsRemaining}</span>}
              />
              <SpecRow k={tr.status} v={<span className="text-green-400">{tr.available}</span>} />
            </dl>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="shop-display shop-display--md text-white">
                {formatPrice(featuredFinalPrice)}
              </span>
              {(featuredHasDiscount || product.priceOriginal) && (
                <span className="text-white/40 text-base sm:text-lg line-through decoration-[#e600ff] decoration-2">
                  {formatPrice(featuredHasDiscount ? featuredOriginalPrice : product.priceOriginal)}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onAdd && onAdd(product)}
                className="shop-btn shop-btn--primary w-full sm:w-auto sm:flex-1 min-h-[52px] px-8 text-sm"
              >
                {tr.addToCart}
              </button>
              <button
                type="button"
                onClick={() => onInspect && onInspect(product)}
                className="shop-btn shop-btn--ghost w-full sm:w-auto min-h-[52px] px-8 text-sm"
              >
                {tr.inspect}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SpecRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/10">
      <dt className="shop-kicker text-white/45">{k}</dt>
      <dd className="text-white font-semibold text-sm sm:text-base text-right">{v}</dd>
    </div>
  )
}
