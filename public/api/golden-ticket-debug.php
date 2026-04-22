<?php
/**
 * Diagnóstico del flujo del golden ticket.
 * Uso: https://mroscar.xyz/api/golden-ticket-debug.php?pid=did:privy:XXXX
 *
 * Evalúa si:
 *   - El profile existe en DB
 *   - El estado del profile dispararía el backfill
 *   - Shopify está configurado
 *   - (opcional) fuerza un mint si ?force=1
 *
 * BORRAR DESPUÉS DE USAR.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/shopify.php';

Middleware::json();

$pid = trim($_GET['pid'] ?? '');
$force = ($_GET['force'] ?? '') === '1';

$out = [
    'timestamp' => date('Y-m-d H:i:s'),
    'pid' => $pid,
    'checks' => [],
];

if (!$pid) {
    $out['checks']['pid_provided'] = ['ok' => false, 'hint' => 'Agregá ?pid=did:privy:XXXX al URL.'];
    echo json_encode($out, JSON_PRETTY_PRINT); exit;
}

$profile = Database::fetchOne('SELECT * FROM user_profiles WHERE privy_id = ?', [$pid]);
if (!$profile) {
    $out['checks']['profile_exists'] = ['ok' => false, 'hint' => 'No hay row en user_profiles. El user no se logueó o hay mismatch de privy_id.'];
    echo json_encode($out, JSON_PRETTY_PRINT); exit;
}

$out['profile_snapshot'] = [
    'id'                          => (int)$profile['id'],
    'email'                       => $profile['email'],
    'golden_ticket'               => (int)($profile['golden_ticket'] ?? 0),
    'ticket_burned'               => (int)($profile['ticket_burned'] ?? 0),
    'golden_ticket_shopify_code'  => $profile['golden_ticket_shopify_code'] ?? null,
    'golden_ticket_minted_at'     => $profile['golden_ticket_minted_at'] ?? null,
];

// Evaluar condiciones del backfill
$hasTicket = (int)($profile['golden_ticket'] ?? 0) === 1;
$notBurned = empty($profile['ticket_burned']);
$noCode = empty($profile['golden_ticket_shopify_code'] ?? null);
$shopifyOk = Shopify::isConfigured();

$out['checks']['has_golden_ticket_flag'] = ['ok' => $hasTicket];
$out['checks']['not_burned'] = ['ok' => $notBurned];
$out['checks']['shopify_code_is_null'] = ['ok' => $noCode];
$out['checks']['shopify_is_configured'] = ['ok' => $shopifyOk];

$wouldBackfill = $hasTicket && $notBurned && $noCode && $shopifyOk;
$out['checks']['backfill_would_run_on_sync'] = [
    'ok' => $wouldBackfill,
    'hint' => $wouldBackfill
        ? 'Hard reload en el sitio (estando logueado) y el backfill corre.'
        : 'Alguna condición arriba falla — revisá cuál.',
];

// Opcional: forzar mint (bypass del sync)
if ($force && $wouldBackfill) {
    $mint = Shopify::mintDiscountCode(35, 'Golden Ticket (forced debug)', 0);
    if ($mint['ok']) {
        Database::update('user_profiles', [
            'golden_ticket_shopify_code' => $mint['shopify_code'],
            'golden_ticket_minted_at'    => date('Y-m-d H:i:s'),
        ], 'id = ?', [$profile['id']]);
        $out['forced_mint'] = [
            'ok' => true,
            'shopify_code' => $mint['shopify_code'],
            'hint' => 'Recargá tu sitio (Ctrl+Shift+R). El badge debería aparecer.',
        ];
    } else {
        $out['forced_mint'] = [
            'ok' => false,
            'error' => $mint['error'] ?? 'unknown',
            'skipped' => $mint['skipped'] ?? false,
        ];
    }
}

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
