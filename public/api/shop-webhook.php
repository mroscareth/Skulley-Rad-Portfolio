<?php
/**
 * Webhook de Stripe — la única fuente de verdad de que un pago entró.
 *
 *   POST /api/shop-webhook.php   (firmado con STRIPE_WEBHOOK_SECRET)
 *
 * Eventos que hay que activar en Stripe → Developers → Webhooks:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded
 *   checkout.session.async_payment_failed
 *   checkout.session.expired
 *   charge.refunded
 *   charge.dispute.created
 *
 * Idempotente: cada event.id se registra una vez en shop_stripe_events, y
 * Shop::markPaid() no hace nada si el pedido ya estaba pagado.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/shop-mailer.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$payload = (string)file_get_contents('php://input');
$event = StripeApi::verifyWebhook($payload, (string)($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''));
if (!$event) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_signature']);
    exit;
}

Shop::ensureSchema();

$eventId = (string)($event['id'] ?? '');
$type = (string)($event['type'] ?? '');
$object = $event['data']['object'] ?? [];

try {
    Database::insert('shop_stripe_events', ['event_id' => $eventId, 'type' => mb_substr($type, 0, 80)]);
} catch (\Throwable $e) {
    // Ya procesado (PK duplicada): Stripe reintentó. Respondemos 200.
    echo json_encode(['ok' => true, 'duplicate' => true]);
    exit;
}

try {
    switch ($type) {
        case 'checkout.session.completed':
            onSessionCompleted($object);
            break;
        case 'checkout.session.async_payment_succeeded':
            if ($order = orderForSession($object)) {
                Shop::markPaid((int)$order['id']);
            }
            break;
        case 'checkout.session.async_payment_failed':
            if ($order = orderForSession($object)) {
                Shop::release((int)$order['id'], 'cancelled');
            }
            break;
        case 'checkout.session.expired':
            if ($order = orderForSession($object)) {
                Shop::release((int)$order['id'], 'expired');
            }
            break;
        case 'charge.refunded':
            onChargeRefunded($object);
            break;
        case 'charge.dispute.created':
            onDispute($object);
            break;
    }
} catch (\Throwable $e) {
    // Liberamos el event_id para que el reintento de Stripe lo vuelva a procesar.
    Database::delete('shop_stripe_events', 'event_id = ?', [$eventId]);
    error_log("[shop-webhook] {$type} failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false]);
    exit;
}

echo json_encode(['ok' => true]);

// ═══════════════════════════════════════════════════════════════

function orderForSession(array $session): ?array
{
    $orderId = (int)($session['metadata']['order_id'] ?? $session['client_reference_id'] ?? 0);
    if ($orderId > 0) {
        $order = Shop::orderById($orderId);
        if ($order) return $order;
    }
    if (!empty($session['id'])) {
        return Database::fetchOne('SELECT * FROM shop_orders WHERE stripe_session_id = ?', [$session['id']]);
    }
    return null;
}

/**
 * Copia al pedido lo que Stripe capturó (contacto, dirección, envío elegido,
 * totales reales) y decide: pagado ya, o pago diferido (OXXO) en espera.
 */
