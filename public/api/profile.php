<?php
/**
 * User Profile API — Linked to Privy Auth
 *
 * Public endpoints (privy_id in body for identification):
 *   POST /profile.php?action=sync        - Create/update profile on login
 *   GET  /profile.php?action=me&pid=X     - Get user profile
 *   POST /profile.php?action=save_score   - Save a game score
 *   GET  /profile.php?action=scores&pid=X - Get user score history
 *   GET  /profile.php?action=leaderboard  - Top 10 global scores
 *   GET  /profile.php?action=orders&pid=X - User's Shopify orders (by email)
 *
 * Admin endpoints (CMS auth required):
 *   GET  /profile.php?action=users        - List all users (paginated)
 *   GET  /profile.php?action=user_detail  - Single user detail
 *   PUT  /profile.php?action=update_user  - Update user flags (admin)
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/shopify.php';

// Threshold del score del minigame para desbloquear golden ticket + gold skin.
// Tiene que coincidir con GOLD_SKIN_THRESHOLD en GameOverModal.jsx y App.jsx.
const GOLDEN_TICKET_SCORE_THRESHOLD = 5000;
// Descuento que viene con el golden ticket. Una vez por cuenta, perpetuo
// hasta que se use (Shopify enforcea usageLimit=1).
const GOLDEN_TICKET_DISCOUNT_PCT = 35;

Middleware::cors();
Middleware::json();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    // Auto-create tables if missing
    ensureTables();

    switch ($action) {
        // ── Public endpoints ─────────────────────────────────────
        case 'sync':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleSync();
            break;
        case 'me':
            handleMe();
            break;
        case 'save_score':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleSaveScore();
            break;
        case 'scores':
            handleScores();
            break;
        case 'leaderboard':
            handleLeaderboard();
            break;
        case 'orders':
            handleOrders();
            break;

        // ── Admin endpoints ──────────────────────────────────────
        case 'users':
            handleAdminUsers();
            break;
        case 'user_detail':
            handleAdminUserDetail();
            break;
        case 'update_user':
            if ($method !== 'PUT') Middleware::error('method_not_allowed', 405);
            handleAdminUpdateUser();
            break;

        default:
            Middleware::error('unknown_action', 400);
    }
} catch (\Throwable $e) {
    Middleware::error($e->getMessage(), 500);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Sync profile on login — upsert by privy_id
 */
function handleSync(): void
{
    if (!Middleware::rateLimit('profile_sync', 30, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $data = Middleware::getJsonBody();
    $privyId = trim($data['privy_id'] ?? '');
    if (!$privyId) Middleware::error('privy_id_required');

    $email    = trim($data['email'] ?? '') ?: null;
    $wallet   = trim($data['wallet'] ?? '') ?: null;
    $name     = trim($data['display_name'] ?? '') ?: null;
    $avatar   = trim($data['avatar_url'] ?? '') ?: null;

    $existing = Database::fetchOne(
        'SELECT * FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );

    if ($existing) {
        // Update fields that may have changed
        $updates = [];
        if ($email && $email !== $existing['email']) $updates['email'] = $email;
        if ($wallet && $wallet !== $existing['wallet']) $updates['wallet'] = $wallet;
        if ($name && $name !== $existing['display_name']) $updates['display_name'] = $name;
        if ($avatar && $avatar !== $existing['avatar_url']) $updates['avatar_url'] = $avatar;

        // Backfill: si el user ya tenía golden_ticket (ganado antes de que
        // Shopify Admin API estuviera configurada) pero nunca se minteó el
        // shopify_code, intentar mintearlo ahora. Idempotente — solo corre
        // una vez por profile porque setea la col después.
        if (
            (int)($existing['golden_ticket'] ?? 0) === 1
            && empty($existing['ticket_burned'])
            && empty($existing['golden_ticket_shopify_code'] ?? null)
            && Shopify::isConfigured()
        ) {
            $mint = Shopify::mintDiscountCode(
                GOLDEN_TICKET_DISCOUNT_PCT,
                'Golden Ticket (backfill)',
                0
            );
            if ($mint['ok']) {
                $updates['golden_ticket_shopify_code'] = $mint['shopify_code'];
                $updates['golden_ticket_minted_at'] = date('Y-m-d H:i:s');
            }
        }

        if (!empty($updates)) {
            try {
                Database::update('user_profiles', $updates, 'id = ?', [$existing['id']]);
            } catch (\Throwable $e) {
                // Schema viejo — retry sin cols shopify.
                unset($updates['golden_ticket_shopify_code'], $updates['golden_ticket_minted_at']);
                if (!empty($updates)) {
                    Database::update('user_profiles', $updates, 'id = ?', [$existing['id']]);
                }
            }
        }

        $profile = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$existing['id']]);
    } else {
        // Create new profile
        $id = Database::insert('user_profiles', [
            'privy_id'     => $privyId,
            'email'        => $email,
            'wallet'       => $wallet,
            'display_name' => $name,
            'avatar_url'   => $avatar,
        ]);
        $profile = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$id]);
    }

    Middleware::success(['profile' => formatProfile($profile)]);
}

