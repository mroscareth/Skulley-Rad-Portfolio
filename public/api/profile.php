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
 *   POST /profile.php?action=game_beat    - Capturas de la partida en curso (sin login)
 *   POST /profile.php?action=game_end     - Últimas capturas + sello del final (sin login)
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
require_once __DIR__ . '/game-tickets.php';

// Los tickets (Silver 5,000 → 10 %, Golden 9,999 → 35 %, 10 Golden al mes,
// uno por cuenta al mes) viven en game-tickets.php. La skin dorada se gana con
// el puntaje del Silver: GameTickets::minScore() = GOLD_SKIN_THRESHOLD en
// GameOverModal.jsx y App.jsx. El checkout aplica el ticket y el webhook de
// Stripe lo quema al confirmarse el pago.
const GAME_SESSION_MAX_AGE = 43200; // 12 h

// El minigame corre en el navegador, así que el score que manda el cliente no
// prueba nada: un script podía pedir boleto, esperar 47 s y mandar 5000. Ahora
// el cliente reporta cada captura mientras juega (game_beat, cada ~5 s) y el
// servidor lleva su propia suma. save_score nunca acepta más que esa suma.
//
// Lo que eso obliga a un tramposo: transmitir capturas verosímiles EN TIEMPO
// REAL durante toda la partida, porque una captura con fecha futura invalida
// la partida y una que llega con más de GAME_EVENT_MAX_DELAY de atraso no
// cuenta. Ya no se puede fabricar un 5000 de golpe al final.
//
// Las esferas renacen en el centro y los portales están a 16 u; el personaje
// corre a ~7.8 u/s. Una esfera chica (100) por viaje de ida y vuelta da ~25
// pts/s sostenidos en el mejor caso. 40 deja margen para rachas con suerte;
// con eso 5000 pide al menos ~110 s de juego.
const GAME_CAPTURE_DELTAS = [100, 30, 5, -100, -30, -5];
const GAME_PACE_POINTS_PER_SECOND = 40;
const GAME_PACE_GRACE = 600;
// Varias esferas pueden caer juntas en un portal, pero 7 chicas en 10 s no.
const GAME_BURST_WINDOW_MS = 10000;
const GAME_BURST_MAX = 700;
const GAME_EVENT_FUTURE_SLACK_MS = 3000; // reloj del cliente vs. started_at truncado a segundos
const GAME_EVENT_MAX_DELAY_MS = 30000;
const GAME_MAX_EVENTS_PER_BEAT = 80;
const GAME_MAX_EVENTS = 4000;
// Las cuentas son gratis: abrir varias para juntar tickets se topa por IP.
// Más de 2 cuentas distintas con 5000+ desde la misma IP en 30 días ya no es
// suerte. Una IP compartida (oficina, CGNAT) casi nunca junta tantos 5000.
const GAME_TICKETS_PER_IP = 2;
const GAME_TICKETS_PER_IP_WINDOW = 30 * 86400;

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
        case 'game_beat':
            if ($method !== 'POST') Middleware::error('method_not_allowed', 405);
            handleGameBeat();
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
        case 'tickets':
            // Pestaña Premios de Argus: cuánto pide y da cada ticket y cuántos
            // Golden quedan este mes.
            Middleware::success(GameTickets::publicStats());
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

/** Boleto vivo: existe, no se ha usado ni cerrado y no caducó. */
function openGameSession(string $token): ?array
{
    if ($token === '') return null;
    $session = Database::fetchOne('SELECT * FROM game_sessions WHERE token = ?', [$token]);
    if (!$session || $session['used_at'] !== null || $session['ended_at'] !== null) return null;
    if (time() - (int)strtotime((string)$session['started_at']) > GAME_SESSION_MAX_AGE) return null;
    return $session;
}

/**
 * Agrega capturas a la bitácora de la partida y devuelve cuántas lleva
 * recibidas, para que el cliente sepa desde dónde seguir.
 *
 * Cada captura es [ms desde el inicio, delta]. `seq` es el índice de la
 * primera del lote: si una respuesta se pierde y el cliente reenvía, las ya
 * recibidas se saltan en vez de contarse dos veces.
 *
 * Una captura imposible (delta inventado, desorden, fecha futura, ritmo o
 * racha sobrehumanos) marca la partida en `flag` y deja de aceptar más. Se
 * hace en silencio: el score se guarda recortado y simplemente no hay ticket.
 * Una captura que llega tarde solo se descarta: puede ser red mala.
 */
