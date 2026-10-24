<?php
/**
 * Códigos de descuento — los de verdad, los de Stripe.
 *
 * El CMS tenía una sección de Codes sobre la tabla local `cheat_codes`, cuyo
 * frontend se quitó en abril de 2026: enseñaba códigos que ya no descontaban
 * nada. Los que sí descuentan son los promotion codes de Stripe, y hasta hoy
 * solo se podían ver en su Dashboard.
 *
 * Este archivo los expone para los dos consumidores: el CMS con su sesión de
 * Google y el MCP con su token. Lo demás de la tienda (productos, zonas,
 * pedidos) ya lo resuelven shop-admin.php y shop-orders.php.
 *
 * LA FRONTERA, que es el punto de este archivo:
 *
 *   Este archivo toca EXCLUSIVAMENTE /v1/coupons y /v1/promotion_codes.
 *   No hay una sola llamada a payment_intents, charges, refunds, payouts,
 *   balance ni transfers, y no debe haberla nunca. Crear un cupón cambia lo
 *   que un cliente va a pagar en su próxima compra; no mueve un peso que ya
 *   esté en la cuenta. Mover fondos lo hace Oscar, a mano, en el Dashboard.
 *
 * Tampoco se borra: desactivar un código lo deja inservible pero conserva el
 * historial de quién lo usó. Borrarlo se lleva esa historia.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';
require_once __DIR__ . '/stripe.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

/**
 * La cuenta corre una versión de API donde /v1/promotion_codes ya no acepta
 * `coupon` (responde "Received unknown parameter: coupon"); pide un objeto
 * `promotion` que su /v1/promotions ni siquiera expone todavía. Con una
 * versión anterior fijada el flujo clásico cupón → código funciona igual.
 *
 * Se fija SOLO aquí, no en la config global, para no mover la versión que usa
 * el checkout, que hoy cobra bien.
 */
const SHOP_COUPONS_API_VERSION = '2024-06-20';

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

// Leer cupones también pide escritura: un listado de descuentos activos es
// información comercial, no catálogo público.
McpAuth::requireAdminOrToken("shop-coupons:{$method} {$action}");

if (!StripeApi::isConfigured()) {
    Middleware::error('stripe_not_configured', 503);
}

/** Lanza si la respuesta de Stripe no vino bien. */
function stripeOk(array $r, string $what): array
{
    if (!($r['ok'] ?? false)) {
        McpAuth::log('stripe_error', ['what' => $what, 'detail' => $r['error'] ?? null]);
        Middleware::error('stripe_error', 502, ['detail' => $r['error'] ?? 'desconocido']);
    }
    return $r['data'] ?? [];
}

