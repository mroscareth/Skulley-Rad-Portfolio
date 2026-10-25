<?php
/**
 * Servidor MCP remoto — https://mroscar.xyz/mcp
 *
 * Lo que un colaborador agrega en Claude como "conector personalizado": pega
 * esta URL, Claude descubre el OAuth del sitio (mcp-oauth.php), el
 * colaborador pega su llave en la página de autorización y listo. Sin repo,
 * sin instalar nada.
 *
 * Transporte "Streamable HTTP" de MCP en su forma más simple: cada POST trae
 * un mensaje JSON-RPC y la respuesta va como application/json. Sin streams
 * (GET responde 405, que el protocolo permite) y sin sesión: cada request se
 * autentica solo con su token.
 *
 * Las herramientas NO reimplementan nada: llaman a los endpoints que ya usa el
 * CMS (shop-admin, shop-orders, shop-coupons, mcp, mcp-write) con la misma
 * credencial que trajo el request. Así pasan por las mismas validaciones, los
 * mismos permisos (McpAuth) y la misma bitácora que todo lo demás.
 *
 * La credencial puede ser un token OAuth (conectores de Claude) o la llave
 * misma en `Authorization: Bearer` (Claude Code con un header fijo).
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';

const MCP_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version');
header('Access-Control-Expose-Headers: WWW-Authenticate, Mcp-Session-Id');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    http_response_code(204);
    exit;
}
if ($method !== 'POST') {
    // Sin stream de servidor a cliente: el protocolo permite contestar 405.
    header('Allow: POST');
    http_response_code(405);
    exit;
}

/** Respuesta JSON-RPC (o un lote) y fin. */
function rpcOut($payload, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Autenticación ──
// Sin credencial válida: 401 con el puntero a la metadata del recurso. Es lo
// que dispara el flujo OAuth en Claude (ignora el header en un 200).
McpAuth::ensureTable();
$key = McpAuth::current();
if (!$key) {
    if (!Middleware::rateLimit('mcp_fail', 30, 60)) {
        rpcOut(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32000, 'message' => 'rate_limited']], 429);
    }
    header('WWW-Authenticate: Bearer resource_metadata="' . McpOAuth::publicUrl() . '/.well-known/oauth-protected-resource/mcp", scope="mcp"');
    rpcOut(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32001, 'message' => 'Unauthorized']], 401);
}
if (!Middleware::rateLimit('mcp_remote_' . $key['id'], 120, 60)) {
    rpcOut(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32000, 'message' => 'Demasiadas peticiones seguidas. Espera un minuto.']], 429);
}
$scope = McpAuth::scope();
$credential = McpAuth::credentialFromRequest();

// ── Herramientas ──
// [nombre, permiso, endpoint, acción, método, descripción, schema de entrada, anotaciones extra]
// Método 'GET' manda los argumentos como query; 'POST', como cuerpo JSON.
function obj(array $props = [], array $required = [], bool $extra = false): array
{
    $s = ['type' => 'object', 'properties' => (object) $props, 'additionalProperties' => $extra];
    if ($required)
        $s['required'] = $required;
    return $s;
}

