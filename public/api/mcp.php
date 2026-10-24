<?php
/**
 * Puerta de lectura para el servidor MCP (tools/mcp/).
 *
 * Un solo endpoint en vez de abrirle el token a los de admin que ya existen:
 * así todo lo que el agente puede ver cabe en este archivo, y revisar qué
 * expone es leer una lista, no auditar treinta endpoints.
 *
 * FASE 1: SOLO LECTURA. Ninguna acción escribe. Las escrituras llegarán en su
 * propio archivo y con scope 'write' — ver mcp-auth.php.
 *
 * Devuelve datos pensados para que un agente decida, no para pintar una
 * pantalla: en los listados van los conteos de palabras de cada descripción,
 * porque "esta ficha tiene 12 palabras" es la pregunta que de verdad se hace
 * quien está revisando el contenido del sitio.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';
require_once __DIR__ . '/db.php';

Middleware::cors();
Middleware::json();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Middleware::error('method_not_allowed', 405);
}

McpAuth::require('read');

$action = trim((string) ($_GET['action'] ?? ''));

/** Palabras de un HTML del CMS — la medida útil para saber si una ficha está vacía. */
function wordCount(?string $html): int
{
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $html)) ?? '');
    return $t === '' ? 0 : count(preg_split('/\s+/u', $t) ?: []);
}

function clampLimit($raw, int $default = 50, int $max = 200): int
{
    $n = is_numeric($raw) ? (int) $raw : $default;
    return max(1, min($max, $n));
}

