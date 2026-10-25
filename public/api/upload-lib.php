<?php
/**
 * Guardar archivos subidos: validar, mover, optimizar y registrar.
 *
 * Lo usan dos puertas: upload.php (el CMS, con sesión) y mcp-upload.php (los
 * enlaces de subida que pide Claude por el conector). Las dos pasan por aquí
 * para que una foto subida desde Claude quede igual que una subida en el CMS:
 * mismos tipos y tamaños permitidos, mismo WebP de 2400 px, misma miniatura,
 * misma fila en la base.
 *
 * Los errores salen como UploadError con un código corto (invalid_file_type,
 * file_too_large…); cada puerta decide cómo contestarlo.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';

final class UploadError extends RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $status = 400, public readonly array $detail = [])
    {
        parent::__construct($errorCode);
    }
}

/**
 * Ruta pública relativa ("uploads/20/foto.webp") de un archivo dentro de
 * public/. UPLOAD_DIR es api/../uploads, y sin resolver el ".." las rutas
 * quedaban guardadas como "api/../uploads/…": el navegador las resolvía, pero
 * así salían en el sitemap, en og:image y en lo que lee Claude.
 */
function publicRelativePath(string $absolute): string
{
    $public = str_replace('\\', '/', (string) realpath(__DIR__ . '/..'));
    $real = realpath($absolute);
    $path = str_replace('\\', '/', $real !== false ? $real : $absolute);
    if ($public !== '' && str_starts_with($path, $public . '/')) {
        return substr($path, strlen($public) + 1);
    }
    return ltrim(preg_replace('~^.*?/(uploads/)~', '$1', $path) ?? $path, '/');
}

/** El MIME real del archivo (no el que dice el navegador). */
function detectUploadMime(string $tmpPath, string $claimed = ''): string
{
    return (string) (mime_content_type($tmpPath) ?: $claimed);
}

/** Valida tipo y tamaño. Devuelve 'image' o 'video'. */
function checkUpload(array $file, bool $allowVideo): string
{
    if (!isset($file['tmp_name']) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UploadError('upload_error_' . (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE));
    }
    $config = Middleware::getConfig();
    $mime = detectUploadMime($file['tmp_name'], (string) ($file['type'] ?? ''));
    $isImage = in_array($mime, $config['ALLOWED_IMAGE_TYPES'] ?? [], true);
    $isVideo = $allowVideo && in_array($mime, $config['ALLOWED_VIDEO_TYPES'] ?? [], true);
    if (!$isImage && !$isVideo) {
        throw new UploadError('invalid_file_type', 400, ['mime' => $mime]);
    }
    $max = $isImage ? ($config['MAX_IMAGE_SIZE'] ?? 10 * 1024 * 1024) : ($config['MAX_VIDEO_SIZE'] ?? 50 * 1024 * 1024);
    if ((int) $file['size'] > $max) {
        throw new UploadError('file_too_large', 400, ['max_size' => $max, 'file_size' => (int) $file['size']]);
    }
    return $isImage ? 'image' : 'video';
}

/** Mueve el archivo recibido y lo optimiza si es imagen. */
function placeUpload(array $file, string $dir, string $filename, bool $isImage): array
{
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        throw new UploadError('mkdir_failed', 500);
    }
    $target = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        throw new UploadError('move_failed', 500);
    }
    $stats = null;
    if ($isImage && function_exists('imagecreatefromstring')) {
        $stats = optimizeImage($target, detectUploadMime($target, (string) ($file['type'] ?? '')));
        if ($stats && !empty($stats['new_path'])) {
            $target = $stats['new_path'];
        }
    }
    return ['path' => publicRelativePath($target), 'stats' => $stats];
}

/** Los números de la optimización, como los devuelve upload.php desde siempre. */
function optimizationSummary(?array $stats, bool $full = true): ?array
{
    if (!$stats) {
        return null;
    }
    $keys = $full
        ? ['original_size', 'optimized_size', 'reduction_percent', 'original_dimensions', 'new_dimensions', 'format', 'converted_to_webp', 'thumbnail']
        : ['original_size', 'optimized_size', 'reduction_percent', 'format', 'converted_to_webp'];
    return array_intersect_key($stats, array_flip($keys));
}

/**
 * Imagen o video para la galería de un proyecto, o su portada.
 *
 * La portada anterior se borra del disco solo si nadie más la usa: se puede
 * elegir una foto de la galería como portada, y borrarla dejaba esa foto rota
 * en la galería.
 */
