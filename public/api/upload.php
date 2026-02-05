<?php
/**
 * Upload y gestión de archivos
 * 
 * Endpoints:
 *   POST   /upload.php              - Subir archivo (requiere project_id)
 *   DELETE /upload.php?id=X         - Eliminar archivo por ID
 *   PUT    /upload.php?reorder=1    - Reordenar archivos de un proyecto
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

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
        } else {
            handleReorder(); // Por defecto también reorder
        }
        break;
    default:
        Middleware::json();
        Middleware::error('method_not_allowed', 405);
}

/**
 * POST - Subir archivo
 */
function handleUpload(): void {
    Middleware::json();
    Middleware::requireAuth();

    // Rate limiting: máximo 20 uploads por minuto
    if (!Middleware::rateLimit('upload', 20, 60)) {
        Middleware::error('rate_limit', 429);
    }

    $config = Middleware::getConfig();

    // Verificar que hay archivo
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $errorCode = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
        Middleware::error('upload_error_' . $errorCode, 400);
    }

    $file = $_FILES['file'];
    $projectId = $_POST['project_id'] ?? null;

    if (!$projectId) {
        Middleware::error('project_id_required', 400);
    }

    // Verificar que el proyecto existe
    $project = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int) $projectId]);
    if (!$project) {
        Middleware::error('project_not_found', 404);
    }

    // Validar tipo de archivo
    $mimeType = mime_content_type($file['tmp_name']) ?: $file['type'];
    $allowedImages = $config['ALLOWED_IMAGE_TYPES'] ?? [];
    $allowedVideos = $config['ALLOWED_VIDEO_TYPES'] ?? [];

    $isImage = in_array($mimeType, $allowedImages, true);
    $isVideo = in_array($mimeType, $allowedVideos, true);

    if (!$isImage && !$isVideo) {
        Middleware::error('invalid_file_type', 400, ['mime' => $mimeType]);
    }

    // Validar tamaño
    $maxSize = $isImage 
        ? ($config['MAX_IMAGE_SIZE'] ?? 10 * 1024 * 1024)
        : ($config['MAX_VIDEO_SIZE'] ?? 50 * 1024 * 1024);

    if ($file['size'] > $maxSize) {
        Middleware::error('file_too_large', 400, [
            'max_size' => $maxSize,
            'file_size' => $file['size']
        ]);
    }

    // Crear directorio del proyecto si no existe
    $uploadDir = $config['UPLOAD_DIR'] ?? __DIR__ . '/../uploads/projects';
    $projectDir = $uploadDir . '/' . $project['slug'];

    if (!is_dir($projectDir)) {
        if (!mkdir($projectDir, 0755, true)) {
            Middleware::error('mkdir_failed', 500);
        }
    }

    // Generar nombre de archivo único
    $extension = getExtensionFromMime($mimeType);
    $isCover = isset($_POST['is_cover']) && $_POST['is_cover'] === '1';
    
    if ($isCover) {
        $filename = 'cover.' . $extension;
    } else {
        // Obtener siguiente número de orden
        $maxOrder = Database::fetchOne(
            'SELECT MAX(display_order) as max_order FROM project_files WHERE project_id = ?',
            [(int) $projectId]
        );
        $nextOrder = ($maxOrder['max_order'] ?? 0) + 1;
        $filename = $nextOrder . '_' . time() . '.' . $extension;
    }

    $targetPath = $projectDir . '/' . $filename;
    $relativePath = 'uploads/projects/' . $project['slug'] . '/' . $filename;

    // Mover archivo
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        Middleware::error('move_failed', 500);
    }

    // Si es imagen y no es cover, intentar optimizar (opcional)
    if ($isImage && !$isCover && function_exists('imagecreatefromstring')) {
        optimizeImage($targetPath, $mimeType);
    }

    // Si es cover, actualizar el proyecto
    if ($isCover) {
        Database::update('projects', ['cover_image' => $relativePath], 'id = ?', [(int) $projectId]);
        Middleware::success([
            'message' => 'cover_uploaded',
            'path' => $relativePath,
        ]);
        return;
    }

    // Guardar en project_files
    $fileId = Database::insert('project_files', [
        'project_id' => (int) $projectId,
        'file_path' => $relativePath,
        'file_type' => $isImage ? 'image' : 'video',
        'display_order' => $nextOrder ?? 1,
    ]);

    Middleware::success([
        'message' => 'uploaded',
        'file' => [
            'id' => $fileId,
            'path' => $relativePath,
            'type' => $isImage ? 'image' : 'video',
        ],
    ]);
}

/**
 * DELETE - Eliminar archivo
 */
function handleDelete(): void {
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
        [(int) $fileId]
    );

    if (!$file) {
        Middleware::error('not_found', 404);
    }

    // Eliminar archivo físico
    $config = Middleware::getConfig();
    $fullPath = __DIR__ . '/../' . $file['file_path'];

    if (is_file($fullPath)) {
        unlink($fullPath);
    }

    // Eliminar de la base de datos
    Database::delete('project_files', 'id = ?', [(int) $fileId]);

    Middleware::success(['message' => 'deleted']);
}

/**
 * PUT - Reordenar archivos
 * Acepta dos formatos:
 *   - { project_id, order: [id1, id2, ...] } - array de IDs en orden
 *   - { orders: [{ id, display_order }, ...] } - array de objetos con orden específico
 */
function handleReorder(): void {
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
                [(int) $fileId, (int) $projectId]
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
 * Obtener extensión desde MIME type
 */
function getExtensionFromMime(string $mime): string {
    $map = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
    ];

    return $map[$mime] ?? 'bin';
}

/**
 * Optimizar imagen (reducir tamaño si es muy grande)
 */
function optimizeImage(string $path, string $mimeType): void {
    $maxDimension = 2400; // máximo 2400px en cualquier lado
    $quality = 85;

    try {
        list($width, $height) = getimagesize($path);

        // Si es menor que el máximo, no hacer nada
        if ($width <= $maxDimension && $height <= $maxDimension) {
            return;
        }

        // Calcular nuevas dimensiones
        $ratio = $width / $height;
        if ($width > $height) {
            $newWidth = $maxDimension;
            $newHeight = (int) ($maxDimension / $ratio);
        } else {
            $newHeight = $maxDimension;
            $newWidth = (int) ($maxDimension * $ratio);
        }

        // Cargar imagen según tipo
        switch ($mimeType) {
            case 'image/jpeg':
                $src = imagecreatefromjpeg($path);
                break;
            case 'image/png':
                $src = imagecreatefrompng($path);
                break;
            case 'image/webp':
                $src = imagecreatefromwebp($path);
                break;
            case 'image/gif':
                $src = imagecreatefromgif($path);
                break;
            default:
                return;
        }

        if (!$src) return;

        // Crear imagen redimensionada
        $dst = imagecreatetruecolor($newWidth, $newHeight);

        // Preservar transparencia para PNG
        if ($mimeType === 'image/png') {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
        }

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        // Guardar
        switch ($mimeType) {
            case 'image/jpeg':
                imagejpeg($dst, $path, $quality);
                break;
            case 'image/png':
                imagepng($dst, $path, 8);
                break;
            case 'image/webp':
                imagewebp($dst, $path, $quality);
                break;
            case 'image/gif':
                imagegif($dst, $path);
                break;
        }

        imagedestroy($src);
        imagedestroy($dst);
    } catch (Exception $e) {
        // Silenciar errores de optimización
    }
}
