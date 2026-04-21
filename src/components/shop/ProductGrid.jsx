import React, { useMemo, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import { PRODUCTS, SHOP_CATEGORIES } from '../../lib/shopMockData.js'

// Grid con filtros de categoría tipo tabs archivistas.
export default function ProductGrid({ lang = 'en', onAdd, onInspect }) {
  const [active, setActive] = useState('all')
  const isEn = lang === 'en'

  const filtered = useMemo(() => {
    if (active === 'all') return PRODUCTS
    return PRODUCTS.filter((p) => p.category === active)
  }, [active])

  const tr = {
    heading: isEn ? 'SKULLEY RAD LOST ITEMS' : 'OBJETOS PERDIDOS DE SKULLEY RAD',
    counter: (n) => isEn ? `${n} LOST ITEMS` : `${n} OBJETOS PERDIDOS`,
    empty: isEn ? 'No lost items in this category.' : 'Sin objetos perdidos en esta categoría.',
  }

  return (
    <section className="relative w-full py-10 sm:py-20 px-4 sm:px-10 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Header — counter escondido en mobile para no wrap con heading largo */}
        <div
          className="flex items-center gap-3 mb-6 sm:mb-8 text-xs sm:text-sm uppercase tracking-widest"
          style={{ fontFamily: '"Cascadia Code", monospace', color: '#e600ff' }}
        >
          <span className="opacity-60">&gt;</span>
          <span className="font-bold flex-shrink min-w-0 truncate">{tr.heading}</span>
          <span className="flex-1 h-px bg-[#e600ff]/30" />
          <span className="hidden sm:inline text-white/60 text-xs whitespace-nowrap">
            {tr.counter(filtered.length)}
          </span>
        </div>

        {/* Tabs — filtros. Scroll horizontal en mobile si hay muchas categorías */}
        <div
          className="flex flex-nowrap sm:flex-wrap gap-0 mb-6 sm:mb-8 border-b-2 border-[#e600ff]/30 overflow-x-auto no-native-scrollbar"
          role="tablist"
          style={{ fontFamily: '"Cascadia Code", monospace' }}
        >
          {SHOP_CATEGORIES.map((cat) => {
            const isActive = active === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(cat.id)}
                className={`relative px-3 sm:px-5 py-2 text-[11px] sm:text-sm font-bold uppercase tracking-widest transition-colors whitespace-nowrap flex-shrink-0 ${isActive
                  ? 'text-black bg-[#e600ff]'
                  : 'text-[#e600ff]/70 hover:text-[#e600ff] hover:bg-[#e600ff]/10'
                  }`}
              >
                {isActive && <span className="mr-1">[</span>}
                {lang === 'en' ? cat.label_en : cat.label_es}
                {isActive && <span className="ml-1">]</span>}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div
            className="text-center py-20 text-white/60 text-sm"
            style={{ fontFamily: '"Cascadia Code", monospace' }}
          >
            &gt; {tr.empty}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-4 sm:gap-6"
            data-shop-grid
          >
            {filtered.map((p) => (
              <div key={p.id} data-shop-grid-item>
                <ProductCard
                  product={p}
                  lang={lang}
                  onAdd={onAdd}
                  onInspect={onInspect}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
