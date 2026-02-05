<?php
/**
 * CRUD de contenido About
 * 
 * Endpoints:
 *   GET  /about.php       - Obtener todo el contenido About (público)
 *   PUT  /about.php       - Actualizar contenido About (auth requerido)
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
    case 'PUT':
        handlePut();
        break;
    default:
        Middleware::error('method_not_allowed', 405);
}

/**
 * GET - Obtener contenido About
 */
function handleGet(): void {
    $lang = $_GET['lang'] ?? null;

    if ($lang) {
        // Obtener solo un idioma
        $content = Database::fetchAll(
            'SELECT paragraph_key, content FROM about_content WHERE lang = ? ORDER BY paragraph_key ASC',
            [$lang]
        );

        $formatted = [];
        foreach ($content as $row) {
            $formatted[$row['paragraph_key']] = $row['content'];
        }

        Middleware::success(['about' => $formatted, 'lang' => $lang]);
        return;
    }

    // Obtener ambos idiomas
    $allContent = Database::fetchAll(
        'SELECT lang, paragraph_key, content FROM about_content ORDER BY lang, paragraph_key ASC'
    );

    $formatted = ['en' => [], 'es' => []];
    foreach ($allContent as $row) {
        $formatted[$row['lang']][$row['paragraph_key']] = $row['content'];
    }

    Middleware::success(['about' => $formatted]);
}

/**
 * PUT - Actualizar contenido About
 */
function handlePut(): void {
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();

    // Espera formato: { "en": { "p1": "...", "p2": "..." }, "es": { "p1": "...", "p2": "..." } }
    // O formato simple: { "lang": "en", "content": { "p1": "...", "p2": "..." } }

    if (isset($data['lang']) && isset($data['content'])) {
        // Formato simple - un solo idioma
        $lang = $data['lang'];
        if (!in_array($lang, ['en', 'es'], true)) {
            Middleware::error('invalid_lang', 400);
        }

        updateLanguageContent($lang, $data['content']);
    } elseif (isset($data['en']) || isset($data['es'])) {
        // Formato completo - ambos idiomas
        if (isset($data['en'])) {
            updateLanguageContent('en', $data['en']);
        }
        if (isset($data['es'])) {
            updateLanguageContent('es', $data['es']);
        }
    } else {
        Middleware::error('invalid_format', 400);
    }

    // Devolver contenido actualizado
    $allContent = Database::fetchAll(
        'SELECT lang, paragraph_key, content FROM about_content ORDER BY lang, paragraph_key ASC'
    );

    $formatted = ['en' => [], 'es' => []];
    foreach ($allContent as $row) {
        $formatted[$row['lang']][$row['paragraph_key']] = $row['content'];
    }

    Middleware::success(['about' => $formatted, 'message' => 'updated']);
}

/**
 * Actualizar contenido de un idioma
 * 
 * Borra todos los párrafos existentes y los reemplaza con los nuevos
 * para evitar párrafos huérfanos
 */
function updateLanguageContent(string $lang, array $content): void {
    $pdo = Database::getInstance();

    // Primero eliminar todos los párrafos existentes de este idioma
    Database::delete('about_content', 'lang = ?', [$lang]);

    // Insertar los nuevos párrafos
    foreach ($content as $key => $value) {
        // Validar key (solo permitir p1-p99)
        if (!preg_match('/^p[1-9][0-9]?$/', $key)) {
            continue;
        }

        // Sanitizar contenido
        $value = trim((string) $value);

        if ($value === '') {
            continue; // Saltar párrafos vacíos
        }

        // Insertar nuevo párrafo
        Database::insert('about_content', [
            'lang' => $lang,
            'paragraph_key' => $key,
            'content' => $value,
        ]);
    }
}
