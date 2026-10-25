<?php
/**
 * Galería y portada de un proyecto, para el conector de Claude.
 *
 * Los archivos se suben con un enlace de mcp-upload.php; aquí se acomodan:
 *
 *   GET  ?action=media.list        (read)  portada y galería en orden
 *   POST ?action=media.reorder     (write) nuevo orden, con TODOS los ids
 *   POST ?action=media.set_cover   (write) una imagen de la galería como portada
 *   POST ?action=media.remove      (write) saca un archivo de la galería
 *
 * mcp-write.php no borra nada, y esto casi tampoco: quitar un archivo de la
 * galería lo mueve a uploads/_trash/ en vez de borrarlo, y si además es la
 * portada se queda donde está. Subir algo equivocado tiene que poder
 * arreglarse desde Claude sin entrar al CMS, pero un error no debe perder el
 * archivo original.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';
require_once __DIR__ . '/upload-lib.php';

Middleware::cors();
Middleware::json();

$action = (string) ($_GET['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body = $isPost ? Middleware::getJsonBody() : $_GET;

function mediaProject(array $args): array
{
    $id = (int) ($args['id'] ?? 0);
    $slug = trim((string) ($args['slug'] ?? ''));
    $p = $id > 0
        ? Database::fetchOne('SELECT * FROM projects WHERE id = ?', [$id])
        : ($slug !== '' ? Database::fetchOne('SELECT * FROM projects WHERE slug = ?', [$slug]) : null);
    if (!$p)
        Middleware::error('not_found', 404);
    return $p;
}

function mediaFiles(int $projectId): array
{
    return Database::fetchAll(
        'SELECT id, file_path, file_type, display_order FROM project_files WHERE project_id = ? ORDER BY display_order, id',
        [$projectId]
    );
}

function mediaState(array $p): array
{
    $base = McpOAuth::publicUrl();
    $cover = (string) ($p['cover_image'] ?? '');
    $files = mediaFiles((int) $p['id']);
    return [
        'project' => [
            'id' => (int) $p['id'],
            'slug' => $p['slug'],
            'title' => $p['title'],
            'visible' => (bool) $p['is_active'],
            'url' => $base . '/work/' . $p['slug'],
        ],
        'cover' => $cover !== '' ? ['path' => $cover, 'url' => str_starts_with($cover, 'http') ? $cover : $base . '/' . ltrim($cover, '/')] : null,
        'media' => array_map(fn($f, $i) => [
            'id' => (int) $f['id'],
            'position' => $i + 1,
            'type' => $f['file_type'],
            'path' => $f['file_path'],
            'url' => $base . '/' . ltrim((string) $f['file_path'], '/'),
            'is_cover' => $f['file_path'] === $cover,
        ], $files, array_keys($files)),
        'count' => count($files),
    ];
}

function mediaFile(array $p, $mediaId): array
{
    $f = Database::fetchOne('SELECT * FROM project_files WHERE id = ? AND project_id = ?', [(int) $mediaId, (int) $p['id']]);
    if (!$f)
        Middleware::error('media_not_in_project', 404);
    return $f;
}

switch ($action) {
    case 'media.list': {
        McpAuth::require('read');
        Middleware::success(mediaState(mediaProject($body)));
        break;
    }

    case 'media.reorder': {
        if (!$isPost)
            Middleware::error('method_not_allowed', 405);
        McpAuth::require('write');
        $p = mediaProject($body);
        $order = array_map('intval', (array) ($body['order'] ?? []));
        $current = array_map(fn($f) => (int) $f['id'], mediaFiles((int) $p['id']));
        $sorted = $order;
        sort($sorted);
        $expected = $current;
        sort($expected);
        // Con todos los ids y sin repetir: un orden a medias dejaría
        // posiciones duplicadas y la galería saldría en un orden al azar.
        if ($sorted !== $expected)
            Middleware::error('order_mismatch', 400, ['expected_ids' => $current]);

        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            foreach ($order as $i => $fid) {
                Database::update('project_files', ['display_order' => $i + 1], 'id = ? AND project_id = ?', [$fid, (int) $p['id']]);
            }
            $pdo->commit();
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            Middleware::error('reorder_failed', 500);
        }
        McpAuth::log('media.reorder', ['slug' => $p['slug'], 'orden' => $order]);
        Middleware::success(mediaState(mediaProject(['id' => $p['id']])));
        break;
    }

    case 'media.set_cover': {
        if (!$isPost)
            Middleware::error('method_not_allowed', 405);
        McpAuth::require('write');
        $p = mediaProject($body);
        $f = mediaFile($p, $body['media_id'] ?? 0);
        if ($f['file_type'] !== 'image')
            Middleware::error('not_image', 400);
        // La portada anterior no se borra: puede seguir en la galería, y si
        // no, igual sirve para volver atrás.
        Database::update('projects', ['cover_image' => $f['file_path']], 'id = ?', [(int) $p['id']]);
        McpAuth::log('media.set_cover', ['slug' => $p['slug'], 'antes' => $p['cover_image'], 'ahora' => $f['file_path']]);
        Middleware::success(mediaState(mediaProject(['id' => $p['id']])));
        break;
    }

    case 'media.remove': {
        if (!$isPost)
            Middleware::error('method_not_allowed', 405);
        McpAuth::require('write');
        $p = mediaProject($body);
        $f = mediaFile($p, $body['media_id'] ?? 0);
        Database::delete('project_files', 'id = ?', [(int) $f['id']]);

        $moved = null;
        $path = ltrim((string) $f['file_path'], '/');
        if (!uploadIsReferenced($path)) {
            $abs = __DIR__ . '/../' . $path;
            if (is_file($abs)) {
                $trashDir = __DIR__ . '/../uploads/_trash/' . (int) $p['id'];
                if (!is_dir($trashDir))
                    @mkdir($trashDir, 0755, true);
                // uploads/.htaccess apaga mod_rewrite, así que el bloqueo va
                // aquí dentro y no en el .htaccess de la raíz.
                $guard = dirname($trashDir) . '/.htaccess';
                if (!is_file($guard))
                    @file_put_contents($guard, "Require all denied\n");
                $dest = $trashDir . '/' . date('Ymd-His') . '_' . basename($abs);
                if (@rename($abs, $dest)) {
                    $moved = publicRelativePath($dest);
                    $thumb = dirname($abs) . '/thumbs/' . pathinfo($abs, PATHINFO_FILENAME) . '.webp';
                    if (is_file($thumb))
                        @unlink($thumb);
                }
            }
        }
        McpAuth::log('media.remove', ['slug' => $p['slug'], 'archivo' => $path, 'papelera' => $moved]);
        Middleware::success(mediaState(mediaProject(['id' => $p['id']])) + ['removed' => [
            'id' => (int) $f['id'],
            'path' => $path,
            'kept_because_cover' => $moved === null && $path === ($p['cover_image'] ?? ''),
            'trash' => $moved,
        ]]);
        break;
    }

    default:
        Middleware::error('unknown_action', 400);
}
