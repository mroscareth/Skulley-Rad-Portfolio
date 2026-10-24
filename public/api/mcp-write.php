<?php
/**
 * Escrituras del MCP — FASE 2.
 *
 * Archivo aparte de mcp.php a propósito: las lecturas se pueden revisar sin
 * leer esto, y todo lo que puede CAMBIAR el sitio cabe en una sola pantalla.
 *
 * Qué NO se puede hacer desde aquí, y por qué:
 *
 *   - Borrar nada. Un agente no necesita borrar para ayudar a escribir, y un
 *     borrado por error no tiene deshacer.
 *   - Cambiar un slug. Las URLs /work/{slug} y /blog/{slug} están indexadas;
 *     renombrarlas las tira del índice. Eso se decide en el CMS, a mano.
 *   - Publicar o despublicar. Publicar es una decisión del autor, no una
 *     edición. post.create siempre deja el post en borrador.
 *   - Tocar productos, pedidos, usuarios o precios. Ahí hay dinero.
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
                'note' => 'Creado como borrador. Publicar se hace desde el CMS.',
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
