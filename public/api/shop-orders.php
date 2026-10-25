<?php
/**
 * Pedidos — vista del cliente y gestión desde el CMS.
 *
 * Público (sin sesión):
 *   GET  ?action=view&t=TOKEN          Estado del pedido (link del correo / regreso de Stripe)
 *   POST ?action=cancel_checkout {t}   El cliente regresó de Stripe sin pagar: libera el apartado
 *   GET  ?action=mine                  Resumen de pedidos de la cuenta (header X-Privy-Token)
 *
 * Admin (requireAuth):
 *   GET  ?action=list[&status=a,b][&q=][&page=]
 *   GET  ?action=detail&id=X
 *   GET  ?action=stats
 *   GET  ?action=attention[&since=]    Lo que le toca al admin (esferita de Pedidos en el CMS)
 *   GET  ?action=export                CSV para contabilidad
 *   POST ?action=update   {id, status?, carrier?, tracking_number?, tracking_url?, notes?, notify?, dispute_handled?}
 *   POST ?action=refund   {id, amount?, restock?}
 *   POST ?action=cancel   {id}         Pedido sin pagar (checkout abierto o ficha OXXO)
 *   POST ?action=resend   {id, type: confirmation|shipped}
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/shop-mailer.php';

Middleware::cors();
Middleware::noCache();
Shop::ensureSchema();

require_once __DIR__ . '/mcp-auth.php';

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'export' && $method === 'GET') {
    Middleware::requireAuth();
    handleExport();
}

Middleware::json();

switch ("{$method} {$action}") {
    case 'GET view':
        handleView();
        break;
    case 'POST cancel_checkout':
        handleCancelCheckout();
        break;
    case 'GET mine':
        handleMine();
        break;
    case 'GET list':
        McpAuth::requireAdminOrToken('shop-orders:GET list');
        handleList();
        break;
    case 'GET detail':
        McpAuth::requireAdminOrToken('shop-orders:GET detail');
        handleDetail();
        break;
    case 'GET stats':
        McpAuth::requireAdminOrToken('shop-orders:GET stats');
        handleStats();
        break;
    case 'GET attention':
        McpAuth::requireAdminOrToken('shop-orders:GET attention');
        handleAttention();
        break;
    case 'POST update':
        McpAuth::requireAdminOrToken('shop-orders:POST update');
        handleUpdate();
        break;
    case 'POST refund':
        Middleware::requireAuth();
        handleRefund();
        break;
    case 'POST cancel':
        Middleware::requireAuth();
        handleCancel();
        break;
    case 'POST resend':
        Middleware::requireAuth();
        handleResend();
        break;
    default:
        Middleware::error('unknown_action', 400);
}

// ═══════════════════════════════════════════════════════════════
// PÚBLICO
// ═══════════════════════════════════════════════════════════════

function publicView(array $order): array
{
    $view = Shop::formatOrder($order, false, true);
    $view['downloads'] = Shop::publicDownloads($order);
    return $view;
}

function handleView(): void
{
    if (!Middleware::rateLimit('shop_order_view', 60, 60)) Middleware::error('rate_limited', 429);
    $order = Shop::orderByToken((string)($_GET['t'] ?? ''));
    if (!$order) Middleware::error('not_found', 404);
    Middleware::success(['order' => publicView($order)]);
}

function handleCancelCheckout(): void
{
    if (!Middleware::rateLimit('shop_cancel_checkout', 20, 60)) Middleware::error('rate_limited', 429);
    $data = Middleware::getJsonBody();
    $order = Shop::orderByToken((string)($data['t'] ?? ''));
    if (!$order) Middleware::error('not_found', 404);
    Shop::closePending($order);
    Middleware::success(['order' => publicView(Shop::orderById((int)$order['id']))]);
}

/**
 * Pedidos de la cuenta para la pestaña PEDIDOS de "Mi cuenta". La identidad
 * sale del token de Privy verificado, y solo cuentan los pedidos hechos con
 * esa cuenta: casar por email permitiría ver pedidos ajenos cambiando el
 * email del perfil. Devuelve resumen: sin dirección, sin teléfono, sin token.
 */
function handleMine(): void
{
    if (!Middleware::rateLimit('shop_orders_mine', 30, 60)) Middleware::error('rate_limited', 429);
    require_once __DIR__ . '/privy-auth.php';
    $privyId = PrivyAuth::requirePrivyId();

    $rows = Database::fetchAll(
        "SELECT * FROM shop_orders
         WHERE privy_id = ? AND status NOT IN ('pending','expired')
         ORDER BY created_at DESC LIMIT 30",
        [$privyId]
    );
    $orders = array_map(function ($o) {
        $f = Shop::formatOrder($o, false, true);
        return [
            'number' => $f['number'],
            'status' => $f['status'],
            'created_at' => $f['created_at'],
            'total' => $f['total'],
            'currency' => $f['currency'],
            'carrier' => $f['carrier'],
            'tracking_number' => $f['tracking_number'],
            'tracking_url' => $f['tracking_url'],
            'items' => array_map(fn($i) => [
                'title' => $i['title'],
                'options' => $i['options'],
                'qty' => $i['qty'],
            ], $f['items']),
        ];
    }, $rows);
    Middleware::success(['orders' => $orders]);
}