function ingestGameEvents(array $session, array $data): int
{
    $received = (int)$session['received'];
    $seq = $data['seq'] ?? null;
    $batch = $data['events'] ?? null;
    if (!is_int($seq) || $seq < 0 || $seq > $received || !is_array($batch)) return $received;

    $batch = array_slice(array_values($batch), $received - $seq, GAME_MAX_EVENTS_PER_BEAT);
    if (!$batch) return $received;

    $events = json_decode((string)($session['events'] ?? ''), true) ?: [];
    $score = (int)$session['server_score'];
    $earned = (int)$session['earned'];
    $lastT = (int)$session['last_t'];
    $flag = $session['flag'];
    $nowMs = (int)((microtime(true) - (int)strtotime((string)$session['started_at'])) * 1000);

    foreach ($batch as $e) {
        if ($flag !== null || count($events) >= GAME_MAX_EVENTS) break;
        if (!is_array($e) || !is_int($e[0] ?? null) || !is_int($e[1] ?? null)) { $flag = 'shape'; break; }
        [$t, $d] = $e;
        if (!in_array($d, GAME_CAPTURE_DELTAS, true)) { $flag = 'delta'; break; }
        if ($t < $lastT || $t < 0) { $flag = 'order'; break; }
        if ($t > $nowMs + GAME_EVENT_FUTURE_SLACK_MS) { $flag = 'future'; break; }
        if ($t < $nowMs - GAME_EVENT_MAX_DELAY_MS) continue;

        if ($d > 0) {
            if ($earned + $d > intdiv($t, 1000) * GAME_PACE_POINTS_PER_SECOND + GAME_PACE_GRACE) { $flag = 'pace'; break; }
            $burst = $d;
            for ($i = count($events) - 1; $i >= 0 && $events[$i][0] > $t - GAME_BURST_WINDOW_MS; $i--) {
                if ($events[$i][1] > 0) $burst += $events[$i][1];
            }
            if ($burst > GAME_BURST_MAX) { $flag = 'burst'; break; }
            $earned += $d;
        }
        $score += $d;
        $lastT = $t;
        $events[] = [$t, $d];
    }

    if ($flag !== null && $session['flag'] === null) {
        error_log("[profile] game {$session['id']} flagged '{$flag}' at {$nowMs}ms, ip {$session['ip']}");
    }

    // El lote completo cuenta como recibido aunque se haya descartado algo:
    // reenviarlo no lo volvería válido.
    $newReceived = $received + count($batch);
    $updated = Database::query(
        'UPDATE game_sessions
         SET received = ?, events = ?, server_score = ?, earned = ?, last_t = ?, flag = ?
         WHERE id = ? AND received = ? AND used_at IS NULL',
        [$newReceived, json_encode($events), $score, $earned, $lastT, $flag, $session['id'], $received]
    )->rowCount();
    // Dos latidos a la vez sobre el mismo boleto: gana uno, el otro reintenta.
    return $updated === 1 ? $newReceived : $received;
}

/** Capturas de la partida en curso. Sin login, como game_start. */
function handleGameBeat(): void
{
    if (!Middleware::rateLimit('game_beat', 60, 60)) {
        Middleware::error('rate_limited', 429);
    }
    $data = Middleware::getJsonBody();
    $session = openGameSession((string)($data['game_token'] ?? ''));
    // Boleto inválido o cerrado: `n` en 0 y nada más. Distinguir los casos
    // sería un oráculo gratis para quien quiera adivinar boletos.
    Middleware::success(['n' => $session ? ingestGameEvents($session, $data) : 0]);
}

/**
 * Cierra el boleto: recibe las últimas capturas y marca cuándo terminó de
 * verdad la partida.
 *
 * Sin login, como game_start. Existe porque el score se puede enviar bastante
 * después del game over —el invitado tiene que iniciar sesión para reclamar su
 * premio—, y después del sello ya no entra ninguna captura.
 *
 * Solo se puede sellar una vez y solo antes de usarse.
 */
function handleGameEnd(): void
{
    if (!Middleware::rateLimit('game_end', 30, 60)) {
        Middleware::error('rate_limited', 429);
    }
    $data = Middleware::getJsonBody();
    $session = openGameSession((string)($data['game_token'] ?? ''));
    $n = 0;
    if ($session) {
        $n = ingestGameEvents($session, $data);
        Database::query(
            'UPDATE game_sessions SET ended_at = ? WHERE id = ? AND used_at IS NULL AND ended_at IS NULL',
            [date('Y-m-d H:i:s'), $session['id']]
        );
    }
    Middleware::success(['n' => $n]);
}

/** Espejo de getRewardTier() en GameOverModal.jsx. */
function rewardTierFor(int $score): ?string
{
    foreach ([5000 => 'legendary', 2000 => 'diamond', 1000 => 'gold', 500 => 'silver', 100 => 'bronze'] as $min => $tier) {
        if ($score >= $min) return $tier;
    }
    return null;
}

