import React, { useRef, useState } from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'

// Producto destacado. Mockup con parallax CSS (hover tilt) en vez de Canvas
// extra para mantener el bundle ligero — el sitio ya tiene un Canvas global.
export default function FeaturedArtifact({ lang = 'en', onAdd, onInspect }) {
  const { featured: product, formatPrice } = useShopData()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef(null)
  if (!product) return null

  const onMouseMove = (e) => {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setTilt({ x: (y - 0.5) * -12, y: (x - 0.5) * 12 })
  }
  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const description = isEn ? product.description_en : product.description_es

  // i18n strings
  const tr = {
    sectionTitle: isEn ? 'FEATURED LOST ITEM' : 'OBJETO PERDIDO DESTACADO',
    liveArchive: isEn ? 'LIVE ARCHIVE' : 'ARCHIVO EN VIVO',
    rec: isEn ? '●REC' : '●REC',
    classLabel: isEn ? 'CLASS' : 'CLASE',
    itemId: isEn ? 'ITEM ID' : 'ID DEL ITEM',
    recovered: isEn ? 'RECOVERED' : 'RECUPERADO',
    unitsRemaining: isEn ? 'UNITS REMAINING' : 'UNIDADES RESTANTES',
    status: isEn ? 'STATUS' : 'ESTATUS',
    available: isEn ? 'AVAILABLE' : 'DISPONIBLE',
    archivedStatus: isEn ? 'ARCHIVED' : 'ARCHIVADO',
    addToCart: isEn ? 'ADD TO CART' : 'AGREGAR AL CARRITO',
    inspect: isEn ? 'INSPECT' : 'INSPECCIONAR',
  }

  return (
    <section className="relative w-full py-6 sm:py-20 px-4 sm:px-10 bg-black rounded-2xl overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-[#e600ff]/20" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#e600ff]/20" />

      <div className="max-w-6xl mx-auto">
        <div
          className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8 text-[11px] sm:text-sm uppercase tracking-widest"
          style={{ fontFamily: '"Cascadia Code", monospace', color: '#e600ff' }}
        >
          <span className="opacity-60 shrink-0">&gt;</span>
          <span className="font-bold truncate">{tr.sectionTitle}</span>
          <span className="flex-1 h-px bg-[#e600ff]/30" />
          <span className="opacity-60 shrink-0 text-[10px] sm:text-sm">{product.archiveId}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 sm:gap-8 lg:gap-12 items-center">
          {/* Mockup con parallax tilt */}
          <div
            ref={cardRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="relative group aspect-square lg:aspect-auto lg:min-h-[480px] bg-gradient-to-br from-[#0a0f20] via-black to-[#0a0f20] border-2 border-[#e600ff]/40 rounded-2xl overflow-hidden"
            style={{
              perspective: '1000px',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="absolute inset-0 shop-halftone opacity-40 pointer-events-none z-[2]" />
            <div className="absolute inset-0 shop-scanlines pointer-events-none z-[2]" />
            <span className="absolute top-2 left-2 text-[#e600ff]/80 text-xs font-mono z-[3]">[01]</span>
            <span className="absolute top-2 right-2 text-[#e600ff]/80 text-xs font-mono z-[3]">{product.archiveId}</span>
            <span className="absolute bottom-2 left-2 text-[#e600ff]/80 text-xs font-mono z-[3]">{tr.liveArchive}</span>
            <span className="absolute bottom-2 right-2 text-[#e600ff]/80 text-xs font-mono z-[3] shop-blink">{tr.rec}</span>

            <div
              className="absolute inset-8 z-[1] flex items-center justify-center transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.04 : 1})`,
                transformStyle: 'preserve-3d',
              }}
            >
              <img
                src={product.image}
                alt={title}
                className="w-full h-full object-cover drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                draggable={false}
              />
            </div>

            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-[1]"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(230, 0, 255, 0.15) 0%, transparent 60%)',
              }}
            />
          </div>

          {/* Ficha técnica */}
          <div className="flex flex-col gap-4 sm:gap-6" style={{ fontFamily: '"Cascadia Code", monospace' }}>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black uppercase text-white leading-tight">
              {title}
            </h2>

            <div className="border border-[#e600ff]/30 rounded-xl overflow-hidden divide-y divide-[#e600ff]/15 text-xs sm:text-sm">
              <SpecRow k={tr.itemId} v={product.archiveId} />
              <SpecRow k={tr.classLabel} v={(product.categoryLabel || product.category).toUpperCase()} />
              <SpecRow k={tr.recovered} v={product.recoveredDate} />
              <SpecRow
                k={tr.unitsRemaining}
                v={<span className={product.unitsRemaining < 20 ? 'text-red-400 shop-blink' : 'text-white'}>{product.unitsRemaining}</span>}
              />
              <SpecRow
                k={tr.status}
                v={<span className="text-green-400">● {tr.available}</span>}
              />
            </div>

            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              {description}
            </p>

            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                {product.priceOriginal && (
                  <span className="text-white/40 text-base sm:text-lg line-through decoration-[#e600ff] decoration-2">
                    {formatPrice(product.priceOriginal)}
                  </span>
                )}
                <span
                  className="text-[2.5rem] sm:text-5xl font-black leading-none"
                  style={{ color: '#e600ff', textShadow: '0 0 16px rgba(230, 0, 255, 0.5)' }}
                >
                  {formatPrice(product.price)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onAdd && onAdd(product)}
                className="w-full sm:flex-1 sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 h-12 sm:h-auto sm:py-3 text-sm font-bold uppercase tracking-widest border-2 rounded-full bg-[#e600ff] text-black border-[#e600ff] hover:shadow-[0_0_24px_rgba(230,0,255,0.6)] active:scale-95 transition-all"
              >
                <span>&gt;_</span>
                <span>{tr.addToCart}</span>
              </button>
              <button
                type="button"
                onClick={() => onInspect && onInspect(product)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 h-12 sm:h-auto sm:py-3 text-sm font-bold uppercase tracking-widest border-2 rounded-full border-white/40 text-white hover:border-white hover:bg-white/10 active:scale-95 transition-all"
              >
                <span>{tr.inspect}</span>
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
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[#e600ff]/70 uppercase tracking-widest text-xs">{k}</span>
      <span className="text-white font-bold">{v}</span>
    </div>
  )
}
