<?php
/**
 * Catálogo público de la tienda.
 *
 *   GET /api/shop.php  → productos activos, categorías, zonas de envío y si
 *                        el checkout está abierto.
 *
 * Una sola llamada trae los dos idiomas y las dos monedas: el frontend cambia
 * de idioma o de región sin volver a pedir nada.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Middleware::error('method_not_allowed', 405);
}

try {
    Shop::ensureSchema();
    $settings = Shop::settings();

    $zones = array_map(fn($z) => [
        'code' => $z['code'],
        'name_en' => $z['name_en'],
        'name_es' => $z['name_es'],
        'currency' => $z['currency'],
        'countries' => $z['countries'],
        'rates' => $z['rates'],
        'free_over' => $z['free_over'],
    ], Shop::zones(true));

    Middleware::success([
        'products' => Shop::products(true),
        'categories' => Shop::categories(),
        'regions' => $zones,
        'checkout_enabled' => $settings['checkout_enabled'] === '1' && StripeApi::isConfigured(),
        'golden_ticket_pct' => SHOP_GOLDEN_TICKET_PCT,
    ]);
} catch (\Throwable $e) {
    error_log('[shop] catalog failed: ' . $e->getMessage());
    Middleware::error('catalog_unavailable', 500);
}
