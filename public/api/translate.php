<?php
/**
 * Traducción automática usando MyMemory API (gratuita)
 * 
 * POST /translate.php
 * Body: { "text": "Hello world", "from": "en", "to": "es" }
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Middleware::error('method_not_allowed', 405);
}

// Requiere autenticación
Middleware::requireAuth();

// Rate limiting: máximo 10 traducciones por minuto
if (!Middleware::rateLimit('translate', 10, 60)) {
    Middleware::error('rate_limit', 429);
}

$data = Middleware::getJsonBody();

$text = trim($data['text'] ?? '');
$from = $data['from'] ?? 'en';
$to = $data['to'] ?? 'es';

if (!$text) {
    Middleware::error('text_required', 400);
}

// Limitar longitud (MyMemory tiene límite de ~500 palabras por request)
if (strlen($text) > 5000) {
    Middleware::error('text_too_long', 400, ['max_length' => 5000]);
}

// Validar idiomas
$validLangs = ['en', 'es', 'fr', 'de', 'it', 'pt'];
if (!in_array($from, $validLangs) || !in_array($to, $validLangs)) {
    Middleware::error('invalid_language', 400);
}

// Traducir cada párrafo por separado para mejor calidad
$paragraphs = preg_split('/\n\s*\n/', $text);
$translatedParagraphs = [];

foreach ($paragraphs as $paragraph) {
    $paragraph = trim($paragraph);
    if (!$paragraph) continue;

    $translated = translateText($paragraph, $from, $to);
    if ($translated === null) {
        // Si falla una traducción, usar el original
        $translatedParagraphs[] = $paragraph;
    } else {
        $translatedParagraphs[] = $translated;
    }
}

$result = implode("\n\n", $translatedParagraphs);

Middleware::success([
    'translated' => $result,
    'from' => $from,
    'to' => $to,
]);

/**
 * Traducir texto usando MyMemory API
 */
function translateText(string $text, string $from, string $to): ?string {
    $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
        'q' => $text,
        'langpair' => "{$from}|{$to}",
        'de' => 'oscarmdesign@gmail.com', // Email para mayor cuota gratuita
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => "User-Agent: MROSCAR-CMS/1.0\r\n",
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if (!$response) {
        return null;
    }

    $data = json_decode($response, true);
    
    if (!$data || !isset($data['responseData']['translatedText'])) {
        return null;
    }

    // Verificar que la traducción fue exitosa
    $status = $data['responseStatus'] ?? 0;
    if ($status !== 200) {
        return null;
    }

    $translated = $data['responseData']['translatedText'];
    
    // MyMemory a veces devuelve el texto en mayúsculas si no encuentra traducción
    if (strtoupper($text) === $translated) {
        return null;
    }

    return $translated;
}
