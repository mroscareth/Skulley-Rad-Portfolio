<?php
/**
 * Upload y gestión de archivos
 * 
 * Endpoints:
 *   POST   /upload.php              - Subir archivo (requiere project_id)
 *   DELETE /upload.php?id=X         - Eliminar archivo por ID
 *   PUT    /upload.php?reorder=1    - Reordenar archivos de un proyecto
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/upload-lib.php';

Middleware::cors();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        handleUpload();
        break;
    case 'DELETE':
        Middleware::json();
        handleDelete();
        break;
    case 'PUT':
        Middleware::json();
        if (isset($_GET['action']) && $_GET['action'] === 'reorder') {
            handleReorder();
        }
        else {
            handleReorder(); // Por defecto también reorder
        }
        break;
    default:
        Middleware::json();
        Middleware::error('method_not_allowed', 405);
}

/**
 * POST - Subir archivo
 *
 * La validación, la optimización y el registro viven en upload-lib.php, que
 * comparte con los enlaces de subida del conector de Claude (mcp-upload.php).
 */
function handleUpload(): void
{
    Middleware::json();
    Middleware::requireAuth();

    // Rate limiting: máximo 20 uploads por minuto
    if (!Middleware::rateLimit('upload', 20, 60)) {
        Middleware::error('rate_limit', 429);
    }

    $file = $_FILES['file'] ?? ['error' => UPLOAD_ERR_NO_FILE];
    $context = $_POST['context'] ?? 'project';

    try {
        // Tienda (banners, productos) y Memorias: imagen suelta, sin proyecto.
        $loose = ['shop-banner' => 'shop/banners', 'shop-product' => 'shop/products', 'blog' => 'blog'];
        if (isset($loose[$context])) {
            $r = storeLooseImage($file, $loose[$context]);
            $response = [
                'message' => 'uploaded',
                'file' => ['path' => $r['path'], 'file_path' => $r['path'], 'file_type' => 'image'],
            ];
            if ($r['stats']) {
                $response['optimization'] = optimizationSummary($r['stats'], $context === 'blog');
            }
            Middleware::success($response);
            return;
        }

        $projectId = (int) ($_POST['project_id'] ?? 0);
        if ($projectId <= 0) {
            Middleware::error('project_id_required', 400);
        }
        $isCover = ($_POST['is_cover'] ?? '') === '1';
        $r = storeProjectUpload($file, $projectId, $isCover);
    }
    catch (UploadError $e) {
        Middleware::error($e->errorCode, $e->status, $e->detail);
        return;
    }

    if ($isCover) {
        $response = ['message' => 'cover_uploaded', 'path' => $r['path']];
    }
    else {
        $response = [
            'message' => 'uploaded',
            'file' => [
                'id' => $r['id'],
                'path' => $r['path'],
                'file_path' => $r['path'],
                'file_type' => $r['type'],
                'type' => $r['type'],
                'display_order' => $r['display_order'],
            ],
        ];
    }
    if ($r['stats']) {
        $response['optimization'] = optimizationSummary($r['stats']);
    }
    Middleware::success($response);
}

/**
 * DELETE - Eliminar archivo
 */
function handleDelete(): void
{
    Middleware::requireAuth();

    $fileId = $_GET['id'] ?? null;
    if (!$fileId) {
        Middleware::error('id_required', 400);
    }

    // Buscar archivo
    $file = Database::fetchOne(
        'SELECT pf.*, p.slug as project_slug 
         FROM project_files pf 
         JOIN projects p ON pf.project_id = p.id 
         WHERE pf.id = ?',
    [(int)$fileId]
    );

    if (!$file) {
        Middleware::error('not_found', 404);
    }

    // Primero la fila y luego el archivo, y solo si nada más lo usa: una foto
    // de la galería puede ser también la portada del proyecto.
    Database::delete('project_files', 'id = ?', [(int)$fileId]);
    discardIfUnused($file['file_path']);

    Middleware::success(['message' => 'deleted']);
}

/**
 * PUT - Reordenar archivos
 * Acepta dos formatos:
 *   - { project_id, order: [id1, id2, ...] } - array de IDs en orden
 *   - { orders: [{ id, display_order }, ...] } - array de objetos con orden específico
 */
function handleReorder(): void
{
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();

    // Formato nuevo: orders con objetos { id, display_order }
    if (isset($data['orders']) && is_array($data['orders'])) {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();

        try {
            foreach ($data['orders'] as $item) {
                if (isset($item['id']) && isset($item['display_order'])) {
                    Database::update(
                        'project_files',
                    ['display_order' => (int)$item['display_order']],
                        'id = ?',
                    [(int)$item['id']]
                    );
                }
            }
            $pdo->commit();
        }
        catch (Exception $e) {
            $pdo->rollBack();
            Middleware::error('reorder_failed', 500);
        }

        Middleware::success(['message' => 'reordered']);
        return;
    }

    // Formato antiguo: project_id y order como array de IDs
    $projectId = $data['project_id'] ?? null;
    $order = $data['order'] ?? [];

    if (!$projectId || !is_array($order)) {
        Middleware::error('invalid_data', 400);
    }

    $pdo = Database::getInstance();
    $pdo->beginTransaction();

    try {
        foreach ($order as $index => $fileId) {
            Database::update(
                'project_files',
            ['display_order' => $index + 1],
                'id = ? AND project_id = ?',
            [(int)$fileId, (int)$projectId]
            );
        }
        $pdo->commit();
    }
    catch (Exception $e) {
        $pdo->rollBack();
        Middleware::error('reorder_failed', 500);
    }

    Middleware::success(['message' => 'reordered']);
}
