import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronRightIcon, MinusIcon, PlusIcon, ShoppingCartIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useShopCartCtx } from '../../lib/shopCartContext.jsx'
import { removeFromCart } from '../../lib/addToCart.js'

const ADDED_MS = 1800 // cuánto se queda el botón en "Agregado"

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * La acción de una pieza fuera del detalle (card y destacada). El texto dice
 * lo que va a pasar (heurística 01/02):
 *
 *   Agregar   → al carrito, ahí mismo, y el botón se vuelve el indicador.
 *   − 2 +     → el indicador (pedido de Oscar, 2026-11-10): cuántas lleva el
 *              carrito, con más y menos ahí mismo. Con 1, el menos es el bote
 *              y regresa a Agregar. El más se detiene en el stock.
 *   Elegir ›  → la pieza tiene talla/color: abre el detalle para escoger. Aquí
 *              no hay indicador: el carrito puede tener varias variantes.
 *   Agotado   → deshabilitado.
 *   Agregado ✓ durante ADDED_MS, solo en piezas con opciones y cuando el
 *              carrito de verdad lo aceptó: addProductToCart avisa con
 *              `shop-toast`, y no avisa si no quedaba stock.
 *
 * El chevron de "Elegir" va DESPUÉS del texto: antes se leería como el
 * prompt `>` de la terminal que el sitio ya no usa.
 */