/**
 * Get current user profile
 */
function handleMe(): void
{
    $privyId = trim($_GET['pid'] ?? '');
    if (!$privyId) Middleware::error('privy_id_required');

    $profile = Database::fetchOne(
        'SELECT * FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );

    if (!$profile) Middleware::error('not_found', 404);

    // Get redemption count
    $redemptions = Database::fetchOne(
        'SELECT COUNT(*) as cnt FROM code_redemptions WHERE user_id = ?',
        [$profile['id']]
    );

    $result = formatProfile($profile);
    $result['codes_redeemed'] = (int)($redemptions['cnt'] ?? 0);

    Middleware::success(['profile' => $result]);
}

/**
 * Save a game score + auto-award golden ticket
 */
function handleSaveScore(): void
{
    if (!Middleware::rateLimit('save_score', 20, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $data = Middleware::getJsonBody();
    $privyId = trim($data['privy_id'] ?? '');
    $score = (int)($data['score'] ?? 0);
    $tier = trim($data['tier'] ?? '') ?: null;

    if (!$privyId) Middleware::error('privy_id_required');

    $profile = Database::fetchOne(
        'SELECT * FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('profile_not_found', 404);

    // Insert score record
    Database::insert('game_scores', [
        'user_id' => $profile['id'],
        'score'   => $score,
        'tier'    => $tier,
    ]);

    // Update high score if beaten
    $updates = [];
    if ($score > (int)$profile['high_score']) {
        $updates['high_score'] = $score;
    }

    // Auto-award golden ticket + gold skin al cruzar el threshold. El golden
    // ticket SOLO se gana jugando — nunca se entrega por un código en la
    // terminal. Ver HANDOFF §Golden Ticket Flow.
    $goldenTicketJustMinted = null;
    if ($score >= GOLDEN_TICKET_SCORE_THRESHOLD && !(int)$profile['golden_ticket']) {
        $updates['golden_ticket'] = 1;
        $updates['ticket_source'] = 'game';
        $updates['gold_skin'] = 1;

        // Mintear shopify discount code PERPETUO (sin endsAt, usageLimit=1).
        // El user puede canjearlo cuando quiera; Shopify lo quema al primer uso.
        // Si Shopify no está configurado todavía: skipped=true, el código vive
        // solo como flag en DB — se puede re-mintear manualmente más adelante.
        $mint = Shopify::mintDiscountCode(
            GOLDEN_TICKET_DISCOUNT_PCT,
            'Golden Ticket (game reward)',
            0 // 0 = modo perpetuo, no expira por tiempo
        );
        if ($mint['ok']) {
            $updates['golden_ticket_shopify_code'] = $mint['shopify_code'];
            $updates['golden_ticket_minted_at'] = date('Y-m-d H:i:s');
            $goldenTicketJustMinted = [
                'shopify_code' => $mint['shopify_code'],
                'discount_pct' => GOLDEN_TICKET_DISCOUNT_PCT,
            ];
        }
        // Si mint falló (Shopify error) o skipped (no configurado), seguimos —
        // el profile queda con golden_ticket=1 sin shopify_code, y el frontend
        // puede mostrar "claim pendiente" hasta que re-mintemos.
    }

    try {
        if (!empty($updates)) {
            Database::update('user_profiles', $updates, 'id = ?', [$profile['id']]);
        }
    } catch (\Throwable $e) {
        // Schema viejo sin cols Shopify: retry sin esas cols.
        unset($updates['golden_ticket_shopify_code'], $updates['golden_ticket_minted_at']);
        if (!empty($updates)) {
            Database::update('user_profiles', $updates, 'id = ?', [$profile['id']]);
        }
    }

    $updated = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$profile['id']]);

    Middleware::success([
        'profile'        => formatProfile($updated),
        'score_saved'    => true,
        'new_high_score' => $score > (int)$profile['high_score'],
        'golden_ticket_minted' => $goldenTicketJustMinted,
    ]);
}

/**
 * Get user score history
 */
function handleScores(): void
{
    $privyId = trim($_GET['pid'] ?? '');
    if (!$privyId) Middleware::error('privy_id_required');

    $profile = Database::fetchOne(
        'SELECT id FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('not_found', 404);

    $scores = Database::fetchAll(
        'SELECT score, tier, played_at FROM game_scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 50',
        [$profile['id']]
    );

    Middleware::success(['scores' => $scores]);
}

/**
 * Global leaderboard — top 10 high scores
 */
function handleLeaderboard(): void
{
    $rows = Database::fetchAll(
        'SELECT p.display_name, p.email, p.avatar_url, p.high_score, p.golden_ticket
         FROM user_profiles p
         WHERE p.high_score > 0
         ORDER BY p.high_score DESC
         LIMIT 10'
    );

    // Mask emails for privacy
    $leaderboard = array_map(function ($r) {
        $name = $r['display_name'] ?: maskEmail($r['email'] ?? '');
        return [
            'name'           => $name,
            'avatar_url'     => $r['avatar_url'],
            'high_score'     => (int)$r['high_score'],
            'golden_ticket'  => (bool)$r['golden_ticket'],
        ];
    }, $rows);

    Middleware::success(['leaderboard' => $leaderboard]);
}

/**
 * Pedidos del usuario (Shopify Admin API, buscados por su email).
 *
 * Identificación por privy_id — mismo modelo de confianza que el resto de
 * endpoints públicos de este archivo (sync/me/scores): el privy_id es el
 * identificador. Se devuelve solo un resumen no-sensible del pedido (sin
 * direcciones ni datos de pago). Gated por Shopify::isConfigured(): sin tokens
 * responde {orders:[], skipped:true} sin error. Si en el futuro se requiere
 * mayor garantía de identidad, verificar aquí el access token de Privy.
 */
function handleOrders(): void
{
    if (!Middleware::rateLimit('profile_orders', 20, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $privyId = trim($_GET['pid'] ?? '');
    if (!$privyId) Middleware::error('privy_id_required');

    $profile = Database::fetchOne(
        'SELECT email FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('not_found', 404);

    $email = trim($profile['email'] ?? '');
    if ($email === '') {
        Middleware::success(['orders' => [], 'skipped' => false]);
    }

    $result = Shopify::fetchCustomerOrders($email);
    Middleware::success([
        'orders'  => $result['orders'] ?? [],
        'skipped' => (bool)($result['skipped'] ?? false),
    ]);
}


// ═══════════════════════════════════════════════════════════════
// ADMIN HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * List all users (paginated)
 */
function handleAdminUsers(): void
{
    Middleware::requireAuth();

    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $offset  = ($page - 1) * $perPage;
    $filter  = $_GET['filter'] ?? '';
    $search  = trim($_GET['search'] ?? '');

    $where = 'WHERE 1=1';
    $params = [];
    if ($filter === 'golden_ticket') {
        $where .= ' AND golden_ticket = 1';
    } elseif ($filter === 'gold_skin') {
        $where .= ' AND gold_skin = 1';
    } elseif ($filter === 'burned') {
        $where .= ' AND ticket_burned = 1';
    }

    if ($search !== '') {
        $where .= ' AND (display_name LIKE ? OR email LIKE ? OR wallet LIKE ?)';
        $searchParam = '%' . $search . '%';
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    $countRow = Database::fetchOne("SELECT COUNT(*) as total FROM user_profiles {$where}", $params);
    $total = (int)($countRow['total'] ?? 0);

    $users = Database::fetchAll(
        "SELECT * FROM user_profiles {$where} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}",
        $params
    );

    // Attach game count + redemption count for each user
    foreach ($users as &$u) {
        $gc = Database::fetchOne('SELECT COUNT(*) as cnt FROM game_scores WHERE user_id = ?', [$u['id']]);
        $rc = Database::fetchOne('SELECT COUNT(*) as cnt FROM code_redemptions WHERE user_id = ?', [$u['id']]);
        $u['games_played'] = (int)($gc['cnt'] ?? 0);
        $u['codes_redeemed'] = (int)($rc['cnt'] ?? 0);
    }
    unset($u);

    Middleware::success([
        'users'       => $users,
        'page'        => $page,
        'per_page'    => $perPage,
        'total'       => $total,
        'total_pages' => (int)ceil($total / $perPage),
    ]);
}

/**
 * Single user detail with score history + redemptions
 */
function handleAdminUserDetail(): void
{
    Middleware::requireAuth();

    $userId = (int)($_GET['id'] ?? 0);
    if ($userId <= 0) Middleware::error('id_required');

    $user = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$userId]);
    if (!$user) Middleware::error('not_found', 404);

    $scores = Database::fetchAll(
        'SELECT score, tier, played_at FROM game_scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 50',
        [$userId]
    );

    $redemptions = Database::fetchAll(
        'SELECT r.*, c.code, c.label, c.type
         FROM code_redemptions r
         JOIN cheat_codes c ON r.code_id = c.id
         WHERE r.user_id = ?
         ORDER BY r.redeemed_at DESC',
        [$userId]
    );

    Middleware::success([
        'user'        => $user,
        'scores'      => $scores,
        'redemptions' => $redemptions,
    ]);
}

/**
 * Admin: update user flags (golden_ticket, gold_skin, ticket_burned)
 */
function handleAdminUpdateUser(): void
{
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();
    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) Middleware::error('id_required');

    $existing = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$id]);
    if (!$existing) Middleware::error('not_found', 404);

    $allowed = ['golden_ticket', 'gold_skin', 'ticket_burned', 'ticket_source'];
    $updates = [];
    foreach ($allowed as $field) {
        if (isset($data[$field])) {
            $updates[$field] = $field === 'ticket_source' ? ($data[$field] ?: null) : ($data[$field] ? 1 : 0);
        }
    }

    if (empty($updates)) Middleware::error('no_changes');

    Database::update('user_profiles', $updates, 'id = ?', [$id]);
    $updated = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$id]);
    Middleware::success(['user' => $updated]);
}


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatProfile(array $row): array
{
    return [
        'id'             => (int)$row['id'],
        'privy_id'       => $row['privy_id'],
        'email'          => $row['email'],
        'wallet'         => $row['wallet'],
        'display_name'   => $row['display_name'],
        'avatar_url'     => $row['avatar_url'],
        'gold_skin'      => (bool)$row['gold_skin'],
        'golden_ticket'  => (bool)$row['golden_ticket'],
        'ticket_source'  => $row['ticket_source'],
        'ticket_burned'  => (bool)$row['ticket_burned'],
        'high_score'     => (int)$row['high_score'],
        // Shopify mint — null si no está minteado o si la col no existe (schema viejo).
        'golden_ticket_shopify_code' => $row['golden_ticket_shopify_code'] ?? null,
        'golden_ticket_minted_at'    => $row['golden_ticket_minted_at'] ?? null,
    ];
}

