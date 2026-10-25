<?php
/**
 * Tickets de descuento del juego de esferas: Silver y Golden.
 *
 * Una sola fuente para las reglas; la usan el juego (profile.php, que los
 * otorga), el checkout (shop-checkout.php, que los aplica) y el catálogo y los
 * correos (shop.php, shop-mailer.php, vía shop-lib.php).
 *
 * Reglas (decisión de Oscar, 2026-10-25):
 *   - Silver: 5,000 puntos → 10 %. Sin tope global.
 *   - Golden: 9,999 puntos → 35 %. Solo 10 por mes calendario en todo el sitio;
 *     si se acabaron, 9,999 da el Silver.
 *   - Una cuenta gana máximo un ticket por mes calendario y tiene uno a la vez.
 *     Excepción: con un Silver sin usar, hacer 9,999 lo sube a Golden.
 *   - El ticket se usa una vez (el webhook de Stripe lo quema al pagar).
 *
 * En user_profiles: `golden_ticket` = la cuenta tiene un ticket (del nivel que
 * sea; el nombre viene de cuando solo existía el dorado), `ticket_burned` = ya
 * se usó, `ticket_tier` = silver|gold (NULL en tickets de antes = gold, 35 %) y
 * `ticket_won_at`. Cada premio queda además en game_ticket_awards: de ahí sale
 * el conteo del mes, que no se puede sacar de los perfiles porque un premio
 * nuevo pisa al anterior.
 */

declare(strict_types=1);

const GAME_TICKET_TIERS = [
    'silver' => ['score' => 5000, 'pct' => 10, 'monthly_cap' => null, 'name' => 'Silver Ticket'],
    'gold'   => ['score' => 9999, 'pct' => 35, 'monthly_cap' => 10,   'name' => 'Golden Ticket'],
];

final class GameTickets
{
    /** El puntaje mínimo para cualquier ticket (y para la skin dorada). */
    public static function minScore(): int
    {
        return GAME_TICKET_TIERS['silver']['score'];
    }