// ═══════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════

function handleList(): void
{
    $where = [];
    $params = [];

    $statusParam = trim((string)($_GET['status'] ?? ''));
    if ($statusParam !== '') {
        $statuses = array_values(array_intersect(explode(',', $statusParam), SHOP_ORDER_STATUSES));
        if ($statuses) {
            $where[] = 'status IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
            $params = array_merge($params, $statuses);
        }
    } elseif (($_GET['all'] ?? '') !== '1') {
        // Por default no mostramos checkouts abandonados: son ruido.
        $where[] = "status NOT IN ('pending','expired')";
    }

    $q = trim((string)($_GET['q'] ?? ''));
    if ($q !== '') {
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
        $where[] = '(order_number LIKE ? OR email LIKE ? OR customer_name LIKE ? OR shipping_name LIKE ? OR tracking_number LIKE ?)';
        array_push($params, $like, $like, $like, $like, $like);
    }

    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 50;
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $total = (int)(Database::fetchOne("SELECT COUNT(*) AS c FROM shop_orders {$whereSql}", $params)['c'] ?? 0);
    $rows = Database::fetchAll(
        "SELECT * FROM shop_orders {$whereSql} ORDER BY created_at DESC, id DESC LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage),
        $params
    );

    $counts = [];
    foreach (Database::fetchAll('SELECT status, COUNT(*) AS c FROM shop_orders GROUP BY status') as $r) {
        $counts[$r['status']] = (int)$r['c'];
    }

    Middleware::success([
        'orders' => array_map(function ($o) {
            $f = Shop::formatOrder($o, true, true);
            $f['item_count'] = array_sum(array_map(fn($i) => $i['qty'], $f['items']));
            return $f;
        }, $rows),
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'counts' => $counts,
    ]);
}

function adminOrderPayload(array $order): array
{
    $f = Shop::formatOrder($order, true, true);
    $f['downloads'] = array_map(fn($d) => [
        'id' => (int)$d['id'],
        'name' => $d['file_name'],
        'downloads' => (int)$d['downloads'],
        'max_downloads' => (int)$d['max_downloads'],
        'expires_at' => $d['expires_at'],
        'url' => Shop::siteUrl('/api/shop-download.php?t=' . $d['token']),
    ], Shop::orderDownloads((int)$order['id']));
    $f['public_url'] = Shop::orderUrl($order['token']);
    $f['stripe_url'] = $order['stripe_payment_intent']
        ? StripeApi::dashboardUrl('payments/' . $order['stripe_payment_intent'])
        : null;
    return $f;
}

function handleDetail(): void
{
    $order = Shop::orderById((int)($_GET['id'] ?? 0));
    if (!$order) Middleware::error('not_found', 404);
    Middleware::success(['order' => adminOrderPayload($order)]);
}

/** Números para la cabecera del panel: ventas del mes por moneda y pendientes. */
function handleStats(): void
{
    $paid = "status IN ('paid','preparing','shipped','delivered','refunded')";
    $monthStart = date('Y-m-01 00:00:00');
    $sales = [];
    foreach (Database::fetchAll(
        "SELECT currency, COUNT(*) AS orders, SUM(total - refunded) AS net
         FROM shop_orders WHERE {$paid} AND paid_at >= ? GROUP BY currency",
        [$monthStart]
    ) as $r) {
        $sales[] = ['currency' => $r['currency'], 'orders' => (int)$r['orders'], 'net' => Shop::money($r['net'])];
    }
    $toShip = (int)(Database::fetchOne(
        "SELECT COUNT(*) AS c FROM shop_orders WHERE status IN ('paid','preparing') AND has_physical = 1"
    )['c'] ?? 0);
    $awaiting = (int)(Database::fetchOne(
        "SELECT COUNT(*) AS c FROM shop_orders WHERE status = 'awaiting_payment'"
    )['c'] ?? 0);
    $disputes = (int)(Database::fetchOne('SELECT COUNT(*) AS c FROM shop_orders WHERE dispute = 1')['c'] ?? 0);

    Middleware::success([
        'month_sales' => $sales,
        'to_ship' => $toShip,
        'awaiting_payment' => $awaiting,
        'disputes' => $disputes,
        'stripe' => [
            'configured' => StripeApi::isConfigured(),
            'test_mode' => StripeApi::isTestMode(),
            'webhook_secret' => StripeApi::hasWebhookSecret(),
        ],
    ]);
}