function maskEmail(?string $email): string
{
    if (!$email) return 'Anonymous';
    $parts = explode('@', $email);
    if (count($parts) !== 2) return 'Anonymous';
    $local = $parts[0];
    $masked = substr($local, 0, 2) . str_repeat('*', max(1, strlen($local) - 2));
    return $masked . '@' . $parts[1];
}

function ensureTables(): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        Database::query("SELECT 1 FROM user_profiles LIMIT 1");
    } catch (\Throwable $e) {
        // Table doesn't exist — create it
        Database::query("
            CREATE TABLE IF NOT EXISTS user_profiles (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              privy_id      VARCHAR(100) NOT NULL UNIQUE,
              email         VARCHAR(255) DEFAULT NULL,
              wallet        VARCHAR(255) DEFAULT NULL,
              display_name  VARCHAR(120) DEFAULT NULL,
              avatar_url    TEXT DEFAULT NULL,
              gold_skin     TINYINT(1) DEFAULT 0,
              golden_ticket TINYINT(1) DEFAULT 0,
              ticket_source ENUM('game','code') DEFAULT NULL,
              ticket_burned TINYINT(1) DEFAULT 0,
              high_score    INT DEFAULT 0,
              created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_email (email),
              INDEX idx_wallet (wallet)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        Database::query("
            CREATE TABLE IF NOT EXISTS game_scores (
              id           INT AUTO_INCREMENT PRIMARY KEY,
              user_id      INT NOT NULL,
              score        INT NOT NULL,
              tier         VARCHAR(20) DEFAULT NULL,
              played_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_score_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
              INDEX idx_user (user_id),
              INDEX idx_score (score DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
}
