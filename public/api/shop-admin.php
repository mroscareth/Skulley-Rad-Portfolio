<?php
/**
 * CMS de la tienda — catálogo, categorías, zonas de envío y ajustes.
 * Todo requiere sesión de admin.
 *
 *   GET  ?action=products                 Todo el catálogo (incl. borradores) + unidades vendidas
 *   GET  ?action=product&id=X
 *   POST ?action=product_save   {...}     Crea o actualiza (variantes incluidas)
 *   POST ?action=product_delete {id}
 *   GET  ?action=categories
 *   POST ?action=categories_save {categories:[...]}
 *   GET  ?action=zones
 *   POST ?action=zones_save      {zones:[...]}
 *   GET  ?action=settings
 *   POST ?action=settings_save   {...}
 *   POST ?action=upload_digital  (multipart: file)
 *
 * Las imágenes de producto se suben con upload.php (context=shop-product),
 * igual que los banners.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';

// Va arriba del switch: un `const` de archivo se define cuando la ejecución
// pasa por su línea, no se hoistea como las funciones.
const SHOP_DIGITAL_EXTENSIONS = [
    'zip', 'rar', '7z', 'pdf', 'epub', 'txt',
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'tif', 'tiff', 'psd', 'ai', 'eps',
    'stl', 'obj', '3mf', 'glb', 'gltf', 'fbx', 'blend',
    'mp3', 'wav', 'flac', 'aiff', 'mp4', 'mov', 'webm',
    'ttf', 'otf', 'woff', 'woff2',
];

// Países que Checkout no acepta en shipping_address_collection.allowed_countries.
const SHOP_STRIPE_BLOCKED_COUNTRIES = [
    'AS', 'CC', 'CU', 'CX', 'FM', 'HM', 'IR', 'KP', 'MH', 'MP', 'NF', 'PW', 'SD', 'SY', 'UM', 'VI',
];

Middleware::cors();
Middleware::json();
Middleware::noCache();
Middleware::requireAuth();
Shop::ensureSchema();

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ("{$method} {$action}") {
        case 'GET products':
            Middleware::success(['products' => adminProducts()]);
            break;
        case 'GET product':
            $p = adminProducts((int)($_GET['id'] ?? 0));
            if (!$p) Middleware::error('not_found', 404);
            Middleware::success(['product' => $p[0]]);
            break;
        case 'POST product_save':
            handleProductSave();
            break;
        case 'POST product_delete':
            handleProductDelete();
            break;
        case 'GET categories':
            Middleware::success(['categories' => Shop::categories()]);
            break;
        case 'POST categories_save':
            handleCategoriesSave();
            break;
        case 'GET zones':
            Middleware::success(['zones' => Shop::zones(false)]);
            break;
        case 'POST zones_save':
            handleZonesSave();
            break;
        case 'GET settings':
            Middleware::success(['settings' => Shop::settings(), 'stripe' => stripeStatus()]);
            break;
        case 'POST settings_save':
            handleSettingsSave();
            break;
        case 'POST upload_digital':
            handleUploadDigital();
            break;
        default:
            Middleware::error('unknown_action', 400);
    }
} catch (\Throwable $e) {
    error_log("[shop-admin] {$action} failed: " . $e->getMessage());
    $debug = (Middleware::getConfig()['DEBUG'] ?? false) === true;
    Middleware::error('server_error', 500, $debug ? ['detail' => $e->getMessage()] : []);
}

// ═══════════════════════════════════════════════════════════════

function stripeStatus(): array
{
    return [
        'configured' => StripeApi::isConfigured(),
        'test_mode' => StripeApi::isTestMode(),
        'webhook_secret' => StripeApi::hasWebhookSecret(),
        'webhook_url' => Shop::siteUrl('/api/shop-webhook.php'),
    ];
}

/** Catálogo completo con unidades vendidas por variante (pedidos pagados). */
function adminProducts(?int $onlyId = null): array
{
    $products = Shop::products(false, $onlyId);
    if (!$products) return [];
    $paid = "o.status IN ('paid','preparing','shipped','delivered')";
    $sold = [];
    foreach (Database::fetchAll(
        "SELECT oi.variant_id, SUM(oi.qty) AS sold
         FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
         WHERE {$paid} GROUP BY oi.variant_id"
    ) as $r) {
        $sold[(int)$r['variant_id']] = (int)$r['sold'];
    }
    // El total del producto se cuenta por product_id: si una variante se
    // borra, sus ventas siguen sumando al producto.
    $soldByProduct = [];
    foreach (Database::fetchAll(
        "SELECT oi.product_id, SUM(oi.qty) AS sold
         FROM shop_order_items oi JOIN shop_orders o ON o.id = oi.order_id
         WHERE {$paid} GROUP BY oi.product_id"
    ) as $r) {
        $soldByProduct[(int)$r['product_id']] = (int)$r['sold'];
    }
    foreach ($products as &$p) {
        foreach ($p['variants'] as &$v) {
            $v['sold'] = $sold[$v['id']] ?? 0;
        }
        unset($v);
        $p['sold'] = $soldByProduct[$p['id']] ?? 0;
    }
    unset($p);
    return $products;
}

