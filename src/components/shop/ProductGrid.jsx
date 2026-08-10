import React, { useMemo, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import { SHOP_CATEGORIES } from '../../lib/shopMockData.js'
import { useShopData } from '../../lib/shopDataContext.jsx'

// Patrón de pesos de la retícula irregular. Tesela exacto en 12 columnas:
//   fila 1 → hero(6, 2 filas) + std(3) + std(3)
//   fila 2 → hero            + std(3) + std(3)
//   fila 3 → wide(6)         + hero del siguiente ciclo
// El efecto secundario es que el hero alterna de lado en cada tanda, que es
// lo que hace que la grilla se lea irregular sin volverse un tetris random.
const WEIGHT_PATTERN = ['hero', 'std', 'std', 'std', 'std', 'wide']
const weightForIndex = (i) => WEIGHT_PATTERN[i % WEIGHT_PATTERN.length]

export default function ProductGrid({ lang = 'en', onAdd, onInspect }) {
  const [active, setActive] = useState('all')
  const isEn = lang === 'en'
  const { products, loading, error } = useShopData()

  const filtered = useMemo(() => {
    if (active === 'all') return products
    return products.filter((p) => p.category === active)
  }, [active, products])

  const tr = {
    headingA: isEn ? 'Lost' : 'Objetos',
    headingB: isEn ? 'Items' : 'Perdidos',
    empty: isEn ? 'Nothing recovered in this category yet.' : 'Todavía no hay nada recuperado en esta categoría.',
    loading: isEn ? 'Opening the archive…' : 'Abriendo el archivo…',
    errorMsg: isEn ? 'The archive is not responding.' : 'El archivo no responde.',
  }

  return (
    <section className="relative w-full px-4 sm:px-8 lg:px-10 py-10 sm:py-20">
      {/* Cap alto y suave: a sangre en cualquier laptop/monitor normal, y
          evita que en ultrawide la retícula se estire hasta lo ilegible. */}
      <div className="max-w-[2000px] mx-auto">
        {/* Solo el título. Sin eyebrow ni contador — ver DESIGN.md §0.7.
            Una sola línea (`whitespace-nowrap`): el clamp de --xl es en vw,
            así que a cualquier ancho el ancho del texto escala con él y nunca
            desborda el contenedor. */}
        <header className="mb-8 sm:mb-14 text-center">
          <h2 className="shop-display shop-display--xl whitespace-nowrap">
            {tr.headingA} <span className="text-[#e600ff]">{tr.headingB}</span>
          </h2>
        </header>

        {/* Filtros — chips centrados. El `justify-center` va gateado a sm:
            porque en mobile el contenedor scrollea horizontal, y centrar el
            contenido de un scroller deja las primeras categorías cortadas. */}
        <div
          className="flex flex-nowrap sm:flex-wrap sm:justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 overflow-x-auto no-native-scrollbar pb-1"
          role="tablist"
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
                className="shop-chip px-4 sm:px-5 py-2 text-[11px] sm:text-xs whitespace-nowrap flex-shrink-0"
              >
                {lang === 'en' ? cat.label_en : cat.label_es}
              </button>
            )
          })}
        </div>

        {/* Retícula */}
        {loading ? (
          <p className="shop-kicker text-white/50 py-24 text-center">{tr.loading}</p>
        ) : error ? (
          <p className="shop-kicker text-red-400 py-24 text-center">{tr.errorMsg}</p>
        ) : filtered.length === 0 ? (
          <p className="shop-kicker text-white/50 py-24 text-center">{tr.empty}</p>
        ) : (
          <div className="shop-reticle" data-shop-grid>
            {filtered.map((p, i) => {
              const weight = weightForIndex(i)
              return (
                <div key={p.id} className={`shop-w-${weight}`} data-shop-grid-item>
                  <ProductCard
                    product={p}
                    lang={lang}
                    weight={weight}
                    onAdd={onAdd}
                    onInspect={onInspect}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