try {
    switch ("{$method} {$action}") {

        case 'GET coupons.list': {
            $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
            $data = stripeOk(
                StripeApi::request('GET', 'promotion_codes', [
                    'limit' => $limit,
                    'expand' => ['data.coupon'],
                ], null, SHOP_COUPONS_API_VERSION),
                'promotion_codes.list'
            );

            $out = array_map(function (array $pc): array {
                $c = $pc['coupon'] ?? [];
                return [
                    'id' => $pc['id'] ?? null,
                    'code' => $pc['code'] ?? null,
                    'active' => (bool) ($pc['active'] ?? false),
                    'discount' => isset($c['percent_off']) && $c['percent_off'] !== null
                        ? $c['percent_off'] . '%'
                        : (isset($c['amount_off']) ? ($c['amount_off'] / 100) . ' ' . strtoupper((string) ($c['currency'] ?? '')) : null),
                    'times_redeemed' => $pc['times_redeemed'] ?? 0,
                    'max_redemptions' => $pc['max_redemptions'] ?? null,
                    'expires_at' => !empty($pc['expires_at']) ? date('c', (int) $pc['expires_at']) : null,
                    'created_at' => !empty($pc['created']) ? date('c', (int) $pc['created']) : null,
                ];
            }, $data['data'] ?? []);

            Middleware::success([
                'coupons' => $out,
                'count' => count($out),
                'test_mode' => StripeApi::isTestMode(),
            ]);
            break;
        }

        case 'POST coupon.create': {
            $b = Middleware::getJsonBody();

            $code = strtoupper(trim((string) ($b['code'] ?? '')));
            if ($code === '' || !preg_match('/^[A-Z0-9_-]{3,40}$/', $code)) {
                Middleware::error('invalid_code', 400, [
                    'detail' => 'De 3 a 40 caracteres: letras, números, guion y guion bajo.',
                ]);
            }

            $percent = isset($b['percent_off']) ? (float) $b['percent_off'] : null;
            $amount = isset($b['amount_off']) ? (float) $b['amount_off'] : null;
            $currency = strtolower(trim((string) ($b['currency'] ?? '')));

            $couponParams = ['duration' => 'once', 'name' => $code];
            if ($percent !== null) {
                if ($percent <= 0 || $percent > 100)
                    Middleware::error('invalid_percent', 400, ['detail' => 'Entre 1 y 100.']);
                $couponParams['percent_off'] = $percent;
            }
            elseif ($amount !== null) {
                if ($amount <= 0)
                    Middleware::error('invalid_amount', 400);
                if (!in_array($currency, ['mxn', 'usd'], true))
                    Middleware::error('invalid_currency', 400, ['detail' => 'mxn o usd.']);
                $couponParams['amount_off'] = (int) round($amount * 100);
                $couponParams['currency'] = $currency;
            }
            else {
                Middleware::error('missing_discount', 400, ['detail' => 'Falta percent_off o amount_off.']);
            }

            $coupon = stripeOk(
                StripeApi::request('POST', 'coupons', $couponParams, 'mcp_coupon_' . $code, SHOP_COUPONS_API_VERSION),
                'coupon.create'
            );

            $pcParams = ['coupon' => $coupon['id'], 'code' => $code];
            if (!empty($b['max_redemptions'])) {
                $pcParams['max_redemptions'] = max(1, (int) $b['max_redemptions']);
            }
            if (!empty($b['expires_at'])) {
                $ts = strtotime((string) $b['expires_at']);
                if ($ts === false || $ts <= time())
                    Middleware::error('invalid_expiry', 400, ['detail' => 'Fecha futura, p. ej. 2026-12-31.']);
                $pcParams['expires_at'] = $ts;
            }

            $pc = stripeOk(
                StripeApi::request('POST', 'promotion_codes', $pcParams, 'mcp_pc_' . $code, SHOP_COUPONS_API_VERSION),
                'promotion_code.create'
            );

            McpAuth::log('coupon.create', [
                'code' => $code,
                'percent_off' => $percent,
                'amount_off' => $amount,
                'currency' => $currency ?: null,
                'promotion_code_id' => $pc['id'] ?? null,
                'test_mode' => StripeApi::isTestMode(),
            ]);

            Middleware::success(['coupon' => [
                'id' => $pc['id'] ?? null,
                'code' => $code,
                'discount' => $percent !== null ? $percent . '%' : $amount . ' ' . strtoupper($currency),
                'max_redemptions' => $pcParams['max_redemptions'] ?? null,
                'expires_at' => isset($pcParams['expires_at']) ? date('c', $pcParams['expires_at']) : null,
                'test_mode' => StripeApi::isTestMode(),
                'note' => 'El comprador lo escribe en el checkout de Stripe.',
            ]]);
            break;
        }

        case 'POST coupon.deactivate': {
            $b = Middleware::getJsonBody();
            $id = trim((string) ($b['id'] ?? ''));
            if ($id === '' || strpos($id, 'promo_') !== 0) {
                Middleware::error('invalid_id', 400, [
                    'detail' => 'Se espera el id del promotion code (promo_…), no el texto del código.',
                ]);
            }

            $pc = stripeOk(
                StripeApi::request('POST', 'promotion_codes/' . rawurlencode($id), ['active' => 'false'], null, SHOP_COUPONS_API_VERSION),
                'promotion_code.deactivate'
            );

            McpAuth::log('coupon.deactivate', ['id' => $id, 'code' => $pc['code'] ?? null]);

            Middleware::success(['coupon' => [
                'id' => $pc['id'] ?? $id,
                'code' => $pc['code'] ?? null,
                'active' => (bool) ($pc['active'] ?? false),
                'note' => 'Desactivado, no borrado: el historial de usos se conserva.',
            ]]);
            break;
        }

        default:
            Middleware::error('unknown_action', 400, ['action' => "{$method} {$action}"]);
    }
}
catch (Throwable $e) {
    McpAuth::log('error', ['action' => $action, 'message' => $e->getMessage()]);
    Middleware::error('server_error', 500);
}