/**
 * Lo que le toca al admin, para la esferita de "Pedidos" en el CMS. Cada
 * pedido cuenta una sola vez aunque caiga en varias cosas: por enviar
 * (pagado con algo físico), disputa abierta, o pagado después de `since` (la
 * última vez que abrió Pedidos). `since` es el `now` que devolvió esta misma
 * acción, así la comparación es siempre en la hora del servidor. Sin `since`
 * (primera vez en ese navegador) no hay "nuevos": todo lo viejo lo sería.
 */
function handleAttention(): void
{
    $toShip = "(status IN ('paid','preparing') AND has_physical = 1)";
    $dispute = '(dispute = 1)';
    $fresh = "(paid_at > ? AND status IN ('paid','preparing','shipped','delivered'))";
    $since = trim((string)($_GET['since'] ?? ''));
    $hasSince = (bool)preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $since);

    $count = fn(string $where, array $params = []): int =>
        (int)(Database::fetchOne("SELECT COUNT(*) AS c FROM shop_orders WHERE {$where}", $params)['c'] ?? 0);

    Middleware::success([
        'count' => $hasSince ? $count("{$toShip} OR {$dispute} OR {$fresh}", [$since]) : $count("{$toShip} OR {$dispute}"),
        'to_ship' => $count($toShip),
        'disputes' => $count($dispute),
        'new' => $hasSince ? $count($fresh, [$since]) : 0,
        'now' => Shop::now(),
    ]);
}

function handleUpdate(): void
{
    $data = Middleware::getJsonBody();
    $order = Shop::orderById((int)($data['id'] ?? 0));
    if (!$order) Middleware::error('not_found', 404);

    $updates = [];
    foreach (['carrier' => 60, 'tracking_number' => 120, 'tracking_url' => 512] as $field => $max) {
        if (array_key_exists($field, $data)) $updates[$field] = mb_substr(trim((string)$data[$field]), 0, $max);
    }
    if (array_key_exists('notes', $data)) $updates['notes'] = (string)$data['notes'];

    // Disputa: 1 = abierta (la pone el webhook), 2 = el admin ya la atendió.
    // Queda constancia de que hubo una; solo deja de pedir atención. Una
    // disputa nueva sobre el mismo pago la vuelve a abrir (webhook).
    if (array_key_exists('dispute_handled', $data) && (int)$order['dispute'] > 0) {
        $updates['dispute'] = $data['dispute_handled'] ? 2 : 1;
    }

    $becameShipped = false;
    if (array_key_exists('status', $data)) {
        $status = (string)$data['status'];
        // Desde el CMS solo se mueve la parte logística. Pagos, expiraciones y
        // reembolsos los decide Stripe (webhook) o las acciones dedicadas.
        $manual = ['paid', 'preparing', 'shipped', 'delivered'];
        if (!in_array($status, $manual, true)) Middleware::error('invalid_status');
        if (!in_array($order['status'], $manual, true)) Middleware::error('order_not_paid', 409);
        if ($status !== $order['status']) {
            $updates['status'] = $status;
            if ($status === 'shipped') {
                $updates['shipped_at'] = $order['shipped_at'] ?: Shop::now();
                $becameShipped = true;
            }
            if ($status === 'delivered') $updates['delivered_at'] = $order['delivered_at'] ?: Shop::now();
        }
    }

    if ($updates) Database::update('shop_orders', $updates, 'id = ?', [(int)$order['id']]);
    $fresh = Shop::orderById((int)$order['id']);

    $notified = false;
    if ($becameShipped && !empty($data['notify'])) {
        $notified = ShopMailer::orderShipped($fresh);
    }
    Middleware::success(['order' => adminOrderPayload($fresh), 'notified' => $notified]);
}

