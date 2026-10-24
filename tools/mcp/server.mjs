#!/usr/bin/env node
/**
 * Servidor MCP del sitio — FASE 1, solo lectura.
 *
 * Expone el contenido de mroscar.xyz (proyectos, posts, productos, pedidos en
 * agregado) como herramientas, para no tener que leerlo manejando el CMS a
 * clics. Habla con public/api/mcp.php usando un token de servicio.
 *
 * Sin dependencias a propósito: el transporte stdio de MCP es JSON-RPC 2.0
 * delimitado por saltos de línea, y meter un paquete más a este repo por
 * doscientas líneas no se paga. Si algún día hace falta sampling o recursos,
 * ahí sí conviene el SDK oficial.
 *
 * Configuración — las dos puntas del token:
 *   .env.local de la raíz   MCP_TOKEN=<el token en claro>   (gitignoreado)
 *   api/config.local.php    'MCP_TOKEN_HASH' => password_hash(<token>)
 *                           'MCP_SCOPE' => 'read'
 * Opcional: MCP_SITE_URL para apuntar a otro origen (default mroscar.xyz).
 *
 * Para generar el par, en el servidor:
 *   ssh mroscar "php -r '\$t=bin2hex(random_bytes(32));
 *     echo \"MCP_TOKEN=\$t\n\", \"hash: \", password_hash(\$t, PASSWORD_DEFAULT), \"\n\";'"
 * El token se enseña una sola vez: va a .env.local, el hash a config.local.php.
 *
 * IMPORTANTE: stdout es el canal del protocolo. Cualquier cosa que se imprima
 * ahí que no sea JSON-RPC rompe la sesión — los mensajes van a stderr.
 */

import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * El token sale de .env.local de la raíz — el mismo archivo gitignoreado donde
 * ya vive VITE_PRIVY_APP_ID. Así .mcp.json se puede commitear sin secretos y
 * no hay que exportar nada en la shell antes de abrir el editor.
 */
function fromEnvLocal(key) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const text = readFileSync(resolve(root, '.env.local'), 'utf8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      if (line.slice(0, eq).trim() !== key) continue
      return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin .env.local se cae al entorno */ }
  return ''
}

const SITE = (process.env.MCP_SITE_URL || fromEnvLocal('MCP_SITE_URL') || 'https://mroscar.xyz').replace(/\/+$/, '')
const TOKEN = process.env.MCP_TOKEN || fromEnvLocal('MCP_TOKEN')
const SERVER_INFO = { name: 'mroscar-site', version: '1.0.0' }
const FALLBACK_PROTOCOL = '2024-11-05'

const log = (...a) => process.stderr.write(a.join(' ') + '\n')

/** Llama a api/mcp.php. Devuelve el objeto de datos o lanza con un mensaje legible. */
/**
 * @param endpoint  Archivo a llamar. Por defecto mcp.php para leer y
 *                  mcp-write.php para escribir; la tienda usa los endpoints
 *                  de admin que ya existen (shop-admin.php, shop-orders.php),
 *                  que aceptan el token además de la sesión del CMS.
 */
async function api(action, params = {}, body = null, endpoint = null) {
  if (!TOKEN) {
    throw new Error('Falta MCP_TOKEN en .env.local (o en el entorno). Ver el comentario de cabecera de tools/mcp/server.mjs.')
  }
  endpoint = endpoint || (body ? 'mcp-write.php' : 'mcp.php')
  const url = new URL(`${SITE}/api/${endpoint}`)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)
  let res
  try {
    res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-MCP-Token': TOKEN,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    throw new Error(err.name === 'AbortError' ? 'El sitio no respondió en 30 s' : `No se pudo conectar: ${err.message}`)
  }
  clearTimeout(timer)

  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* respuesta no-JSON */ }

  if (!res.ok || !data?.ok) {
    // Los códigos del backend dichos en voz humana: el agente los va a leer.
    const code = data?.error || `http_${res.status}`
    const hints = {
      unauthorized: 'El token no es válido. Revisa MCP_TOKEN y el MCP_TOKEN_HASH del servidor.',
      mcp_not_configured: 'El servidor no tiene MCP_TOKEN_HASH en config.local.php.',
      read_only_token: "Esta accion necesita escritura y el token es de solo lectura. Cambiar MCP_SCOPE a 'write' en api/config.local.php del servidor.",
      nothing_to_update: 'No mandaste ningun campo que cambiar.',
      slug_taken: 'Ya existe una entrada con ese slug.',
      title_required: 'El titulo no puede quedar vacio.',
      invalid_url: 'La URL no sirve: tiene que empezar con http:// o https://.',
      rate_limited: 'Demasiadas peticiones seguidas. Espera un minuto.',
      not_found: 'No existe ese elemento.',
    }
    throw new Error(hints[code] || `Error del servidor: ${code}`)
  }
  return data
}

