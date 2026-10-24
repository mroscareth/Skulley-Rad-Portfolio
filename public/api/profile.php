<?php
/**
 * User Profile API — Linked to Privy Auth
 *
 * Identidad: el privy_id sale del access token de Privy verificado en el
 * servidor (header X-Privy-Token, ver privy-auth.php). Nunca del body.
 *
 *   POST /profile.php?action=sync        - Create/update profile on login (token)
 *   GET  /profile.php?action=me           - Get user profile (token)
 *   POST /profile.php?action=game_start   - Boleto de partida del minigame (sin login)
 *   POST /profile.php?action=save_score   - Save a game score (token + game_token)
 *   GET  /profile.php?action=scores&pid=X - Get user score history
 *   GET  /profile.php?action=leaderboard  - Top 10 global scores
 *
 * Los pedidos de la cuenta viven en shop-orders.php?action=mine.
 *
 * Admin endpoints (CMS auth required):
 *   GET  /profile.php?action=users        - List all users (paginated)
 *   GET  /profile.php?action=user_detail  - Single user detail
 *   PUT  /profile.php?action=update_user  - Update user flags (admin)
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/privy-auth.php';

// Threshold del score del minigame para desbloquear golden ticket + gold skin.
// Tiene que coincidir con GOLD_SKIN_THRESHOLD en GameOverModal.jsx y App.jsx.
// El descuento del ticket (35%, un uso por cuenta) lo aplica shop-checkout.php
// y lo quema el webhook de Stripe al confirmarse el pago.
const GOLDEN_TICKET_SCORE_THRESHOLD = 5000;
// El minigame corre en el navegador, así que el servidor no puede saber el
// score real; sí puede saber cuánto duró la partida (boleto de game_start).
// La mejor entrega vale 100 y tarda bastante más de un segundo en lograrse:
// 100 pts/s ya es imposible para una persona. +300 de margen por latencia.
const GAME_MAX_POINTS_PER_SECOND = 100;
const GAME_SCORE_GRACE = 300;
const GAME_SESSION_MAX_AGE = 43200; // 12 h

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
        case 'game_start':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleGameStart();
            break;
        case 'game_end':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleGameEnd();
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
    $privyId = PrivyAuth::requirePrivyId();

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

        if (!empty($updates)) {
            Database::update('user_profiles', $updates, 'id = ?', [$existing['id']]);
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
    $privyId = PrivyAuth::requirePrivyId();

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
/**
 * Cierra el boleto: marca cuándo terminó de verdad la partida.
 *
 * Sin login, como game_start. Existe porque el score se puede enviar bastante
 * después del game over —el invitado tiene que iniciar sesión para reclamar su
 * premio— y la verosimilitud del score no debe medirse contra ese rato de
 * login: si se midiera contra `now`, cada minuto que alguien tarde en entrar
 * le ampliaría el techo de puntos aceptable.
 *
 * Solo se puede sellar una vez y solo antes de usarse.
 */
function handleGameEnd(): void
{
    if (!Middleware::rateLimit('game_end', 30, 60)) {
        Middleware::error('rate_limited', 429);
    }
    $data = Middleware::getJsonBody();
    $token = (string)($data['game_token'] ?? '');
    if ($token === '') Middleware::error('invalid_game', 400);

    Database::query(
        'UPDATE game_sessions SET ended_at = ?
         WHERE token = ? AND used_at IS NULL AND ended_at IS NULL',
        [date('Y-m-d H:i:s'), $token]
    );
    // Siempre ok: al jugador no le importa, y decirle si el boleto existe o no
    // sería un oráculo gratis para quien quiera adivinar boletos.
    Middleware::success([]);
}

