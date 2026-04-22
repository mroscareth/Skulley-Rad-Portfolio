// Mock data de la tienda. Estructura pensada para migrar a Shopify Storefront
// API sin cambiar el layer de UI: el consumer solo toca el fetcher, todo el
// resto lee estos objetos directamente.

// Vocabulario satírico de M.A.D.R.E.: los productos son "Skulley Rad Lost
// Items" — artefactos recuperados del último diseñador humano.

// Los IDs deben coincidir con el slug del Product Type de Shopify.
// slugify("Art Toys") === "art-toys", slugify("Coleccionables") === "coleccionables".
// Si el usuario agrega tipos en Shopify, agregar la entrada correspondiente aquí.
export const SHOP_CATEGORIES = [
  { id: 'all',             label_en: 'ALL',            label_es: 'TODO' },
  { id: 'art-toys',        label_en: 'ART TOYS',       label_es: 'ART TOYS' },
  { id: 'apparel',         label_en: 'APPAREL',        label_es: 'ROPA' },
  { id: 'prints',          label_en: 'PRINTS',         label_es: 'PRINTS' },
  { id: 'stickers',        label_en: 'STICKERS',       label_es: 'STICKERS' },
  { id: 'coleccionables',  label_en: 'COLLECTIBLES',   label_es: 'COLECCIONABLES' },
]

// Hero slideshow banners. Cada banner es una IMAGEN que el admin sube — el
// texto, tipografía y estética viven dentro de la imagen (patrón estándar
// de ecommerce editorial). Acá solo guardamos metadata: imagen por idioma,
// código del bulletin, fecha, link de CTA y color de acento para el chrome.
//
// Las imágenes EN y ES pueden ser la misma si el usuario decide diseñar
// banners bilingües; dejando el campo opcional.
//
// TODO: reemplazar las imágenes placeholder por las que Skulley diseñe.
export const HERO_BULLETINS = [
  {
    id: 'b01',
    code: 'BULLETIN #0042',
    date: '2049.06.21',
    image_en: '/heritage.jpg',       // TODO: reemplazar con banner real EN
    image_es: '/heritage.jpg',       // TODO: reemplazar con banner real ES
    cta_en: 'BROWSE LOST ITEMS',
    cta_es: 'VER OBJETOS PERDIDOS',
    alt_en: 'Final clearance banner',
    alt_es: 'Banner de liquidación final',
    accent: '#e600ff',
  },
  {
    id: 'b02',
    code: 'BULLETIN #0039',
    date: '2049.06.07',
    image_en: '/Etherean.jpg',
    image_es: '/Etherean.jpg',
    cta_en: 'INSPECT ARCHIVE',
    cta_es: 'INSPECCIONAR ARCHIVO',
    alt_en: 'New artifacts banner',
    alt_es: 'Banner de nuevas reliquias',
    accent: '#22c55e',
  },
  {
    id: 'b03',
    code: 'BULLETIN #0031',
    date: '2049.05.19',
    image_en: '/3dheads.webp',
    image_es: '/3dheads.webp',
    cta_en: 'DOWNLOAD',
    cta_es: 'DESCARGAR',
    alt_en: 'Digital relics banner',
    alt_es: 'Banner de reliquias digitales',
    accent: '#00bfff',
  },
]

// Producto destacado (el más visible). Puede incluir mockup 3D/parallax extra.
export const FEATURED_PRODUCT_ID = 'skr-t001'

// Catálogo. Cada item es un "Lost Item" / "Objeto Perdido" del sujeto.
// Usamos imágenes REALES de proyectos del portafolio (públicos en /public/
// y /public/uploads/ del CMS) — no badges ni placeholders genéricos.
const COVERS = {
  c1: '/uploads/1/cover.jpg',
  c2: '/uploads/2/cover.jpg',
  c3: '/uploads/3/cover.jpg',
  c4: '/uploads/4/cover.jpg',
  c5: '/uploads/5/cover.jpg',
  heritage: '/heritage.jpg',
  etherean: '/Etherean.jpg',
  heads3d: '/3dheads.webp',
  transition: '/transition0.png',
}

