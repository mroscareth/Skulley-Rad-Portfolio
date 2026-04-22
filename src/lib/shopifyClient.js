// Shopify Storefront API GraphQL client.
//
// Usa el token público (Storefront), seguro de exponer en el frontend. Todas
// las queries pasan por @inContext para soportar multi-currency via Shopify
// Markets (EN→US/USD, ES→MX/MXN). Si Markets no está configurado todavía, la
// API ignora el country y devuelve la moneda default de la tienda — no rompe.

const DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN
const TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN
const API_VERSION = import.meta.env.VITE_SHOPIFY_API_VERSION || '2025-01'

export const SHOPIFY_CONFIGURED = Boolean(DOMAIN && TOKEN)

const ENDPOINT = SHOPIFY_CONFIGURED
  ? `https://${DOMAIN}/api/${API_VERSION}/graphql.json`
  : null

async function gql(query, variables = {}) {
  if (!SHOPIFY_CONFIGURED) {
    throw new Error('Shopify no está configurado (falta VITE_SHOPIFY_DOMAIN / VITE_SHOPIFY_STOREFRONT_TOKEN)')
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    throw new Error(`Shopify ${res.status}: ${await res.text()}`)
  }
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  }
  return json.data
}

const COLLECTION_QUERY = /* GraphQL */ `
  query CollectionProducts(
    $handle: String!
    $country: CountryCode!
    $language: LanguageCode!
    $first: Int!
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      products(first: $first) {
        edges {
          node {
            id
            handle
            title
            description
            productType
            tags
            createdAt
            availableForSale
            featuredImage {
              url
              altText
              width
              height
            }
            images(first: 6) {
              edges {
                node { url altText width height }
              }
            }
            priceRange {
              minVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
            }
            options { name values }
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  title
                  availableForSale
                  quantityAvailable
                  selectedOptions { name value }
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  image { url altText width height }
                }
              }
            }
          }
        }
      }
    }
  }
`

// Fetch de la colección en un idioma/país específico. Devuelve los nodes crudos
// (el adapter los transforma al shape del app).
export async function fetchCollectionProducts({ handle, language = 'EN', country = 'US', first = 100 }) {
  const data = await gql(COLLECTION_QUERY, { handle, language, country, first })
  const coll = data?.collection
  if (!coll) return { handle, title: null, products: [] }
  const products = (coll.products?.edges || []).map(e => e.node)
  return { handle: coll.handle, title: coll.title, products }
}

// Cart create — devuelve { id, checkoutUrl }. El frontend redirige al checkoutUrl.
// Shopify se encarga del checkout completo (pagos, addresses, inventario, todo).
const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate(
    $input: CartInput!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors { field message }
    }
  }
`

export async function createCart({ lines, discountCodes = [], language = 'EN', country = 'US' }) {
  const input = {
    lines: lines.map(l => ({
      merchandiseId: l.variantId,
      quantity: l.quantity,
    })),
  }
  if (discountCodes.length) input.discountCodes = discountCodes
  const data = await gql(CART_CREATE_MUTATION, { input, language, country })
  const payload = data?.cartCreate
  if (payload?.userErrors?.length) {
    throw new Error(`Cart: ${payload.userErrors.map(e => e.message).join('; ')}`)
  }
  return payload?.cart
}

// Mapeo lang → market. Ajustar si el usuario agrega más mercados.
export function marketForLang(lang) {
  if (lang === 'es') return { language: 'ES', country: 'MX' }
  return { language: 'EN', country: 'US' }
}
