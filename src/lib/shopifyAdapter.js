// Adapter: Shopify Storefront node → shape del app.
//
// La UI espera el mismo shape que el mock (shopMockData.js). Este módulo
// traduce; si cambia el contrato del UI, solo se actualiza aquí.
//
// Merge EN/ES: el context llama fetchCollectionProducts() dos veces (una por
// idioma). mergeLocalized() combina ambos arrays por ID para producir un solo
// producto con title_en/title_es/description_en/description_es. El precio se
// toma del idioma activo (porque cambia con Markets).

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function formatRecoveredDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

// Extrae el primer SKU no vacío de las variantes, con fallback al ID corto.
function pickArchiveId(node) {
  const variants = node.variants?.edges?.map(e => e.node) || []
  const sku = variants.find(v => v.sku)?.sku
  if (sku) return sku.toUpperCase()
  const id = node.id || ''
  return id.split('/').pop()?.slice(-8)?.toUpperCase() || 'SKR-???'
}

// Shopify le pone un option "Title" por default a los productos sin opciones.
// Su único valor es "Default Title" — no queremos mostrarlo como selector.
function isDefaultTitleOption(opt) {
  return opt?.name === 'Title' && Array.isArray(opt.values) && opt.values.length === 1 && opt.values[0] === 'Default Title'
}

// Convierte selectedOptions array → objeto {name: value}. Más fácil de consumir.
function selectedOptionsToObject(arr) {
  const obj = {}
  for (const o of arr || []) obj[o.name] = o.value
  return obj
}

// Convierte un product node en el shape del app. Parcial: solo el idioma de
// este fetch. mergeLocalized completa title_other / description_other.
export function adaptProduct(node, { lang = 'en' } = {}) {
  const rawVariants = node.variants?.edges?.map(e => e.node) || []
  const firstVariant = rawVariants[0] || null

  // availableForSale es la fuente de verdad para "¿se puede comprar?". Un
  // producto sin inventario trackeado, o uno con "Continue selling when out
  // of stock" activado, puede tener quantityAvailable 0 o null mientras
  // availableForSale sigue true — no queremos mostrar SOLD OUT en ese caso.
  const inStock = Boolean(node.availableForSale)
  let trackedUnits = 0
  let anyTracked = false
  for (const v of rawVariants) {
    if (typeof v.quantityAvailable === 'number') {
      anyTracked = true
      trackedUnits += Math.max(0, v.quantityAvailable)
    }
  }
  const unitsRemaining = inStock
    ? (anyTracked && trackedUnits > 0 ? trackedUnits : 9999)
    : 0

  // Opciones "reales" — excluir el Title default.
  const options = (node.options || [])
    .filter(o => !isDefaultTitleOption(o))
    .map(o => ({ name: o.name, values: [...(o.values || [])] }))

  // Adapt variants con todo lo que necesita la UI para mostrarlo y comprarlo.
  const variants = rawVariants.map((v) => {
    const selectedOptions = selectedOptionsToObject(v.selectedOptions)
    const price = Number(v.price?.amount ?? 0)
    const compare = Number(v.compareAtPrice?.amount ?? 0)
    return {
      id: v.id,
      sku: v.sku || null,
      selectedOptions,
      availableForSale: Boolean(v.availableForSale),
      quantityAvailable: typeof v.quantityAvailable === 'number' ? v.quantityAvailable : null,
      price,
      priceOriginal: compare > price ? compare : null,
      currency: v.price?.currencyCode || 'USD',
      image: v.image?.url || null,
    }
  })

  // Default variant: la primera disponible; si ninguna, la primera absoluta.
  const defaultVariant = variants.find(v => v.availableForSale) || variants[0] || null
  const defaultVariantId = defaultVariant?.id || null

  const priceAmount = defaultVariant?.price ?? Number(node.priceRange?.minVariantPrice?.amount ?? 0)
  const currency = defaultVariant?.currency || node.priceRange?.minVariantPrice?.currencyCode || 'USD'
  const priceOriginal = defaultVariant?.priceOriginal ?? null

  const categoryLabel = node.productType || 'Uncategorized'
  const category = slugify(categoryLabel) || 'uncategorized'

  const tags = (node.tags || []).map(t => String(t).toLowerCase())
  const featured = tags.includes('featured')
  const digital = tags.includes('digital')

  const title = node.title || ''
  const description = node.description || ''

  // Galería: imágenes del producto + de sus variantes, deduplicadas por URL.
  // Orden: featured primero (si no ya está), luego resto de producto, luego
  // variant images. Así la primera imagen es la "principal" del producto.
  const seen = new Set()
  const gallery = []
  const pushImage = (img) => {
    if (!img?.url || seen.has(img.url)) return
    seen.add(img.url)
    gallery.push({ url: img.url, alt: img.altText || '' })
  }
  if (node.featuredImage) pushImage(node.featuredImage)
  for (const edge of node.images?.edges || []) pushImage(edge.node)
  for (const v of rawVariants) {
    if (v.image) pushImage(v.image)
  }

  return {
    id: node.id,
    handle: node.handle,
    archiveId: pickArchiveId(node),
    defaultVariantId,
    options,
    variants,
    hasOptions: options.length > 0,
    [`title_${lang}`]: title,
    [`description_${lang}`]: description,
    category,
    categoryLabel,
    price: priceAmount,
    priceOriginal,
    currency,
    image: gallery[0]?.url || '',
    images: gallery,
    recoveredDate: formatRecoveredDate(node.createdAt),
    unitsRemaining,
    inStock,
    featured,
    digital,
  }
}

// Resolver: dado un producto y un objeto {optionName: value}, devuelve la
// variante exacta que coincide con esa combinación.
export function findVariantBySelection(product, selectedOptions) {
  if (!product?.variants?.length) return null
  if (!selectedOptions) return null
  return product.variants.find((v) => {
    return Object.entries(selectedOptions).every(([k, val]) => v.selectedOptions?.[k] === val)
  }) || null
}

// Merge de dos fetches del mismo catálogo en distintos idiomas.
// - primary: array de productos adaptados en el idioma activo (precios/moneda
//   correctos para el UI actual).
// - secondary: array del otro idioma, solo se usa para completar title/description.
export function mergeLocalized(primary, secondary, { primaryLang = 'en', secondaryLang = 'es' } = {}) {
  const secMap = new Map()
  for (const p of secondary || []) secMap.set(p.id, p)
  return primary.map((p) => {
    const other = secMap.get(p.id)
    return {
      ...p,
      [`title_${primaryLang}`]: p[`title_${primaryLang}`] || '',
      [`title_${secondaryLang}`]: other?.[`title_${secondaryLang}`] || p[`title_${primaryLang}`] || '',
      [`description_${primaryLang}`]: p[`description_${primaryLang}`] || '',
      [`description_${secondaryLang}`]: other?.[`description_${secondaryLang}`] || p[`description_${primaryLang}`] || '',
    }
  })
}

// Formatter universal. Shopify devuelve amount como string decimal ("29.00").
// MXN/USD → símbolo $; otros → código.
const CURRENCY_SYMBOLS = {
  USD: '$',
  MXN: '$',
  EUR: '€',
  GBP: '£',
}

export function formatPriceWithCurrency(amount, currency = 'USD') {
  const n = Number(amount || 0)
  const symbol = CURRENCY_SYMBOLS[currency] || ''
  // Entero → sin decimales; fraccional → 2 decimales.
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2)
  if (currency === 'MXN') return `$${formatted} MXN`
  if (symbol) return `${symbol}${formatted}`
  return `${formatted} ${currency}`
}