function onSessionCompleted(array $session): void
{
    $order = orderForSession($session);
    if (!$order) return;

    // El evento trae la versión de API de la cuenta; pedimos la sesión con el
    // shipping_rate expandido (nombre del envío elegido) y el método de pago.
    $full = StripeApi::retrieveCheckoutSession(
        (string)$session['id'],
        ['shipping_cost.shipping_rate', 'payment_intent.payment_method']
    );
    if ($full['ok']) $session = $full['data'];

    $customer = $session['customer_details'] ?? [];
    // API ≥ 2025-03-31 movió shipping_details a collected_information.
    $shipping = $session['collected_information']['shipping_details'] ?? $session['shipping_details'] ?? null;
    $address = $shipping['address'] ?? null;
    $rate = $session['shipping_cost']['shipping_rate'] ?? null;
    $totals = $session['total_details'] ?? [];

    $updates = [
        'email' => mb_substr((string)($customer['email'] ?? $order['email']), 0, 255),
        'customer_name' => mb_substr((string)($customer['name'] ?? ''), 0, 200),
        'phone' => mb_substr((string)($customer['phone'] ?? ''), 0, 40),
        'stripe_payment_intent' => is_string($session['payment_intent'] ?? null) ? $session['payment_intent'] : ($session['payment_intent']['id'] ?? null),
        'subtotal' => ((int)($session['amount_subtotal'] ?? 0)) / 100,
        'discount' => ((int)($totals['amount_discount'] ?? 0)) / 100,
        'shipping' => ((int)($totals['amount_shipping'] ?? $session['shipping_cost']['amount_total'] ?? 0)) / 100,
        'total' => ((int)($session['amount_total'] ?? 0)) / 100,
    ];
    if ($address) {
        $updates['shipping_name'] = mb_substr((string)($shipping['name'] ?? ''), 0, 200);
        $updates['shipping_address'] = Shop::json([
            'line1' => (string)($address['line1'] ?? ''),
            'line2' => (string)($address['line2'] ?? ''),
            'city' => (string)($address['city'] ?? ''),
            'state' => (string)($address['state'] ?? ''),
            'postal_code' => (string)($address['postal_code'] ?? ''),
            'country' => (string)($address['country'] ?? ''),
        ]);
    }
    if (is_array($rate) && !empty($rate['display_name'])) {
        $updates['shipping_method'] = mb_substr((string)$rate['display_name'], 0, 160);
    }
    $pmType = $session['payment_intent']['payment_method']['type'] ?? null;
    if (is_string($pmType) && $pmType !== '') $updates['payment_method'] = mb_substr($pmType, 0, 32);
    // Un código promocional de Stripe (no el golden ticket) también se anota.
    if ((float)$updates['discount'] > 0 && !(int)$order['golden_ticket']) {
        $updates['discount_label'] = 'Código promocional';
    }

    $paymentStatus = (string)($session['payment_status'] ?? '');
    if ($paymentStatus === 'unpaid') {
        $updates['status'] = 'awaiting_payment';
        $updates['expires_at'] = Shop::at(SHOP_ASYNC_HOLD_TTL);
    }
    Database::update('shop_orders', $updates, 'id = ?', [(int)$order['id']]);

    if ($paymentStatus === 'paid' || $paymentStatus === 'no_payment_required') {
        if (in_array($order['status'], ['expired', 'cancelled'], true)) {
            // Cobro que llegó después de soltar el apartado: se honra, pero
            // alguien más pudo haber comprado la misma pieza. Que Oscar lo vea.
            $note = trim((string)$order['notes'] . "\n[" . Shop::now() . '] Pago recibido después de que el apartado venció — revisa que haya stock.');
            Database::update('shop_orders', ['notes' => $note], 'id = ?', [(int)$order['id']]);
        }
        Shop::markPaid((int)$order['id']);
    }
}

function onChargeRefunded(array $charge): void
{
    $pi = is_string($charge['payment_intent'] ?? null) ? $charge['payment_intent'] : null;
    if (!$pi) return;
    $order = Database::fetchOne('SELECT * FROM shop_orders WHERE stripe_payment_intent = ?', [$pi]);
    if (!$order) return;

    $refunded = ((int)($charge['amount_refunded'] ?? 0)) / 100;
    $updates = ['refunded' => $refunded];
    if (!empty($charge['refunded'])) $updates['status'] = 'refunded';
    Database::update('shop_orders', $updates, 'id = ?', [(int)$order['id']]);
}

function onDispute(array $dispute): void
{
    $pi = is_string($dispute['payment_intent'] ?? null) ? $dispute['payment_intent'] : null;
    if (!$pi) return;
    $order = Database::fetchOne('SELECT * FROM shop_orders WHERE stripe_payment_intent = ?', [$pi]);
    if (!$order) return;
    Database::update('shop_orders', ['dispute' => 1], 'id = ?', [(int)$order['id']]);
    ShopMailer::adminDispute($order, (string)($dispute['reason'] ?? 'unknown'));
}