try {
    switch ($action) {

        // Qué sabe hacer este endpoint. El servidor MCP lo llama al arrancar
        // para no traer herramientas que el backend todavía no soporta.
        case 'capabilities':
            Middleware::success([
                'phase' => 1,
                'scope' => McpAuth::scope(),
                'actions' => [
                    'capabilities',
                    'projects.list', 'projects.get',
                    'posts.list', 'posts.get',
                    'products.list',
                    'orders.summary',
                ],
                'writes_enabled' => false,
            ]);
            break;

        case 'projects.list': {
            $rows = Database::fetchAll(
                'SELECT id, slug, title, project_type, is_active, external_url, link_url,
                        description_en, description_es, created_at
                 FROM projects ORDER BY display_order ASC, id DESC'
            ) ?: [];
            $out = array_map(fn($p) => [
                'id' => (int) $p['id'],
                'slug' => $p['slug'],
                'title' => $p['title'],
                'type' => $p['project_type'],
                'visible' => (bool) $p['is_active'],
                'url' => 'https://mroscar.xyz/work/' . $p['slug'],
                'link' => $p['external_url'] ?: $p['link_url'] ?: null,
                'words_en' => wordCount($p['description_en'] ?? ''),
                'words_es' => wordCount($p['description_es'] ?? ''),
            ], $rows);
            Middleware::success(['projects' => $out, 'count' => count($out)]);
            break;
        }

        case 'projects.get': {
            $id = $_GET['id'] ?? null;
            $slug = trim((string) ($_GET['slug'] ?? ''));
            if ($id === null && $slug === '')
                Middleware::error('missing_id_or_slug', 400);

            $p = $id !== null
                ? Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $id])
                : Database::fetchOne('SELECT * FROM projects WHERE slug = ?', [$slug]);

            if (!$p)
                Middleware::error('not_found', 404);

            Middleware::success(['project' => [
                'id' => (int) $p['id'],
                'slug' => $p['slug'],
                'title' => $p['title'],
                'type' => $p['project_type'],
                'visible' => (bool) $p['is_active'],
                'url' => 'https://mroscar.xyz/work/' . $p['slug'],
                'description_en' => $p['description_en'],
                'description_es' => $p['description_es'],
                'words_en' => wordCount($p['description_en'] ?? ''),
                'words_es' => wordCount($p['description_es'] ?? ''),
                'external_url' => $p['external_url'],
                'link_url' => $p['link_url'],
                'link_text_en' => $p['link_text_en'],
                'link_text_es' => $p['link_text_es'],
                'cover_image' => $p['cover_image'],
                'created_at' => $p['created_at'],
            ]]);
            break;
        }

        case 'posts.list': {
            // Incluye borradores a propósito: el token es de admin y saber qué
            // hay sin publicar es justo lo que no se ve desde fuera.
            $rows = Database::fetchAll(
                'SELECT id, slug, title, title_es, published, featured, published_at,
                        excerpt, content_html, content_html_es, updated_at
                 FROM blog_posts ORDER BY published_at DESC, id DESC'
            ) ?: [];
            $out = array_map(fn($b) => [
                'id' => (int) $b['id'],
                'slug' => $b['slug'],
                'title' => $b['title'],
                'title_es' => $b['title_es'],
                'published' => (bool) $b['published'],
                'featured' => (bool) $b['featured'],
                'published_at' => $b['published_at'],
                'updated_at' => $b['updated_at'],
                'url' => 'https://mroscar.xyz/blog/' . $b['slug'],
                'words_en' => wordCount($b['content_html'] ?? ''),
                'words_es' => wordCount($b['content_html_es'] ?? ''),
            ], $rows);
            Middleware::success(['posts' => $out, 'count' => count($out)]);
            break;
        }

        case 'posts.get': {
            $id = $_GET['id'] ?? null;
            $slug = trim((string) ($_GET['slug'] ?? ''));
            if ($id === null && $slug === '')
                Middleware::error('missing_id_or_slug', 400);

            $b = $id !== null
                ? Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [(int) $id])
                : Database::fetchOne('SELECT * FROM blog_posts WHERE slug = ?', [$slug]);

            if (!$b)
                Middleware::error('not_found', 404);

            Middleware::success(['post' => [
                'id' => (int) $b['id'],
                'slug' => $b['slug'],
                'title' => $b['title'],
                'title_es' => $b['title_es'],
                'subtitle' => $b['subtitle'],
                'excerpt' => $b['excerpt'],
                'excerpt_es' => $b['excerpt_es'],
                'content_html' => $b['content_html'],
                'content_html_es' => $b['content_html_es'],
                'tags' => json_decode($b['tags'] ?? '[]', true) ?: [],
                'published' => (bool) $b['published'],
                'published_at' => $b['published_at'],
                'cover_image' => $b['cover_image'],
                'url' => 'https://mroscar.xyz/blog/' . $b['slug'],
                'words_en' => wordCount($b['content_html'] ?? ''),
                'words_es' => wordCount($b['content_html_es'] ?? ''),
            ]]);
            break;
        }

        case 'products.list': {
            $rows = Database::fetchAll(
                'SELECT id, slug, archive_id, status, kind, edition, edition_size, featured,
                        title_en, title_es, description_en, description_es, updated_at
                 FROM shop_products ORDER BY display_order ASC, id DESC'
            ) ?: [];
            $out = array_map(fn($p) => [
                'id' => (int) $p['id'],
                'slug' => $p['slug'],
                'archive_id' => $p['archive_id'],
                'status' => $p['status'],
                'kind' => $p['kind'],
                'edition' => $p['edition'],
                'edition_size' => $p['edition_size'] !== null ? (int) $p['edition_size'] : null,
                'featured' => (bool) $p['featured'],
                'title_en' => $p['title_en'],
                'title_es' => $p['title_es'],
                'words_en' => wordCount($p['description_en'] ?? ''),
                'words_es' => wordCount($p['description_es'] ?? ''),
                'updated_at' => $p['updated_at'],
            ], $rows);
            Middleware::success(['products' => $out, 'count' => count($out)]);
            break;
        }

        case 'orders.summary': {
            // Agregados y lo mínimo por pedido. Nada de email, dirección,
            // teléfono ni ids de Stripe: el agente no necesita datos del
            // comprador para ayudar con el sitio, y lo que no se expone no
            // se puede filtrar.
            $byStatus = Database::fetchAll(
                'SELECT status, COUNT(*) AS n, COALESCE(SUM(total),0) AS total
                 FROM shop_orders GROUP BY status'
            ) ?: [];

            $limit = clampLimit($_GET['limit'] ?? null, 20, 100);
            $recent = Database::fetchAll(
                "SELECT order_number, status, currency, total, zone_code, has_physical,
                        has_digital, created_at, paid_at
                 FROM shop_orders ORDER BY created_at DESC LIMIT {$limit}"
            ) ?: [];

            Middleware::success([
                'by_status' => array_map(fn($r) => [
                    'status' => $r['status'],
                    'count' => (int) $r['n'],
                    'total' => (float) $r['total'],
                ], $byStatus),
                'recent' => $recent,
            ]);
            break;
        }

        default:
            Middleware::error('unknown_action', 400, ['action' => $action]);
    }
}
catch (Throwable $e) {
    // El mensaje real va a la bitácora, no a la respuesta: un error de SQL
    // cuenta más de la cuenta sobre el esquema.
    McpAuth::log('error', ['action' => $action, 'message' => $e->getMessage()]);
    Middleware::error('server_error', 500);
}