export default function AddButton({ product, lang = 'en', onAdd, className = '' }) {
  const cart = useShopCartCtx()
  const [added, setAdded] = useState(false)
  const isEn = lang === 'en'
  const title = isEn ? product.title_en : product.title_es
  const isSoldOut = !product.inStock || product.unitsRemaining === 0
  const needsChoice = product.hasOptions

  const enCarrito = needsChoice ? null : cart.items.find(it => it.variantId === product.defaultVariantId)
  const qty = enCarrito?.qty || 0
  const enTope = !!enCarrito && qty >= enCarrito.maxQty
  const indicador = qty > 0 && !isSoldOut

  const pillRef = useRef(null)
  const masRef = useRef(null)
  const agregarRef = useRef(null)
  const prevQty = useRef(qty)
  const focoPendiente = useRef(null) // 'mas' | 'agregar': el botón que tenía el foco se desmontó
  // Hacia dónde rueda el número: se decide en el render, antes de pintarlo.
  const [rueda, setRueda] = useState({ qty, dir: 'up' })
  if (rueda.qty !== qty) setRueda({ qty, dir: qty > rueda.qty ? 'up' : 'down' })

  useEffect(() => {
    if (!added) return undefined
    const t = setTimeout(() => setAdded(false), ADDED_MS)
    return () => clearTimeout(t)
  }, [added])
  useEffect(() => {
    if (!needsChoice) return undefined
    const onToast = (e) => {
      if (e?.detail?.product?.id === product.id) setAdded(true)
    }
    window.addEventListener('shop-toast', onToast)
    return () => window.removeEventListener('shop-toast', onToast)
  }, [product.id, needsChoice])

  // Cada cambio de cantidad: el número rueda hacia donde fue y la píldora da un
  // salto (más fuerte al subir). Al ir y volver de Agregar, el foco del teclado
  // pasa al control nuevo en vez de perderse en el body.
  useLayoutEffect(() => {
    const antes = prevQty.current
    prevQty.current = qty
    if (antes === qty) return
    if (focoPendiente.current === 'mas' && masRef.current) masRef.current.focus({ preventScroll: true })
    if (focoPendiente.current === 'agregar' && agregarRef.current) agregarRef.current.focus({ preventScroll: true })
    focoPendiente.current = null
    if (reduceMotion()) return
    const el = qty > 0 ? pillRef.current : agregarRef.current
    if (!el?.animate) return
    const pico = qty > antes ? 1.08 : 0.94
    el.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${pico})` }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }, [qty])

  const tr = {
    soldOut: isEn ? 'Sold out' : 'Agotado',
    add: isEn ? 'Add' : 'Agregar',
    choose: isEn ? 'Choose' : 'Elegir',
    added: isEn ? 'Added' : 'Agregado',
    addAria: isEn ? `Add ${title} to cart` : `Agregar ${title} al carrito`,
    chooseAria: isEn ? `Choose options for ${title}` : `Elegir opciones de ${title}`,
    inCart: isEn ? `${title} in your cart` : `${title} en tu carrito`,
    more: isEn ? 'Add one more' : 'Agregar otra',
    less: isEn ? 'Remove one' : 'Quitar una',
    remove: isEn ? 'Remove from cart' : 'Quitar del carrito',
    tope: isEn ? 'That’s all of them' : 'Ya no hay más',
  }

  if (indicador) {
    const menos = qty <= 1 ? tr.remove : tr.less
    return (
      <div
        ref={pillRef}
        role="group"
        aria-label={tr.inCart}
        onClick={(e) => e.stopPropagation()}
        className={`shop-btn shop-btn--primary shop-stepper shrink-0 ${className}`}
      >
        {/* Molde invisible del botón de Agregar, con su mismo padding: el
            indicador nunca queda más angosto que el botón que reemplazó, y
            crece solo si − cantidad + no le cabe. */}
        <span className={`shop-stepper__molde ${className}`} aria-hidden>
          <ShoppingCartIcon className="w-4 h-4 -ml-0.5" />
          <span>{tr.add}</span>
        </span>
        <span className="shop-stepper__fila">
        <button
          type="button"
          className="shop-stepper__btn"
          aria-label={menos}
          data-tip={menos}
          onClick={(e) => {
            e.stopPropagation()
            if (qty <= 1 && e.currentTarget === document.activeElement) focoPendiente.current = 'agregar'
            removeFromCart(cart, product.id, product.defaultVariantId, qty - 1)
          }}
        >
          {qty <= 1 ? <TrashIcon className="w-4 h-4" aria-hidden /> : <MinusIcon className="w-4 h-4" aria-hidden />}
        </button>
        <span className="shop-stepper__qty" aria-live="polite">
          <span key={qty} className="shop-stepper__num" data-dir={rueda.dir}>{qty}</span>
        </span>
        <button
          ref={masRef}
          type="button"
          className="shop-stepper__btn"
          aria-label={enTope ? tr.tope : tr.more}
          aria-disabled={enTope || undefined}
          data-tip={enTope ? tr.tope : tr.more}
          onClick={(e) => {
            e.stopPropagation()
            if (!enTope && onAdd) onAdd(product)
          }}
        >
          <PlusIcon className="w-4 h-4" aria-hidden />
        </button>
        </span>
      </div>
    )
  }

  const label = isSoldOut ? tr.soldOut : added ? tr.added : needsChoice ? tr.choose : tr.add
  const LeadIcon = isSoldOut || (needsChoice && !added) ? null : added ? CheckIcon : ShoppingCartIcon
  const aria = isSoldOut
    ? `${tr.soldOut}: ${title}`
    : added ? `${tr.added}: ${title}` : needsChoice ? tr.chooseAria : tr.addAria

  return (
    <button
      ref={agregarRef}
      type="button"
      disabled={isSoldOut}
      aria-label={aria}
      onClick={(e) => {
        // Vive dentro de superficies clickeables (la card abre el detalle).
        e.stopPropagation()
        if (isSoldOut || !onAdd) return
        if (!needsChoice && e.currentTarget === document.activeElement) focoPendiente.current = 'mas'
        onAdd(product)
      }}
      className={`shop-btn shop-btn--primary shrink-0 ${className}`}
    >
      {LeadIcon && <LeadIcon className="w-4 h-4 -ml-0.5" aria-hidden />}
      <span>{label}</span>
      {needsChoice && !added && !isSoldOut && <ChevronRightIcon className="w-4 h-4 -mr-1" aria-hidden />}
    </button>
  )
}
