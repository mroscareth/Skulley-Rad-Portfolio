<?php
/**
 * CRUD de Proyectos
 * 
 * Endpoints:
 *   GET    /projects.php           - Listar proyectos (público si ?active=1)
 *   GET    /projects.php?id=X      - Obtener proyecto específico
 *   POST   /projects.php           - Crear proyecto (auth requerido)
 *   PUT    /projects.php?id=X      - Actualizar proyecto (auth requerido)
 *   DELETE /projects.php?id=X      - Eliminar proyecto (auth requerido)
 *   PUT    /projects.php?reorder=1 - Reordenar proyectos (auth requerido)
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet();
        break;
    case 'POST':
        handlePost();
        break;
    case 'PUT':
        handlePut();
        break;
    case 'DELETE':
        handleDelete();
        break;
    default:
        Middleware::error('method_not_allowed', 405);
}

/**
 * GET - Listar proyectos o obtener uno específico
 */
function handleGet(): void {
    $id = $_GET['id'] ?? null;
    $activeOnly = isset($_GET['active']) && $_GET['active'] === '1';

    if ($id) {
        // Obtener proyecto específico
        $project = Database::fetchOne(
            'SELECT * FROM projects WHERE id = ?',
            [(int) $id]
        );

        if (!$project) {
            Middleware::error('not_found', 404);
        }

        // Obtener archivos del proyecto
        $files = Database::fetchAll(
            'SELECT * FROM project_files WHERE project_id = ? ORDER BY display_order ASC',
            [(int) $id]
        );

        // Normalizar archivos para el frontend (agregar 'path' como alias de 'file_path')
        $project['files'] = array_map(function($f) {
            return [
                'id' => (int) $f['id'],
                'project_id' => (int) $f['project_id'],
                'path' => $f['file_path'], // Alias para compatibilidad
                'file_path' => $f['file_path'],
                'file_type' => $f['file_type'],
                'display_order' => (int) $f['display_order'],
                'created_at' => $f['created_at'],
            ];
        }, $files);
        Middleware::success(['project' => formatProject($project)]);
    }

    // Listar todos los proyectos
    $sql = 'SELECT * FROM projects';
    $params = [];

    if ($activeOnly) {
        $sql .= ' WHERE is_active = 1';
    }

    $sql .= ' ORDER BY display_order ASC, created_at DESC';

    $projects = Database::fetchAll($sql, $params);

    // Formatear para el frontend
    $formatted = array_map('formatProject', $projects);

    Middleware::success(['projects' => $formatted]);
}

/**
 * POST - Crear nuevo proyecto
 */
function handlePost(): void {
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();

    // Validaciones
    $title = trim($data['title'] ?? '');
    if (!$title) {
        Middleware::error('title_required', 400);
    }

    $slug = $data['slug'] ?? '';
    if (!$slug) {
        $slug = Middleware::slugify($title);
    } else {
        $slug = Middleware::slugify($slug);
    }

    // Verificar slug único
    $existing = Database::fetchOne('SELECT id FROM projects WHERE slug = ?', [$slug]);
    if ($existing) {
        // Agregar timestamp para hacerlo único
        $slug .= '-' . time();
    }

    $projectType = ($data['project_type'] ?? 'gallery') === 'link' ? 'link' : 'gallery';
    
    // Obtener el mayor display_order y sumar 1
    $maxOrder = Database::fetchOne('SELECT MAX(display_order) as max_order FROM projects');
    $displayOrder = ($maxOrder['max_order'] ?? 0) + 1;

    $projectId = Database::insert('projects', [
        'slug' => $slug,
        'title' => $title,
        'description_en' => $data['description_en'] ?? '',
        'description_es' => $data['description_es'] ?? '',
        'project_type' => $projectType,
        'external_url' => $data['external_url'] ?? null,
        'cover_image' => $data['cover_image'] ?? null,
        'display_order' => $displayOrder,
        'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : true,
    ]);

    $project = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [$projectId]);

    Middleware::success(['project' => formatProject($project), 'message' => 'created']);
}

/**
 * PUT - Actualizar proyecto o reordenar
 */