function handleRefund(): void
{
    $data = Middleware::getJsonBody();
    $order = Shop::orderById((int)($data['id'] ?? 0));
    if (!$order) Middleware::error('not_found', 404);
    if (empty($order['stripe_payment_intent'])) Middleware::error('no_payment', 409);
    // Stripe no reembolsa pagos OXXO (efectivo): se devuelve por fuera.
    if (($order['payment_method'] ?? '') === 'oxxo') Middleware::error('oxxo_not_refundable', 409);

    $totalCents = Shop::cents($order['total']);
    $refundedCents = Shop::cents($order['refunded']);
    $remaining = $totalCents - $refundedCents;
    if ($remaining <= 0) Middleware::error('already_refunded', 409);

    $amountCents = isset($data['amount']) && $data['amount'] !== '' && $data['amount'] !== null
        ? Shop::cents($data['amount'])
        : $remaining;
    if ($amountCents <= 0 || $amountCents > $remaining) Middleware::error('invalid_amount');

    $res = StripeApi::createRefund(
        $order['stripe_payment_intent'],
        $amountCents === $remaining && $refundedCents === 0 ? null : $amountCents,
        "refund_{$order['id']}_{$refundedCents}_{$amountCents}"
    );
    if (!$res['ok']) Middleware::error('stripe_error', 502, ['detail' => $res['error']]);

    $newRefunded = ($refundedCents + $amountCents) / 100;
    $updates = ['refunded' => $newRefunded];
    $full = ($refundedCents + $amountCents) >= $totalCents;
    if ($full) $updates['status'] = 'refunded';

    $note = '[' . Shop::now() . '] Reembolso ' . ShopMailer::fmt($amountCents / 100, $order['currency']);
    if (!empty($data['restock'])) {
        Shop::restock((int)$order['id']);
        $note .= ' + piezas devueltas al stock';
    }
    // La página de ayuda promete que un pedido cancelado o reembolsado completo
    // le regresa el ticket a la cuenta (Silver o Golden). Solo se "des-quema":
    // si la cuenta ya ganó otro ticket después, se queda con ese.
    if ($full && (int)$order['golden_ticket'] === 1 && $order['profile_id'] !== null) {
        $restored = Database::query(
            'UPDATE user_profiles SET ticket_burned = 0 WHERE id = ? AND golden_ticket = 1 AND ticket_burned = 1',
            [(int)$order['profile_id']]
        )->rowCount();
        if ($restored) $note .= ' + ticket devuelto a la cuenta';
    }
    $updates['notes'] = trim((string)$order['notes'] . "\n" . $note);
    Database::update('shop_orders', $updates, 'id = ?', [(int)$order['id']]);

    Middleware::success(['order' => adminOrderPayload(Shop::orderById((int)$order['id']))]);
}

function handleCancel(): void
{
    $data = Middleware::getJsonBody();
    $order = Shop::orderById((int)($data['id'] ?? 0));
    if (!$order) Middleware::error('not_found', 404);

    if ($order['status'] === 'pending') {
        Shop::closePending($order, 'cancelled');
    } elseif ($order['status'] === 'awaiting_payment') {
        // Ficha OXXO sin pagar: se cancela el PaymentIntent para que ya no se
        // pueda pagar, y se libera el apartado.
        if (!empty($order['stripe_payment_intent'])) {
            $r = StripeApi::request('POST', 'payment_intents/' . rawurlencode($order['stripe_payment_intent']) . '/cancel');
            if (!$r['ok']) Middleware::error('stripe_error', 502, ['detail' => $r['error']]);
        }
        Shop::release((int)$order['id'], 'cancelled');
    } else {
        Middleware::error('not_cancellable', 409);
    }
    Middleware::success(['order' => adminOrderPayload(Shop::orderById((int)$order['id']))]);
}

function handleResend(): void
{
    $data = Middleware::getJsonBody();
    $order = Shop::orderById((int)($data['id'] ?? 0));
    if (!$order) Middleware::error('not_found', 404);
    $type = (string)($data['type'] ?? 'confirmation');
    $sent = $type === 'shipped'
        ? ShopMailer::orderShipped($order)
        : ShopMailer::orderConfirmation($order);
    Middleware::success(['sent' => $sent]);
}

function handleExport(): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pedidos-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM para que Excel lea los acentos
    fputcsv($out, [
        'pedido', 'fecha_pago', 'estado', 'moneda', 'subtotal', 'descuento', 'envio', 'total', 'reembolsado',
        'cliente', 'email', 'telefono', 'pais', 'productos', 'paqueteria', 'guia', 'stripe_payment_intent',
    ]);
    $rows = Database::fetchAll(
        "SELECT * FROM shop_orders WHERE status NOT IN ('pending','expired','cancelled') ORDER BY created_at ASC"
    );
    foreach ($rows as $o) {
        $items = Shop::orderItems((int)$o['id']);
        $addr = Shop::jsonDecode($o['shipping_address'], []);
        fputcsv($out, [
            $o['order_number'],
            $o['paid_at'],
            $o['status'],
            $o['currency'],
            $o['subtotal'],
            $o['discount'],
            $o['shipping'],
            $o['total'],
            $o['refunded'],
            $o['customer_name'],
            $o['email'],
            $o['phone'],
            $addr['country'] ?? '',
            implode(' | ', array_map(fn($i) => $i['qty'] . 'x ' . $i['title'] . ($i['options_label'] ? " ({$i['options_label']})" : ''), $items)),
            $o['carrier'],
            $o['tracking_number'],
            $o['stripe_payment_intent'],
        ]);
    }
    fclose($out);
    exit;
}