    public static function ensureSchema(): void
    {
        static $done = false;
        if ($done) return;
        $done = true;

        $have = array_column(Database::fetchAll('SHOW COLUMNS FROM user_profiles'), 'Field');
        if (!in_array('ticket_tier', $have, true)) {
            Database::query("ALTER TABLE user_profiles ADD COLUMN ticket_tier VARCHAR(8) DEFAULT NULL");
        }
        if (!in_array('ticket_won_at', $have, true)) {
            Database::query("ALTER TABLE user_profiles ADD COLUMN ticket_won_at DATETIME DEFAULT NULL");
        }
        Database::query("
            CREATE TABLE IF NOT EXISTS game_ticket_awards (
              id          INT AUTO_INCREMENT PRIMARY KEY,
              profile_id  INT NOT NULL,
              tier        VARCHAR(8) NOT NULL,
              score       INT NOT NULL DEFAULT 0,
              upgraded    TINYINT(1) NOT NULL DEFAULT 0,
              won_at      DATETIME NOT NULL,
              INDEX idx_won (won_at),
              INDEX idx_profile (profile_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    /** Nivel del ticket vivo de la cuenta, o null si no tiene uno sin usar. */
    public static function aliveTier(?array $profile): ?string
    {
        if (!$profile || (int)($profile['golden_ticket'] ?? 0) !== 1 || !empty($profile['ticket_burned'])) return null;
        return self::tierOf($profile);
    }

    /** Nivel del ticket de la cuenta (vivo o usado). Los de antes de los niveles eran de 35 %. */
    public static function tierOf(array $profile): ?string
    {
        if ((int)($profile['golden_ticket'] ?? 0) !== 1) return null;
        $tier = (string)($profile['ticket_tier'] ?? '');
        return isset(GAME_TICKET_TIERS[$tier]) ? $tier : 'gold';
    }

    public static function pct(?string $tier): int
    {
        return $tier && isset(GAME_TICKET_TIERS[$tier]) ? GAME_TICKET_TIERS[$tier]['pct'] : 0;
    }

    /** "Golden Ticket 35%": la etiqueta del descuento en pedidos, Stripe y correos. */
    public static function label(?string $tier): string
    {
        if (!$tier || !isset(GAME_TICKET_TIERS[$tier])) return '';
        return GAME_TICKET_TIERS[$tier]['name'] . ' ' . GAME_TICKET_TIERS[$tier]['pct'] . '%';
    }

    /** Cupón de Stripe de cada nivel. El de 35 % conserva el id que ya existía. */
    public static function couponId(string $tier): string
    {
        return $tier === 'gold' ? 'skr_golden_ticket_35' : 'skr_' . $tier . '_ticket_' . self::pct($tier);
    }

    public static function monthStart(): string
    {
        return date('Y-m-01 00:00:00');
    }

    public static function wonThisMonth(string $tier): int
    {
        $row = Database::fetchOne(
            'SELECT COUNT(*) AS n FROM game_ticket_awards WHERE tier = ? AND won_at >= ?',
            [$tier, self::monthStart()]
        );
        return (int)($row['n'] ?? 0);
    }

    /** Lo que se muestra en el juego: cuánto pide y da cada ticket, y cuántos Golden quedan este mes. */
    public static function publicStats(): array
    {
        $tiers = [];
        foreach (GAME_TICKET_TIERS as $key => $t) {
            $won = self::wonThisMonth($key);
            $tiers[$key] = [
                'score' => $t['score'],
                'pct' => $t['pct'],
                'name' => $t['name'],
                'monthly_cap' => $t['monthly_cap'],
                'won_this_month' => $won,
                'left_this_month' => $t['monthly_cap'] === null ? null : max(0, $t['monthly_cap'] - $won),
            ];
        }
        return [
            'tiers' => $tiers,
            'month' => date('Y-m'),
            'resets_at' => date('Y-m-01', strtotime('first day of next month')),
        ];
    }

    /** Solo lo fijo (sin conteos), para el catálogo de la tienda. */
    public static function publicTiers(): array
    {
        $out = [];
        foreach (GAME_TICKET_TIERS as $key => $t) {
            $out[$key] = ['score' => $t['score'], 'pct' => $t['pct'], 'name' => $t['name'], 'monthly_cap' => $t['monthly_cap']];
        }
        return $out;
    }

    /**
     * Decide y guarda el premio de una partida ya validada. Devuelve
     * ['awarded' => silver|gold|null, 'upgraded' => bool, 'reason' => ?string].
     * `reason` explica por qué no hubo premio (o por qué fue Silver con 9,999):
     * holding | monthly_limit | gold_sold_out | ip_limit.
     *
     * El tope de Golden se respeta con un candado de MySQL: dos partidas que
     * terminan al mismo tiempo con el 10.º disponible no se llevan las dos.
     */
    public static function award(array $profile, int $score, bool $ipQuotaUsed): array
    {
        $none = fn(?string $reason) => ['awarded' => null, 'upgraded' => false, 'reason' => $reason];
        if ($score < self::minScore()) return $none(null);

        $alive = self::aliveTier($profile);
        $wantsGold = $score >= GAME_TICKET_TIERS['gold']['score'];

        if ($alive === 'gold') return $none('holding');
        if ($alive === 'silver' && !$wantsGold) return $none('holding');
        if ($alive === null) {
            $wonAt = (string)($profile['ticket_won_at'] ?? '');
            if ($wonAt !== '' && $wonAt >= self::monthStart()) return $none('monthly_limit');
            if ($ipQuotaUsed) return $none('ip_limit');
        }

        $lock = Database::fetchOne("SELECT GET_LOCK('skr_ticket_award', 5) AS l");
        try {
            $tier = 'silver';
            $reason = null;
            if ($wantsGold) {
                if (self::wonThisMonth('gold') < GAME_TICKET_TIERS['gold']['monthly_cap']) {
                    $tier = 'gold';
                } else {
                    $reason = 'gold_sold_out';
                }
            }
            // Con un Silver vivo solo cuenta subir a Golden.
            if ($alive === 'silver' && $tier !== 'gold') return $none($reason ?? 'holding');

            $now = date('Y-m-d H:i:s');
            Database::update('user_profiles', [
                'golden_ticket' => 1,
                'ticket_burned' => 0,
                'ticket_tier' => $tier,
                'ticket_won_at' => $now,
                'ticket_source' => 'game',
            ], 'id = ?', [(int)$profile['id']]);
            Database::insert('game_ticket_awards', [
                'profile_id' => (int)$profile['id'],
                'tier' => $tier,
                'score' => $score,
                'upgraded' => $alive === 'silver' ? 1 : 0,
                'won_at' => $now,
            ]);
            return ['awarded' => $tier, 'upgraded' => $alive === 'silver', 'reason' => $reason];
        } finally {
            if ((int)($lock['l'] ?? 0) === 1) Database::query("SELECT RELEASE_LOCK('skr_ticket_award')");
        }
    }
}