function handlePut(): void {
    Middleware::requireAuth();

    // Reordenar múltiples proyectos
    if (isset($_GET['reorder']) || isset($_GET['action']) && $_GET['action'] === 'reorder') {
        handleReorder();
        return;
    }

    $id = $_GET['id'] ?? null;
    if (!$id) {
        Middleware::error('id_required', 400);
    }

    $existing = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $id]);
    if (!$existing) {
        Middleware::error('not_found', 404);
    }

    $data = Middleware::getJsonBody();
    $updateData = [];

    // Solo actualizar campos proporcionados
    if (isset($data['title'])) {
        $title = trim($data['title']);
        if (!$title) {
            Middleware::error('title_required', 400);
        }
        $updateData['title'] = $title;
    }

    if (isset($data['slug'])) {
        $slug = Middleware::slugify($data['slug']);
        // Verificar que no exista otro proyecto con el mismo slug
        $duplicate = Database::fetchOne(
            'SELECT id FROM projects WHERE slug = ? AND id != ?',
            [$slug, (int) $id]
        );
        if ($duplicate) {
            Middleware::error('slug_taken', 400);
        }
        $updateData['slug'] = $slug;
    }

    if (isset($data['description_en'])) {
        $updateData['description_en'] = $data['description_en'];
    }

    if (isset($data['description_es'])) {
        $updateData['description_es'] = $data['description_es'];
    }

    if (isset($data['project_type'])) {
        $updateData['project_type'] = $data['project_type'] === 'link' ? 'link' : 'gallery';
    }

    if (array_key_exists('external_url', $data)) {
        $updateData['external_url'] = $data['external_url'] ?: null;
    }

    if (array_key_exists('cover_image', $data)) {
        $updateData['cover_image'] = $data['cover_image'] ?: null;
    }

    if (isset($data['display_order'])) {
        $updateData['display_order'] = (int) $data['display_order'];
    }

    if (isset($data['is_active'])) {
        $updateData['is_active'] = (bool) $data['is_active'];
    }

    if (empty($updateData)) {
        Middleware::error('no_data', 400);
    }

    Database::update('projects', $updateData, 'id = ?', [(int) $id]);

    $project = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $id]);
    
    // Obtener archivos
    $files = Database::fetchAll(
        'SELECT * FROM project_files WHERE project_id = ? ORDER BY display_order ASC',
        [(int) $id]
    );
    $project['files'] = $files;

    Middleware::success(['project' => formatProject($project), 'message' => 'updated']);
}

/**
 * Reordenar proyectos
 * Acepta dos formatos:
 *   - { order: [id1, id2, ...] } - array de IDs en orden
 *   - { orders: [{ id, display_order }, ...] } - array de objetos con orden específico
 */
function handleReorder(): void {
    $data = Middleware::getJsonBody();
    
    // Formato nuevo: orders con objetos { id, display_order }
    if (isset($data['orders']) && is_array($data['orders'])) {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();

        try {
            foreach ($data['orders'] as $item) {
                if (isset($item['id']) && isset($item['display_order'])) {
                    Database::update(
                        'projects',
                        ['display_order' => (int) $item['display_order']],
                        'id = ?',
                        [(int) $item['id']]
                    );
                }
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            Middleware::error('reorder_failed', 500);
        }

        Middleware::success(['message' => 'reordered']);
        return;
    }

    // Formato antiguo: order como array de IDs
    $order = $data['order'] ?? [];

    if (!is_array($order) || empty($order)) {
        Middleware::error('order_required', 400);
    }

    $pdo = Database::getInstance();
    $pdo->beginTransaction();

    try {
        foreach ($order as $index => $projectId) {
            Database::update(
                'projects',
                ['display_order' => $index + 1],
                'id = ?',
                [(int) $projectId]
            );
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        Middleware::error('reorder_failed', 500);
    }

    Middleware::success(['message' => 'reordered']);
}

/**
 * DELETE - Eliminar proyecto
 */
function handleDelete(): void {
    Middleware::requireAuth();

    $id = $_GET['id'] ?? null;
    if (!$id) {
        Middleware::error('id_required', 400);
    }

    $existing = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $id]);
    if (!$existing) {
        Middleware::error('not_found', 404);
    }

    // Eliminar archivos físicos del proyecto
    $config = Middleware::getConfig();
    $uploadDir = $config['UPLOAD_DIR'] ?? __DIR__ . '/../uploads/projects';
    $projectDir = $uploadDir . '/' . $existing['slug'];

    if (is_dir($projectDir)) {
        deleteDirectory($projectDir);
    }

    // Eliminar de la base de datos (cascade elimina project_files)
    Database::delete('projects', 'id = ?', [(int) $id]);

    Middleware::success(['message' => 'deleted']);
}

/**
 * Formatear proyecto para el frontend
 */
function formatProject(array $project): array {
    $config = Middleware::getConfig();
    $baseUrl = $config['SITE_URL'] ?? '';

    return [
        'id' => (int) $project['id'],
        'slug' => $project['slug'],
        'title' => $project['title'],
        'description_en' => $project['description_en'] ?? '',
        'description_es' => $project['description_es'] ?? '',
        'project_type' => $project['project_type'],
        'external_url' => $project['external_url'],
        'cover_image' => $project['cover_image'],
        'display_order' => (int) $project['display_order'],
        'is_active' => (bool) $project['is_active'],
        'files' => $project['files'] ?? [],
        'created_at' => $project['created_at'],
        'updated_at' => $project['updated_at'],
    ];
}

/**
 * Eliminar directorio recursivamente
 */
function deleteDirectory(string $dir): bool {
    if (!is_dir($dir)) {
        return false;
    }

    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }

    return rmdir($dir);
}
