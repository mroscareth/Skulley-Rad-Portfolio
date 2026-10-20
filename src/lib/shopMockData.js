// Banners de respaldo del hero de la tienda. Solo se usan si el CMS
// (ShopEditor → shop-config.php) todavía no tiene banners. El catálogo,
// las categorías y los precios viven en MySQL (/api/shop.php).

// Hero slideshow banners. Cada banner es una IMAGEN que el admin sube — el
// texto, tipografía y estética viven dentro de la imagen (patrón estándar
// de ecommerce editorial). Acá solo guardamos metadata: imagen por idioma,
// código del bulletin, fecha, link de CTA y color de acento para el chrome.
//
// Las imágenes EN y ES pueden ser la misma si el usuario decide diseñar
// banners bilingües; dejando el campo opcional.
export const HERO_BULLETINS = [
  {
    id: 'b01',
    code: 'BULLETIN #0042',
    date: '2049.06.21',
    image_en: '/heritage.jpg',
    image_es: '/heritage.jpg',
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
