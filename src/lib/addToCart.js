import { playCarritoAgregar, playCarritoQuitar } from './carritoSound.js'

// Agregar al carrito una variante ya elegida (o la default). Lo usan la tienda
// (Shop.jsx) y la tarjeta de la home de teléfono. Quien llama decide antes qué
// hacer con una pieza que tiene opciones y llega sin variante: abrir la ficha.
//
// Capamos la qty al stock disponible de la variante, restando lo que ya esté
// en el carrito — así nunca mandamos a checkout más de lo que hay. El backend
// vuelve a validar al cobrar; esto solo evita la sorpresa.
//
// Devuelve true si entró algo. `shop-toast` avisa al toast de la tienda (y a la
// card de una pieza con opciones, que pasa a "Agregado"); no se manda si no
// quedaba stock.
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
  playCarritoAgregar(existingQty + finalQty)
  avisarCarrito(cart.totalItems, cart.totalItems + finalQty)
  try { window.dispatchEvent(new CustomEvent('shop-toast', { detail: { product } })) } catch { }
  return true
}

// Quitar piezas de una variante (el indicador de la card y el panel del
// carrito). 0 o menos la saca del carrito. `carrito-quitado` pone triste al
// retrato (PortraitGlobo); lo que el carrito quita solo (agotados, pago
// confirmado) no pasa por aquí.
export function removeFromCart(cart, productId, variantId, qty) {
  const quedan = Math.max(0, qty)
  if (quedan > 0) cart.setQty(productId, variantId, quedan)
  else cart.remove(productId, variantId)
  playCarritoQuitar(quedan)
  try { window.dispatchEvent(new CustomEvent('carrito-quitado')) } catch { }
}

// Aviso de que entró algo, con el total de piezas antes y después: lo escucha
// la viñeta del retrato (PortraitGlobo), que habla por escalones.
export function avisarCarrito(antes, despues) {
  try { window.dispatchEvent(new CustomEvent('carrito-agregado', { detail: { antes, despues } })) } catch { }
}
