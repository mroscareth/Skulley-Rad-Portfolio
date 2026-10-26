<?php
/**
 * Crea el cobro en Stripe a partir del carrito.
 *
 *   POST /api/shop-checkout.php
 *   { items: [{variant_id, qty}], region: 'mx'|'us'|'latam', lang: 'es'|'en',
 *     use_golden_ticket?: bool, replace_token?: string }
 *   Header X-Privy-Token: identifica al comprador (golden ticket). Opcional,
 *   salvo que el carrito traiga algo digital (login_required).
 *   → { url, token }   (el frontend redirige a `url`)
 *
 * El navegador solo manda QUÉ quiere y CUÁNTO. Precio, moneda, stock,
 * descuento y envío salen de MySQL — nunca del cliente.
 *
 * Orden de operaciones:
 *   1. Transacción con las variantes bloqueadas (FOR UPDATE): valida stock
 *      contra lo apartado por otros pedidos y crea el pedido `pending`. Ese
 *      pedido ES el apartado: mientras viva, nadie más puede comprar esas
 *      unidades.
 *   2. Fuera de la transacción, crea la Checkout Session en Stripe.
 *   3. Si Stripe falla, el pedido se marca `expired` y el stock se libera.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Middleware::error('method_not_allowed', 405);
}
if (!Middleware::rateLimit('shop_checkout', 12, 60)) {
    Middleware::error('rate_limited', 429);
}

Shop::ensureSchema();

if (Shop::getSetting('checkout_enabled', '1') !== '1' || !StripeApi::isConfigured()) {
    Middleware::error('checkout_unavailable', 503);
}

$data = Middleware::getJsonBody();
$lang = ($data['lang'] ?? 'es') === 'en' ? 'en' : 'es';
$zone = Shop::zone((string)($data['region'] ?? ''));
if (!$zone) Middleware::error('invalid_region');
$currency = $zone['currency'];
$priceField = $currency === 'MXN' ? 'price_mxn' : 'price_usd';

// ── Carrito: agrupar por variante (dos líneas iguales = una con más qty) ──
$wanted = [];
foreach ((array)($data['items'] ?? []) as $it) {
    $vid = (int)($it['variant_id'] ?? 0);
    $qty = (int)($it['qty'] ?? 0);
    if ($vid <= 0 || $qty <= 0) continue;
    $wanted[$vid] = min(99, ($wanted[$vid] ?? 0) + $qty);
}
if (!$wanted || count($wanted) > 50) Middleware::error('empty_cart');

// ── Comprador (opcional): golden ticket + correo prellenado ──
// La identidad sale del token de Privy verificado, nunca de un privy_id en el
// body: si no, cualquiera podría gastar el golden ticket de otra cuenta.
require_once __DIR__ . '/privy-auth.php';
$privyId = PrivyAuth::privyIdFromRequest() ?? '';
$profile = $privyId !== ''
    ? Database::fetchOne('SELECT * FROM user_profiles WHERE privy_id = ?', [$privyId])
    : null;

// Si el mismo navegador vuelve a pagar sin haber cerrado el intento anterior
// (botón "atrás" en Stripe), ese intento todavía aparta las piezas. Lo
// cerramos antes de reservar de nuevo — si no, una pieza 1/1 se vería agotada
// por el propio comprador.
$replaceToken = (string)($data['replace_token'] ?? '');
if ($replaceToken !== '') {
    $prev = Shop::orderByToken($replaceToken);
    if ($prev) Shop::closePending($prev);
}

// El comprador puede guardar el ticket para otra compra (lo quita del carrito):
// solo se aplica si el frontend lo pide explícitamente. `use_golden_ticket` y
// `$useGolden` conservan el nombre de cuando solo existía el dorado: valen
// para el ticket que tenga la cuenta, Silver o Golden (game-tickets.php).
$useGolden = false;
$ticketTier = GameTickets::aliveTier($profile);
$ticketPct = GameTickets::pct($ticketTier);
$ticketLabel = GameTickets::label($ticketTier);
if (!empty($data['use_golden_ticket']) && $ticketTier !== null) {
    // Un solo uso: si el ticket ya va en otro checkout abierto, ese se cierra.
    // Si va en una ficha OXXO sin pagar, el ticket está comprometido y este
    // carrito va sin descuento.
    $open = Database::fetchAll(
        "SELECT * FROM shop_orders WHERE profile_id = ? AND golden_ticket = 1 AND status IN ('pending','awaiting_payment')",
        [(int)$profile['id']]
    );
    $committed = false;
    foreach ($open as $o) {
        if ($o['status'] === 'awaiting_payment') {
            $committed = true;
            continue;
        }
        // Si Stripe ya lo cobró (webhook en camino) el ticket está usado.
        if (!Shop::closePending($o)) $committed = true;
    }
    $useGolden = !$committed;
}

// ── 1. Validar y apartar ──
$pdo = Database::getInstance();
$pdo->beginTransaction();
try {
    $ids = array_keys($wanted);
    $in = implode(',', array_fill(0, count($ids), '?'));
    $rows = Database::fetchAll(
        "SELECT v.*, p.status AS p_status, p.kind, p.title_en, p.title_es, p.options AS p_options,
                p.images AS p_images, p.archive_id
         FROM shop_variants v
         JOIN shop_products p ON p.id = v.product_id
         WHERE v.id IN ({$in})
         FOR UPDATE",
        $ids
    );
    $byId = [];
    foreach ($rows as $r) $byId[(int)$r['id']] = $r;
    $reserved = Shop::reservedByVariant($ids);

    $problems = [];
    $lines = [];
    $subtotalCents = 0;
    $hasPhysical = false;
    $hasDigital = false;

    foreach ($wanted as $vid => $qty) {
        $v = $byId[$vid] ?? null;
        if (!$v || $v['p_status'] !== 'active') {
            $problems[] = ['variant_id' => $vid, 'reason' => 'not_found', 'available' => 0];
            continue;
        }
        $price = $v[$priceField];
        if ($price === null || (float)$price <= 0) {
            $problems[] = ['variant_id' => $vid, 'reason' => 'no_price', 'available' => 0];
            continue;
        }
        $stock = $v['stock'] !== null ? (int)$v['stock'] : null;
        $available = Shop::available($stock, $reserved[$vid] ?? 0);
        if ($available !== null && $available < $qty) {
            $problems[] = ['variant_id' => $vid, 'reason' => 'stock', 'available' => $available];
            continue;
        }

        $kind = $v['kind'] === 'digital' ? 'digital' : 'physical';
        $hasPhysical = $hasPhysical || $kind === 'physical';
        $hasDigital = $hasDigital || $kind === 'digital';

        $title = $lang === 'en' ? ($v['title_en'] ?: $v['title_es']) : ($v['title_es'] ?: $v['title_en']);
        $options = Shop::jsonDecode($v['p_options']);
        $optionValues = Shop::jsonDecode($v['option_values']);
        $images = Shop::jsonDecode($v['p_images']);
        $image = (string)($v['image_url'] ?: ($images[0]['url'] ?? ''));

        $unitCents = Shop::cents($price);
        $subtotalCents += $unitCents * $qty;
        $lines[] = [
            'variant_id' => $vid,
            'product_id' => (int)$v['product_id'],
            'kind' => $kind,
            'title' => $title,
            'options_label' => Shop::optionsLabel($options, $optionValues, $lang),
            'sku' => $v['sku'] ?: ($v['archive_id'] ?? ''),
            'image_url' => $image,
            'unit_cents' => $unitCents,
            'qty' => $qty,
        ];
    }

    if ($problems) {
        $pdo->rollBack();
        Middleware::error('items_unavailable', 409, ['items' => $problems]);
    }

    // Lo digital solo se compra con cuenta: los archivos solo los baja la
    // cuenta que compró (Mi cuenta → Descargas), así un enlace que circule no
    // le sirve a nadie (desde 2026-10-25).
    if ($hasDigital && !$profile) {
        $pdo->rollBack();
        Middleware::error('login_required', 401);
    }

    $discountCents = $useGolden ? (int)round($subtotalCents * $ticketPct / 100) : 0;
    $token = Shop::token();
    $orderId = Database::insert('shop_orders', [
        'token' => $token,
        'status' => 'pending',
        'currency' => $currency,
        'zone_code' => $zone['code'],
        'lang' => $lang,
        'subtotal' => $subtotalCents / 100,
        'discount' => $discountCents / 100,
        'total' => ($subtotalCents - $discountCents) / 100,
        'discount_label' => $useGolden ? $ticketLabel : '',
        'golden_ticket' => $useGolden ? 1 : 0,
        'has_physical' => $hasPhysical ? 1 : 0,
        'has_digital' => $hasDigital ? 1 : 0,
        'privy_id' => $profile ? $privyId : null,
        'profile_id' => $profile ? (int)$profile['id'] : null,
        'email' => (string)($profile['email'] ?? ''),
        'expires_at' => Shop::at(SHOP_HOLD_TTL),
    ]);
    $orderNumber = 'SR-' . (1000 + $orderId);
    Database::update('shop_orders', ['order_number' => $orderNumber], 'id = ?', [$orderId]);

    foreach ($lines as $l) {
        Database::insert('shop_order_items', [
            'order_id' => $orderId,
            'product_id' => $l['product_id'],
            'variant_id' => $l['variant_id'],
            'kind' => $l['kind'],
            'title' => mb_substr($l['title'], 0, 255),
            'options_label' => mb_substr($l['options_label'], 0, 255),
            'sku' => mb_substr((string)$l['sku'], 0, 64),
            'image_url' => mb_substr($l['image_url'], 0, 512),
            'unit_price' => $l['unit_cents'] / 100,
            'qty' => $l['qty'],
        ]);
    }
    $pdo->commit();
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[shop-checkout] reserve failed: ' . $e->getMessage());
    Middleware::error('checkout_failed', 500);
}

// ── 2. Checkout Session ──
$cur = strtolower($currency);
$lineItems = [];
foreach ($lines as $l) {
    $productData = ['name' => mb_substr($l['title'] !== '' ? $l['title'] : 'Skulley Rad', 0, 250)];
    if ($l['options_label'] !== '') $productData['description'] = $l['options_label'];
    $img = Shop::absoluteUrl($l['image_url']);
    if ($img) $productData['images'] = [$img];
    $productData['metadata'] = ['variant_id' => (string)$l['variant_id'], 'product_id' => (string)$l['product_id']];
    $lineItems[] = [
        'quantity' => $l['qty'],
        'price_data' => [
            'currency' => $cur,
            'unit_amount' => $l['unit_cents'],
            'product_data' => $productData,
        ],
    ];
}

$orderUrl = Shop::orderUrl($token);
$params = [
    'mode' => 'payment',
    'line_items' => $lineItems,
    'client_reference_id' => (string)$orderId,
    'metadata' => ['order_id' => (string)$orderId, 'order_number' => $orderNumber],
    'payment_intent_data' => [
        'description' => "Pedido {$orderNumber}",
        'metadata' => ['order_id' => (string)$orderId, 'order_number' => $orderNumber],
    ],
    'locale' => $lang === 'en' ? 'en' : 'es-419',
    'customer_creation' => 'always',
    'expires_at' => time() + SHOP_CHECKOUT_TTL,
    'success_url' => $orderUrl,
    'cancel_url' => $orderUrl . '&cancelado=1',
];
if (!empty($profile['email'])) $params['customer_email'] = $profile['email'];
// La ficha OXXO dura 5 días por default y el apartado solo SHOP_ASYNC_HOLD_TTL
// (4): con 3 días la ficha siempre vence antes de soltar las piezas.
if ($currency === 'MXN') {
    $params['payment_method_options'] = ['oxxo' => ['expires_after_days' => 3]];
}

if ($useGolden && StripeApi::ensureCoupon(GameTickets::couponId($ticketTier), $ticketPct, $ticketLabel)) {
    $params['discounts'] = [['coupon' => GameTickets::couponId($ticketTier)]];
} else {
    if ($useGolden) {
        // Sin cupón no hay descuento: el pedido no debe prometer uno.
        Database::update('shop_orders', ['golden_ticket' => 0, 'discount' => 0, 'discount_label' => '', 'total' => $subtotalCents / 100], 'id = ?', [$orderId]);
    }
    // Stripe no permite discounts y allow_promotion_codes en la misma sesión.
    if (Shop::getSetting('allow_promo_codes', '1') === '1') $params['allow_promotion_codes'] = true;
}

if ($hasPhysical) {
    $params['shipping_address_collection'] = ['allowed_countries' => $zone['countries']];
    $params['phone_number_collection'] = ['enabled' => true];
    $afterDiscount = ($subtotalCents - $discountCents) / 100;
    $freeApplies = $zone['free_over'] !== null && $zone['free_over'] > 0 && $afterDiscount >= $zone['free_over'];
    $options = [];
    foreach (array_slice($zone['rates'], 0, 5) as $i => $rate) {
        $free = $freeApplies && $i === 0;
        $name = $lang === 'en' ? ($rate['name_en'] ?: $rate['name_es']) : ($rate['name_es'] ?: $rate['name_en']);
        if ($free) $name .= $lang === 'en' ? ' (free)' : ' (gratis)';
        $rateData = [
            'type' => 'fixed_amount',
            'fixed_amount' => ['amount' => $free ? 0 : Shop::cents($rate['amount']), 'currency' => $cur],
            'display_name' => mb_substr($name !== '' ? $name : 'Envío', 0, 100),
        ];
        if ($rate['min_days'] && $rate['max_days']) {
            $rateData['delivery_estimate'] = [
                'minimum' => ['unit' => 'business_day', 'value' => $rate['min_days']],
                'maximum' => ['unit' => 'business_day', 'value' => $rate['max_days']],
            ];
        }
        $options[] = ['shipping_rate_data' => $rateData];
    }
    if ($options) $params['shipping_options'] = $options;
}

// La página de pago con la cara de la tienda (fondo #0a0510, acento magenta
// de DESIGN.md §14.3) en vez del azul genérico de Stripe.
$params['branding_settings'] = [
    'display_name' => 'Skulley Rad — Lost & Found',
    'background_color' => '#0a0510',
    'button_color' => '#e600ff',
    'border_style' => 'rounded',
];

$res = StripeApi::createCheckoutSession($params, 'checkout_' . $token);
if (!$res['ok'] && str_contains((string)$res['error'], 'branding_settings')) {
    // Cuenta con versión de API anterior al branding por sesión: se cobra
    // igual, con el branding del Dashboard.
    unset($params['branding_settings']);
    $res = StripeApi::createCheckoutSession($params, 'checkout_' . $token . '_nb');
}
if (!$res['ok'] || empty($res['data']['url'])) {
    Shop::release($orderId, 'expired');
    error_log('[shop-checkout] stripe failed: ' . ($res['error'] ?? 'unknown'));
    $debug = (Middleware::getConfig()['DEBUG'] ?? false) === true;
    Middleware::error('stripe_error', 502, $debug ? ['detail' => $res['error']] : []);
}

Database::update('shop_orders', ['stripe_session_id' => $res['data']['id']], 'id = ?', [$orderId]);

Middleware::success(['url' => $res['data']['url'], 'token' => $token]);