const TOOLS = [
  {
    name: 'list_projects',
    description:
      'Lista los proyectos del portafolio (/work) con su slug, tipo, visibilidad y cuántas palabras tiene su descripción en cada idioma. Úsalo para ver de un vistazo qué fichas están vacías.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('projects.list'),
  },
  {
    name: 'get_project',
    description:
      'Devuelve un proyecto completo, con las descripciones en inglés y español, el link externo y el texto de su botón. Se identifica por slug o por id.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del proyecto, p. ej. "arttoys"' },
        id: { type: 'number', description: 'Id numérico, alternativa al slug' },
      },
      additionalProperties: false,
    },
    run: async (args) => api('projects.get', { slug: args.slug, id: args.id }),
  },
  {
    name: 'list_posts',
    description:
      'Lista las entradas del blog, incluidas las no publicadas, con su estado y el conteo de palabras por idioma.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('posts.list'),
  },
  {
    name: 'get_post',
    description:
      'Devuelve una entrada del blog completa, con el cuerpo en HTML en ambos idiomas, el extracto y los tags. Se identifica por slug o por id.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del post' },
        id: { type: 'number', description: 'Id numérico, alternativa al slug' },
      },
      additionalProperties: false,
    },
    run: async (args) => api('posts.get', { slug: args.slug, id: args.id }),
  },
  {
    name: 'list_shop_products',
    description:
      'Lista los productos de la tienda como los ve el CMS: variantes, stock, precios en MXN y USD, edición, estado y cuántos se han vendido.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('products', {}, null, 'shop-admin.php'),
  },
  {
    name: 'get_shop_product',
    description: 'Devuelve un producto completo de la tienda, con sus variantes, opciones, imágenes y precios.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'Id del producto' } },
      required: ['id'],
      additionalProperties: false,
    },
    run: async ({ id }) => api('product', { id }, null, 'shop-admin.php'),
  },
  {
    name: 'save_shop_product',
    description:
      'Crea o actualiza un producto. Sin "id" crea uno nuevo; con "id" actualiza ese. Pasa por las mismas validaciones que el CMS: una edición "unique" no admite opciones, una "limited" exige tiraje, y un digital activo exige archivos. Manda el producto completo, no solo los campos que cambian.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Omitir para crear uno nuevo' },
        title_en: { type: 'string' },
        title_es: { type: 'string' },
        description_en: { type: 'string' },
        description_es: { type: 'string' },
        status: { type: 'string', description: 'active | draft | archived' },
        kind: { type: 'string', description: 'physical | digital' },
        edition: { type: 'string', description: 'unique (1/1) | limited (exige edition_size) | open' },
        edition_size: { type: 'number' },
        category_id: { type: 'number' },
        images: { type: 'array', items: { type: 'string' }, description: 'URLs o rutas' },
        options: { type: 'array', items: { type: 'object' }, description: 'Color, Size… con sus valores' },
        variants: {
          type: 'array',
          description: 'Cada variante con sku, price_mxn, price_usd, stock y option_values',
          items: { type: 'object' },
        },
      },
      additionalProperties: true,
    },
    run: async (args) => api('product_save', {}, args, 'shop-admin.php'),
  },
  {
    name: 'list_shop_categories',
    description: 'Categorías de la tienda, con su id para usarlo en category_id al guardar un producto.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('categories', {}, null, 'shop-admin.php'),
  },
  {
    name: 'list_shop_zones',
    description: 'Zonas de envío: qué países cubre cada una, en qué moneda cobra y sus tarifas.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('zones', {}, null, 'shop-admin.php'),
  },
  {
    name: 'list_orders',
    description:
      'Lista pedidos con filtros. A diferencia de orders_summary, aquí sí vienen los datos del comprador, así que úsalo cuando haga falta atender un pedido concreto.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Separados por coma: paid,preparing,shipped,delivered,cancelled…' },
        q: { type: 'string', description: 'Busca por número de pedido, nombre o correo' },
        page: { type: 'number' },
      },
      additionalProperties: false,
    },
    run: async (args) => api('list', args, null, 'shop-orders.php'),
  },
  {
    name: 'get_order',
    description: 'Un pedido completo: artículos, envío, pagos y su historial.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
      additionalProperties: false,
    },
    run: async ({ id }) => api('detail', { id }, null, 'shop-orders.php'),
  },
  {
    name: 'order_stats',
    description: 'Totales de la tienda por moneda: pedidos pagados, neto y devoluciones.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('stats', {}, null, 'shop-orders.php'),
  },
  {
    name: 'update_order',
    description:
      'Actualiza un pedido: paquetería, guía y estado. OJO: poner el estado en "shipped" le manda un correo al comprador con la guía, así que no lo uses sin que te lo pidan. NO puede reembolsar, cancelar ni marcar como pagado — eso se hace en el CMS.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        status: { type: 'string', description: 'paid | preparing | shipped | delivered' },
        carrier: { type: 'string' },
        tracking_number: { type: 'string' },
        tracking_url: { type: 'string' },
        notes: { type: 'string', description: 'Nota interna, no la ve el comprador' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    run: async (args) => api('update', {}, args, 'shop-orders.php'),
  },
  {
    name: 'list_coupons',
    description: 'Códigos de descuento de Stripe: cuáles existen, cuánto descuentan, cuántas veces se usaron y si siguen activos.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: '1-100, default 50' } },
      additionalProperties: false,
    },
    run: async (args) => api('coupons.list', args, null, 'shop-coupons.php'),
  },
  {
    name: 'create_coupon',
    description:
      'Crea un código de descuento en Stripe que el comprador escribe en el checkout. Lleva percent_off o bien amount_off con su moneda. No mueve dinero: cambia lo que se va a cobrar en una compra futura.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '3-40 caracteres: letras, números, guion y guion bajo. Se guarda en mayúsculas.' },
        percent_off: { type: 'number', description: 'Entre 1 y 100' },
        amount_off: { type: 'number', description: 'Monto fijo; exige currency' },
        currency: { type: 'string', description: 'mxn o usd, solo con amount_off' },
        max_redemptions: { type: 'number', description: 'Cuántas veces se puede usar en total' },
        expires_at: { type: 'string', description: 'Fecha futura, p. ej. 2026-12-31' },
      },
      required: ['code'],
      additionalProperties: false,
    },
    run: async (args) => api('coupon.create', {}, args, 'shop-coupons.php'),
  },
  {
    name: 'deactivate_coupon',
    description:
      'Desactiva un código de descuento. No lo borra: el historial de quién lo usó se conserva. Pide el id del promotion code (promo_…), que sale de list_coupons.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id del promotion code, promo_…' } },
      required: ['id'],
      additionalProperties: false,
    },
    run: async ({ id }) => api('coupon.deactivate', {}, { id }, 'shop-coupons.php'),
  },
  {
    name: 'orders_summary',
    description:
      'Resumen de pedidos: totales por estado y los más recientes. No devuelve datos del comprador (ni correo, ni dirección, ni teléfono).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Cuántos pedidos recientes traer (1-100, default 20)' },
      },
      additionalProperties: false,
    },
    run: async (args) => api('orders.summary', { limit: args.limit }),
  },

  // ── Escrituras (fase 2) ──
  // No hay borrar, no hay cambiar slug y no hay publicar: ver la cabecera de
  // api/mcp-write.php para el porqué de cada ausencia.
  {
    name: 'update_project',
    description:
      'Cambia el contenido de un proyecto: título, descripciones en inglés y español, texto y destino del botón, y visibilidad. El HTML se limpia con el mismo sanitizador del CMS. NO puede cambiar el slug ni borrar el proyecto. Manda solo los campos que quieras cambiar.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del proyecto a cambiar' },
        id: { type: 'number', description: 'Id numérico, alternativa al slug' },
        title: { type: 'string' },
        description_en: { type: 'string', description: 'HTML, normalmente párrafos <p>' },
        description_es: { type: 'string', description: 'HTML, normalmente párrafos <p>' },
        link_text_en: { type: 'string', description: 'Texto del botón en inglés, p. ej. "Visit the site"' },
        link_text_es: { type: 'string', description: 'Texto del botón en español' },
        link_url: { type: 'string', description: 'A dónde lleva el botón. Solo http/https; cadena vacía lo quita.' },
        external_url: { type: 'string', description: 'Igual que link_url, para los proyectos de tipo "link". Solo http/https.' },
        visible: { type: 'boolean', description: 'Si el proyecto se muestra en el sitio' },
      },
      additionalProperties: false,
    },
    run: async ({ slug, id, ...fields }) => api('project.update', {}, { slug, id, ...fields }),
  },
  {
    name: 'update_post',
    description:
      'Cambia el contenido de una entrada: títulos, subtítulos, extractos, cuerpo en HTML y tags, en ambos idiomas. NO puede publicar ni despublicar —eso se hace en el CMS— ni cambiar el slug. Manda solo los campos que quieras cambiar.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del post a cambiar' },
        id: { type: 'number', description: 'Id numérico, alternativa al slug' },
        title: { type: 'string' },
        title_es: { type: 'string' },
        subtitle: { type: 'string' },
        subtitle_es: { type: 'string' },
        excerpt: { type: 'string', description: 'Texto plano; las etiquetas se quitan' },
        excerpt_es: { type: 'string', description: 'Texto plano; las etiquetas se quitan' },
        content_html: { type: 'string', description: 'Cuerpo en HTML' },
        content_html_es: { type: 'string', description: 'Cuerpo en HTML' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    run: async ({ slug, id, ...fields }) => api('post.update', {}, { slug, id, ...fields }),
  },
  {
    name: 'create_post',
    description:
      'Crea una entrada nueva del blog. Siempre queda en BORRADOR: publicarla es una decisión que se toma en el CMS. El slug se genera del título si no se da.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Obligatorio' },
        slug: { type: 'string', description: 'Opcional; si no va, se genera del título' },
        title_es: { type: 'string' },
        subtitle: { type: 'string' },
        excerpt: { type: 'string' },
        excerpt_es: { type: 'string' },
        content_html: { type: 'string' },
        content_html_es: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title'],
      additionalProperties: false,
    },
    run: async (args) => api('post.create', {}, args),
  },
]