$TOOLS = [
    // Contenido (lectura)
    ['list_projects', 'read', 'mcp.php', 'projects.list', 'GET',
        'Lista los proyectos del portafolio (/work) con su slug, tipo, visibilidad y cuántas palabras tiene su descripción en cada idioma.',
        obj()],
    ['get_project', 'read', 'mcp.php', 'projects.get', 'GET',
        'Un proyecto completo: descripciones en inglés y español, link externo y texto de su botón. Por slug o por id.',
        obj(['slug' => ['type' => 'string', 'description' => 'Slug, p. ej. "arttoys"'], 'id' => ['type' => 'number']])],
    ['list_posts', 'read', 'mcp.php', 'posts.list', 'GET',
        'Lista las entradas de Memories (blog), incluidas las no publicadas, con su estado y palabras por idioma.',
        obj()],
    ['get_post', 'read', 'mcp.php', 'posts.get', 'GET',
        'Una entrada completa, con el cuerpo en HTML en ambos idiomas, el extracto y los tags. Por slug o por id.',
        obj(['slug' => ['type' => 'string'], 'id' => ['type' => 'number']])],
    ['orders_summary', 'read', 'mcp.php', 'orders.summary', 'GET',
        'Resumen de pedidos: totales por estado y los más recientes, sin datos del comprador.',
        obj(['limit' => ['type' => 'number', 'description' => '1-100, default 20']])],

    // Tienda
    ['list_shop_products', 'shop', 'shop-admin.php', 'products', 'GET',
        'Lista los productos de la tienda como los ve el CMS: variantes, stock, precios en MXN y USD, edición, estado y vendidos.',
        obj()],
    ['get_shop_product', 'shop', 'shop-admin.php', 'product', 'GET',
        'Un producto completo de la tienda, con variantes, opciones, imágenes y precios.',
        obj(['id' => ['type' => 'number', 'description' => 'Id del producto']], ['id'])],
    ['save_shop_product', 'shop', 'shop-admin.php', 'product_save', 'POST',
        'Crea o actualiza un producto. Sin "id" crea uno nuevo; con "id" actualiza ese. Pasa por las mismas validaciones que el CMS: una edición "unique" no admite opciones, una "limited" exige tiraje, y un digital activo exige archivos. Manda el producto COMPLETO (léelo antes con get_shop_product), no solo lo que cambia. Antes de guardar, muéstrale al usuario qué vas a cambiar.',
        obj([
            'id' => ['type' => 'number', 'description' => 'Omitir para crear uno nuevo'],
            'title_en' => ['type' => 'string'], 'title_es' => ['type' => 'string'],
            'description_en' => ['type' => 'string'], 'description_es' => ['type' => 'string'],
            'status' => ['type' => 'string', 'description' => 'active | draft | archived'],
            'kind' => ['type' => 'string', 'description' => 'physical | digital'],
            'edition' => ['type' => 'string', 'description' => 'unique (1/1) | limited (exige edition_size) | open'],
            'edition_size' => ['type' => 'number'],
            'category_id' => ['type' => 'number'],
            'images' => ['type' => 'array', 'items' => obj(['url' => ['type' => 'string'], 'alt_en' => ['type' => 'string'], 'alt_es' => ['type' => 'string']], ['url']), 'description' => 'Fotos en orden: [{url, alt_en, alt_es}] con la ruta (uploads/…) que da get_shop_product. Para agregar fotos nuevas usa create_upload_link.'],
            'options' => ['type' => 'array', 'items' => ['type' => 'object'], 'description' => 'Color, Size… con sus valores'],
            'variants' => ['type' => 'array', 'items' => ['type' => 'object'], 'description' => 'Cada variante con sku, price_mxn, price_usd, stock y option_values. El MXN sigue al USD con el tipo de cambio del día (redondeado a pesos), como en el CMS: si cambias price_usd y dejas price_mxn igual, o no mandas la llave price_mxn, se recalcula solo. Para fijar un MXN a propósito, mándalo distinto al guardado; null = sin precio en MXN.'],
        ], [], true)],
    ['list_shop_categories', 'shop', 'shop-admin.php', 'categories', 'GET',
        'Categorías de la tienda, con el id que va en category_id al guardar un producto.',
        obj()],
    ['list_shop_zones', 'shop', 'shop-admin.php', 'zones', 'GET',
        'Zonas de envío: qué países cubre cada una, en qué moneda cobra y sus tarifas.',
        obj()],
    ['list_orders', 'shop', 'shop-orders.php', 'list', 'GET',
        'Lista pedidos con filtros, con los datos del comprador para atender un pedido concreto.',
        obj([
            'status' => ['type' => 'string', 'description' => 'Separados por coma: paid,preparing,shipped,delivered,cancelled…'],
            'q' => ['type' => 'string', 'description' => 'Busca por número de pedido, nombre o correo'],
            'page' => ['type' => 'number'],
        ])],
    ['get_order', 'shop', 'shop-orders.php', 'detail', 'GET',
        'Un pedido completo: artículos, envío, pagos y su historial.',
        obj(['id' => ['type' => 'number']], ['id'])],
    ['order_stats', 'shop', 'shop-orders.php', 'stats', 'GET',
        'Totales de la tienda por moneda: pedidos pagados, neto y devoluciones.',
        obj()],
    ['update_order', 'shop', 'shop-orders.php', 'update', 'POST',
        'Actualiza un pedido: paquetería, guía y estado. OJO: el estado "shipped" le manda un correo al comprador con la guía — confírmalo con el usuario antes. NO puede reembolsar, cancelar ni marcar como pagado: eso se hace en el CMS.',
        obj([
            'id' => ['type' => 'number'],
            'status' => ['type' => 'string', 'description' => 'paid | preparing | shipped | delivered'],
            'carrier' => ['type' => 'string'], 'tracking_number' => ['type' => 'string'], 'tracking_url' => ['type' => 'string'],
            'notes' => ['type' => 'string', 'description' => 'Nota interna, no la ve el comprador'],
        ], ['id'])],
    ['list_coupons', 'shop', 'shop-coupons.php', 'coupons.list', 'GET',
        'Códigos de descuento de Stripe: cuáles existen, cuánto descuentan, cuántas veces se usaron y si siguen activos.',
        obj(['limit' => ['type' => 'number', 'description' => '1-100, default 50']])],
    ['create_coupon', 'shop', 'shop-coupons.php', 'coupon.create', 'POST',
        'Crea un código de descuento que el comprador escribe en el checkout. Lleva percent_off, o amount_off con su moneda. No mueve dinero: cambia lo que se cobrará en una compra futura. Confirma el código y el descuento con el usuario antes de crearlo.',
        obj([
            'code' => ['type' => 'string', 'description' => '3-40 caracteres: letras, números, guion y guion bajo. Se guarda en mayúsculas.'],
            'percent_off' => ['type' => 'number', 'description' => 'Entre 1 y 100'],
            'amount_off' => ['type' => 'number', 'description' => 'Monto fijo; exige currency'],
            'currency' => ['type' => 'string', 'description' => 'mxn o usd, solo con amount_off'],
            'max_redemptions' => ['type' => 'number', 'description' => 'Cuántas veces se puede usar en total'],
            'expires_at' => ['type' => 'string', 'description' => 'Fecha futura, p. ej. 2026-12-31'],
        ], ['code'])],
    ['deactivate_coupon', 'shop', 'shop-coupons.php', 'coupon.deactivate', 'POST',
        'Desactiva un código de descuento. No lo borra: el historial de quién lo usó se conserva. Pide el id del promotion code (promo_…) que sale de list_coupons.',
        obj(['id' => ['type' => 'string', 'description' => 'Id del promotion code, promo_…']], ['id'])],

    // Contenido (escritura)
    ['update_project', 'write', 'mcp-write.php', 'project.update', 'POST',
        'Cambia el contenido de un proyecto: título, descripciones en inglés y español, texto y destino del botón, y visibilidad. El HTML se limpia con el sanitizador del CMS. NO cambia el slug ni borra. Manda solo los campos que cambian.',
        obj([
            'slug' => ['type' => 'string'], 'id' => ['type' => 'number'], 'title' => ['type' => 'string'],
            'description_en' => ['type' => 'string', 'description' => 'HTML, normalmente <p>'],
            'description_es' => ['type' => 'string', 'description' => 'HTML, normalmente <p>'],
            'link_text_en' => ['type' => 'string'], 'link_text_es' => ['type' => 'string'],
            'link_url' => ['type' => 'string', 'description' => 'Solo http/https; vacío lo quita'],
            'external_url' => ['type' => 'string', 'description' => 'Para proyectos de tipo link. Solo http/https.'],
            'visible' => ['type' => 'boolean'],
        ])],
    ['create_project', 'write', 'mcp-write.php', 'project.create', 'POST',
        'Crea un proyecto nuevo del portafolio (/work) con su título y descripciones en inglés y español. Nace OCULTO: después sube la portada y la galería con create_upload_link (slot cover y gallery), revisa con list_project_media y hazlo visible con update_project visible:true cuando el usuario lo pida. El slug se genera del título si no se da y no se puede cambiar después: confírmalo con el usuario.',
        obj([
            'title' => ['type' => 'string', 'description' => 'Obligatorio'],
            'slug' => ['type' => 'string', 'description' => 'Opcional; si no va, se genera del título. Será la URL /work/{slug}.'],
            'description_en' => ['type' => 'string', 'description' => 'HTML, normalmente <p>'],
            'description_es' => ['type' => 'string', 'description' => 'HTML, normalmente <p>'],
            'project_type' => ['type' => 'string', 'description' => 'gallery (default) | link'],
            'link_url' => ['type' => 'string', 'description' => 'Destino del botón. Solo http/https.'],
            'link_text_en' => ['type' => 'string'], 'link_text_es' => ['type' => 'string'],
            'external_url' => ['type' => 'string', 'description' => 'Para proyectos de tipo link. Solo http/https.'],
        ], ['title'])],
    ['update_post', 'write', 'mcp-write.php', 'post.update', 'POST',
        'Cambia una entrada de Memories: títulos, subtítulos, extractos, cuerpo en HTML y tags en ambos idiomas, y si está publicada (published). NO cambia el slug. Manda solo los campos que cambian; publicar o despublicar confírmalo con el usuario.',
        obj([
            'slug' => ['type' => 'string'], 'id' => ['type' => 'number'],
            'title' => ['type' => 'string'], 'title_es' => ['type' => 'string'],
            'subtitle' => ['type' => 'string'], 'subtitle_es' => ['type' => 'string'],
            'excerpt' => ['type' => 'string'], 'excerpt_es' => ['type' => 'string'],
            'content_html' => ['type' => 'string'], 'content_html_es' => ['type' => 'string'],
            'tags' => ['type' => 'array', 'items' => ['type' => 'string']],
            'published' => ['type' => 'boolean', 'description' => 'true publica, false la regresa a borrador'],
        ])],
    ['create_post', 'write', 'mcp-write.php', 'post.create', 'POST',
        'Crea una entrada nueva de Memories. Nace en BORRADOR; para publicarla, update_post con published:true. El slug se genera del título si no se da.',
        obj([
            'title' => ['type' => 'string', 'description' => 'Obligatorio'], 'slug' => ['type' => 'string'],
            'title_es' => ['type' => 'string'], 'subtitle' => ['type' => 'string'],
            'excerpt' => ['type' => 'string'], 'excerpt_es' => ['type' => 'string'],
            'content_html' => ['type' => 'string'], 'content_html_es' => ['type' => 'string'],
            'tags' => ['type' => 'array', 'items' => ['type' => 'string']],
        ], ['title'])],

    // Archivos: el MCP no transporta bytes, así que se sube por un enlace.
    ['create_upload_link', 'shop', 'mcp-upload.php', 'link.create', 'POST',
        'Crea un enlace para subir fotos y videos a mroscar.xyz, porque el MCP no transporta archivos. Destinos: target "project" (slot "gallery" para la galería, o "cover" para la portada), "product" (sus fotos; basta llave de tienda) o "post" (portada de una entrada de Memorias). '
        . 'Si TIENES acceso a los archivos (Claude Code), súbelos tú con curl -sS -F "file=@/ruta/archivo" URL, uno por petición y en el orden en que deben quedar; la respuesta dice si cada uno quedó. '
        . 'Si NO lo tienes (claude.ai, celular), dale el enlace al usuario: lo abre, arrastra sus archivos y te avisa. '
        . 'Las imágenes se optimizan solas (WebP, 2400 px máx.); imágenes hasta 10 MB, videos MP4/WebM hasta 50 MB y solo en la galería de un proyecto. El enlace vence en 60 minutos y deja de servir si se revoca la llave.',
        obj([
            'target' => ['type' => 'string', 'description' => 'project | product | post'],
            'id' => ['type' => 'number', 'description' => 'Id del proyecto, producto o entrada'],
            'slug' => ['type' => 'string', 'description' => 'Para proyecto o entrada, en vez del id'],
            'slot' => ['type' => 'string', 'description' => 'Proyecto: gallery (default) o cover. Producto: images. Entrada: cover.'],
            'max_files' => ['type' => 'number', 'description' => 'Tope de archivos, 1-40 (default 20; una portada siempre es 1)'],
        ], ['target'])],
    ['list_project_media', 'read', 'mcp-media.php', 'media.list', 'GET',
        'La portada y la galería de un proyecto en el orden en que salen en el sitio, con el id de cada archivo (media_id), su tipo y su URL.',
        obj(['slug' => ['type' => 'string'], 'id' => ['type' => 'number']])],
    ['reorder_project_media', 'write', 'mcp-media.php', 'media.reorder', 'POST',
        'Cambia el orden de la galería de un proyecto. "order" lleva TODOS los media_id del proyecto (sácalos de list_project_media), cada uno una vez, en el orden nuevo.',
        obj(['slug' => ['type' => 'string'], 'id' => ['type' => 'number'], 'order' => ['type' => 'array', 'items' => ['type' => 'number']]], ['order'])],
    ['set_project_cover', 'write', 'mcp-media.php', 'media.set_cover', 'POST',
        'Usa una imagen de la galería como portada del proyecto (la tarjeta en /work). La imagen sigue también en la galería.',
        obj(['slug' => ['type' => 'string'], 'id' => ['type' => 'number'], 'media_id' => ['type' => 'number']], ['media_id'])],
    ['remove_project_media', 'write', 'mcp-media.php', 'media.remove', 'POST',
        'Saca un archivo de la galería de un proyecto. No se borra: el archivo pasa a la papelera del servidor (uploads/_trash), y si también es la portada se queda donde está. Confírmalo con el usuario antes.',
        obj(['slug' => ['type' => 'string'], 'id' => ['type' => 'number'], 'media_id' => ['type' => 'number']], ['media_id']),
        ['destructiveHint' => true]],
];

