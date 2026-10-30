import { playSfx } from './sfx.js'

// Agregar al carrito una variante ya elegida (o la default). Lo usan la tienda
// (Shop.jsx) y la tarjeta de la home de teléfono. Quien llama decide antes qué
// hacer con una pieza que tiene opciones y llega sin variante: abrir la ficha.
//
// Capamos la qty al stock disponible de la variante, restando lo que ya esté
// en el carrito — así nunca mandamos a checkout más de lo que hay. El backend
// vuelve a validar al cobrar; esto solo evita la sorpresa.
//
// Devuelve true si entró algo. `shop-toast` avisa a la tarjeta (AddButton pasa
// a "Agregado") y al toast de la tienda; no se manda si no quedaba stock.
export function addProductToCart(cart, product, qty = 1, selectedOptions = null, variantId = null) {
  const finalVariantId = variantId || product.defaultVariantId
  const variant = product.variants?.find(v => v.id === finalVariantId)
  if (!variant?.availableForSale) return false
  // quantityAvailable null = sin límite (digitales, impresión bajo demanda).
  const tracked = typeof variant.quantityAvailable === 'number'
  const existingQty = cart.items.find(it => it.variantId === finalVariantId)?.qty || 0
  const maxAvailable = tracked ? Math.max(0, variant.quantityAvailable - existingQty) : Infinity
  const finalQty = Math.min(qty, maxAvailable)
  if (finalQty <= 0) return false
  cart.add(product.id, finalQty, finalVariantId, selectedOptions)
  try { playSfx('click', { volume: 0.5 }) } catch { }
  try { window.dispatchEvent(new CustomEvent('shop-toast', { detail: { product } })) } catch { }
  return true
}
