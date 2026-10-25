<?php
/**
 * Escrituras del MCP — FASE 2.
 *
 * Archivo aparte de mcp.php a propósito: las lecturas se pueden revisar sin
 * leer esto, y todo lo que puede CAMBIAR el sitio cabe en una sola pantalla.
 *
 * Solo llaves con permiso 'write' ("Everything" en el CMS): la de Oscar y
 * las de quien él decida. Desde 2026-10-24 también crean proyectos y
 * publican posts — Oscar documenta su trabajo desde Claude.
 *
 * Qué NO se puede hacer desde aquí, y por qué:
 *
 *   - Borrar nada. Un agente no necesita borrar para ayudar a escribir, y un
 *     borrado por error no tiene deshacer.
 *   - Cambiar un slug. Las URLs /work/{slug} y /blog/{slug} están indexadas;
 *     renombrarlas las tira del índice. Eso se decide en el CMS, a mano.
 *     (El link del botón sí se puede cambiar: ese apunta hacia afuera y
 *     caduca solo cuando se acaba una colaboración.)
 *   - Subir archivos. MCP no transporta bytes: la portada y la galería se
 *     suben con un enlace de mcp-upload.php (create_upload_link) y se
 *     acomodan con mcp-media.php.
 *   - Productos, pedidos y cupones no viven aquí: van por los endpoints de
 *     la tienda (permiso 'shop'), y mover dinero no lo hace ninguna llave.
 *
 * Proyectos y posts nuevos nacen OCULTOS / en BORRADOR aunque se pida otra
 * cosa en el mismo paso: mostrarlos es un segundo paso explícito
 * (project.update visible:true, post.update published:true).
 *
 * El HTML pasa por HtmlSanitizer, el mismo que usa el CMS. Las descripciones
 * de proyecto hoy se guardan sin sanitizar desde el CMS; aquí sí se limpian,
 * que es la dirección segura del error.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/html-sanitizer.php';

Middleware::cors();
Middleware::json();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Middleware::error('method_not_allowed', 405);
}

McpAuth::require('write');

$action = trim((string) ($_GET['action'] ?? ''));
$body = Middleware::getJsonBody();
if (!is_array($body))
    $body = [];

function wc(?string $html): int
{
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $html)) ?? '');
    return $t === '' ? 0 : count(preg_split('/\s+/u', $t) ?: []);
}

/** Localiza una fila por id o por slug. */
function findRow(string $table, array $body): ?array
{
    if (isset($body['id'])) {
        return Database::fetchOne("SELECT * FROM {$table} WHERE id = ?", [(int) $body['id']]);
    }
    $slug = trim((string) ($body['slug'] ?? ''));
    if ($slug === '')
        Middleware::error('missing_id_or_slug', 400);
    return Database::fetchOne("SELECT * FROM {$table} WHERE slug = ?", [$slug]);
}

