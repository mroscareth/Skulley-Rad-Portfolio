// Cliente del CMS de la tienda. Todas las llamadas van con la cookie de
// sesión del admin (credentials: 'include'); el backend responde
// { ok, ...data } o { ok:false, error } con status HTTP de error.

const ADMIN = '/api/shop-admin.php'
const ORDERS = '/api/shop-orders.php'

async function request(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* respuesta no-JSON */ }
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `http_${res.status}`)
    err.detail = data?.detail
    err.payload = data
    throw err
  }
  return data
}

const q = (params) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  })
  return s.toString()
}

// ── Catálogo ──
export const listProducts = () => request(`${ADMIN}?action=products`).then(d => d.products)
export const getProduct = (id) => request(`${ADMIN}?action=product&id=${id}`).then(d => d.product)
export const saveProduct = (product) => request(`${ADMIN}?action=product_save`, { method: 'POST', body: product }).then(d => d.product)
// Con ventas el backend ARCHIVA en vez de borrar ({archived:true}); force=true borra igual.
export const deleteProduct = (id, force = false) => request(`${ADMIN}?action=product_delete`, { method: 'POST', body: { id, force } })

export const listCategories = () => request(`${ADMIN}?action=categories`).then(d => d.categories)
export const saveCategories = (categories) => request(`${ADMIN}?action=categories_save`, { method: 'POST', body: { categories } }).then(d => d.categories)

export const listZones = () => request(`${ADMIN}?action=zones`).then(d => d.zones)
export const saveZones = (zones) => request(`${ADMIN}?action=zones_save`, { method: 'POST', body: { zones } }).then(d => d.zones)

export const getSettings = () => request(`${ADMIN}?action=settings`)
// Tipo de cambio USD→MXN, cacheado en el servidor. `refresh` lo fuerza.
export const getFxRate = ({ refresh = false } = {}) =>
  request(`${ADMIN}?action=fx_rate${refresh ? '&refresh=1' : ''}`).then(d => d.fx)
export const saveSettings = (settings) => request(`${ADMIN}?action=settings_save`, { method: 'POST', body: settings })

// Imagen de producto → uploads/shop/products/ (devuelve la ruta relativa).
export async function uploadProductImage(file) {
  const form = new FormData()
  form.append('file', file)
  form.append('context', 'shop-product')
  const res = await fetch('/api/upload.php', { method: 'POST', credentials: 'include', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok || !data.file?.path) throw new Error(data?.error || 'upload_failed')
  return data.file.path
}

// Archivo digital → carpeta privada (devuelve {key, name, size}).
export async function uploadDigitalFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${ADMIN}?action=upload_digital`, { method: 'POST', credentials: 'include', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'upload_failed')
  return data.file
}

// ── Pedidos ──
export const listOrders = ({ status, q: search, page, all } = {}) =>
  request(`${ORDERS}?action=list&${q({ status, q: search, page, all: all ? 1 : undefined })}`)
export const getOrder = (id) => request(`${ORDERS}?action=detail&id=${id}`).then(d => d.order)
export const getOrderStats = () => request(`${ORDERS}?action=stats`)
// Lo que te toca en Pedidos (esferita del menú). `since` = el `now` que
// devolvió la última visita a Pedidos.
export const getOrdersAttention = (since) => request(`${ORDERS}?${q({ action: 'attention', since })}`)
export const updateOrder = (patch) => request(`${ORDERS}?action=update`, { method: 'POST', body: patch })
export const setDisputeHandled = (id, handled) => updateOrder({ id, dispute_handled: handled }).then(d => d.order)
export const refundOrder = ({ id, amount, restock }) => request(`${ORDERS}?action=refund`, { method: 'POST', body: { id, amount, restock } }).then(d => d.order)
export const cancelOrder = (id) => request(`${ORDERS}?action=cancel`, { method: 'POST', body: { id } }).then(d => d.order)
export const resendOrderEmail = (id, type) => request(`${ORDERS}?action=resend`, { method: 'POST', body: { id, type } })
export const ordersExportUrl = () => `${ORDERS}?action=export`

// Ruta relativa (uploads/...) → URL usable en <img>.
export const toPublicUrl = (p) => {
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  return p.startsWith('/') ? p : `/${p}`
}

export const formatMoney = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = Number(amount)
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim()
}
