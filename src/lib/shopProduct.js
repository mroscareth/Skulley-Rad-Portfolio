// Adapter: producto de /api/shop.php → shape que consume la UI de la tienda.
//
// La API manda cada producto con los dos idiomas y las dos monedas. Aquí se
// resuelve para UN idioma (nombres de opciones/valores, alt de imágenes) y
// UNA moneda (la de la región elegida). Si cambia el contrato de la UI, solo
// se toca este archivo.

// La UI trata 9999 como "sin límite" (no muestra contador ni tope de qty).
export const UNLIMITED_UNITS = 9999

function formatRecoveredDate(raw) {
  if (!raw) return ''
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : ''
}

const pick = (obj, base, lang) => obj?.[`${base}_${lang}`] || obj?.[`${base}_${lang === 'es' ? 'en' : 'es'}`] || ''

export function adaptProduct(p, { lang = 'es', currency = 'MXN' } = {}) {
  const priceKey = currency === 'MXN' ? 'price_mxn' : 'price_usd'
  const compareKey = currency === 'MXN' ? 'compare_mxn' : 'compare_usd'

  // Valores de opción: la variante guarda el valor canónico (EN); la UI ve el
  // del idioma activo. El mapa canónico→local se arma por posición de opción.
  const options = (p.options || []).map((o) => ({
    name: pick(o, 'name', lang),
    values: (o.values || []).map(v => (lang === 'es' ? (v.es || v.en) : (v.en || v.es))),
  }))
  const localValue = (optIndex, canonical) => {
    const val = p.options?.[optIndex]?.values?.find(v => v.en === canonical)
    if (!val) return canonical
    return lang === 'es' ? (val.es || val.en) : (val.en || val.es)
  }

  const variants = (p.variants || []).map((v) => {
    const selectedOptions = {}
    ;(v.option_values || []).forEach((canonical, i) => {
      if (options[i]) selectedOptions[options[i].name] = localValue(i, canonical)
    })
    const price = v[priceKey] != null ? Number(v[priceKey]) : null
    const compare = v[compareKey] != null ? Number(v[compareKey]) : null
    const available = v.available // null = sin límite
    return {
      id: v.id,
      sku: v.sku || null,
      selectedOptions,
      // Sin precio en esta moneda la variante no se vende en esta región.
      availableForSale: price !== null && price > 0 && (available === null || available > 0),
      quantityAvailable: available,
      price: price ?? 0,
      priceOriginal: compare !== null && price !== null && compare > price ? compare : null,
      currency,
      image: v.image_url || null,
    }
  })

  const priced = variants.filter(v => v.price > 0)
  const defaultVariant = variants.find(v => v.availableForSale) || priced[0] || variants[0] || null

  let unitsRemaining = 0
  for (const v of priced) {
    if (v.quantityAvailable === null) { unitsRemaining = UNLIMITED_UNITS; break }
    unitsRemaining += v.quantityAvailable
  }

  const title = pick(p, 'title', lang)
  const images = (p.images || []).map(img => ({ url: img.url, alt: pick(img, 'alt', lang) || title }))
  for (const v of variants) {
    if (v.image && !images.some(i => i.url === v.image)) images.push({ url: v.image, alt: title })
  }

  const cat = p.category
  return {
    id: p.id,
    handle: p.slug,
    archiveId: p.archive_id,
    defaultVariantId: defaultVariant?.id ?? null,
    options,
    variants,
    hasOptions: options.length > 0,
    title_en: p.title_en || p.title_es || '',
    title_es: p.title_es || p.title_en || '',
    description_en: p.description_en || p.description_es || '',
    description_es: p.description_es || p.description_en || '',
    category: cat?.slug || 'uncategorized',
    categoryLabel: cat ? pick(cat, 'name', lang) : '',
    categoryColor: cat?.color || null,
    price: defaultVariant?.price ?? 0,
    priceOriginal: defaultVariant?.priceOriginal ?? null,
    currency,
    image: images[0]?.url || '',
    images,
    recoveredDate: formatRecoveredDate(p.created_at),
    unitsRemaining,
    inStock: variants.some(v => v.availableForSale),
    // Ninguna variante tiene precio en la moneda de la región → no se ofrece ahí.
    sellableInRegion: priced.length > 0,
    featured: !!p.featured,
    kind: p.kind,
    digital: p.kind === 'digital',
    edition: p.edition,
    editionSize: p.edition_size ?? null,
  }
}

export function findVariantBySelection(product, selectedOptions) {
  if (!product?.variants?.length || !selectedOptions) return null
  return product.variants.find(v => (
    Object.entries(selectedOptions).every(([k, val]) => v.selectedOptions?.[k] === val)
  )) || null
}

export function formatPriceWithCurrency(amount, currency = 'MXN') {
  const n = Number(amount || 0)
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `$${formatted} ${currency}`
}

// Etiqueta de edición para la ficha: "Pieza única · 1/1", "Tiraje de 50".
export function editionLabel(product, lang = 'es') {
  const es = lang === 'es'
  if (product?.edition === 'unique') return es ? 'Pieza única · 1/1' : 'One of one · 1/1'
  if (product?.edition === 'limited' && product.editionSize) {
    return es ? `Tiraje de ${product.editionSize}` : `Edition of ${product.editionSize}`
  }
  return null
}
