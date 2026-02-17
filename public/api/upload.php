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
 */
function handleUpload(): void
{
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
    $context = $_POST['context'] ?? 'project';
    $projectId = $_POST['project_id'] ?? null;

    // Blog context: skip project validation, store in uploads/blog/
    if ($context === 'blog') {
        $config2 = Middleware::getConfig();
        $mimeType = mime_content_type($file['tmp_name']) ?: $file['type'];
        $allowedImages = $config2['ALLOWED_IMAGE_TYPES'] ?? [];
        $isImage = in_array($mimeType, $allowedImages, true);

        if (!$isImage) {
            Middleware::error('invalid_file_type', 400, ['mime' => $mimeType]);
        }

        $maxSize = $config2['MAX_IMAGE_SIZE'] ?? 10 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            Middleware::error('file_too_large', 400, ['max_size' => $maxSize, 'file_size' => $file['size']]);
        }
        // Blog uploads always go to /uploads/blog/ (not UPLOAD_DIR which may be /uploads/projects/)
        $baseUploadsDir = __DIR__ . '/../uploads';
        $blogDir = $baseUploadsDir . '/blog';
        if (!is_dir($blogDir)) {
            mkdir($blogDir, 0755, true);
        }

        $extension = getExtensionFromMime($mimeType);
        $filename = time() . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
        $targetPath = $blogDir . '/' . $filename;
        $relativePath = 'uploads/blog/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            Middleware::error('move_failed', 500);
        }

        $optimizationStats = null;
        if (function_exists('imagecreatefromstring')) {
            $optimizationStats = optimizeImage($targetPath, $mimeType);

            // Update path if image was converted to WebP
            if ($optimizationStats && !empty($optimizationStats['new_path'])) {
                $publicDir = realpath(__DIR__ . '/..');
                $relativePath = str_replace(
                    [$publicDir . '\\', $publicDir . '/'],
                    '',
                    $optimizationStats['new_path']
                );
            }
        }

        $response = [
            'message' => 'uploaded',
            'file' => [
                'path' => $relativePath,
                'file_path' => $relativePath,
                'file_type' => 'image',
            ],
        ];

        if ($optimizationStats) {
            $response['optimization'] = [
                'original_size' => $optimizationStats['original_size'],
                'optimized_size' => $optimizationStats['optimized_size'],
                'reduction_percent' => $optimizationStats['reduction_percent'],
                'original_dimensions' => $optimizationStats['original_dimensions'],
                'new_dimensions' => $optimizationStats['new_dimensions'],
                'format' => $optimizationStats['format'],
                'converted_to_webp' => $optimizationStats['converted_to_webp'],
                'thumbnail' => $optimizationStats['thumbnail'],
            ];
        }

        Middleware::success($response);
        return;
    }

    if (!$projectId) {
        Middleware::error('project_id_required', 400);
    }

    // Verificar que el proyecto existe
    $project = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [(int)$projectId]);
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

    // Create project directory using project ID for better organization
    $uploadDir = $config['UPLOAD_DIR'] ?? __DIR__ . '/../uploads';
    $projectDir = $uploadDir . '/' . $projectId;

    if (!is_dir($projectDir)) {
        if (!mkdir($projectDir, 0755, true)) {
            Middleware::error('mkdir_failed', 500);
        }
    }

    // Generate unique filename
    $extension = getExtensionFromMime($mimeType);
    $isCover = isset($_POST['is_cover']) && $_POST['is_cover'] === '1';

    if ($isCover) {
        $filename = 'cover.' . $extension;
    }
    else {
        // Get next display order number
        $maxOrder = Database::fetchOne(
            'SELECT MAX(display_order) as max_order FROM project_files WHERE project_id = ?',
        [(int)$projectId]
        );
        $nextOrder = ($maxOrder['max_order'] ?? 0) + 1;
        $filename = $nextOrder . '_' . time() . '.' . $extension;
    }

    $targetPath = $projectDir . '/' . $filename;
    $relativePath = 'uploads/' . $projectId . '/' . $filename;

    // Mover archivo
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        Middleware::error('move_failed', 500);
    }

    // Optimize all images (including covers)
    $optimizationStats = null;
    if ($isImage && function_exists('imagecreatefromstring')) {
        $optimizationStats = optimizeImage($targetPath, $mimeType);

        // Update paths if image was converted to WebP
        if ($optimizationStats && !empty($optimizationStats['new_path'])) {
            $publicDir = realpath(__DIR__ . '/..');
            $relativePath = str_replace(
                [$publicDir . '\\', $publicDir . '/'],
                '',
                $optimizationStats['new_path']
            );
        }
    }

    // Si es cover, actualizar el proyecto
    if ($isCover) {
        Database::update('projects', ['cover_image' => $relativePath], 'id = ?', [(int)$projectId]);

        $response = [
            'message' => 'cover_uploaded',
            'path' => $relativePath,
        ];

        if ($optimizationStats) {
            $response['optimization'] = [
                'original_size' => $optimizationStats['original_size'],
                'optimized_size' => $optimizationStats['optimized_size'],
                'reduction_percent' => $optimizationStats['reduction_percent'],
                'original_dimensions' => $optimizationStats['original_dimensions'],
                'new_dimensions' => $optimizationStats['new_dimensions'],
                'format' => $optimizationStats['format'],
                'converted_to_webp' => $optimizationStats['converted_to_webp'],
                'thumbnail' => $optimizationStats['thumbnail'],
            ];
        }

        Middleware::success($response);
        return;
    }

    // Guardar en project_files
    $fileId = Database::insert('project_files', [
        'project_id' => (int)$projectId,
        'file_path' => $relativePath,
        'file_type' => $isImage ? 'image' : 'video',
        'display_order' => $nextOrder ?? 1,
    ]);

    $response = [
        'message' => 'uploaded',
        'file' => [
            'id' => $fileId,
            'path' => $relativePath,
            'file_path' => $relativePath,
            'file_type' => $isImage ? 'image' : 'video',
            'type' => $isImage ? 'image' : 'video',
            'display_order' => $nextOrder ?? 1,
        ],
    ];

    if ($optimizationStats) {
        $response['optimization'] = [
            'original_size' => $optimizationStats['original_size'],
            'optimized_size' => $optimizationStats['optimized_size'],
            'reduction_percent' => $optimizationStats['reduction_percent'],
            'original_dimensions' => $optimizationStats['original_dimensions'],
            'new_dimensions' => $optimizationStats['new_dimensions'],
            'format' => $optimizationStats['format'],
            'converted_to_webp' => $optimizationStats['converted_to_webp'],
            'thumbnail' => $optimizationStats['thumbnail'],
        ];
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

    // Eliminar archivo físico
    $config = Middleware::getConfig();
    $fullPath = __DIR__ . '/../' . $file['file_path'];

    if (is_file($fullPath)) {
        unlink($fullPath);
    }

    // Eliminar de la base de datos
    Database::delete('project_files', 'id = ?', [(int)$fileId]);

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

/**
 * Obtener extensión desde MIME type
 */
function getExtensionFromMime(string $mime): string
{
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
 * Load a GD image resource from a file based on its MIME type
 */
function loadImageFromFile(string $path, string $mimeType): \GdImage|false
{
    switch ($mimeType) {
        case 'image/jpeg':
            return imagecreatefromjpeg($path);
        case 'image/png':
            return imagecreatefrompng($path);
        case 'image/webp':
            return imagecreatefromwebp($path);
        case 'image/gif':
            return imagecreatefromgif($path);
        default:
            return false;
    }
}

/**
 * Save a GD image resource to a file in WebP format (or original format as fallback)
 */
function saveImageToFile(\GdImage $img, string $path, string $mimeType, int $quality = 82): bool
{
    // Try saving as WebP first (best compression)
    $webpPath = preg_replace('/\.(jpe?g|png|gif)$/i', '.webp', $path);

    if ($webpPath !== $path && function_exists('imagewebp')) {
        // Ensure full color for WebP conversion
        imagepalettetotruecolor($img);
        imagealphablending($img, true);
        imagesavealpha($img, true);

        if (imagewebp($img, $webpPath, $quality)) {
            // Remove the original file if WebP was saved successfully
            if (file_exists($path) && $path !== $webpPath) {
                @unlink($path);
            }
            return true;
        }
    }

    // Fallback: save in original format
    switch ($mimeType) {
        case 'image/jpeg':
            return imagejpeg($img, $path, $quality);
        case 'image/png':
            return imagepng($img, $path, 8);
        case 'image/webp':
            return imagewebp($img, $path, $quality);
        case 'image/gif':
            return imagegif($img, $path);
        default:
            return false;
    }
}

/**
 * Resize a GD image resource to fit within max dimensions, preserving aspect ratio.
 * Returns a new GD resource or null if no resize was needed.
 */
function resizeImage(\GdImage $src, int $origWidth, int $origHeight, int $maxDimension): ?\GdImage
{
    if ($origWidth <= $maxDimension && $origHeight <= $maxDimension) {
        return null; // No resize needed
    }

    $ratio = $origWidth / $origHeight;
    if ($origWidth > $origHeight) {
        $newWidth = $maxDimension;
        $newHeight = (int)($maxDimension / $ratio);
    } else {
        $newHeight = $maxDimension;
        $newWidth = (int)($maxDimension * $ratio);
    }

    $dst = imagecreatetruecolor($newWidth, $newHeight);
    // Preserve transparency
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefill($dst, 0, 0, $transparent);

    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
    return $dst;
}

/**
 * Generate a thumbnail for an image file.
 * Returns the relative path to the thumbnail, or null on failure.
 */
function generateThumbnail(string $originalPath, string $mimeType, int $thumbSize = 400): ?string
{
    try {
        $info = getimagesize($originalPath);
        if (!$info) return null;

        [$origWidth, $origHeight] = $info;

        // Don't generate thumb if original is already small
        if ($origWidth <= $thumbSize && $origHeight <= $thumbSize) {
            return null;
        }

        $src = loadImageFromFile($originalPath, $mimeType);
        if (!$src) return null;

        $ratio = $origWidth / $origHeight;
        if ($origWidth > $origHeight) {
            $tw = $thumbSize;
            $th = (int)($thumbSize / $ratio);
        } else {
            $th = $thumbSize;
            $tw = (int)($thumbSize * $ratio);
        }

        $thumb = imagecreatetruecolor($tw, $th);
        imagealphablending($thumb, false);
        imagesavealpha($thumb, true);
        $transparent = imagecolorallocatealpha($thumb, 0, 0, 0, 127);
        imagefill($thumb, 0, 0, $transparent);
        imagecopyresampled($thumb, $src, 0, 0, 0, 0, $tw, $th, $origWidth, $origHeight);

        // Determine thumbnail path — always save as WebP
        $dir = dirname($originalPath);
        $thumbDir = $dir . '/thumbs';
        if (!is_dir($thumbDir)) {
            mkdir($thumbDir, 0755, true);
        }

        $basename = pathinfo($originalPath, PATHINFO_FILENAME);
        $thumbPath = $thumbDir . '/' . $basename . '.webp';

        imagepalettetotruecolor($thumb);
        imagealphablending($thumb, true);
        imagesavealpha($thumb, true);
        imagewebp($thumb, $thumbPath, 75);

        imagedestroy($src);
        imagedestroy($thumb);

        return $thumbPath;
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Full image optimization pipeline:
 *  1. Record original file size
 *  2. Resize if exceeds max dimension
 *  3. Convert to WebP (except GIF which stays as-is for animation)
 *  4. Generate thumbnail
 *  5. Return optimization stats
 *
 * Returns an associative array with optimization results, or null on error.
 */
function optimizeImage(string $path, string $mimeType): ?array
{
    $maxDimension = 2400;
    $quality = 82;

    try {
        $originalSize = filesize($path);
        $info = getimagesize($path);
        if (!$info) return null;

        [$origWidth, $origHeight] = $info;

        // Skip GIF optimization (may be animated)
        if ($mimeType === 'image/gif') {
            return [
                'original_size' => $originalSize,
                'optimized_size' => $originalSize,
                'reduction_percent' => 0,
                'original_dimensions' => "{$origWidth}x{$origHeight}",
                'new_dimensions' => "{$origWidth}x{$origHeight}",
                'format' => 'gif',
                'thumbnail' => null,
                'converted_to_webp' => false,
            ];
        }

        $src = loadImageFromFile($path, $mimeType);
        if (!$src) return null;

        // Strip EXIF by re-encoding: the GD library discards EXIF data automatically
        // when we load and re-save the image. This already happens by loading with GD.

        // Resize if necessary
        $resized = resizeImage($src, $origWidth, $origHeight, $maxDimension);
        $finalImage = $resized ?? $src;
        $finalWidth = $resized ? imagesx($finalImage) : $origWidth;
        $finalHeight = $resized ? imagesy($finalImage) : $origHeight;

        // Save optimized image (converts to WebP when possible)
        $wasWebpAlready = ($mimeType === 'image/webp');
        saveImageToFile($finalImage, $path, $mimeType, $quality);

        // Determine the actual output path (may have .webp extension now)
        $webpPath = preg_replace('/\.(jpe?g|png)$/i', '.webp', $path);
        $actualPath = file_exists($webpPath) ? $webpPath : $path;
        $convertedToWebp = ($actualPath !== $path);

        // Clean up GD resources
        if ($resized) {
            imagedestroy($resized);
        }
        imagedestroy($src);

        $optimizedSize = filesize($actualPath);

        // Generate thumbnail
        $thumbAbsolutePath = generateThumbnail($actualPath, 'image/webp');
        $thumbRelative = null;
        if ($thumbAbsolutePath) {
            // Convert absolute thumb path to a relative path from public/
            $publicDir = realpath(__DIR__ . '/..');
            $thumbRelative = str_replace(
                [$publicDir . '\\', $publicDir . '/'],
                '',
                $thumbAbsolutePath
            );
        }

        $reduction = $originalSize > 0
            ? round((1 - $optimizedSize / $originalSize) * 100, 1)
            : 0;

        return [
            'original_size' => $originalSize,
            'optimized_size' => $optimizedSize,
            'reduction_percent' => max(0, $reduction),
            'original_dimensions' => "{$origWidth}x{$origHeight}",
            'new_dimensions' => "{$finalWidth}x{$finalHeight}",
            'format' => $convertedToWebp ? 'webp' : pathinfo($path, PATHINFO_EXTENSION),
            'thumbnail' => $thumbRelative,
            'converted_to_webp' => $convertedToWebp || $wasWebpAlready,
            'new_path' => $actualPath,
        ];
    } catch (Exception $e) {
        return null;
    }
}