try {
    switch ($action) {

        case 'project.update': {
            $p = findRow('projects', $body);
            if (!$p)
                Middleware::error('not_found', 404);

            $set = [];
            if (array_key_exists('title', $body)) {
                $t = trim((string) $body['title']);
                if ($t === '')
                    Middleware::error('title_required', 400);
                $set['title'] = $t;
            }
            foreach (['description_en', 'description_es'] as $f) {
                if (array_key_exists($f, $body))
                    $set[$f] = HtmlSanitizer::clean((string) $body[$f]);
            }
            foreach (['link_text_en', 'link_text_es'] as $f) {
                if (array_key_exists($f, $body))
                    $set[$f] = trim((string) $body[$f]) ?: null;
            }
            // A dónde apunta el botón. Es contenido, no estructura: una
            // colaboración se acaba y el link deja de servir. Solo http(s),
            // para que no entre un javascript: por aquí.
            foreach (['link_url', 'external_url'] as $f) {
                if (!array_key_exists($f, $body))
                    continue;
                $u = trim((string) $body[$f]);
                if ($u === '') {
                    $set[$f] = null;
                    continue;
                }
                $scheme = strtolower((string) parse_url($u, PHP_URL_SCHEME));
                if (!in_array($scheme, ['http', 'https'], true) || !filter_var($u, FILTER_VALIDATE_URL)) {
                    Middleware::error('invalid_url', 400, ['field' => $f]);
                }
                $set[$f] = $u;
            }
            if (array_key_exists('visible', $body)) {
                $set['is_active'] = $body['visible'] ? 1 : 0;
            }

            if (!$set)
                Middleware::error('nothing_to_update', 400);

            Database::update('projects', $set, 'id = ?', [(int) $p['id']]);
            McpAuth::log('project.update', [
                'slug' => $p['slug'],
                'campos' => array_keys($set),
                'palabras_antes' => ['en' => wc($p['description_en']), 'es' => wc($p['description_es'])],
            ]);

            $after = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $p['id']]);
            Middleware::success(['project' => [
                'id' => (int) $after['id'],
                'slug' => $after['slug'],
                'title' => $after['title'],
                'url' => 'https://mroscar.xyz/work/' . $after['slug'],
                'words_en' => wc($after['description_en']),
                'words_es' => wc($after['description_es']),
                'updated_fields' => array_keys($set),
            ]]);
            break;
        }

        case 'post.update': {
            $b = findRow('blog_posts', $body);
            if (!$b)
                Middleware::error('not_found', 404);

            $set = [];
            foreach (['title', 'title_es', 'subtitle', 'subtitle_es'] as $f) {
                if (array_key_exists($f, $body))
                    $set[$f] = trim((string) $body[$f]);
            }
            if (isset($set['title']) && $set['title'] === '')
                Middleware::error('title_required', 400);

            foreach (['excerpt', 'excerpt_es'] as $f) {
                if (array_key_exists($f, $body))
                    $set[$f] = trim(strip_tags((string) $body[$f]));
            }
            foreach (['content_html', 'content_html_es'] as $f) {
                if (array_key_exists($f, $body))
                    $set[$f] = HtmlSanitizer::clean((string) $body[$f]);
            }
            if (array_key_exists('tags', $body)) {
                $tags = is_array($body['tags']) ? array_values(array_filter(array_map(
                    fn($t) => trim(strip_tags((string) $t)),
                    $body['tags']
                ))) : [];
                $set['tags'] = json_encode($tags, JSON_UNESCAPED_UNICODE);
            }
            // Publicar / despublicar. La fecha de publicación se fija la
            // primera vez y no se mueve al despublicar y volver a publicar:
            // es la que ordena Memories y la que lee Google.
            if (array_key_exists('published', $body)) {
                $set['published'] = $body['published'] ? 1 : 0;
                if ($set['published'] && empty($b['published_at']))
                    $set['published_at'] = date('Y-m-d H:i:s');
            }

            if (!$set)
                Middleware::error('nothing_to_update', 400);

            Database::update('blog_posts', $set, 'id = ?', [(int) $b['id']]);
            McpAuth::log('post.update', [
                'slug' => $b['slug'],
                'campos' => array_keys($set),
                'palabras_antes' => ['en' => wc($b['content_html']), 'es' => wc($b['content_html_es'])],
            ]);

            $after = Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [(int) $b['id']]);
            Middleware::success(['post' => [
                'id' => (int) $after['id'],
                'slug' => $after['slug'],
                'title' => $after['title'],
                'published' => (bool) $after['published'],
                'url' => 'https://mroscar.xyz/blog/' . $after['slug'],
                'words_en' => wc($after['content_html']),
                'words_es' => wc($after['content_html_es']),
                'updated_fields' => array_keys($set),
            ]]);
            break;
        }

        case 'project.create': {
            $title = trim((string) ($body['title'] ?? ''));
            if ($title === '')
                Middleware::error('title_required', 400);

            $slug = Middleware::slugify((string) ($body['slug'] ?? $title));
            if (Database::fetchOne('SELECT id FROM projects WHERE slug = ?', [$slug])) {
                Middleware::error('slug_taken', 400, ['slug' => $slug]);
            }

            $urls = [];
            foreach (['link_url', 'external_url'] as $f) {
                $u = trim((string) ($body[$f] ?? ''));
                if ($u === '')
                    continue;
                $scheme = strtolower((string) parse_url($u, PHP_URL_SCHEME));
                if (!in_array($scheme, ['http', 'https'], true) || !filter_var($u, FILTER_VALIDATE_URL)) {
                    Middleware::error('invalid_url', 400, ['field' => $f]);
                }
                $urls[$f] = $u;
            }
            $type = ($body['project_type'] ?? '') === 'link' ? 'link' : 'gallery';
            $max = Database::fetchOne('SELECT MAX(display_order) AS m FROM projects');

            $id = Database::insert('projects', [
                'slug' => $slug,
                'title' => $title,
                'description_en' => HtmlSanitizer::clean((string) ($body['description_en'] ?? '')),
                'description_es' => HtmlSanitizer::clean((string) ($body['description_es'] ?? '')),
                'project_type' => $type,
                'external_url' => $urls['external_url'] ?? null,
                'link_url' => $urls['link_url'] ?? null,
                'link_text_en' => trim((string) ($body['link_text_en'] ?? '')) ?: null,
                'link_text_es' => trim((string) ($body['link_text_es'] ?? '')) ?: null,
                'display_order' => (int) ($max['m'] ?? 0) + 1,
                // Oculto: sin portada ni galería (create_upload_link) un
                // proyecto visible sería una card vacía en /work.
                'is_active' => 0,
            ]);
            McpAuth::log('project.create', ['slug' => $slug, 'id' => $id]);

            Middleware::success(['project' => [
                'id' => (int) $id,
                'slug' => $slug,
                'title' => $title,
                'visible' => false,
                'url' => 'https://mroscar.xyz/work/' . $slug,
                'cms_url' => 'https://mroscar.xyz/admin/projects/edit/' . $id,
                'note' => 'Creado oculto. Sube la portada (create_upload_link slot cover) y la galería (slot gallery), revisa con list_project_media y luego hazlo visible con update_project visible:true.',
            ]]);
            break;
        }

        case 'post.create': {
            $title = trim((string) ($body['title'] ?? ''));
            if ($title === '')
                Middleware::error('title_required', 400);

            $slug = Middleware::slugify((string) ($body['slug'] ?? $title));
            if (Database::fetchOne('SELECT id FROM blog_posts WHERE slug = ?', [$slug])) {
                Middleware::error('slug_taken', 400, ['slug' => $slug]);
            }

            $tags = is_array($body['tags'] ?? null) ? array_values(array_filter(array_map(
                fn($t) => trim(strip_tags((string) $t)),
                $body['tags']
            ))) : [];

            $id = Database::insert('blog_posts', [
                'slug' => $slug,
                'title' => $title,
                'title_es' => trim((string) ($body['title_es'] ?? '')) ?: null,
                'subtitle' => trim((string) ($body['subtitle'] ?? '')) ?: null,
                'excerpt' => trim(strip_tags((string) ($body['excerpt'] ?? ''))) ?: null,
                'excerpt_es' => trim(strip_tags((string) ($body['excerpt_es'] ?? ''))) ?: null,
                'content_html' => HtmlSanitizer::clean((string) ($body['content_html'] ?? '')),
                'content_html_es' => HtmlSanitizer::clean((string) ($body['content_html_es'] ?? '')),
                'content_blocks' => '[]',
                'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE),
                // Siempre borrador: publicar lo decide una persona en el CMS.
                'published' => 0,
                'featured' => 0,
            ]);

            McpAuth::log('post.create', ['slug' => $slug, 'id' => $id]);

            Middleware::success(['post' => [
                'id' => (int) $id,
                'slug' => $slug,
                'title' => $title,
                'published' => false,
                'note' => 'Creado como borrador. Para publicarlo: update_post published:true.',
            ]]);
            break;
        }

        default:
            Middleware::error('unknown_action', 400, ['action' => $action]);
    }
}
catch (Throwable $e) {
    McpAuth::log('error', ['action' => $action, 'message' => $e->getMessage()]);
    Middleware::error('server_error', 500);
}
