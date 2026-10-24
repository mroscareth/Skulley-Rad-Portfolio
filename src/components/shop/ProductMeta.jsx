import React from 'react'

const DEFAULT_ACCENT = '#e600ff'
const LOW_STOCK = 20

/**
 * La línea de abajo del nombre de una pieza: qué es y, si apremia, cuántas
 * quedan. La misma en la card y en el detalle (heurística 04: lo que se ve
 * igual dice lo mismo).
 *
 * El color de la categoría (CMS → store_settings) vive como punto junto al
 * nombre de la categoría, nunca como superficie. El stock bajo le gana a la
 * edición porque es lo que cambia la decisión.
 */
export default function ProductMeta({ product, lang = 'en', className = '' }) {
  const isEn = lang === 'en'
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const lowStock = !isSoldOut && product.edition !== 'unique' && product.unitsRemaining < LOW_STOCK

  const edition = product.edition === 'unique'
    ? (isEn ? 'One of one' : 'Pieza única')
    : product.edition === 'limited' && product.editionSize
      ? (isEn ? `Edition of ${product.editionSize}` : `Tiraje de ${product.editionSize}`)
      : null
  const detail = lowStock
    ? (isEn ? `${product.unitsRemaining} left` : `Quedan ${product.unitsRemaining}`)
    : edition

  if (!product.categoryLabel && !detail) return null

  return (
    <p className={`shop-meta ${className}`}>
      {product.categoryLabel && (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: product.categoryColor || DEFAULT_ACCENT }}
            aria-hidden
          />
          <span className="truncate">{product.categoryLabel}</span>
        </span>
      )}
      {product.categoryLabel && detail && <span aria-hidden className="text-white/30">·</span>}
      {detail && (
        <span className={`truncate ${lowStock ? 'text-red-400 font-bold' : ''}`}>{detail}</span>
      )}
    </p>
  )
}