/** Los códigos de error del backend dichos para que el modelo los entienda. */
function humanError(string $code): string
{
    $hints = [
        'unauthorized' => 'La llave ya no es válida (¿se revocó?). Vuelve a conectar el conector.',
        'read_only_token' => 'Esta llave es de solo lectura o de tienda: no puede editar contenido del sitio.',
        'shop_scope_required' => 'Esta llave no tiene permiso de tienda.',
        'nothing_to_update' => 'No mandaste ningún campo que cambiar.',
        'slug_taken' => 'Ya existe una entrada con ese slug.',
        'title_required' => 'El título no puede quedar vacío.',
        'invalid_url' => 'La URL no sirve: tiene que empezar con http:// o https://.',
        'rate_limited' => 'Demasiadas peticiones seguidas. Espera un minuto.',
        'not_found' => 'No existe ese elemento.',
        'stripe_not_configured' => 'Stripe no está configurado en el servidor.',
        'invalid_target' => 'target tiene que ser project, product o post.',
        'invalid_slot' => 'Ese slot no existe para ese destino: proyecto gallery o cover, producto images, entrada cover.',
        'order_mismatch' => 'El orden tiene que traer todos los media_id del proyecto, cada uno una vez. Pídelos con list_project_media.',
        'media_not_in_project' => 'Ese media_id no es de este proyecto. Revisa con list_project_media.',
        'not_image' => 'La portada tiene que ser una imagen, no un video.',
    ];
    return $hints[$code] ?? "Error del servidor: {$code}";
}

