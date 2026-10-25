<?php
/**
 * Núcleo de la tienda — esquema, catálogo, stock y ciclo de vida de pedidos.
 *
 * Librería, no endpoint: la usan shop.php (catálogo público), shop-admin.php
 * (CMS), shop-checkout.php, shop-orders.php, shop-webhook.php y
 * shop-download.php.
 *
 * MySQL es la fuente de verdad del catálogo y de los pedidos. Stripe solo
 * cobra: los precios viajan inline en cada Checkout Session, así que no hay
 * nada que sincronizar con su catálogo.
 *
 * Stock: `shop_variants.stock` es lo que queda en el estante (NULL = sin
 * límite). Lo disponible para vender es eso menos lo APARTADO por pedidos
 * pendientes de pago que no han vencido. Así una pieza 1/1 no se puede pagar
 * dos veces: la segunda persona ni siquiera llega a Stripe.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/stripe.php';

const SHOP_SCHEMA_VERSION = '2';

// El golden ticket se gana en el minigame (profile.php::handleSaveScore) y se
// cobra aquí. Vive en user_profiles, no en un código externo.
const SHOP_GOLDEN_TICKET_PCT = 35;
const SHOP_GOLDEN_COUPON_ID = 'skr_golden_ticket_35';

const SHOP_PRODUCT_STATUSES = ['draft', 'active', 'archived'];
const SHOP_PRODUCT_KINDS = ['physical', 'digital'];
const SHOP_EDITIONS = ['unique', 'limited', 'open'];

// Estados de pedido. `pending` y `awaiting_payment` apartan stock.
const SHOP_ORDER_STATUSES = [
    'pending',          // checkout creado, el cliente está en Stripe
    'awaiting_payment', // pago diferido (OXXO): ficha emitida, sin pagar
    'paid',             // pagado, por preparar
    'preparing',
    'shipped',
    'delivered',
    'cancelled',
    'expired',
    'refunded',
];
const SHOP_HOLDING_STATUSES = ['pending', 'awaiting_payment'];

// Checkout Session de Stripe vive 30 min como mínimo; el apartado dura un poco
// más para que el webhook de expiración siempre llegue antes que el vencimiento.
const SHOP_CHECKOUT_TTL = 1900;
const SHOP_HOLD_TTL = 2100;
// Ficha OXXO: Stripe la deja pagar 3 días. Apartamos 4.
const SHOP_ASYNC_HOLD_TTL = 4 * 86400;

class Shop
{
    private static bool $schemaChecked = false;

    // ═══════════════════════════════════════════════════════════════
    // ESQUEMA
    // ═══════════════════════════════════════════════════════════════

    /**
     * Crea las tablas si faltan. Cuesta un SELECT por request cuando ya están:
     * la versión del esquema vive en shop_settings.
     */
    public static function ensureSchema(): void
    {
        if (self::$schemaChecked) return;
        self::$schemaChecked = true;

        try {
            $row = Database::fetchOne(
                'SELECT setting_value FROM shop_settings WHERE setting_key = ?',
                ['shop_schema_version']
            );
            if (($row['setting_value'] ?? null) === SHOP_SCHEMA_VERSION) return;
        } catch (\Throwable $e) {
            // shop_settings todavía no existe — se crea abajo.
        }

        $pdo = Database::getInstance();
        $engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_settings (
            setting_key VARCHAR(64) PRIMARY KEY,
            setting_value TEXT
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(80) NOT NULL,
            name_en VARCHAR(120) NOT NULL DEFAULT '',
            name_es VARCHAR(120) NOT NULL DEFAULT '',
            color VARCHAR(24) NOT NULL DEFAULT '#e600ff',
            display_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_slug (slug)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(160) NOT NULL,
            archive_id VARCHAR(40) NOT NULL DEFAULT '',
            category_id INT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'draft',
            kind VARCHAR(16) NOT NULL DEFAULT 'physical',
            edition VARCHAR(16) NOT NULL DEFAULT 'open',
            edition_size INT NULL,
            featured TINYINT(1) NOT NULL DEFAULT 0,
            title_en VARCHAR(200) NOT NULL DEFAULT '',
            title_es VARCHAR(200) NOT NULL DEFAULT '',
            description_en TEXT NULL,
            description_es TEXT NULL,
            images TEXT NULL,
            options TEXT NULL,
            digital_files TEXT NULL,
            weight_g INT NOT NULL DEFAULT 0,
            display_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_slug (slug),
            KEY idx_status (status),
            KEY idx_category (category_id)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_variants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            sku VARCHAR(64) NOT NULL DEFAULT '',
            option_values TEXT NULL,
            price_mxn DECIMAL(10,2) NULL,
            price_usd DECIMAL(10,2) NULL,
            compare_mxn DECIMAL(10,2) NULL,
            compare_usd DECIMAL(10,2) NULL,
            stock INT NULL,
            image_url VARCHAR(512) NOT NULL DEFAULT '',
            display_order INT NOT NULL DEFAULT 0,
            KEY idx_product (product_id)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_zones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(16) NOT NULL,
            name_en VARCHAR(120) NOT NULL DEFAULT '',
            name_es VARCHAR(120) NOT NULL DEFAULT '',
            currency CHAR(3) NOT NULL DEFAULT 'USD',
            countries TEXT NULL,
            rates TEXT NULL,
            free_over DECIMAL(10,2) NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            display_order INT NOT NULL DEFAULT 0,
            UNIQUE KEY uq_code (code)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_number VARCHAR(24) NOT NULL DEFAULT '',
            token CHAR(32) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            currency CHAR(3) NOT NULL DEFAULT 'MXN',
            zone_code VARCHAR(16) NOT NULL DEFAULT '',
            lang CHAR(2) NOT NULL DEFAULT 'es',
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount DECIMAL(10,2) NOT NULL DEFAULT 0,
            shipping DECIMAL(10,2) NOT NULL DEFAULT 0,
            total DECIMAL(10,2) NOT NULL DEFAULT 0,
            refunded DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount_label VARCHAR(80) NOT NULL DEFAULT '',
            golden_ticket TINYINT(1) NOT NULL DEFAULT 0,
            has_physical TINYINT(1) NOT NULL DEFAULT 0,
            has_digital TINYINT(1) NOT NULL DEFAULT 0,
            privy_id VARCHAR(128) NULL,
            profile_id INT NULL,
            email VARCHAR(255) NOT NULL DEFAULT '',
            customer_name VARCHAR(200) NOT NULL DEFAULT '',
            phone VARCHAR(40) NOT NULL DEFAULT '',
            shipping_name VARCHAR(200) NOT NULL DEFAULT '',
            shipping_address TEXT NULL,
            shipping_method VARCHAR(160) NOT NULL DEFAULT '',
            carrier VARCHAR(60) NOT NULL DEFAULT '',
            tracking_number VARCHAR(120) NOT NULL DEFAULT '',
            tracking_url VARCHAR(512) NOT NULL DEFAULT '',
            notes TEXT NULL,
            dispute TINYINT(1) NOT NULL DEFAULT 0,
            stripe_session_id VARCHAR(255) NULL,
            stripe_payment_intent VARCHAR(255) NULL,
            payment_method VARCHAR(32) NOT NULL DEFAULT '',
            expires_at DATETIME NULL,
            paid_at DATETIME NULL,
            shipped_at DATETIME NULL,
            delivered_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_token (token),
            KEY idx_status (status),
            KEY idx_session (stripe_session_id),
            KEY idx_pi (stripe_payment_intent),
            KEY idx_privy (privy_id),
            KEY idx_email (email)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NULL,
            variant_id INT NULL,
            kind VARCHAR(16) NOT NULL DEFAULT 'physical',
            title VARCHAR(255) NOT NULL DEFAULT '',
            options_label VARCHAR(255) NOT NULL DEFAULT '',
            sku VARCHAR(64) NOT NULL DEFAULT '',
            image_url VARCHAR(512) NOT NULL DEFAULT '',
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
            qty INT NOT NULL DEFAULT 1,
            KEY idx_order (order_id),
            KEY idx_variant (variant_id)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_downloads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NULL,
            file_key VARCHAR(128) NOT NULL,
            file_name VARCHAR(255) NOT NULL DEFAULT '',
            token CHAR(32) NOT NULL,
            downloads INT NOT NULL DEFAULT 0,
            max_downloads INT NOT NULL DEFAULT 5,
            expires_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_token (token),
            KEY idx_order (order_id)
        ) {$engine}");

        $pdo->exec("CREATE TABLE IF NOT EXISTS shop_stripe_events (
            event_id VARCHAR(255) PRIMARY KEY,
            type VARCHAR(80) NOT NULL DEFAULT '',
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) {$engine}");

        // v2: método con el que se pagó (OXXO no admite reembolsos en Stripe).
        try {
            $pdo->exec("ALTER TABLE shop_orders ADD COLUMN payment_method VARCHAR(32) NOT NULL DEFAULT '' AFTER stripe_payment_intent");
        } catch (\Throwable $e) {
            // Ya existe (instalación nueva con el CREATE de arriba).
        }

        self::seedDefaults();
        self::setSetting('shop_schema_version', SHOP_SCHEMA_VERSION);
    }

    /**
     * Arranque en limpio: categorías y zonas de envío de ejemplo. Solo corre
     * si las tablas están vacías — nunca pisa lo que Oscar ya editó.
     */
    private static function seedDefaults(): void
    {
        $catCount = (int)(Database::fetchOne('SELECT COUNT(*) AS c FROM shop_categories')['c'] ?? 0);
        if ($catCount === 0) {
            $cats = [
                ['art-toys', 'Art Toys', 'Art Toys', '#e600ff'],
                ['apparel', 'Apparel', 'Ropa', '#22c55e'],
                ['prints', 'Prints', 'Prints', '#38bdf8'],
                ['stickers', 'Stickers', 'Stickers', '#ec4899'],
                ['3d-prints', '3D Prints', 'Impresiones 3D', '#f97316'],
                ['keychains', 'Keychains', 'Llaveros', '#ef4444'],
                ['digital', 'Digital', 'Digital', '#a78bfa'],
            ];
            foreach ($cats as $i => [$slug, $en, $es, $color]) {
                Database::insert('shop_categories', [
                    'slug' => $slug, 'name_en' => $en, 'name_es' => $es,
                    'color' => $color, 'display_order' => $i,
                ]);
            }
        }

        $zoneCount = (int)(Database::fetchOne('SELECT COUNT(*) AS c FROM shop_zones')['c'] ?? 0);
        if ($zoneCount === 0) {
            // Tarifas de arranque. Son placeholders: se ajustan en el CMS.
            $zones = [
                [
                    'code' => 'mx', 'name_en' => 'Mexico', 'name_es' => 'México', 'currency' => 'MXN',
                    'countries' => ['MX'],
                    'rates' => [
                        ['name_en' => 'Standard shipping', 'name_es' => 'Envío estándar', 'amount' => 150, 'min_days' => 3, 'max_days' => 7],
                        ['name_en' => 'Express shipping', 'name_es' => 'Envío express', 'amount' => 290, 'min_days' => 1, 'max_days' => 3],
                    ],
                    'free_over' => 1500,
                ],
                [
                    'code' => 'us', 'name_en' => 'United States', 'name_es' => 'Estados Unidos', 'currency' => 'USD',
                    'countries' => ['US', 'PR'],
                    'rates' => [
                        ['name_en' => 'Standard shipping', 'name_es' => 'Envío estándar', 'amount' => 18, 'min_days' => 5, 'max_days' => 10],
                    ],
                    'free_over' => null,
                ],
                [
                    'code' => 'latam', 'name_en' => 'Latin America', 'name_es' => 'Latinoamérica', 'currency' => 'USD',
                    'countries' => ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PE', 'PY', 'SV', 'UY'],
                    'rates' => [
                        ['name_en' => 'Standard shipping', 'name_es' => 'Envío estándar', 'amount' => 30, 'min_days' => 7, 'max_days' => 20],
                    ],
                    'free_over' => null,
                ],
            ];
            foreach ($zones as $i => $z) {
                Database::insert('shop_zones', [
                    'code' => $z['code'],
                    'name_en' => $z['name_en'],
                    'name_es' => $z['name_es'],
                    'currency' => $z['currency'],
                    'countries' => json_encode($z['countries']),
                    'rates' => json_encode($z['rates'], JSON_UNESCAPED_UNICODE),
                    'free_over' => $z['free_over'],
                    'display_order' => $i,
                ]);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════════

    public const SETTING_DEFAULTS = [
        'checkout_enabled' => '1',
        'allow_promo_codes' => '1',
        'notify_email' => '',
        'download_days' => '30',
        'download_max' => '5',
        // Tipo de cambio USD→MXN, cacheado. Lo llena solo `usdToMxn()` desde
        // una fuente pública; nadie lo captura a mano. Solo se usa para llenar
        // el precio en pesos mientras se edita un producto — al cobrar se usa
        // el precio guardado en la variante, así que cuando el tipo de cambio
        // se mueve, lo ya publicado no cambia.
        'usd_to_mxn' => '',
        'usd_to_mxn_at' => '',
    ];

    /** Horas que vale la pena reusar el tipo de cambio antes de volver a pedirlo. */
    private const FX_TTL_HOURS = 12;

    /** Si la fuente falla y nunca hubo caché, al menos no dividir entre cero. */
    private const FX_FALLBACK = 18.0;

    public static function getSetting(string $key, ?string $default = null): ?string
    {
        $row = Database::fetchOne('SELECT setting_value FROM shop_settings WHERE setting_key = ?', [$key]);
        if ($row === null) return $default ?? (self::SETTING_DEFAULTS[$key] ?? null);
        return (string)$row['setting_value'];
    }

    /**
     * Tipo de cambio USD→MXN para capturar precios en el CMS.
     *
     * Se pide a una fuente pública (sin llave) y se cachea en shop_settings.
     * Mientras el caché tenga menos de FX_TTL_HOURS no se sale a la red, así
     * que abrir diez productos seguidos no son diez llamadas. Si la fuente no
     * responde, se devuelve el último valor conocido: vale más un tipo de
     * cambio de ayer que ninguno.
     *
     * @return array{rate: float, at: string, stale: bool}
     */
    public static function usdToMxn(bool $force = false): array
    {
        $cached = (float)self::getSetting('usd_to_mxn', '');
        $at = (string)self::getSetting('usd_to_mxn_at', '');
        $ageOk = $at !== '' && (time() - strtotime($at)) < self::FX_TTL_HOURS * 3600;

        if (!$force && $cached > 0 && $ageOk) {
            return ['rate' => $cached, 'at' => $at, 'stale' => false];
        }

        $fresh = self::fetchUsdToMxn();
        if ($fresh > 0) {
            $now = date('Y-m-d H:i:s');
            self::setSetting('usd_to_mxn', (string)round($fresh, 4));
            self::setSetting('usd_to_mxn_at', $now);
            return ['rate' => round($fresh, 4), 'at' => $now, 'stale' => false];
        }

        // La red falló: el último valor bueno, marcado como viejo.
        if ($cached > 0) return ['rate' => $cached, 'at' => $at, 'stale' => true];
        return ['rate' => self::FX_FALLBACK, 'at' => '', 'stale' => true];
    }

    /** Devuelve 0.0 si ninguna fuente respondió algo creíble. */
    private static function fetchUsdToMxn(): float
    {
        $sources = [
            ['https://open.er-api.com/v6/latest/USD', ['rates', 'MXN']],
            ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN', ['rates', 'MXN']],
        ];
        foreach ($sources as [$url, $path]) {
            try {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 5,
                    CURLOPT_CONNECTTIMEOUT => 3,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_USERAGENT => 'mroscar.xyz shop',
                ]);
                $body = curl_exec($ch);
                $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                if ($code !== 200 || !is_string($body)) continue;
                $json = json_decode($body, true);
                foreach ($path as $key) {
                    if (!is_array($json) || !isset($json[$key])) { $json = null; break; }
                    $json = $json[$key];
                }
                $rate = (float)$json;
                // Un peso nunca ha estado fuera de este rango; si la fuente
                // devuelve algo raro, mejor ignorarla que publicar precios mal.
                if ($rate >= 5 && $rate <= 100) return $rate;
            } catch (\Throwable $e) {
                // siguiente fuente
            }
        }
        return 0.0;
    }

    public static function setSetting(string $key, string $value): void
    {
        Database::query(
            'INSERT INTO shop_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
            [$key, $value]
        );
    }

    public static function settings(): array
    {
        $out = self::SETTING_DEFAULTS;
        $rows = Database::fetchAll('SELECT setting_key, setting_value FROM shop_settings');
        foreach ($rows as $r) {
            if (array_key_exists($r['setting_key'], $out)) $out[$r['setting_key']] = (string)$r['setting_value'];
        }
        return $out;
    }

    public static function notifyEmail(): string
    {
        $email = trim((string)self::getSetting('notify_email', ''));
        if ($email !== '') return $email;
        $c = Middleware::getConfig();
        return (string)($c['TO_EMAIL'] ?? '');
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    public static function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    public static function at(int $secondsFromNow): string
    {
        return date('Y-m-d H:i:s', time() + $secondsFromNow);
    }

    public static function token(): string
    {
        return bin2hex(random_bytes(16));
    }

    public static function cents($amount): int
    {
        return (int)round(((float)$amount) * 100);
    }

    public static function money($amount): float
    {
        return round((float)$amount, 2);
    }

    public static function jsonDecode($raw, $fallback = [])
    {
        if ($raw === null || $raw === '') return $fallback;
        $v = json_decode((string)$raw, true);
        return is_array($v) ? $v : $fallback;
    }

    public static function json($value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** Ruta relativa (uploads/...) → URL pública del sitio ("/uploads/..."). */
    public static function publicPath(string $path): string
    {
        if ($path === '') return '';
        if (preg_match('~^https?://~i', $path)) return $path;
        return '/' . ltrim($path, '/');
    }

    /**
     * URL absoluta para Stripe (imágenes del checkout). Stripe solo acepta
     * https públicos — en local devuelve null y el checkout va sin foto.
     */
    public static function absoluteUrl(string $path): ?string
    {
        if ($path === '') return null;
        if (preg_match('~^https://~i', $path)) return $path;
        $site = rtrim((string)(Middleware::getConfig()['SITE_URL'] ?? ''), '/');
        if (!preg_match('~^https://~i', $site)) return null;
        return $site . self::publicPath($path);
    }

    public static function siteUrl(string $path = ''): string
    {
        $site = rtrim((string)(Middleware::getConfig()['SITE_URL'] ?? ''), '/');
        return $site . $path;
    }

    /** La sección de la tienda en el SPA (sectionRouting.js: section3). */
    public static function orderUrl(string $token): string
    {
        return self::siteUrl('/lost-and-found-shop?pedido=' . $token);
    }

    public static function uniqueSlug(string $base, string $table, ?int $ignoreId = null): string
    {
        $slug = Middleware::slugify($base);
        $candidate = $slug;
        $n = 2;
        while (true) {
            $params = [$candidate];
            $sql = "SELECT id FROM {$table} WHERE slug = ?";
            if ($ignoreId !== null) {
                $sql .= ' AND id <> ?';
                $params[] = $ignoreId;
            }
            if (!Database::fetchOne($sql, $params)) return $candidate;
            $candidate = $slug . '-' . $n++;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CATÁLOGO
    // ═══════════════════════════════════════════════════════════════

    public static function categories(): array
    {
        $rows = Database::fetchAll('SELECT * FROM shop_categories ORDER BY display_order ASC, id ASC');
        return array_map(fn($c) => [
            'id' => (int)$c['id'],
            'slug' => $c['slug'],
            'name_en' => $c['name_en'],
            'name_es' => $c['name_es'],
            'color' => $c['color'] ?: '#e600ff',
            'display_order' => (int)$c['display_order'],
        ], $rows);
    }

    public static function zones(bool $onlyActive = true): array
    {
        $sql = 'SELECT * FROM shop_zones' . ($onlyActive ? ' WHERE active = 1' : '') . ' ORDER BY display_order ASC, id ASC';
        $rows = Database::fetchAll($sql);
        return array_map([self::class, 'formatZone'], $rows);
    }

    public static function zone(string $code): ?array
    {
        $row = Database::fetchOne('SELECT * FROM shop_zones WHERE code = ? AND active = 1', [$code]);
        return $row ? self::formatZone($row) : null;
    }

    private static function formatZone(array $z): array
    {
        $rates = array_values(array_filter(
            self::jsonDecode($z['rates']),
            fn($r) => is_array($r) && isset($r['amount'])
        ));
        return [
            'id' => (int)$z['id'],
            'code' => $z['code'],
            'name_en' => $z['name_en'],
            'name_es' => $z['name_es'],
            'currency' => strtoupper($z['currency']),
            'countries' => array_values(self::jsonDecode($z['countries'])),
            'rates' => array_map(fn($r) => [
                'name_en' => (string)($r['name_en'] ?? ''),
                'name_es' => (string)($r['name_es'] ?? ''),
                'amount' => self::money($r['amount'] ?? 0),
                'min_days' => isset($r['min_days']) && $r['min_days'] !== '' ? (int)$r['min_days'] : null,
                'max_days' => isset($r['max_days']) && $r['max_days'] !== '' ? (int)$r['max_days'] : null,
            ], $rates),
            'free_over' => $z['free_over'] !== null ? self::money($z['free_over']) : null,
            'active' => (bool)$z['active'],
            'display_order' => (int)$z['display_order'],
        ];
    }

    /**
     * Unidades apartadas por pedidos sin pagar (vigentes), por variante.
     * $excludeOrderId sirve para recalcular sin contar el pedido en curso.
     */
    public static function reservedByVariant(array $variantIds, ?int $excludeOrderId = null): array
    {
        $variantIds = array_values(array_unique(array_map('intval', $variantIds)));
        if (!$variantIds) return [];
        $in = implode(',', array_fill(0, count($variantIds), '?'));
        $holding = implode(',', array_fill(0, count(SHOP_HOLDING_STATUSES), '?'));
        $params = array_merge(SHOP_HOLDING_STATUSES, [self::now()], $variantIds);
        $sql = "SELECT oi.variant_id, SUM(oi.qty) AS reserved
                FROM shop_order_items oi
                JOIN shop_orders o ON o.id = oi.order_id
                WHERE o.status IN ({$holding}) AND o.expires_at > ? AND oi.variant_id IN ({$in})";
        if ($excludeOrderId !== null) {
            $sql .= ' AND o.id <> ?';
            $params[] = $excludeOrderId;
        }
        $sql .= ' GROUP BY oi.variant_id';
        $out = [];
        foreach (Database::fetchAll($sql, $params) as $r) {
            $out[(int)$r['variant_id']] = (int)$r['reserved'];
        }
        return $out;
    }

    /** Disponible = stock − apartado. null = sin límite. */
    public static function available(?int $stock, int $reserved): ?int
    {
        if ($stock === null) return null;
        return max(0, $stock - $reserved);
    }

    /**
     * Productos con sus variantes. $public=true filtra a `active` y quita lo
     * que el comprador no debe ver (archivos digitales, stock crudo).
     */
    public static function products(bool $public = true, ?int $onlyId = null): array
    {
        $where = [];
        $params = [];
        if ($public) $where[] = "p.status = 'active'";
        if ($onlyId !== null) {
            $where[] = 'p.id = ?';
            $params[] = $onlyId;
        }
        $sql = 'SELECT p.* FROM shop_products p'
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY p.display_order ASC, p.created_at DESC, p.id DESC';
        $rows = Database::fetchAll($sql, $params);
        if (!$rows) return [];

        $ids = array_map(fn($r) => (int)$r['id'], $rows);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $variantRows = Database::fetchAll(
            "SELECT * FROM shop_variants WHERE product_id IN ({$in}) ORDER BY display_order ASC, id ASC",
            $ids
        );
        $reserved = self::reservedByVariant(array_map(fn($v) => (int)$v['id'], $variantRows));

        $byProduct = [];
        foreach ($variantRows as $v) {
            $vid = (int)$v['id'];
            $stock = $v['stock'] !== null ? (int)$v['stock'] : null;
            $variant = [
                'id' => $vid,
                'sku' => $v['sku'],
                'option_values' => array_values(self::jsonDecode($v['option_values'])),
                'price_mxn' => $v['price_mxn'] !== null ? self::money($v['price_mxn']) : null,
                'price_usd' => $v['price_usd'] !== null ? self::money($v['price_usd']) : null,
                'compare_mxn' => $v['compare_mxn'] !== null ? self::money($v['compare_mxn']) : null,
                'compare_usd' => $v['compare_usd'] !== null ? self::money($v['compare_usd']) : null,
                'available' => self::available($stock, $reserved[$vid] ?? 0),
                'image_url' => self::publicPath((string)$v['image_url']),
            ];
            if (!$public) {
                $variant['stock'] = $stock;
                $variant['reserved'] = $reserved[$vid] ?? 0;
                $variant['image_url_raw'] = (string)$v['image_url'];
            }
            $byProduct[(int)$v['product_id']][] = $variant;
        }

        $cats = [];
        foreach (self::categories() as $c) $cats[$c['id']] = $c;

        $out = [];
        foreach ($rows as $p) {
            $pid = (int)$p['id'];
            $images = array_values(array_filter(self::jsonDecode($p['images']), fn($i) => !empty($i['url'])));
            $product = [
                'id' => $pid,
                'slug' => $p['slug'],
                'archive_id' => $p['archive_id'] ?: sprintf('SKR-%04d', $pid),
                'status' => $p['status'],
                'kind' => $p['kind'],
                'edition' => $p['edition'],
                'edition_size' => $p['edition_size'] !== null ? (int)$p['edition_size'] : null,
                'featured' => (bool)$p['featured'],
                'title_en' => $p['title_en'],
                'title_es' => $p['title_es'],
                'description_en' => (string)($p['description_en'] ?? ''),
                'description_es' => (string)($p['description_es'] ?? ''),
                'category' => $p['category_id'] !== null ? ($cats[(int)$p['category_id']] ?? null) : null,
                'images' => array_map(fn($i) => [
                    'url' => self::publicPath((string)$i['url']),
                    'alt_en' => (string)($i['alt_en'] ?? ''),
                    'alt_es' => (string)($i['alt_es'] ?? ''),
                ], $images),
                'options' => array_values(self::jsonDecode($p['options'])),
                'weight_g' => (int)$p['weight_g'],
                'created_at' => $p['created_at'],
                'variants' => $byProduct[$pid] ?? [],
            ];
            if (!$public) {
                $product['category_id'] = $p['category_id'] !== null ? (int)$p['category_id'] : null;
                $product['images_raw'] = $images;
                $product['digital_files'] = array_values(self::jsonDecode($p['digital_files']));
                $product['display_order'] = (int)$p['display_order'];
                $product['updated_at'] = $p['updated_at'];
                $product['archive_id_raw'] = $p['archive_id'];
            }
            $out[] = $product;
        }
        return $out;
    }

    /** "Negro · M" en el idioma pedido, a partir de los valores canónicos (EN). */
    public static function optionsLabel(array $options, array $values, string $lang): string
    {
        $parts = [];
        foreach ($values as $i => $canonical) {
            $label = (string)$canonical;
            foreach ((array)($options[$i]['values'] ?? []) as $val) {
                if ((string)($val['en'] ?? '') === (string)$canonical) {
                    $label = $lang === 'es' && !empty($val['es']) ? (string)$val['es'] : (string)$val['en'];
                    break;
                }
            }
            if ($label !== '') $parts[] = $label;
        }
        return implode(' · ', $parts);
    }

    // ═══════════════════════════════════════════════════════════════
    // PEDIDOS
    // ═══════════════════════════════════════════════════════════════

    public static function orderById(int $id): ?array
    {
        return Database::fetchOne('SELECT * FROM shop_orders WHERE id = ?', [$id]);
    }

    public static function orderByToken(string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;
        return Database::fetchOne('SELECT * FROM shop_orders WHERE token = ?', [$token]);
    }

    public static function orderItems(int $orderId): array
    {
        return Database::fetchAll('SELECT * FROM shop_order_items WHERE order_id = ? ORDER BY id ASC', [$orderId]);
    }

    public static function orderDownloads(int $orderId): array
    {
        return Database::fetchAll('SELECT * FROM shop_downloads WHERE order_id = ? ORDER BY id ASC', [$orderId]);
    }

    /**
     * Forma pública de un pedido. $full incluye datos de contacto y notas
     * (solo para el admin). La vista del cliente por token sí lleva su
     * dirección de envío: el token de 32 hex es la llave.
     */
    public static function formatOrder(array $o, bool $full = false, bool $withItems = true): array
    {
        $out = [
            'id' => (int)$o['id'],
            'number' => $o['order_number'],
            'token' => $o['token'],
            'status' => $o['status'],
            'currency' => $o['currency'],
            'zone' => $o['zone_code'],
            'lang' => $o['lang'],
            'subtotal' => self::money($o['subtotal']),
            'discount' => self::money($o['discount']),
            'discount_label' => $o['discount_label'],
            'shipping' => self::money($o['shipping']),
            'total' => self::money($o['total']),
            'refunded' => self::money($o['refunded']),
            'has_physical' => (bool)$o['has_physical'],
            'has_digital' => (bool)$o['has_digital'],
            'shipping_name' => $o['shipping_name'],
            'shipping_address' => self::jsonDecode($o['shipping_address'], null),
            'shipping_method' => $o['shipping_method'],
            'carrier' => $o['carrier'],
            'tracking_number' => $o['tracking_number'],
            'tracking_url' => $o['tracking_url'],
            'created_at' => $o['created_at'],
            'paid_at' => $o['paid_at'],
            'shipped_at' => $o['shipped_at'],
            'delivered_at' => $o['delivered_at'],
        ];
        if ($withItems) {
            $out['items'] = array_map(fn($i) => [
                'id' => (int)$i['id'],
                'product_id' => $i['product_id'] !== null ? (int)$i['product_id'] : null,
                'variant_id' => $i['variant_id'] !== null ? (int)$i['variant_id'] : null,
                'kind' => $i['kind'],
                'title' => $i['title'],
                'options' => $i['options_label'],
                'sku' => $i['sku'],
                'image' => self::publicPath((string)$i['image_url']),
                'unit_price' => self::money($i['unit_price']),
                'qty' => (int)$i['qty'],
            ], self::orderItems((int)$o['id']));
        }
        if ($full) {
            $out['email'] = $o['email'];
            $out['customer_name'] = $o['customer_name'];
            $out['phone'] = $o['phone'];
            $out['notes'] = (string)($o['notes'] ?? '');
            $out['dispute'] = (bool)$o['dispute'];
            // 1 = abierta; 2 = el admin ya la atendió (shop-orders.php update).
            $out['dispute_open'] = (int)$o['dispute'] === 1;
            $out['golden_ticket'] = (bool)$o['golden_ticket'];
            $out['privy_id'] = $o['privy_id'];
            $out['stripe_session_id'] = $o['stripe_session_id'];
            $out['stripe_payment_intent'] = $o['stripe_payment_intent'];
            $out['payment_method'] = (string)($o['payment_method'] ?? '');
            $out['expires_at'] = $o['expires_at'];
            $out['updated_at'] = $o['updated_at'];
        }
        return $out;
    }

    /** Links de descarga de un pedido pagado (vista del cliente). */
    public static function publicDownloads(array $order): array
    {
        if (!in_array($order['status'], ['paid', 'preparing', 'shipped', 'delivered'], true)) return [];
        return array_map(fn($d) => [
            'name' => $d['file_name'],
            'url' => self::siteUrl('/api/shop-download.php?t=' . $d['token']),
            'downloads' => (int)$d['downloads'],
            'max_downloads' => (int)$d['max_downloads'],
            'expires_at' => $d['expires_at'],
        ], self::orderDownloads((int)$order['id']));
    }

    /**
     * Pago confirmado. Idempotente: si el pedido ya estaba pagado no hace nada
     * (Stripe puede reenviar el mismo evento, y completed + async_succeeded
     * pueden llegar los dos).
     *
     * Descuenta stock, quema el golden ticket, emite los links de descarga y
     * manda los correos. Un pedido solo-digital queda `delivered` de una vez:
     * no hay nada que empacar.
     */
    public static function markPaid(int $orderId): bool
    {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            $order = Database::fetchOne('SELECT * FROM shop_orders WHERE id = ? FOR UPDATE', [$orderId]);
            if (!$order || !in_array($order['status'], array_merge(SHOP_HOLDING_STATUSES, ['expired', 'cancelled']), true)) {
                $pdo->commit();
                return false;
            }

            $items = self::orderItems($orderId);
            foreach ($items as $it) {
                if ($it['variant_id'] === null) continue;
                Database::query(
                    'UPDATE shop_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ? AND stock IS NOT NULL',
                    [(int)$it['qty'], (int)$it['variant_id']]
                );
            }

            $now = self::now();
            $digitalOnly = !(int)$order['has_physical'];
            Database::update('shop_orders', [
                'status' => $digitalOnly ? 'delivered' : 'paid',
                'paid_at' => $now,
                'delivered_at' => $digitalOnly ? $now : null,
                'expires_at' => null,
            ], 'id = ?', [$orderId]);

            if ((int)$order['golden_ticket'] === 1 && $order['profile_id'] !== null) {
                Database::update('user_profiles', ['ticket_burned' => 1], 'id = ?', [(int)$order['profile_id']]);
            }

            if ((int)$order['has_digital'] === 1) {
                self::issueDownloads($order, $items);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        require_once __DIR__ . '/shop-mailer.php';
        $fresh = self::orderById($orderId);
        if ($fresh) {
            ShopMailer::orderConfirmation($fresh);
            ShopMailer::adminNewOrder($fresh);
        }
        return true;
    }

    private static function issueDownloads(array $order, array $items): void
    {
        $days = max(1, (int)self::getSetting('download_days', '30'));
        $max = max(1, (int)self::getSetting('download_max', '5'));
        $expires = self::at($days * 86400);
        $seenProducts = [];
        foreach ($items as $it) {
            if ($it['kind'] !== 'digital' || $it['product_id'] === null) continue;
            $pid = (int)$it['product_id'];
            if (isset($seenProducts[$pid])) continue;
            $seenProducts[$pid] = true;
            $product = Database::fetchOne('SELECT digital_files FROM shop_products WHERE id = ?', [$pid]);
            foreach (self::jsonDecode($product['digital_files'] ?? null) as $file) {
                if (empty($file['key'])) continue;
                Database::insert('shop_downloads', [
                    'order_id' => (int)$order['id'],
                    'product_id' => $pid,
                    'file_key' => (string)$file['key'],
                    'file_name' => (string)($file['name'] ?? $file['key']),
                    'token' => self::token(),
                    'max_downloads' => $max,
                    'expires_at' => $expires,
                ]);
            }
        }
    }

    /** Libera el apartado de un pedido que no se pagó. */
    public static function release(int $orderId, string $status = 'expired'): void
    {
        $holding = implode(',', array_fill(0, count(SHOP_HOLDING_STATUSES), '?'));
        Database::query(
            "UPDATE shop_orders SET status = ?, expires_at = NULL WHERE id = ? AND status IN ({$holding})",
            array_merge([$status, $orderId], SHOP_HOLDING_STATUSES)
        );
    }

    /**
     * Cierra en Stripe un checkout que sigue abierto y libera su apartado.
     * Si Stripe ya lo dio por completado no se toca: el webhook manda.
     */
    public static function closePending(array $order, string $status = 'expired'): bool
    {
        if ($order['status'] !== 'pending') return false;
        if (!empty($order['stripe_session_id'])) {
            $r = StripeApi::expireCheckoutSession($order['stripe_session_id']);
            if (!$r['ok']) {
                $s = StripeApi::retrieveCheckoutSession($order['stripe_session_id']);
                if (($s['data']['status'] ?? '') === 'complete') return false;
            }
        }
        self::release((int)$order['id'], $status);
        return true;
    }

    /** Devuelve al estante las unidades de un pedido pagado (reembolso + restock). */
    public static function restock(int $orderId): void
    {
        foreach (self::orderItems($orderId) as $it) {
            if ($it['variant_id'] === null || $it['kind'] === 'digital') continue;
            Database::query(
                'UPDATE shop_variants SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL',
                [(int)$it['qty'], (int)$it['variant_id']]
            );
        }
    }

    /**
     * Archivos digitales: fuera del document root si se puede (en Hostinger,
     * junto a public_html). Si el hosting no deja escribir ahí, cae a una
     * carpeta dentro de /api con .htaccess que niega todo.
     */
    public static function privateDir(): string
    {
        $c = Middleware::getConfig();
        $candidates = [];
        if (!empty($c['SHOP_PRIVATE_DIR'])) $candidates[] = (string)$c['SHOP_PRIVATE_DIR'];
        $candidates[] = dirname(__DIR__, 2) . '/shop-private';
        $candidates[] = __DIR__ . '/shop-private';

        foreach ($candidates as $dir) {
            if (!is_dir($dir)) @mkdir($dir, 0750, true);
            if (is_dir($dir) && is_writable($dir)) {
                if (str_starts_with(realpath($dir) ?: $dir, realpath(__DIR__) ?: __DIR__)) {
                    $ht = $dir . '/.htaccess';
                    if (!is_file($ht)) @file_put_contents($ht, "Require all denied\n");
                }
                return rtrim($dir, '/\\');
            }
        }
        throw new \RuntimeException('private_dir_unavailable');
    }

    public static function privateFilePath(string $key): ?string
    {
        if (!preg_match('/^[a-zA-Z0-9._-]+$/', $key)) return null;
        $path = self::privateDir() . '/' . $key;
        return is_file($path) ? $path : null;
    }
}
