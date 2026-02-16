<?php
/**
 * Translation API proxy
 *
 * POST /api/translate.php
 * Body: { "texts": { "title": "...", "subtitle": "...", ... }, "from": "en", "to": "es" }
 * Response: { "ok": true, "translations": { "title": "...", "subtitle": "...", ... } }
 *
 * Uses Google Translate (free endpoint) with MyMemory fallback.
 * Auth required — admin only.
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Middleware::error('method_not_allowed', 405);
}

Middleware::requireAuth();

if (!Middleware::rateLimit('translate', 30, 60)) {
    Middleware::error('rate_limit', 429);
}

$data = Middleware::getJsonBody();
$texts = $data['texts'] ?? [];
$from = $data['from'] ?? 'en';
$to = $data['to'] ?? 'es';

if (empty($texts) || !is_array($texts)) {
    Middleware::error('texts_required', 400);
}

// ─── Translation functions ───

function translateGoogle(string $text, string $from, string $to): ?string
{
    if (trim($text) === '')
        return '';

    $url = 'https://translate.googleapis.com/translate_a/single?'
        . http_build_query([
        'client' => 'gtx',
        'sl' => $from,
        'tl' => $to,
        'dt' => 't',
        'q' => $text,
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => 'User-Agent: Mozilla/5.0',
        ],
    ]);

    $response = @file_get_contents($url, false, $ctx);
    if ($response === false)
        return null;

    $json = json_decode($response, true);
    if (!is_array($json) || !isset($json[0]))
        return null;

    // Reassemble translated segments
    $result = '';
    foreach ($json[0] as $segment) {
        if (is_array($segment) && isset($segment[0])) {
            $result .= $segment[0];
        }
    }

    return $result ?: null;
}

function translateMyMemory(string $text, string $from, string $to): ?string
{
    if (trim($text) === '')
        return '';

    $url = 'https://api.mymemory.translated.net/get?'
        . http_build_query([
        'q' => $text,
        'langpair' => "{$from}|{$to}",
    ]);

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
        ],
    ]);

    $response = @file_get_contents($url, false, $ctx);
    if ($response === false)
        return null;

    $json = json_decode($response, true);
    if (!is_array($json))
        return null;

    return $json['responseData']['translatedText'] ?? null;
}

function translateText(string $text, string $from, string $to): string
{
    if (trim($text) === '')
        return '';

    // Try Google first, fallback to MyMemory
    $result = translateGoogle($text, $from, $to);
    if ($result !== null)
        return $result;

    $result = translateMyMemory($text, $from, $to);
    if ($result !== null)
        return $result;

    return $text; // Return original if all fail
}

function translateHtml(string $html, string $from, string $to): string
{
    if (trim($html) === '')
        return '';

    // For HTML content, we translate in chunks to preserve structure.
    // Split HTML into tag and text segments
    $parts = preg_split('/(<[^>]+>)/', $html, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);

    $textBuffer = '';
    $segments = [];

    // Group consecutive text nodes to translate together
    foreach ($parts as $part) {
        if (preg_match('/^<[^>]+>$/', $part)) {
            // It's a tag
            if ($textBuffer !== '') {
                $segments[] = ['type' => 'text', 'content' => $textBuffer];
                $textBuffer = '';
            }
            $segments[] = ['type' => 'tag', 'content' => $part];
        }
        else {
            $textBuffer .= $part;
        }
    }
    if ($textBuffer !== '') {
        $segments[] = ['type' => 'text', 'content' => $textBuffer];
    }

    // Translate text segments
    $result = '';
    foreach ($segments as $seg) {
        if ($seg['type'] === 'tag') {
            $result .= $seg['content'];
        }
        else {
            $text = $seg['content'];
            if (trim($text) === '' || trim($text) === '&nbsp;') {
                $result .= $text;
            }
            else {
                $result .= translateText($text, $from, $to);
            }
        }
    }

    return $result;
}

// ─── Process each field ───

$translations = [];

foreach ($texts as $key => $value) {
    if (!is_string($value) || trim($value) === '') {
        $translations[$key] = '';
        continue;
    }

    // Detect if the value contains HTML tags
    $isHtml = $key === 'content_html' || preg_match('/<[a-z][^>]*>/i', $value);

    if ($isHtml) {
        $translations[$key] = translateHtml($value, $from, $to);
    }
    else {
        $translations[$key] = translateText($value, $from, $to);
    }
}

Middleware::success(['translations' => $translations]);