/** Llama a un endpoint del sitio con la credencial del request. */
function callSite(string $endpoint, string $action, string $method, array $args, string $credential): array
{
    $base = rtrim((string) (Middleware::getConfig()['MCP_LOOPBACK_URL'] ?? McpOAuth::publicUrl()), '/');
    $query = ['action' => $action];
    if ($method === 'GET') {
        foreach ($args as $k => $v) {
            if ($v !== null && $v !== '' && !is_array($v))
                $query[$k] = is_bool($v) ? ($v ? '1' : '0') : (string) $v;
        }
    }
    $ch = curl_init("{$base}/api/{$endpoint}?" . http_build_query($query));
    $headers = ['X-MCP-Token: ' . $credential, 'Accept: application/json'];
    if ($method === 'POST') {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode((object) $args, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 28,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'mroscar-mcp-remote',
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false)
        throw new RuntimeException("No se pudo hablar con el sitio: {$err}");
    $data = json_decode((string) $raw, true);
    if (!is_array($data) || !($data['ok'] ?? false)) {
        $code = is_array($data) ? (string) ($data['error'] ?? "http_{$status}") : "http_{$status}";
        $detail = is_array($data) && isset($data['detail']) ? ' — ' . (is_string($data['detail']) ? $data['detail'] : json_encode($data['detail'], JSON_UNESCAPED_UNICODE)) : '';
        throw new RuntimeException(humanError($code) . $detail);
    }
    unset($data['ok']);
    return $data;
}

/** Atiende un mensaje JSON-RPC. Devuelve la respuesta, o null si era notificación. */
function handleRpc($msg, array $TOOLS, array $key, string $scope, string $credential): ?array
{
    if (!is_array($msg) || ($msg['jsonrpc'] ?? null) !== '2.0' || !isset($msg['method'])) {
        return ['jsonrpc' => '2.0', 'id' => $msg['id'] ?? null, 'error' => ['code' => -32600, 'message' => 'Invalid Request']];
    }
    $hasId = array_key_exists('id', $msg) && $msg['id'] !== null;
    $id = $msg['id'] ?? null;
    $params = is_array($msg['params'] ?? null) ? $msg['params'] : [];
    if (!$hasId)
        return null; // notificaciones (initialized, cancelled…): nada que contestar

    $ok = fn($result) => ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result];
    $fail = fn(int $code, string $m) => ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $m]];
    $mine = array_values(array_filter($TOOLS, fn($t) => McpAuth::allows($scope, $t[1])));

    switch ($msg['method']) {
        case 'initialize':
            $asked = (string) ($params['protocolVersion'] ?? '');
            $scopeText = ['read' => 'solo lectura', 'shop' => 'tienda', 'write' => 'tienda y contenido del sitio'][$scope];
            return $ok([
                'protocolVersion' => in_array($asked, MCP_PROTOCOLS, true) ? $asked : MCP_PROTOCOLS[0],
                'capabilities' => ['tools' => ['listChanged' => false]],
                'serverInfo' => ['name' => 'mroscar-site', 'title' => 'mroscar.xyz', 'version' => '2.1.0'],
                'instructions' =>
                    "Trabajas en mroscar.xyz, el sitio y la tienda de Oscar Moctezuma (Skulley Rad), con la llave \"{$key['name']}\" ({$scopeText}). "
                    . 'La tienda vende en MXN y USD: cada variante tiene precio en las dos monedas. '
                    . 'No puedes reembolsar, cancelar pedidos sin pagar ni mover dinero: eso lo hace Oscar en el CMS. '
                    . 'Antes de guardar un producto, crear o desactivar un cupón, o marcar un pedido como enviado (le llega un correo al comprador), dile al usuario exactamente qué vas a hacer y espera su confirmación. '
                    . 'Para fotos y videos usa create_upload_link: si tienes los archivos, súbelos tú con curl a ese enlace; si no, dáselo al usuario para que los arrastre ahí. Nunca le pidas que entre al CMS. '
                    . 'Contesta en el idioma del usuario.',
            ]);

        case 'ping':
            return $ok((object) []);

        case 'tools/list':
            return $ok(['tools' => array_map(fn($t) => [
                'name' => $t[0],
                'description' => $t[5],
                'inputSchema' => $t[6],
                'annotations' => ($t[7] ?? []) + ['readOnlyHint' => $t[4] === 'GET', 'destructiveHint' => false],
            ], $mine)]);

        case 'tools/call': {
            $name = (string) ($params['name'] ?? '');
            $tool = null;
            foreach ($TOOLS as $t) {
                if ($t[0] === $name) {
                    $tool = $t;
                    break;
                }
            }
            if (!$tool)
                return $fail(-32602, "Herramienta desconocida: {$name}");
            if (!McpAuth::allows($scope, $tool[1])) {
                return $ok(['content' => [['type' => 'text', 'text' => 'Tu llave no tiene permiso para esta herramienta.']], 'isError' => true]);
            }
            $args = is_array($params['arguments'] ?? null) ? $params['arguments'] : [];
            try {
                $data = callSite($tool[2], $tool[3], $tool[4], $args, $credential);
                return $ok(['content' => [['type' => 'text', 'text' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]]]);
            }
            catch (Throwable $e) {
                // isError en el resultado, no un error JSON-RPC: así el modelo
                // lee el motivo y puede corregir.
                return $ok(['content' => [['type' => 'text', 'text' => $e->getMessage()]], 'isError' => true]);
            }
        }

        default:
            return $fail(-32601, "Método no soportado: {$msg['method']}");
    }
}

$body = json_decode((string) file_get_contents('php://input'), true);
if ($body === null) {
    rpcOut(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'Parse error']], 400);
}

try {
    // Lote (versiones viejas del protocolo) o un solo mensaje.
    if (array_is_list($body)) {
        $out = array_values(array_filter(array_map(fn($m) => handleRpc($m, $TOOLS, $key, $scope, $credential), $body)));
        if (!$out) {
            http_response_code(202);
            exit;
        }
        rpcOut($out);
    }
    $res = handleRpc($body, $TOOLS, $key, $scope, $credential);
    if ($res === null) {
        http_response_code(202);
        exit;
    }
    rpcOut($res);
}
catch (Throwable $e) {
    McpAuth::log('error', ['endpoint' => 'mcp-remote', 'message' => $e->getMessage()]);
    rpcOut(['jsonrpc' => '2.0', 'id' => $body['id'] ?? null, 'error' => ['code' => -32603, 'message' => 'Error interno']], 500);
}
