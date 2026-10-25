import React from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { formatAmount } from '../../lib/shopProduct.js'

/**
 * Precio de una pieza: el monto grande y la moneda chica aparte. Debajo, si
 * hay, el precio tachado — el de comparación del CMS o, con golden ticket, el
 * de antes del descuento junto al porcentaje.
 */
export default function PriceTag({ amount, struck = null, pct = 0, size = 'md', className = '' }) {
  const { currency } = useShopData()
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={`shop-price ${size === 'lg' ? 'shop-price--lg' : size === 'sm' ? 'shop-price--sm' : ''}`}>
        {formatAmount(amount)}
        <span className="shop-price__currency">{currency}</span>
      </p>
      {struck ? (
        <p className="mt-1 text-sm text-white/50 tabular-nums">
          <span className="line-through decoration-[#e600ff] decoration-2">{formatAmount(struck)}</span>
          {pct > 0 && <span className="ml-2 font-bold text-[#e600ff]">−{pct}%</span>}
        </p>
      ) : null}
    </div>
  )
}