export const PRODUCTS = [
  {
    id: 'skr-t001',
    archiveId: 'SKR-T001',
    title_en: 'THE LAST DESIGNER — Tee',
    title_es: 'THE LAST DESIGNER — Playera',
    category: 'apparel',
    price: 29,
    priceOriginal: 39,
    image: COVERS.heads3d,
    recoveredDate: '2049.05.12',
    unitsRemaining: 87,
    description_en: 'Heavyweight cotton tee. Screen-printed halftone portrait of the subject. Preserved exactly as the mortal left it.',
    description_es: 'Playera de algodón pesado. Retrato halftone serigrafiado del sujeto. Preservada exactamente como el mortal la dejó.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inStock: true,
    featured: true,
  },
  {
    id: 'skr-t002',
    archiveId: 'SKR-T002',
    title_en: 'M.A.D.R.E. PROTOCOL — Tee',
    title_es: 'PROTOCOLO M.A.D.R.E. — Playera',
    category: 'apparel',
    price: 32,
    image: COVERS.etherean,
    recoveredDate: '2049.05.15',
    unitsRemaining: 54,
    description_en: 'Corporate-issue tee. Features the M.A.D.R.E. quarterly report on the back. Automation propaganda, sanctioned.',
    description_es: 'Playera corporativa. Incluye el reporte trimestral de M.A.D.R.E. en la espalda. Propaganda de automatización, sancionada.',
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
  },
  {
    id: 'skr-p001',
    archiveId: 'SKR-P001',
    title_en: 'AUTOMATION COMPLETE — Print A2',
    title_es: 'AUTOMATIZACIÓN COMPLETA — Print A2',
    category: 'prints',
    price: 45,
    image: COVERS.heritage,
    recoveredDate: '2049.04.28',
    unitsRemaining: 23,
    description_en: 'Archival giclée print on 310gsm matte paper. Numbered and sealed. A2 (420 \u00d7 594 mm). Limited run, will not be reprinted.',
    description_es: 'Print giclée de archivo sobre papel mate 310gsm. Numerado y sellado. A2 (420 \u00d7 594 mm). Tiraje limitado, no se reimprime.',
    inStock: true,
  },
  {
    id: 'skr-p002',
    archiveId: 'SKR-P002',
    title_en: 'ERROR PATTERNS — Print A3',
    title_es: 'PATRONES DE ERROR — Print A3',
    category: 'prints',
    price: 29,
    priceOriginal: 35,
    image: COVERS.c4,
    recoveredDate: '2049.04.10',
    unitsRemaining: 41,
    description_en: 'Inefficiencies detected, preserved, framed. Giclée on 310gsm matte. A3 (297 \u00d7 420 mm).',
    description_es: 'Ineficiencias detectadas, preservadas, enmarcadas. Giclée sobre mate 310gsm. A3 (297 \u00d7 420 mm).',
    inStock: true,
  },
  {
    id: 'skr-s001',
    archiveId: 'SKR-S001',
    title_en: 'ARCHIVE STICKER PACK',
    title_es: 'PACK DE STICKERS DEL ARCHIVO',
    category: 'stickers',
    price: 8,
    image: COVERS.c5,
    recoveredDate: '2049.05.01',
    unitsRemaining: 312,
    description_en: '8 die-cut vinyl stickers. Halftone logos, glitch fragments, M.A.D.R.E. seals. Waterproof. Designed to outlive you.',
    description_es: '8 stickers de vinil troquelado. Logos halftone, fragmentos glitch, sellos de M.A.D.R.E. Impermeables. Diseñados para sobrevivirte.',
    inStock: true,
  },
  {
    id: 'skr-d001',
    archiveId: 'SKR-D001',
    title_en: 'MAUSOLEUM WALLPAPER PACK',
    title_es: 'PACK DE WALLPAPERS DEL MAUSOLEO',
    category: 'digital',
    price: 6,
    image: COVERS.transition,
    recoveredDate: '2049.06.02',
    unitsRemaining: 9999,
    description_en: '12 wallpapers in 4K + ultrawide. Instant download after purchase. Survives format migrations.',
    description_es: '12 wallpapers en 4K + ultrawide. Descarga inmediata tras la compra. Sobrevive a migraciones de formato.',
    inStock: true,
    digital: true,
  },
  {
    id: 'skr-d002',
    archiveId: 'SKR-D002',
    title_en: 'SUBJECT\u2019S BRUSH PACK — Procreate',
    title_es: 'PACK DE BRUSHES DEL SUJETO — Procreate',
    category: 'digital',
    price: 14,
    image: COVERS.c3,
    recoveredDate: '2049.06.09',
    unitsRemaining: 9999,
    description_en: '24 custom brushes the subject used. Procreate .brushset. Human imperfections preserved in every stroke.',
    description_es: '24 brushes personalizados que usaba el sujeto. .brushset de Procreate. Imperfecciones humanas preservadas en cada trazo.',
    inStock: true,
    digital: true,
  },
  {
    id: 'skr-r001',
    archiveId: 'SKR-R001',
    title_en: 'OG HOUSEBIRD — Art Toy (Signed)',
    title_es: 'HOUSEBIRD OG — Art Toy (Firmado)',
    category: 'relic',
    price: 180,
    image: COVERS.c1,
    recoveredDate: '2049.03.14',
    unitsRemaining: 3,
    description_en: 'Hand-painted resin figure. Signed by the subject before decommission. Only 3 units remain. No replicas authorized.',
    description_es: 'Figura de resina pintada a mano. Firmada por el sujeto antes del decomiso. Solo quedan 3 unidades. No se autorizan réplicas.',
    inStock: true,
  },
  {
    id: 'skr-r002',
    archiveId: 'SKR-R002',
    title_en: 'FRACTURED MEMORY — Zine',
    title_es: 'MEMORIA FRACTURADA — Fanzine',
    category: 'relic',
    price: 22,
    image: COVERS.c2,
    recoveredDate: '2049.02.21',
    unitsRemaining: 0,
    description_en: '48-page zine. Sketches and process fragments from the subject\u2019s personal archive. Hand-bound. Archive closed.',
    description_es: 'Fanzine de 48 páginas. Bocetos y fragmentos de proceso del archivo personal del sujeto. Encuadernado a mano. Archivo cerrado.',
    inStock: false,
  },
  {
    id: 'skr-a003',
    archiveId: 'SKR-A003',
    title_en: 'M.A.D.R.E. UNIFORM — Hoodie',
    title_es: 'UNIFORME M.A.D.R.E. — Hoodie',
    category: 'apparel',
    price: 68,
    image: COVERS.c3,
    recoveredDate: '2049.05.28',
    unitsRemaining: 19,
    description_en: 'Heavy fleece hoodie. M.A.D.R.E. operator issue. Reflective patch. Stays warm in the server room.',
    description_es: 'Hoodie de fleece pesado. Issue para operadores de M.A.D.R.E. Parche reflectivo. Aguanta el cuarto de servidores.',
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
  },
]

// Helpers
export function productsByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return PRODUCTS
  return PRODUCTS.filter(p => p.category === categoryId)
}

export function getFeaturedProduct() {
  return PRODUCTS.find(p => p.id === FEATURED_PRODUCT_ID) || PRODUCTS[0]
}

export function getProductById(id) {
  return PRODUCTS.find(p => p.id === id) || null
}

export function formatPrice(cents) {
  return `$${cents}`
}
