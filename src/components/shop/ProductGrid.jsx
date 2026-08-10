import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import { SHOP_CATEGORIES } from '../../lib/shopMockData.js'
import { useShopData } from '../../lib/shopDataContext.jsx'

// Patrón de anchos. Ya NO hay filas fijas: la altura de cada card la decide su
// propia imagen (ver useMasonrySpans abajo).
//
// Tres `hero` seguidos y luego cuatro `std` NO es capricho: en 12 columnas,
// 3 heroes de 4 teselan una fila (4+4+4) y 4 std de 3 teselan otra (3+3+3+3).
// Mezclarlos en la misma fila dejaría sobrantes de 1 o 2 columnas donde no
// cabe nada, y `dense` no los podría rellenar nunca.
//
// El hero mide 4 columnas y no 6 a propósito: a 6 era exactamente el DOBLE de
// ancho que un std, y como la imagen manda el alto, salía también del doble de
// alto (~900px) — se comía la pantalla. A 4 el salto es de 1.33×.
const WEIGHT_PATTERN = ['hero', 'hero', 'hero', 'std', 'std', 'std', 'std']
const weightForIndex = (i) => WEIGHT_PATTERN[i % WEIGHT_PATTERN.length]

// Masonry por row-span. La retícula corre con filas finísimas
// (`grid-auto-rows: 8px`) y cada item se queda con las filas que necesite:
//
//   span = ceil((alto real de la card + gap) / (8px + gap))
//
// Es la única forma de tener a la vez proporción exacta y cero hueco cuando
// las piezas vienen en formatos distintos (el catálogo mezcla 1:1 y 4:5). Un
// alto fijo por celda obliga a recortar; un `object-contain` sobre alto fijo
// deja paspartú. Esto no hace ninguna de las dos.
//
// El ResizeObserver es obligatorio, no una optimización: la ratio real de cada
// pieza sólo se conoce cuando su imagen carga, y en ese momento la card cambia
// de alto y hay que re-medir. También cubre resize de ventana y cambio de
// fuente sin escuchar nada más.
function useMasonrySpans(gridRef, deps) {
  const rafRef = useRef(0)

  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const cs = window.getComputedStyle(grid)
      const rowUnit = parseFloat(cs.gridAutoRows) || 0
      // Sin filas finas (breakpoint chico o CSS no aplicado) el masonry se
      // apaga solo y la retícula vuelve a fluir normal.
      if (rowUnit <= 0) return
      for (const item of grid.children) {
        const card = item.firstElementChild
        if (!card) continue
        const h = card.getBoundingClientRect().height
        if (!h) continue
        // El separador vertical vive en el `padding-bottom` del item, no en
        // `row-gap` (ver index.css). Tiene que entrar en el span: si no, la
        // pista mide solo la card, la siguiente fila arranca 20px antes y el
        // aire entre piezas desaparece.
        const pad = parseFloat(window.getComputedStyle(item).paddingBottom) || 0
        item.style.gridRowEnd = `span ${Math.max(1, Math.ceil(h + pad))}`
      }
    })
  }, [gridRef])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(grid)
    for (const item of grid.children) {
      if (item.firstElementChild) ro.observe(item.firstElementChild)
    }
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])
}

export default function ProductGrid({ lang = 'en', onAdd, onInspect }) {
  const [active, setActive] = useState('all')
  const isEn = lang === 'en'
  const { products, loading, error } = useShopData()
  const gridRef = useRef(null)

  const filtered = useMemo(() => {
    if (active === 'all') return products
    return products.filter((p) => p.category === active)
  }, [active, products])

  // Re-observa cuando cambia el set de cards (filtro de categoría o llegada de
  // los productos), porque los hijos del grid son otros.
  useMasonrySpans(gridRef, [filtered.length, loading])

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
          <div className="shop-reticle" data-shop-grid ref={gridRef}>
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