/**
 * Las imágenes se guardan como ruta relativa (uploads/shop/...), igual que los
 * banners: así sobreviven a un cambio de dominio. Una URL externa se respeta.
 */
function normalizeAssetPath(string $url): string
{
    if ($url === '') return '';
    $site = rtrim((string)(Middleware::getConfig()['SITE_URL'] ?? ''), '/');
    if ($site !== '' && stripos($url, $site . '/') === 0) $url = substr($url, strlen($site));
    if (preg_match('~^https?://~i', $url)) return $url;
    return ltrim($url, '/');
}

function cleanMoney($v): ?float
{
    if ($v === null || $v === '') return null;
    if (!is_numeric($v)) Middleware::error('invalid_price');
    $n = round((float)$v, 2);
    if ($n < 0) Middleware::error('invalid_price');
    return $n;
}

function cleanInt($v): ?int
{
    if ($v === null || $v === '') return null;
    if (!is_numeric($v)) Middleware::error('invalid_number');
    return max(0, (int)$v);
}

function handleProductSave(): void
{
    $d = Middleware::getJsonBody();
    $id = !empty($d['id']) ? (int)$d['id'] : null;
    if ($id !== null && !Database::fetchOne('SELECT id FROM shop_products WHERE id = ?', [$id])) {
        Middleware::error('not_found', 404);
    }

    $titleEn = trim((string)($d['title_en'] ?? ''));
    $titleEs = trim((string)($d['title_es'] ?? ''));
    if ($titleEn === '' && $titleEs === '') Middleware::error('title_required');
    $titleEn = $titleEn !== '' ? $titleEn : $titleEs;
    $titleEs = $titleEs !== '' ? $titleEs : $titleEn;

    $status = in_array($d['status'] ?? '', SHOP_PRODUCT_STATUSES, true) ? $d['status'] : 'draft';
    $kind = in_array($d['kind'] ?? '', SHOP_PRODUCT_KINDS, true) ? $d['kind'] : 'physical';
    $edition = in_array($d['edition'] ?? '', SHOP_EDITIONS, true) ? $d['edition'] : 'open';
    $editionSize = $edition === 'limited' ? cleanInt($d['edition_size'] ?? null) : ($edition === 'unique' ? 1 : null);
    if ($edition === 'limited' && !$editionSize) Middleware::error('edition_size_required');

    $categoryId = !empty($d['category_id']) ? (int)$d['category_id'] : null;
    if ($categoryId !== null && !Database::fetchOne('SELECT id FROM shop_categories WHERE id = ?', [$categoryId])) {
        $categoryId = null;
    }

    // Imágenes: rutas relativas (uploads/...) tal como las devuelve upload.php.
    $images = [];
    foreach ((array)($d['images'] ?? []) as $img) {
        $url = trim((string)($img['url'] ?? ''));
        if ($url === '') continue;
        $url = normalizeAssetPath($url);
        $images[] = [
            'url' => mb_substr($url, 0, 512),
            'alt_en' => mb_substr((string)($img['alt_en'] ?? ''), 0, 255),
            'alt_es' => mb_substr((string)($img['alt_es'] ?? ''), 0, 255),
        ];
    }

    // Opciones: [{name_en, name_es, values:[{en, es}]}]. El valor canónico de
    // cada opción es `en` — es lo que guardan las variantes.
    $options = [];
    foreach ((array)($d['options'] ?? []) as $opt) {
        $nameEn = trim((string)($opt['name_en'] ?? ''));
        $nameEs = trim((string)($opt['name_es'] ?? ''));
        if ($nameEn === '' && $nameEs === '') continue;
        $values = [];
        $seen = [];
        foreach ((array)($opt['values'] ?? []) as $val) {
            $en = trim((string)($val['en'] ?? ''));
            $es = trim((string)($val['es'] ?? ''));
            if ($en === '' && $es === '') continue;
            $en = $en !== '' ? $en : $es;
            if (isset($seen[mb_strtolower($en)])) continue;
            $seen[mb_strtolower($en)] = true;
            $values[] = ['en' => mb_substr($en, 0, 60), 'es' => mb_substr($es !== '' ? $es : $en, 0, 60)];
        }
        if (!$values) continue;
        $options[] = [
            'name_en' => mb_substr($nameEn !== '' ? $nameEn : $nameEs, 0, 60),
            'name_es' => mb_substr($nameEs !== '' ? $nameEs : $nameEn, 0, 60),
            'values' => $values,
        ];
    }
    if (count($options) > 3) Middleware::error('too_many_options');
    // Una pieza única es UNA pieza: con variantes habría una unidad por variante.
    if ($edition === 'unique' && $options) Middleware::error('unique_no_options');

    // Variantes
    $variantsIn = (array)($d['variants'] ?? []);
    if (!$variantsIn) Middleware::error('variants_required');
    if (!$options && count($variantsIn) > 1) $variantsIn = [reset($variantsIn)];
    $variants = [];
    $combos = [];
    foreach ($variantsIn as $i => $v) {
        $values = array_values(array_map('strval', (array)($v['option_values'] ?? [])));
        if ($options) {
            if (count($values) !== count($options)) Middleware::error('variant_options_mismatch', 400, ['index' => $i]);
            foreach ($values as $k => $val) {
                $valid = array_filter($options[$k]['values'], fn($x) => $x['en'] === $val);
                if (!$valid) Middleware::error('variant_option_unknown', 400, ['index' => $i, 'value' => $val]);
            }
            $key = mb_strtolower(implode('|', $values));
            if (isset($combos[$key])) Middleware::error('variant_duplicate', 400, ['index' => $i]);
            $combos[$key] = true;
        } else {
            $values = [];
        }

        $stock = array_key_exists('stock', $v) ? cleanInt($v['stock']) : null;
        if ($edition === 'unique') {
            $stock = $stock === null ? 1 : min(1, $stock);
        } elseif ($edition === 'limited' && $stock === null) {
            $stock = $editionSize;
        }

        $variants[] = [
            'id' => !empty($v['id']) ? (int)$v['id'] : null,
            'sku' => mb_substr(trim((string)($v['sku'] ?? '')), 0, 64),
            'option_values' => Shop::json($values),
            'price_mxn' => cleanMoney($v['price_mxn'] ?? null),
            'price_usd' => cleanMoney($v['price_usd'] ?? null),
            'compare_mxn' => cleanMoney($v['compare_mxn'] ?? null),
            'compare_usd' => cleanMoney($v['compare_usd'] ?? null),
            'stock' => $stock,
            'image_url' => mb_substr(normalizeAssetPath(trim((string)($v['image_url'] ?? ''))), 0, 512),
            'display_order' => $i,
        ];
    }

    // Archivos digitales: solo claves que existan en la carpeta privada.
    $files = [];
    foreach ((array)($d['digital_files'] ?? []) as $f) {
        $key = (string)($f['key'] ?? '');
        if (!Shop::privateFilePath($key)) continue;
        $files[] = [
            'key' => $key,
            'name' => mb_substr((string)($f['name'] ?? $key), 0, 200),
            'size' => (int)($f['size'] ?? 0),
        ];
    }
    if ($kind === 'digital' && $status === 'active' && !$files) Middleware::error('digital_files_required');

    $row = [
        'title_en' => mb_substr($titleEn, 0, 200),
        'title_es' => mb_substr($titleEs, 0, 200),
        'description_en' => (string)($d['description_en'] ?? ''),
        'description_es' => (string)($d['description_es'] ?? ''),
        'archive_id' => mb_substr(strtoupper(trim((string)($d['archive_id'] ?? ''))), 0, 40),
        'category_id' => $categoryId,
        'status' => $status,
        'kind' => $kind,
        'edition' => $edition,
        'edition_size' => $editionSize,
        'featured' => !empty($d['featured']) ? 1 : 0,
        'weight_g' => cleanInt($d['weight_g'] ?? 0) ?? 0,
        'images' => Shop::json($images),
        'options' => Shop::json($options),
        'digital_files' => Shop::json($files),
    ];
    // Sin la llave no se toca: un guardado parcial no debe reordenar el catálogo.
    if (array_key_exists('display_order', $d)) $row['display_order'] = (int)$d['display_order'];
    $slugBase = trim((string)($d['slug'] ?? '')) ?: $titleEn;
    $row['slug'] = Shop::uniqueSlug($slugBase, 'shop_products', $id);

    $pdo = Database::getInstance();
    $pdo->beginTransaction();
    try {
        $previousFiles = [];
        if ($id === null) {
            $id = Database::insert('shop_products', $row);
        } else {
            $prev = Database::fetchOne('SELECT digital_files FROM shop_products WHERE id = ?', [$id]);
            $previousFiles = Shop::jsonDecode($prev['digital_files'] ?? null);
            Database::update('shop_products', $row, 'id = ?', [$id]);
        }

        $existing = array_map(
            fn($r) => (int)$r['id'],
            Database::fetchAll('SELECT id FROM shop_variants WHERE product_id = ?', [$id])
        );
        $kept = [];
        foreach ($variants as $v) {
            $vid = $v['id'];
            unset($v['id']);
            if ($vid !== null && in_array($vid, $existing, true)) {
                Database::update('shop_variants', $v, 'id = ?', [$vid]);
                $kept[] = $vid;
            } else {
                $v['product_id'] = $id;
                $kept[] = Database::insert('shop_variants', $v);
            }
        }
        $removed = array_diff($existing, $kept);
        if ($removed) {
            $in = implode(',', array_fill(0, count($removed), '?'));
            Database::query("DELETE FROM shop_variants WHERE id IN ({$in})", array_values($removed));
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    // Archivos que se quitaron y que nada más necesita: se borran del disco.
    $nowKeys = array_column($files, 'key');
    foreach ($previousFiles as $pf) {
        $key = (string)($pf['key'] ?? '');
        if ($key === '' || in_array($key, $nowKeys, true)) continue;
        deleteDigitalFileIfUnused($key);
    }

    $saved = adminProducts($id);
    Middleware::success(['product' => $saved[0] ?? null]);
}

function handleProductDelete(): void
{
    $d = Middleware::getJsonBody();
    $id = (int)($d['id'] ?? 0);
    $p = Database::fetchOne('SELECT * FROM shop_products WHERE id = ?', [$id]);
    if (!$p) Middleware::error('not_found', 404);

    // Con ventas se archiva en vez de borrar: el historial de pedidos guarda
    // una copia de título y precio, pero las estadísticas por producto no.
    $hasOrders = Database::fetchOne('SELECT id FROM shop_order_items WHERE product_id = ? LIMIT 1', [$id]);
    if ($hasOrders && empty($d['force'])) {
        Database::update('shop_products', ['status' => 'archived'], 'id = ?', [$id]);
        Middleware::success(['archived' => true]);
    }

    Database::delete('shop_variants', 'product_id = ?', [$id]);
    Database::delete('shop_products', 'id = ?', [$id]);
    foreach (Shop::jsonDecode($p['digital_files']) as $f) {
        $key = (string)($f['key'] ?? '');
        if ($key !== '') deleteDigitalFileIfUnused($key);
    }
    Middleware::success(['deleted' => true]);
}

/**
 * Un archivo digital solo se borra del disco si ningún link de descarga
 * emitido lo usa y ningún otro producto lo lista.
 */
function deleteDigitalFileIfUnused(string $key): void
{
    if (Database::fetchOne('SELECT id FROM shop_downloads WHERE file_key = ? LIMIT 1', [$key])) return;
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], '"' . $key . '"') . '%';
    if (Database::fetchOne('SELECT id FROM shop_products WHERE digital_files LIKE ? LIMIT 1', [$like])) return;
    $path = Shop::privateFilePath($key);
    if ($path) @unlink($path);
}

