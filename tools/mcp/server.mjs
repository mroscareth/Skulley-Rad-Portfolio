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
async function api(action, params = {}, body = null) {
  if (!TOKEN) {
    throw new Error('Falta MCP_TOKEN en .env.local (o en el entorno). Ver el comentario de cabecera de tools/mcp/server.mjs.')
  }
  // Las escrituras van a su propio endpoint, por POST. Ver api/mcp-write.php.
  const endpoint = body ? 'mcp-write.php' : 'mcp.php'
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
    name: 'list_products',
    description:
      'Lista los productos de la tienda con su estado, tipo de edición y el conteo de palabras de su descripción.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => api('products.list'),
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
      'Cambia el contenido de un proyecto: título, descripciones en inglés y español, texto del botón y visibilidad. El HTML se limpia con el mismo sanitizador del CMS. NO puede cambiar el slug ni borrar el proyecto. Manda solo los campos que quieras cambiar.',
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