const byName = new Map(TOOLS.map((t) => [t.name, t]))

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handle(msg) {
  const { id, method, params } = msg

  // Las notificaciones no llevan id y no se contestan.
  if (id === undefined || id === null) return

  switch (method) {
    case 'initialize':
      reply(id, {
        // Devolvemos la versión que pidió el cliente cuando es una que
        // entendemos; si no, la nuestra. Así no se rompe al actualizar.
        protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : FALLBACK_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
      return

    case 'ping':
      reply(id, {})
      return

    case 'tools/list':
      reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      })
      return

    case 'tools/call': {
      const tool = byName.get(params?.name)
      if (!tool) {
        replyError(id, -32602, `Herramienta desconocida: ${params?.name}`)
        return
      }
      try {
        const data = await tool.run(params?.arguments || {})
        reply(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
      } catch (err) {
        // isError en el resultado, no un error de JSON-RPC: así el modelo lee
        // el motivo y puede corregir, en vez de ver la llamada caerse seca.
        reply(id, { content: [{ type: 'text', text: String(err.message || err) }], isError: true })
      }
      return
    }

    default:
      replyError(id, -32601, `Método no soportado: ${method}`)
  }
}

const rl = createInterface({ input: process.stdin })

// Peticiones en vuelo. Sin esto, cerrar stdin mata el proceso con llamadas a
// medio camino y el cliente se queda esperando una respuesta que nunca llega.
const pending = new Set()

rl.on('line', (line) => {
  const text = line.trim()
  if (!text) return
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    log('[mcp] línea que no es JSON, ignorada')
    return
  }
  const task = handle(msg).catch((err) => {
    log('[mcp] error sin capturar:', err?.stack || err)
    if (msg?.id !== undefined && msg?.id !== null) replyError(msg.id, -32603, 'Error interno')
  })
  pending.add(task)
  task.finally(() => pending.delete(task))
})

rl.on('close', async () => {
  // Damos margen a lo que esté en vuelo, pero sin colgarnos para siempre si
  // el sitio no contesta.
  if (pending.size) {
    await Promise.race([
      Promise.allSettled([...pending]),
      new Promise((r) => setTimeout(r, 35_000)),
    ])
  }
  process.exit(0)
})

log(`[mcp] mroscar-site listo — ${SITE}${TOKEN ? '' : ' (SIN TOKEN: las llamadas van a fallar)'}`)