function storeProjectUpload(array $file, int $projectId, bool $isCover): array
{
    $project = Database::fetchOne('SELECT * FROM projects WHERE id = ?', [$projectId]);
    if (!$project) {
        throw new UploadError('project_not_found', 404);
    }
    $type = checkUpload($file, !$isCover);
    $config = Middleware::getConfig();
    $dir = ($config['UPLOAD_DIR'] ?? __DIR__ . '/../uploads') . '/' . $projectId;
    $mime = detectUploadMime($file['tmp_name'], (string) ($file['type'] ?? ''));
    $ext = getExtensionFromMime($mime);

    if ($isCover) {
        // Nombre único por subida: con un nombre fijo la URL nunca cambia y el
        // navegador seguía mostrando la portada vieja de su caché.
        $placed = placeUpload($file, $dir, 'cover_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext, true);
        $old = (string) ($project['cover_image'] ?? '');
        Database::update('projects', ['cover_image' => $placed['path']], 'id = ?', [$projectId]);
        if ($old !== '' && !str_starts_with($old, 'http') && $old !== $placed['path']) {
            discardIfUnused($old);
        }
        return ['kind' => 'cover', 'path' => $placed['path'], 'type' => 'image', 'stats' => $placed['stats']];
    }

    $max = Database::fetchOne('SELECT MAX(display_order) AS m FROM project_files WHERE project_id = ?', [$projectId]);
    $order = (int) ($max['m'] ?? 0) + 1;
    $placed = placeUpload($file, $dir, $order . '_' . time() . '_' . bin2hex(random_bytes(2)) . '.' . $ext, $type === 'image');
    $id = Database::insert('project_files', [
        'project_id' => $projectId,
        'file_path' => $placed['path'],
        'file_type' => $type,
        'display_order' => $order,
    ]);
    return ['kind' => 'gallery', 'id' => $id, 'path' => $placed['path'], 'type' => $type, 'display_order' => $order, 'stats' => $placed['stats']];
}

/** Imagen suelta para la tienda (productos, banners) o para Memorias. */
function storeLooseImage(array $file, string $subdir): array
{
    checkUpload($file, false);
    $mime = detectUploadMime($file['tmp_name'], (string) ($file['type'] ?? ''));
    $dir = __DIR__ . '/../uploads/' . $subdir;
    $placed = placeUpload($file, $dir, time() . '_' . bin2hex(random_bytes(4)) . '.' . getExtensionFromMime($mime), true);
    return ['path' => $placed['path'], 'type' => 'image', 'stats' => $placed['stats']];
}

/** ¿Alguna galería, portada o producto sigue usando esta ruta? */
function uploadIsReferenced(string $path): bool
{
    $path = ltrim($path, '/');
    if (Database::fetchOne('SELECT id FROM project_files WHERE file_path = ? LIMIT 1', [$path])) return true;
    if (Database::fetchOne('SELECT id FROM projects WHERE cover_image = ? LIMIT 1', [$path])) return true;
    if (Database::fetchOne('SELECT id FROM blog_posts WHERE cover_image = ? LIMIT 1', [$path])) return true;
    return false;
}

/** Borra un archivo subido (y su miniatura) si ya nada lo usa. */
function discardIfUnused(string $path): void
{
    if (uploadIsReferenced($path)) {
        return;
    }
    $abs = __DIR__ . '/../' . ltrim($path, '/');
    if (!is_file($abs)) {
        return;
    }
    @unlink($abs);
    $thumb = dirname($abs) . '/thumbs/' . pathinfo($abs, PATHINFO_FILENAME) . '.webp';
    if (is_file($thumb)) {
        @unlink($thumb);
    }
}

/**
 * Quita el "api/../" de las rutas que ya estaban guardadas así (ver
 * publicRelativePath). Idempotente; lo corre mcp-upload.php una sola vez,
 * al crear su tabla.
 */
function healUploadPaths(): void
{
    try {
        Database::query("UPDATE project_files SET file_path = SUBSTRING(file_path, 8) WHERE file_path LIKE 'api/../%'");
        Database::query("UPDATE projects SET cover_image = SUBSTRING(cover_image, 8) WHERE cover_image LIKE 'api/../%'");
        Database::query("UPDATE blog_posts SET cover_image = SUBSTRING(cover_image, 8) WHERE cover_image LIKE 'api/../%'");
    }
    catch (Throwable $e) {
        // Una tabla que no existe en esta instalación no detiene nada.
    }
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

        // imagedestroy() no hace nada desde PHP 8.0 y PHP 8.5 lo depreca:
        // soltar la referencia es lo que libera el GdImage.
        unset($src, $thumb);

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
        unset($resized, $src);

        $optimizedSize = filesize($actualPath);

        // Generate thumbnail
        $thumbAbsolutePath = generateThumbnail($actualPath, 'image/webp');
        $thumbRelative = null;
        if ($thumbAbsolutePath) {
            $thumbRelative = publicRelativePath($thumbAbsolutePath);
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
