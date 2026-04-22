<?php
/**
 * User Achievements API — logros persistentes por usuario autenticado.
 *
 * Public endpoints (privy_id para identificación):
 *   GET  /achievements.php?action=list&pid=<privy_id>
 *   POST /achievements.php?action=unlock  body { privy_id, achievement_key, metadata? }
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    ensureAchievementsTable();

    switch ($action) {
        case 'list':
            if ($method !== 'GET') Middleware::error('method_not_allowed', 405);
            handleList();
            break;
        case 'unlock':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleUnlock();
            break;
        default:
            Middleware::error('unknown_action', 400);
    }
} catch (\Throwable $e) {
    Middleware::error($e->getMessage(), 500);
}

// ── Public: List user achievements ─────────────────────────

function handleList(): void
{
    $privyId = trim($_GET['pid'] ?? '');
    if (!$privyId) Middleware::error('privy_id_required');

    $profile = Database::fetchOne(
        'SELECT id FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) {
        Middleware::success(['achievements' => []]);
    }

    $rows = Database::fetchAll(
        'SELECT achievement_key, unlocked_at, metadata
         FROM user_achievements
         WHERE user_id = ?
         ORDER BY unlocked_at ASC',
        [(int)$profile['id']]
    );

    $achievements = array_map(function ($r) {
        $meta = null;
        if (!empty($r['metadata'])) {
            $decoded = json_decode((string)$r['metadata'], true);
            $meta = is_array($decoded) ? $decoded : null;
        }
        return [
            'key'          => $r['achievement_key'],
            'unlocked_at'  => $r['unlocked_at'],
            'metadata'     => $meta,
        ];
    }, $rows);

    Middleware::success(['achievements' => $achievements]);
}

// ── Public: Unlock achievement (idempotente) ───────────────

function handleUnlock(): void
{
    if (!Middleware::rateLimit('achievement_unlock', 30, 60)) {
        Middleware::error('rate_limited', 429);
    }

    $data = Middleware::getJsonBody();
    $privyId = trim($data['privy_id'] ?? '');
    $key     = trim($data['achievement_key'] ?? '');
    $metadata = $data['metadata'] ?? null;

    if (!$privyId) Middleware::error('privy_id_required');
    if (!$key) Middleware::error('achievement_key_required');
    if (!preg_match('/^[a-z0-9_]{1,64}$/', $key)) {
        Middleware::error('invalid_achievement_key');
    }

    $profile = Database::fetchOne(
        'SELECT id FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('profile_not_found', 404);

    $userId = (int)$profile['id'];
    $metaJson = null;
    if (is_array($metadata) && !empty($metadata)) {
        $encoded = json_encode($metadata);
        if ($encoded !== false) $metaJson = $encoded;
    }

    // Idempotente: INSERT IGNORE por el UNIQUE KEY (user_id, achievement_key).
    // Si ya existía, rowCount == 0 y devolvemos el registro existente.
    $stmt = Database::query(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_key, metadata)
         VALUES (?, ?, ?)',
        [$userId, $key, $metaJson]
    );
    $newlyUnlocked = $stmt->rowCount() > 0;

    $row = Database::fetchOne(
        'SELECT achievement_key, unlocked_at, metadata
         FROM user_achievements
         WHERE user_id = ? AND achievement_key = ?',
        [$userId, $key]
    );

    $meta = null;
    if ($row && !empty($row['metadata'])) {
        $decoded = json_decode((string)$row['metadata'], true);
        $meta = is_array($decoded) ? $decoded : null;
    }

    Middleware::success([
        'achievement' => $row ? [
            'key'          => $row['achievement_key'],
            'unlocked_at'  => $row['unlocked_at'],
            'metadata'     => $meta,
        ] : null,
        'newly_unlocked' => $newlyUnlocked,
    ]);
}

// ── Auto-create table en deploys frescos ──────────────────

function ensureAchievementsTable(): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        Database::query('SELECT 1 FROM user_achievements LIMIT 1');
    } catch (\Throwable $e) {
        Database::query(
            "CREATE TABLE IF NOT EXISTS user_achievements (
              id               INT AUTO_INCREMENT PRIMARY KEY,
              user_id          INT NOT NULL,
              achievement_key  VARCHAR(64) NOT NULL,
              unlocked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              metadata         JSON NULL,
              UNIQUE KEY uk_user_achievement (user_id, achievement_key),
              CONSTRAINT fk_achievement_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
              INDEX idx_key (achievement_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }
}