function handleSaveScore(): void
{
    if (!Middleware::rateLimit('save_score', 20, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $data = Middleware::getJsonBody();
    $privyId = PrivyAuth::requirePrivyId();
    $score = (int)($data['score'] ?? 0);
    $tier = trim($data['tier'] ?? '') ?: null;

    $profile = Database::fetchOne(
        'SELECT * FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('profile_not_found', 404);

    // Cada score necesita un boleto de partida sin usar, y tiene que caber en
    // el tiempo que duró esa partida. Un boleto = un score.
    $session = Database::fetchOne(
        'SELECT * FROM game_sessions WHERE token = ?',
        [(string)($data['game_token'] ?? '')]
    );
    if (!$session || $session['used_at'] !== null) Middleware::error('invalid_game', 400);
    // Cuánto duró la partida, no cuánto tardó en llegar el score: si el
    // cliente selló el final con game_end, se mide contra ese sello.
    $endedAt = $session['ended_at'] ?? null;
    $endStamp = $endedAt ? (int)strtotime((string)$endedAt) : time();
    $elapsed = $endStamp - (int)strtotime((string)$session['started_at']);
    $age = time() - (int)strtotime((string)$session['started_at']);
    if ($elapsed < 0 || $age > GAME_SESSION_MAX_AGE) Middleware::error('invalid_game', 400);
    $consumed = Database::query(
        'UPDATE game_sessions SET used_at = ?, profile_id = ?, score = ? WHERE id = ? AND used_at IS NULL',
        [date('Y-m-d H:i:s'), $profile['id'], $score, $session['id']]
    )->rowCount();
    if ($consumed !== 1) Middleware::error('invalid_game', 400);
    if ($score > $elapsed * GAME_MAX_POINTS_PER_SECOND + GAME_SCORE_GRACE) {
        error_log("[profile] implausible score {$score} in {$elapsed}s for profile {$profile['id']}");
        Middleware::error('implausible_score', 422);
    }

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
    // terminal. Vive como flag en user_profiles: el checkout lo aplica y el
    // webhook de Stripe lo quema (ticket_burned) al confirmarse el pago.
    if ($score >= GOLDEN_TICKET_SCORE_THRESHOLD && !(int)$profile['golden_ticket']) {
        $updates['golden_ticket'] = 1;
        $updates['ticket_source'] = 'game';
        $updates['gold_skin'] = 1;
    }

    if (!empty($updates)) {
        Database::update('user_profiles', $updates, 'id = ?', [$profile['id']]);
    }

    $updated = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$profile['id']]);

    Middleware::success([
        'profile'        => formatProfile($updated),
        'score_saved'    => true,
        'new_high_score' => $score > (int)$profile['high_score'],
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

    // Va aparte: las instalaciones existentes ya tienen user_profiles y nunca
    // entran al bloque de arriba.
    try {
        Database::query("SELECT 1 FROM game_sessions LIMIT 1");
    } catch (\Throwable $e) {
        Database::query("
            CREATE TABLE IF NOT EXISTS game_sessions (
              id          INT AUTO_INCREMENT PRIMARY KEY,
              token       CHAR(32) NOT NULL,
              started_at  DATETIME NOT NULL,
              ip          VARCHAR(45) DEFAULT NULL,
              profile_id  INT DEFAULT NULL,
              score       INT DEFAULT NULL,
              ended_at    DATETIME DEFAULT NULL,
              used_at     DATETIME DEFAULT NULL,
              UNIQUE KEY uq_token (token),
              INDEX idx_started (started_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    // Las instalaciones que ya tenían game_sessions no pasan por el CREATE de
    // arriba y se quedarían sin ended_at. Si ya está, MySQL se queja y se
    // ignora: es el camino normal en cada petición.
    try {
        Database::query("ALTER TABLE game_sessions ADD COLUMN ended_at DATETIME DEFAULT NULL AFTER score");
    } catch (\Throwable $e) {
        // columna ya existente
    }
}

/**
 * Boleto de partida. Se pide al empezar el minigame (logueado o no: muchos
 * inician sesión hasta el game over para guardar). save_score lo consume.
 */
function handleGameStart(): void
{
    if (!Middleware::rateLimit('game_start', 20, 60)) {
        Middleware::error('rate_limited', 429);
    }
    $token = bin2hex(random_bytes(16));
    Database::insert('game_sessions', [
        'token'      => $token,
        'started_at' => date('Y-m-d H:i:s'),
        'ip'         => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
    ]);
    // Limpieza oportunista: boletos nunca usados de hace más de 2 días.
    if (random_int(1, 50) === 1) {
        Database::query(
            'DELETE FROM game_sessions WHERE used_at IS NULL AND started_at < ?',
            [date('Y-m-d H:i:s', time() - 2 * 86400)]
        );
    }
    Middleware::success(['game_token' => $token]);
}
