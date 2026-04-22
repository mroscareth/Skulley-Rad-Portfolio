// Devuelve el precio final y el original tachado para un producto, aplicando
// el activeDiscount (golden ticket) si existe.
//
// Comportamiento:
//   - Sin discount activo: { finalPrice: basePrice, originalPrice: product.priceOriginal ?? null, hasDiscount: false }
//     → muestra el compareAtPrice de Shopify tachado (si existe) y el price normal.
//   - Con discount activo (ej. 35% ticket): { finalPrice: basePrice*0.65, originalPrice: basePrice, hasDiscount: true }
//     → muestra el price normal tachado y el discounted prominente. Ignora compareAtPrice
//       para evitar mostrar 3 precios apilados (ya Shopify cobra el 35% sobre el price final).
//
// Aritmética en centavos para evitar drift en monedas como MXN.

import { useActiveDiscount } from './useActiveDiscount.js'

export function usePriceWithDiscount(basePrice, productPriceOriginal = null) {
  const { active } = useActiveDiscount()
  const pct = Number(active?.pct || 0)
  const price = Number(basePrice || 0)

  if (pct <= 0 || pct >= 100 || price <= 0) {
    return {
      finalPrice: price,
      originalPrice: productPriceOriginal ?? null,
      hasDiscount: false,
      pct: 0,
    }
  }

  const cents = Math.round(price * 100)
  const discountedCents = Math.max(0, Math.round(cents * (1 - pct / 100)))
  return {
    finalPrice: discountedCents / 100,
    originalPrice: price,
    hasDiscount: true,
    pct,
  }
}