/** ¿Esta IP ya juntó sus tickets del mes con otras cuentas? */
function ipTicketQuotaUsed(array $session, int $profileId): bool
{
    if (!$session['ip']) return false;
    $row = Database::fetchOne(
        'SELECT COUNT(DISTINCT profile_id) AS n FROM game_sessions
         WHERE ip = ? AND score >= ? AND profile_id <> ? AND used_at > ?',
        [$session['ip'], GameTickets::minScore(), $profileId, date('Y-m-d H:i:s', time() - GAME_TICKETS_PER_IP_WINDOW)]
    );
    return (int)($row['n'] ?? 0) >= GAME_TICKETS_PER_IP;
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
    $privyId = PrivyAuth::requirePrivyId();
    $claimed = (int)($data['score'] ?? 0);

    $profile = Database::fetchOne(
        'SELECT * FROM user_profiles WHERE privy_id = ?',
        [$privyId]
    );
    if (!$profile) Middleware::error('profile_not_found', 404);

    // Cada score necesita un boleto de partida sin usar. Un boleto = un score.
    $session = Database::fetchOne(
        'SELECT * FROM game_sessions WHERE token = ?',
        [(string)($data['game_token'] ?? '')]
    );
    if (!$session || $session['used_at'] !== null) Middleware::error('invalid_game', 400);
    $age = time() - (int)strtotime((string)$session['started_at']);
    if ($age > GAME_SESSION_MAX_AGE) Middleware::error('invalid_game', 400);

    // Nunca más que lo que el servidor vio capturar. Menos sí: la penalización
    // por trampa del cliente baja el marcador a -9999 sin pasar por capturas.
    $score = min($claimed, (int)$session['server_score']);
    if ($claimed > $score) {
        error_log("[profile] game {$session['id']} claimed {$claimed}, server saw {$score}, profile {$profile['id']}");
    }

    $consumed = Database::query(
        'UPDATE game_sessions SET used_at = ?, profile_id = ?, score = ? WHERE id = ? AND used_at IS NULL',
        [date('Y-m-d H:i:s'), $profile['id'], $score, $session['id']]
    )->rowCount();
    if ($consumed !== 1) Middleware::error('invalid_game', 400);

    // Insert score record
    Database::insert('game_scores', [
        'user_id' => $profile['id'],
        'score'   => $score,
        'tier'    => rewardTierFor($score),
    ]);

    // Update high score if beaten
    $updates = [];
    if ($score > (int)$profile['high_score']) {
        $updates['high_score'] = $score;
    }

    // Skin dorada con el puntaje del Silver. Una partida marcada por la
    // bitácora no da premio, aunque su suma llegue.
    $clean = $session['flag'] === null;
    if ($clean && $score >= GameTickets::minScore()) {
        $updates['gold_skin'] = 1;
    }

    if (!empty($updates)) {
        Database::update('user_profiles', $updates, 'id = ?', [$profile['id']]);
    }

    // Los tickets SOLO se ganan jugando — nunca por un código. Reglas en
    // game-tickets.php; aquí solo se le pasan el puntaje y el límite por IP.
    $ticket = ['awarded' => null, 'upgraded' => false, 'reason' => null];
    if ($clean && $score >= GameTickets::minScore()) {
        $ticket = GameTickets::award($profile, $score, ipTicketQuotaUsed($session, (int)$profile['id']));
    }

    $updated = Database::fetchOne('SELECT * FROM user_profiles WHERE id = ?', [$profile['id']]);

    Middleware::success([
        'profile'        => formatProfile($updated),
        'score'          => $score,
        'score_saved'    => true,
        'new_high_score' => $score > (int)$profile['high_score'],
        'ticket'         => $ticket + [
            'pct' => GameTickets::pct($ticket['awarded']),
            'resets_at' => date('Y-m-01', strtotime('first day of next month')),
        ],
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
        'SELECT p.display_name, p.email, p.avatar_url, p.high_score, p.golden_ticket, p.ticket_tier
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
            'ticket_tier'    => GameTickets::tierOf($r),
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

    if (isset($data['ticket_tier']) && isset(GAME_TICKET_TIERS[(string)$data['ticket_tier']])) {
        $updates['ticket_tier'] = (string)$data['ticket_tier'];
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
        // `golden_ticket` = tiene un ticket de cualquier nivel (game-tickets.php).
        'ticket_tier'    => GameTickets::tierOf($row),
        'ticket_pct'     => GameTickets::pct(GameTickets::tierOf($row)),
        'ticket_won_at'  => $row['ticket_won_at'] ?? null,
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

    // Columnas que se fueron sumando. Las instalaciones que ya tenían
    // game_sessions no pasan por el CREATE de arriba; cuando ya están todas,
    // esto es una sola consulta por petición.
    $have = array_column(Database::fetchAll('SHOW COLUMNS FROM game_sessions'), 'Field');
    $added = [
        'ended_at'     => 'DATETIME DEFAULT NULL',
        // Bitácora de capturas (game_beat): ver ingestGameEvents().
        'received'     => 'INT NOT NULL DEFAULT 0',
        'server_score' => 'INT NOT NULL DEFAULT 0',
        'earned'       => 'INT NOT NULL DEFAULT 0',
        'last_t'       => 'INT NOT NULL DEFAULT 0',
        'events'       => 'MEDIUMTEXT DEFAULT NULL',
        'flag'         => 'VARCHAR(20) DEFAULT NULL',
    ];
    foreach ($added as $col => $def) {
        if (!in_array($col, $have, true)) {
            Database::query("ALTER TABLE game_sessions ADD COLUMN {$col} {$def}");
        }
    }

    // Niveles de ticket: columnas en user_profiles y la bitácora de premios.
    GameTickets::ensureSchema();
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
