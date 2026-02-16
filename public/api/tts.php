<?php
/**
 * TTS Proxy — Fetches audio from Google Translate TTS and returns it
 * 
 * This endpoint acts as a server-side proxy to bypass CORS restrictions.
 * The browser can't directly access translate.google.com, but our PHP
 * server can fetch the MP3 audio and serve it to the client.
 *
 * Usage: GET /api/tts.php?text=Hola+mundo&lang=es
 * Returns: audio/mpeg stream
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/middleware.php';

// CORS
Middleware::cors();

// Only GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

// Rate limit: 60 requests per minute per IP (generous for TTS chunking)
if (!Middleware::rateLimit('tts', 60, 60)) {
    http_response_code(429);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'rate_limited']);
    exit;
}

// Get parameters
$text = trim($_GET['text'] ?? '');
$lang = trim($_GET['lang'] ?? 'en');

// Validate text
if ($text === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'missing_text']);
    exit;
}

// Cap text length (Google TTS has ~200 char limit)
if (mb_strlen($text) > 200) {
    $text = mb_substr($text, 0, 200);
}

// Sanitize language code
$allowedLangs = ['es', 'en', 'es-MX', 'es-419', 'en-US', 'en-GB', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh'];
// Map regional codes to base codes for Google
$langMap = [
    'es-MX' => 'es',
    'es-419' => 'es',
    'en-US' => 'en',
    'en-GB' => 'en',
];
$safeLang = $langMap[$lang] ?? $lang;
if (!in_array($safeLang, $allowedLangs, true)) {
    $safeLang = 'en';
}

// Build Google Translate TTS URL
$googleUrl = 'https://translate.google.com/translate_tts?'
    . http_build_query([
    'ie' => 'UTF-8',
    'tl' => $safeLang,
    'client' => 'tw-ob',
    'q' => $text,
]);

// Fetch audio from Google
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 10,
        'header' => implode("\r\n", [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer: https://translate.google.com/',
            'Accept: audio/mpeg, audio/*, */*',
        ]),
        'ignore_errors' => true,
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
    ],
]);

$audio = @file_get_contents($googleUrl, false, $context);

if ($audio === false || strlen($audio) < 100) {
    // Google TTS failed — try fallback with different client parameter
    $fallbackUrl = 'https://translate.google.com/translate_tts?'
        . http_build_query([
        'ie' => 'UTF-8',
        'tl' => $safeLang,
        'client' => 'gtx',
        'q' => $text,
    ]);

    $audio = @file_get_contents($fallbackUrl, false, $context);
}

if ($audio === false || strlen($audio) < 100) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'tts_fetch_failed']);
    exit;
}

// Return audio with correct headers
header('Content-Type: audio/mpeg');
header('Content-Length: ' . strlen($audio));
header('Cache-Control: public, max-age=86400'); // Cache for 24h
header('X-TTS-Lang: ' . $safeLang);
echo $audio;
