<?php
/**
 * Cheat Codes API
 *
 * Admin endpoints (auth required):
 *   GET    /codes.php                              - List all codes
 *   GET    /codes.php?action=redemptions&code_id=X&page=N - Paginated redemption log
 *   POST   /codes.php                              - Create a new code
 *   PUT    /codes.php                              - Update a code
 *   DELETE /codes.php?id=X                         - Delete a code
 *
 * Public endpoint:
 *   POST   /codes.php?action=validate  - Validate & redeem a code (requires email)
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Public validate endpoint (no auth required)
if ($method === 'POST' && $action === 'validate') {
    handleValidate();
    exit;
}

// All other endpoints require admin auth
switch ($method) {
    case 'GET':
        if ($action === 'redemptions') {
            handleGetRedemptions();
        } else {
            handleGet();
        }
        break;
    case 'POST':
        handlePost();
        break;
    case 'PUT':
        handlePut();
        break;
    case 'DELETE':
        handleDelete();
        break;
    default:
        Middleware::error('method_not_allowed', 405);
}

// ── Public: Validate & redeem ──────────────────────────────

function handleValidate(): void
{
    // Rate limit: 10 attempts per 60s per IP
    if (!Middleware::rateLimit('cheat_validate', 10, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $data = Middleware::getJsonBody();
    $code = trim($data['code'] ?? '');
    $email = trim($data['email'] ?? '');

    if (!$code) {
        Middleware::error('code_required');
    }
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Middleware::error('valid_email_required');
    }

    $row = Database::fetchOne(
        'SELECT * FROM cheat_codes WHERE LOWER(code) = LOWER(?) LIMIT 1',
        [$code]
    );

    if (!$row) {
        Middleware::error('unknown_code', 404);
    }

    if (!$row['active']) {
        Middleware::error('code_inactive', 403);
    }

    // Check expiration
    if ($row['expires_at'] && strtotime($row['expires_at']) < time()) {
        Middleware::error('code_expired', 410);
    }

    // Atomic check-and-increment: prevents race where two concurrent
    // redemptions both pass the max_uses check and over-consume.
    // max_uses = 0 means unlimited.
    $stmt = Database::query(
        'UPDATE cheat_codes
         SET times_used = times_used + 1
         WHERE id = ?
           AND (max_uses = 0 OR times_used < max_uses)',
        [$row['id']]
    );
    if ($stmt->rowCount() === 0) {
        Middleware::error('code_exhausted', 410);
    }

    // Resolve user profile if privy_id provided
    $userId = null;
    $privyId = trim($data['privy_id'] ?? '');
    if ($privyId) {
        $userProfile = Database::fetchOne(
            'SELECT id FROM user_profiles WHERE privy_id = ?',
            [$privyId]
        );
        if ($userProfile) {
            $userId = (int)$userProfile['id'];

            // Auto-grant gold_skin + golden_ticket for golden_ticket type codes
            if ($row['type'] === 'golden_ticket') {
                Database::update('user_profiles', [
                    'gold_skin'      => 1,
                    'golden_ticket'  => 1,
                    'ticket_source'  => 'code',
                ], 'id = ?', [$userId]);
            }
        }
    }

    // Log the redemption
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    Database::insert('code_redemptions', [
        'code_id'    => $row['id'],
        'user_id'    => $userId,
        'email'      => $email,
        'ip_address' => $ip,
    ]);

    Middleware::success([
        'action'       => $row['action'],
        'type'         => $row['type'],
        'label'        => $row['label'],
        'discount_pct' => $row['type'] === 'discount' ? (int) $row['discount_pct'] : null,
    ]);
}

// ── Admin: List all codes ──────────────────────────────────

function handleGet(): void
{
    Middleware::requireAuth();

    $codes = Database::fetchAll(
        'SELECT * FROM cheat_codes ORDER BY created_at DESC'
    );

    Middleware::success(['codes' => $codes]);
}

// ── Admin: Paginated redemption log ────────────────────────

function handleGetRedemptions(): void
{
    Middleware::requireAuth();

    $codeId = (int) ($_GET['code_id'] ?? 0);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;

    // Build WHERE clause
    $where = '';
    $params = [];
    if ($codeId > 0) {
        $where = 'WHERE r.code_id = ?';
        $params[] = $codeId;
    }

    // Total count
    $countRow = Database::fetchOne(
        "SELECT COUNT(*) as total FROM code_redemptions r {$where}",
        $params
    );
    $total = (int) ($countRow['total'] ?? 0);

    // Rows
    $rows = Database::fetchAll(
        "SELECT r.*, c.code, c.label, 
                u.display_name AS user_display_name, u.email AS user_email
         FROM code_redemptions r 
         JOIN cheat_codes c ON r.code_id = c.id 
         LEFT JOIN user_profiles u ON r.user_id = u.id
         {$where}
         ORDER BY r.redeemed_at DESC 
         LIMIT {$perPage} OFFSET {$offset}",
        $params
    );

    Middleware::success([
        'redemptions' => $rows,
        'page'        => $page,
        'per_page'    => $perPage,
        'total'       => $total,
        'total_pages' => (int) ceil($total / $perPage),
    ]);
}

// ── Admin: Create code ─────────────────────────────────────

function handlePost(): void
{
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();
    $code = trim($data['code'] ?? '');
    $type = $data['type'] ?? 'golden_ticket';
    $label = trim($data['label'] ?? '');
    $action = $data['action'] ?? null;
    $discountPct = isset($data['discount_pct']) ? (int) $data['discount_pct'] : null;
    $maxUses = isset($data['max_uses']) ? (int) $data['max_uses'] : 1;
    $expiresAt = $data['expires_at'] ?? null;

    if (!$code) Middleware::error('code_required');
    if (!$label) Middleware::error('label_required');
    if (!in_array($type, ['golden_ticket', 'discount'], true)) Middleware::error('invalid_type');
    if ($type === 'discount' && ($discountPct === null || $discountPct < 1 || $discountPct > 100)) {
        Middleware::error('discount_pct must be 1-100');
    }

    // Normalize action: empty string or 'none' => null
    if ($action === '' || $action === 'none') $action = null;

    // Check uniqueness
    $existing = Database::fetchOne('SELECT id FROM cheat_codes WHERE LOWER(code) = LOWER(?)', [$code]);
    if ($existing) Middleware::error('code_already_exists', 409);

    $id = Database::insert('cheat_codes', [
        'code'         => $code,
        'type'         => $type,
        'label'        => $label,
        'action'       => $action,
        'discount_pct' => $type === 'discount' ? $discountPct : null,
        'max_uses'     => $maxUses,
        'expires_at'   => $expiresAt ?: null,
    ]);

    $created = Database::fetchOne('SELECT * FROM cheat_codes WHERE id = ?', [$id]);
    Middleware::success(['code' => $created]);
}

// ── Admin: Update code ─────────────────────────────────────

function handlePut(): void
{
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) Middleware::error('id_required');

    $existing = Database::fetchOne('SELECT * FROM cheat_codes WHERE id = ?', [$id]);
    if (!$existing) Middleware::error('not_found', 404);

    $updates = [];
    if (isset($data['active'])) $updates['active'] = $data['active'] ? 1 : 0;
    if (isset($data['label'])) $updates['label'] = trim($data['label']);
    if (isset($data['type'])) {
        $t = $data['type'];
        if (in_array($t, ['golden_ticket', 'discount'], true)) $updates['type'] = $t;
    }
    if (isset($data['action'])) {
        $a = $data['action'];
        $updates['action'] = ($a === '' || $a === 'none') ? null : trim($a);
    }
    if (isset($data['max_uses'])) $updates['max_uses'] = (int) $data['max_uses'];
    if (isset($data['expires_at'])) $updates['expires_at'] = $data['expires_at'] ?: null;
    if (isset($data['discount_pct'])) {
        $pct = (int) $data['discount_pct'];
        $updates['discount_pct'] = ($pct >= 1 && $pct <= 100) ? $pct : null;
    }

    if (empty($updates)) Middleware::error('no_changes');

    Database::update('cheat_codes', $updates, 'id = ?', [$id]);
    $updated = Database::fetchOne('SELECT * FROM cheat_codes WHERE id = ?', [$id]);
    Middleware::success(['code' => $updated]);
}

// ── Admin: Delete code ─────────────────────────────────────

function handleDelete(): void
{
    Middleware::requireAuth();

    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) Middleware::error('id_required');

    $existing = Database::fetchOne('SELECT * FROM cheat_codes WHERE id = ?', [$id]);
    if (!$existing) Middleware::error('not_found', 404);

    Database::delete('cheat_codes', 'id = ?', [$id]);
    Middleware::success(['deleted' => $existing]);
}
