<?php
/**
 * Shop config — banners (hero slideshow) + featured product override.
 *
 * Endpoints:
 *   GET  /shop-config.php  - Fetch banners array + featured_product_id (public)
 *   PUT  /shop-config.php  - Update banners array and/or featured_product_id (auth)
 *
 * Payload PUT acepta cualquiera de los dos (o ambos):
 *   { banners: [{ id?, image_en, image_es, code, date, accent, alt_en, alt_es, link_url }, ...] }
 *   { featured_product_id: "gid://shopify/Product/..."|null }
 *
 * El frontend usa el array devuelto como fuente de verdad para el hero;
 * featured_product_id sobrescribe la lógica de tag "featured" de Shopify.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

/**
 * Modo de slideshow:
 *
 *   auto   — rota solo (default, comportamiento histórico)
 *   manual — no rota, pero deja flechas y dots para pasar a mano
 *   off    — una sola imagen fija, sin controles
 *   hidden — el módulo NO se renderiza. Solo aplica al banner del hero: una
 *            card de producto sin imagen no tiene sentido, así que ahí se
 *            comporta como `off`.
 *
 * `manual` existe porque el ruido de una galería es el AUTOPLAY, no la
 * galería: varias cards rotando cada quien por su cuenta compiten con las
 * piezas. Pasar de imagen a voluntad no molesta a nadie.
 *
 * OJO: va ACÁ ARRIBA y no junto a sus funciones. Las funciones se hoistean,
 * un `const` de archivo NO — se define cuando la ejecución pasa por su línea,
 * y el switch de abajo corre antes.
 */
const SLIDESHOW_MODES = ['auto', 'manual', 'off', 'hidden'];

ensureTables();

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

function ensureTables(): void {
    $pdo = Database::getInstance();

    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_en VARCHAR(512) NOT NULL DEFAULT '',
        image_es VARCHAR(512) NOT NULL DEFAULT '',
        code VARCHAR(120) NOT NULL DEFAULT '',
        date_label VARCHAR(60) NOT NULL DEFAULT '',
        accent VARCHAR(24) NOT NULL DEFAULT '#e600ff',
        alt_en VARCHAR(255) NOT NULL DEFAULT '',
        alt_es VARCHAR(255) NOT NULL DEFAULT '',
        link_url VARCHAR(512) NOT NULL DEFAULT '',
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        setting_value TEXT
    )");
}

function handleGet(): void {
    $banners = Database::fetchAll(
        'SELECT * FROM shop_banners ORDER BY display_order ASC, id ASC'
    );

    $formatted = array_map(function ($b) {
        return [
            'id' => (int) $b['id'],
            'image_en' => $b['image_en'] ?: '',
            'image_es' => $b['image_es'] ?: '',
            'code' => $b['code'] ?: '',
            'date' => $b['date_label'] ?: '',
            'accent' => $b['accent'] ?: '#e600ff',
            'alt_en' => $b['alt_en'] ?: '',
            'alt_es' => $b['alt_es'] ?: '',
            'link_url' => $b['link_url'] ?: '',
            'display_order' => (int) $b['display_order'],
        ];
    }, $banners);

    $featuredRow = Database::fetchOne(
        'SELECT setting_value FROM shop_settings WHERE setting_key = ?',
        ['featured_product_id']
    );
    $featuredId = $featuredRow['setting_value'] ?? null;
    if ($featuredId === '') $featuredId = null;

    Middleware::success([
        'banners' => $formatted,
        'featured_product_id' => $featuredId,
        'slideshow' => [
            'hero' => readSlideshowMode('hero_slideshow'),
            'card' => readSlideshowMode('card_slideshow'),
        ],
    ]);
}

function readSlideshowMode(string $key): string {
    $row = Database::fetchOne(
        'SELECT setting_value FROM shop_settings WHERE setting_key = ?',
        [$key]
    );
    $value = $row['setting_value'] ?? '';
    return in_array($value, SLIDESHOW_MODES, true) ? $value : 'auto';
}

function writeSetting(string $key, string $value): void {
    $existing = Database::fetchOne(
        'SELECT setting_value FROM shop_settings WHERE setting_key = ?',
        [$key]
    );
    if ($existing) {
        Database::update('shop_settings', ['setting_value' => $value], 'setting_key = ?', [$key]);
    } else {
        Database::insert('shop_settings', ['setting_key' => $key, 'setting_value' => $value]);
    }
}

function handlePut(): void {
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();

    $updated = false;

    if (array_key_exists('featured_product_id', $data)) {
        $value = $data['featured_product_id'];
        if ($value === null || $value === '') {
            Database::delete('shop_settings', 'setting_key = ?', ['featured_product_id']);
        } else {
            $value = (string) $value;
            $existing = Database::fetchOne(
                'SELECT setting_value FROM shop_settings WHERE setting_key = ?',
                ['featured_product_id']
            );
            if ($existing) {
                Database::update(
                    'shop_settings',
                    ['setting_value' => $value],
                    'setting_key = ?',
                    ['featured_product_id']
                );
            } else {
                Database::insert('shop_settings', [
                    'setting_key' => 'featured_product_id',
                    'setting_value' => $value,
                ]);
            }
        }
        $updated = true;
    }

    // Modos de slideshow. Un valor fuera del enum se ignora en silencio en vez
    // de guardarse: el GET ya cae a 'auto' ante cualquier basura, así que
    // aceptar el escrito solo serviría para dejar filas muertas en la tabla.
    foreach (['hero' => 'hero_slideshow', 'card' => 'card_slideshow'] as $field => $key) {
        if (!array_key_exists($field . '_slideshow', $data)) continue;
        $mode = (string) $data[$field . '_slideshow'];
        if (!in_array($mode, SLIDESHOW_MODES, true)) continue;
        writeSetting($key, $mode);
        $updated = true;
    }

    if (isset($data['banners']) && is_array($data['banners'])) {
        // Replace-all strategy: wipe + insert. Los banners no tienen relaciones
        // (images viven en disco, los IDs son solo identidad de fila).
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            Database::delete('shop_banners', '1=1', []);
            $order = 0;
            foreach ($data['banners'] as $b) {
                if (!is_array($b)) continue;
                Database::insert('shop_banners', [
                    'image_en' => (string) ($b['image_en'] ?? ''),
                    'image_es' => (string) ($b['image_es'] ?? ''),
                    'code' => substr((string) ($b['code'] ?? ''), 0, 120),
                    'date_label' => substr((string) ($b['date'] ?? ''), 0, 60),
                    'accent' => substr((string) ($b['accent'] ?? '#e600ff'), 0, 24),
                    'alt_en' => substr((string) ($b['alt_en'] ?? ''), 0, 255),
                    'alt_es' => substr((string) ($b['alt_es'] ?? ''), 0, 255),
                    'link_url' => substr((string) ($b['link_url'] ?? ''), 0, 512),
                    'display_order' => $order++,
                ]);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            Middleware::error('banners_save_failed', 500, ['message' => $e->getMessage()]);
        }
        $updated = true;
    }

    if (!$updated) {
        Middleware::error('nothing_to_update', 400);
    }

    handleGet();
}
