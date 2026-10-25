import React, { useEffect, useState } from 'react'
import { CheckIcon, ChevronRightIcon, ShoppingCartIcon } from '@heroicons/react/24/solid'

const ADDED_MS = 1800 // cuánto se queda el botón en "Agregado"

/**
 * La acción de una pieza fuera del detalle (card y destacada). El texto dice
 * lo que va a pasar (heurística 01/02):
 *
 *   Agregar   → al carrito, ahí mismo.
 *   Elegir ›  → la pieza tiene talla/color: abre el detalle para escoger.
 *   Agotado   → deshabilitado.
 *   Agregado ✓ durante ADDED_MS, solo cuando el carrito de verdad lo aceptó:
 *              Shop.handleAdd avisa con `shop-toast`, y no avisa si no quedaba
 *              stock.
 *
 * El chevron de "Elegir" va DESPUÉS del texto: antes se leería como el
 * prompt `>` de la terminal que el sitio ya no usa.
 */
export default function AddButton({ product, lang = 'en', onAdd, className = '' }) {
  const [added, setAdded] = useState(false)
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const needsChoice = product.hasOptions

  useEffect(() => {
    if (!added) return undefined
    const t = setTimeout(() => setAdded(false), ADDED_MS)
    return () => clearTimeout(t)
  }, [added])
  useEffect(() => {
    const onToast = (e) => {
      if (e?.detail?.product?.id === product.id) setAdded(true)
    }
    window.addEventListener('shop-toast', onToast)
    return () => window.removeEventListener('shop-toast', onToast)
  }, [product.id])

  const tr = {
    soldOut: isEn ? 'Sold out' : 'Agotado',
    add: isEn ? 'Add' : 'Agregar',
    choose: isEn ? 'Choose' : 'Elegir',
    added: isEn ? 'Added' : 'Agregado',
    addAria: isEn ? `Add ${title} to cart` : `Agregar ${title} al carrito`,
    chooseAria: isEn ? `Choose options for ${title}` : `Elegir opciones de ${title}`,
  }

  const label = isSoldOut ? tr.soldOut : added ? tr.added : needsChoice ? tr.choose : tr.add
  const LeadIcon = isSoldOut || (needsChoice && !added) ? null : added ? CheckIcon : ShoppingCartIcon
  const aria = isSoldOut
    ? `${tr.soldOut}: ${title}`
    : added ? `${tr.added}: ${title}` : needsChoice ? tr.chooseAria : tr.addAria

  return (
    <button
      type="button"
      disabled={isSoldOut}
      aria-label={aria}
      onClick={(e) => {
        // Vive dentro de superficies clickeables (la card abre el detalle).
        e.stopPropagation()
        if (!isSoldOut && onAdd) onAdd(product)
      }}
      className={`shop-btn shop-btn--primary shrink-0 ${className}`}
    >
      {LeadIcon && <LeadIcon className="w-4 h-4 -ml-0.5" aria-hidden />}
      <span>{label}</span>
      {needsChoice && !added && !isSoldOut && <ChevronRightIcon className="w-4 h-4 -mr-1" aria-hidden />}
    </button>
  )
}
