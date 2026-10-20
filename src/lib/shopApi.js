// Cliente de la tienda (lado comprador). El backend es PHP + MySQL; Stripe
// solo aparece al final, cuando /api/shop-checkout.php devuelve la URL de pago.

const API = `${import.meta.env.BASE_URL}api`

async function call(url, options = {}) {
  const res = await fetch(url, options)
  let data = null
  try { data = await res.json() } catch { /* respuesta no-JSON */ }
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `http_${res.status}`)
    err.code = data?.error || null
    err.payload = data
    throw err
  }
  return data
}

// Catálogo completo: productos (ambos idiomas, ambas monedas), categorías,
// regiones de envío y si el checkout está abierto.
export function fetchCatalog() {
  return call(`${API}/shop.php`, { cache: 'no-store' })
}

// Devuelve { url, token }. Errores con code:
//   items_unavailable (payload.items = [{variant_id, reason, available}]),
//   checkout_unavailable, invalid_region, empty_cart, rate_limited, stripe_error
// authToken = access token de Privy: el backend identifica al comprador con él
// (golden ticket, correo prellenado). Sin token se compra como invitado.
export function createCheckout({ items, region, lang, authToken, useGoldenTicket, replaceToken }) {
  return call(`${API}/shop-checkout.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'X-Privy-Token': authToken } : {}),
    },
    body: JSON.stringify({
      items: items.map(it => ({ variant_id: it.variantId, qty: it.qty })),
      region,
      lang,
      use_golden_ticket: !!useGoldenTicket,
      replace_token: replaceToken || undefined,
    }),
  })
}

export function fetchOrder(token) {
  return call(`${API}/shop-orders.php?action=view&t=${encodeURIComponent(token)}`, { cache: 'no-store' })
    .then(d => d.order)
}

// El comprador regresó de Stripe sin pagar: libera lo que su checkout apartaba.
export function cancelCheckout(token) {
  return call(`${API}/shop-orders.php?action=cancel_checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t: token }),
  }).then(d => d.order)
}

export function fetchMyOrders(authToken) {
  return call(`${API}/shop-orders.php?action=mine`, { headers: { 'X-Privy-Token': authToken } })
    .then(d => d.orders || [])
}
