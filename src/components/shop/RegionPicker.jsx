import React from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'

// Destino de envío, y con él la moneda.
//
// No es un selector de moneda a secas: la región decide también las tarifas de
// envío y qué piezas están a la venta, y el checkout cobra en la moneda de la
// región. Enseñar USD a quien va a pagar en pesos sería mentirle, así que se
// elige el destino y la moneda viene con él. La elección se recuerda en
// localStorage (lo hace setRegion).
export default function RegionPicker({ lang }) {
  const { regions, region, setRegion } = useShopData()
  const isEn = lang === 'en'

  if (regions.length < 2) return null

  return (
    <div className="px-5 sm:px-8 pt-10 sm:pt-14">
      <div
        className="max-w-[2000px] mx-auto flex justify-center gap-2"
        role="group"
        aria-label={isEn ? 'Shipping destination and currency' : 'Destino de envío y moneda'}
      >
        {regions.map((r) => {
          const isActive = region?.code === r.code
          return (
            <button
              key={r.code}
              type="button"
              aria-pressed={isActive}
              onClick={() => setRegion(r.code)}
              title={isEn
                ? `Ship to ${r.name_en} — prices in ${r.currency}`
                : `Enviar a ${r.name_es} — precios en ${r.currency}`}
              className={`shop-chip px-3 py-1.5 text-[10px] sm:text-[11px] whitespace-nowrap flex-shrink-0 ${isActive ? '' : 'opacity-55 hover:opacity-100'}`}
            >
              {(isEn ? r.name_en : r.name_es).toUpperCase()} · {r.currency}
            </button>
          )
        })}
      </div>
    </div>
  )
}
