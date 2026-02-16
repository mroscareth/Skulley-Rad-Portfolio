<?php
/**
 * Music Tracks API
 * 
 * Manages songs/manifest.json and mp3 file uploads/deletions.
 * 
 * Endpoints:
 *   GET    /music.php               - List all tracks (public)
 *   POST   /music.php               - Add a new track (auth required, multipart)
 *   PUT    /music.php                - Update track metadata or reorder (auth required)
 *   DELETE /music.php?index=X        - Delete a track (auth required)
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

$method = $_SERVER['REQUEST_METHOD'];

// Path to manifest
define('MANIFEST_PATH', realpath(__DIR__ . '/../songs') . DIRECTORY_SEPARATOR . 'manifest.json');
define('SONGS_DIR', realpath(__DIR__ . '/../songs') . DIRECTORY_SEPARATOR);

/**
 * Read the manifest file
 */
function readManifest(): array
{
    if (!file_exists(MANIFEST_PATH))
        return [];
    $json = file_get_contents(MANIFEST_PATH);
    $data = json_decode($json ?: '[]', true);
    return is_array($data) ? $data : [];
}

/**
 * Write the manifest file (with pretty print for readability)
 */
function writeManifest(array $tracks): void
{
    file_put_contents(
        MANIFEST_PATH,
        json_encode($tracks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n",
        LOCK_EX
    );
}

/**
 * Allowed vinyl colors (must match VINYL_COLORS in MusicPlayer.jsx)
 */
function allowedColors(): array
{
    return ['red', 'black', 'yellow', 'blue', 'purple', 'teal', 'green', 'orange', 'pink'];
}

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
 * GET — Return all tracks
 */
function handleGet(): void
{
    $tracks = readManifest();
    echo json_encode($tracks);
    exit;
}

/**
 * POST — Upload a new track (multipart form data)
 * 
 * Fields: title, artist (optional), vinylColor (optional)
 * File: audio (mp3 file)
 */
function handlePost(): void
{
    Middleware::requireAuth();

    // Check for uploaded file
    if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
        Middleware::error('No audio file uploaded or upload error');
    }

    $file = $_FILES['audio'];
    $title = trim($_POST['title'] ?? '');
    $artist = trim($_POST['artist'] ?? '');
    $vinylColor = trim($_POST['vinylColor'] ?? 'red');

    if (!$title) {
        Middleware::error('Title is required');
    }

    // Validate vinyl color (preset name or #hex)
    if (!in_array($vinylColor, allowedColors(), true) && !preg_match('/^#[0-9a-fA-F]{6}$/', $vinylColor)) {
        $vinylColor = 'red';
    }

    // Validate file type
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['mp3', 'ogg', 'wav', 'flac'], true)) {
        Middleware::error('Invalid audio format. Allowed: mp3, ogg, wav, flac');
    }

    // Generate safe filename
    $safeName = preg_replace('/[^a-zA-Z0-9\-_ ()]/', '', $title);
    $safeName = trim($safeName) ?: 'track';
    $destName = $safeName . '.' . $ext;
    $destPath = SONGS_DIR . $destName;

    // Avoid overwriting
    $counter = 1;
    while (file_exists($destPath)) {
        $destName = $safeName . ' (' . $counter . ').' . $ext;
        $destPath = SONGS_DIR . $destName;
        $counter++;
    }

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        Middleware::error('Failed to save audio file');
    }

    // Add to manifest
    $tracks = readManifest();
    $newTrack = [
        'title' => $title,
        'artist' => $artist,
        'src' => 'songs/' . $destName,
        'vinylColor' => $vinylColor,
    ];
    $tracks[] = $newTrack;
    writeManifest($tracks);

    Middleware::success(['track' => $newTrack, 'index' => count($tracks) - 1]);
}

/**
 * PUT — Update track metadata or reorder
 * 
 * Body JSON:
 *   { "index": 0, "title": "...", "artist": "...", "vinylColor": "blue" }
 *   or
 *   { "reorder": [2, 0, 1, 3, ...] }  — array of old indices in new order
 *   or
 *   { "firstTrack": 3 }  — move index 3 to position 0
 */
function handlePut(): void
{
    Middleware::requireAuth();
    $data = Middleware::getJsonBody();
    $tracks = readManifest();

    // Reorder
    if (isset($data['reorder']) && is_array($data['reorder'])) {
        $order = $data['reorder'];
        $reordered = [];
        foreach ($order as $idx) {
            if (isset($tracks[(int)$idx])) {
                $reordered[] = $tracks[(int)$idx];
            }
        }
        // Keep any tracks not in the order list at the end
        if (count($reordered) === count($tracks)) {
            writeManifest($reordered);
            Middleware::success(['tracks' => $reordered]);
        }
        else {
            Middleware::error('Invalid reorder indices');
        }
    }

    // Set first track
    if (isset($data['firstTrack'])) {
        $idx = (int)$data['firstTrack'];
        if ($idx >= 0 && $idx < count($tracks)) {
            $first = $tracks[$idx];
            array_splice($tracks, $idx, 1);
            array_unshift($tracks, $first);
            writeManifest($tracks);
            Middleware::success(['tracks' => $tracks]);
        }
        else {
            Middleware::error('Invalid track index');
        }
    }

    // Update single track metadata
    if (isset($data['index'])) {
        $idx = (int)$data['index'];
        if ($idx < 0 || $idx >= count($tracks)) {
            Middleware::error('Invalid track index');
        }

        if (isset($data['title'])) {
            $tracks[$idx]['title'] = trim($data['title']);
        }
        if (isset($data['artist'])) {
            $tracks[$idx]['artist'] = trim($data['artist']);
        }
        if (isset($data['vinylColor'])) {
            $color = trim($data['vinylColor']);
            if (in_array($color, allowedColors(), true) || preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
                $tracks[$idx]['vinylColor'] = $color;
            }
        }

        writeManifest($tracks);
        Middleware::success(['track' => $tracks[$idx]]);
    }

    Middleware::error('No valid action specified');
}

/**
 * DELETE — Remove a track by index
 */
function handleDelete(): void
{
    Middleware::requireAuth();

    $idx = isset($_GET['index']) ? (int)$_GET['index'] : -1;
    $tracks = readManifest();

    if ($idx < 0 || $idx >= count($tracks)) {
        Middleware::error('Invalid track index');
    }

    $track = $tracks[$idx];

    // Delete the audio file
    $filePath = realpath(__DIR__ . '/../' . ($track['src'] ?? ''));
    if ($filePath && file_exists($filePath) && strpos($filePath, SONGS_DIR) === 0) {
        @unlink($filePath);
    }

    // Remove from manifest
    array_splice($tracks, $idx, 1);
    writeManifest($tracks);

    Middleware::success(['deleted' => $track]);
}