function handleCategoriesSave(): void
{
    $d = Middleware::getJsonBody();
    $list = (array)($d['categories'] ?? []);
    $pdo = Database::getInstance();
    $pdo->beginTransaction();
    try {
        $existing = array_map(fn($r) => (int)$r['id'], Database::fetchAll('SELECT id FROM shop_categories'));
        $kept = [];
        foreach (array_values($list) as $i => $c) {
            $nameEn = trim((string)($c['name_en'] ?? ''));
            $nameEs = trim((string)($c['name_es'] ?? ''));
            if ($nameEn === '' && $nameEs === '') continue;
            $nameEn = $nameEn !== '' ? $nameEn : $nameEs;
            $nameEs = $nameEs !== '' ? $nameEs : $nameEn;
            $cid = !empty($c['id']) && in_array((int)$c['id'], $existing, true) ? (int)$c['id'] : null;
            $color = preg_match('/^#[0-9a-fA-F]{3,8}$/', (string)($c['color'] ?? '')) ? (string)$c['color'] : '#e600ff';
            $row = [
                'name_en' => mb_substr($nameEn, 0, 120),
                'name_es' => mb_substr($nameEs, 0, 120),
                'color' => $color,
                'display_order' => $i,
                'slug' => Shop::uniqueSlug(trim((string)($c['slug'] ?? '')) ?: $nameEn, 'shop_categories', $cid),
            ];
            if ($cid !== null) {
                Database::update('shop_categories', $row, 'id = ?', [$cid]);
                $kept[] = $cid;
            } else {
                $kept[] = Database::insert('shop_categories', $row);
            }
        }
        $removed = array_values(array_diff($existing, $kept));
        if ($removed) {
            $in = implode(',', array_fill(0, count($removed), '?'));
            Database::query("UPDATE shop_products SET category_id = NULL WHERE category_id IN ({$in})", $removed);
            Database::query("DELETE FROM shop_categories WHERE id IN ({$in})", $removed);
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    Middleware::success(['categories' => Shop::categories()]);
}

function handleZonesSave(): void
{
    $d = Middleware::getJsonBody();
    $list = (array)($d['zones'] ?? []);
    $pdo = Database::getInstance();
    $pdo->beginTransaction();
    try {
        $existing = [];
        foreach (Database::fetchAll('SELECT id, code FROM shop_zones') as $r) $existing[(int)$r['id']] = $r['code'];
        // Las zonas que se quitaron se borran ANTES de insertar: así se puede
        // quitar una zona y crear otra con el mismo código en un solo guardado.
        $incomingIds = array_filter(array_map(fn($z) => (int)($z['id'] ?? 0), $list));
        $removed = array_values(array_diff(array_keys($existing), $incomingIds));
        if ($removed) {
            $in = implode(',', array_fill(0, count($removed), '?'));
            Database::query("DELETE FROM shop_zones WHERE id IN ({$in})", $removed);
        }
        $kept = [];
        $codes = [];
        $countryZone = [];
        foreach (array_values($list) as $i => $z) {
            $code = mb_substr(Middleware::slugify((string)($z['code'] ?? '')), 0, 16);
            if ($code === 'untitled' || isset($codes[$code])) Middleware::error('invalid_zone_code', 400, ['index' => $i]);
            $codes[$code] = true;
            $currency = strtoupper((string)($z['currency'] ?? ''));
            if (!in_array($currency, ['MXN', 'USD'], true)) Middleware::error('invalid_currency', 400, ['index' => $i]);
            $countries = [];
            foreach ((array)($z['countries'] ?? []) as $cc) {
                $cc = strtoupper(trim((string)$cc));
                if (!preg_match('/^[A-Z]{2}$/', $cc)) continue;
                // Un país que Stripe no acepta tumba TODOS los checkouts de la zona.
                if (in_array($cc, SHOP_STRIPE_BLOCKED_COUNTRIES, true)) {
                    Middleware::error('invalid_country', 400, ['index' => $i, 'country' => $cc]);
                }
                // En dos zonas, el país tendría dos monedas y dos tarifas.
                if (isset($countryZone[$cc]) && $countryZone[$cc] !== $i) {
                    Middleware::error('country_in_two_zones', 400, ['index' => $i, 'country' => $cc]);
                }
                $countryZone[$cc] = $i;
                $countries[$cc] = true;
            }
            if (!$countries) Middleware::error('countries_required', 400, ['index' => $i]);
            $rates = [];
            foreach ((array)($z['rates'] ?? []) as $r) {
                $amount = cleanMoney($r['amount'] ?? null);
                if ($amount === null) continue;
                $rates[] = [
                    'name_en' => mb_substr(trim((string)($r['name_en'] ?? '')), 0, 80),
                    'name_es' => mb_substr(trim((string)($r['name_es'] ?? '')), 0, 80),
                    'amount' => $amount,
                    'min_days' => cleanInt($r['min_days'] ?? null),
                    'max_days' => cleanInt($r['max_days'] ?? null),
                ];
            }
            if (!$rates) Middleware::error('rates_required', 400, ['index' => $i]);
            $row = [
                'code' => $code,
                'name_en' => mb_substr(trim((string)($z['name_en'] ?? '')), 0, 120),
                'name_es' => mb_substr(trim((string)($z['name_es'] ?? '')), 0, 120),
                'currency' => $currency,
                'countries' => Shop::json(array_keys($countries)),
                'rates' => Shop::json(array_slice($rates, 0, 5)),
                'free_over' => cleanMoney($z['free_over'] ?? null),
                'active' => !empty($z['active']) ? 1 : 0,
                'display_order' => $i,
            ];
            $zid = !empty($z['id']) && isset($existing[(int)$z['id']]) ? (int)$z['id'] : null;
            if ($zid !== null) {
                Database::update('shop_zones', $row, 'id = ?', [$zid]);
                $kept[] = $zid;
            } else {
                $kept[] = Database::insert('shop_zones', $row);
            }
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    Middleware::success(['zones' => Shop::zones(false)]);
}

function handleSettingsSave(): void
{
    $d = Middleware::getJsonBody();
    foreach (['checkout_enabled', 'allow_promo_codes'] as $flag) {
        if (array_key_exists($flag, $d)) Shop::setSetting($flag, !empty($d[$flag]) ? '1' : '0');
    }
    if (array_key_exists('notify_email', $d)) {
        $email = trim((string)$d['notify_email']);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) Middleware::error('invalid_email');
        Shop::setSetting('notify_email', $email);
    }
    if (array_key_exists('download_days', $d)) Shop::setSetting('download_days', (string)max(1, min(365, (int)$d['download_days'])));
    if (array_key_exists('download_max', $d)) Shop::setSetting('download_max', (string)max(1, min(100, (int)$d['download_max'])));
    Middleware::success(['settings' => Shop::settings(), 'stripe' => stripeStatus()]);
}

function handleUploadDigital(): void
{
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        Middleware::error('upload_error_' . ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE));
    }
    $file = $_FILES['file'];
    $original = (string)$file['name'];
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    if (!in_array($ext, SHOP_DIGITAL_EXTENSIONS, true)) Middleware::error('invalid_file_type', 400, ['ext' => $ext]);
    $max = (int)(Middleware::getConfig()['SHOP_MAX_DIGITAL_SIZE'] ?? 500 * 1024 * 1024);
    if ($file['size'] > $max) Middleware::error('file_too_large', 400, ['max_size' => $max]);

    $key = date('Ymd') . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    $target = Shop::privateDir() . '/' . $key;
    if (!move_uploaded_file($file['tmp_name'], $target)) Middleware::error('move_failed', 500);

    Middleware::success(['file' => [
        'key' => $key,
        'name' => mb_substr(basename($original), 0, 200),
        'size' => (int)$file['size'],
    ]]);
}
