<?php
/**
 * OAuth 2.1 mínimo para que Claude se conecte al MCP remoto (mcp-remote.php).
 *
 * Por qué existe: los conectores personalizados de Claude (claude.ai, Desktop,
 * móvil) autentican por persona SOLO con OAuth — registro dinámico de clientes
 * (RFC 7591) y PKCE S256. No aceptan una llave fija en un header (beta, y
 * compartida por toda la organización) ni en la URL (prohibido). Ver
 * https://claude.com/docs/connectors/building/authentication
 *
 * La llave de cada colaborador (mcp_tokens, se crea en el CMS) sigue siendo
 * la identidad: la página de autorización (mcp-oauth.php?action=authorize) se
 * la pide, y todo lo que emite este archivo queda atado a esa llave. Revocar
 * la llave en el CMS corta todas sus conexiones en el siguiente request.
 *
 * Todo se guarda como SHA-256: códigos, tokens de acceso y de renovación son
 * aleatorios de 256 bits, no contraseñas.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';

final class McpOAuth
{
    public const ACCESS_PREFIX = 'mat_';
    private const REFRESH_PREFIX = 'mrt_';
    public const ACCESS_TTL = 3600;              // 1 h; Claude renueva solo
    private const REFRESH_TTL = 60 * 86400;      // 60 días sin usarse
    private const CODE_TTL = 600;                // 10 min para canjear el código
    private static bool $ready = false;

    /**
     * Dónde puede regresar el código. Solo Claude: el callback de las apps
     * hospedadas y el loopback de Claude Code (puerto efímero). Cualquier otro
     * destino sería un camino para robar códigos con un cliente falso.
     */
    public static function redirectAllowed(string $uri): bool
    {
        if (in_array($uri, ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'], true))
            return true;
        return (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:\d{1,5})?/callback$#', $uri);
    }

    public static function ensureTables(): void
    {
        if (self::$ready)
            return;
        self::$ready = true;

        Database::query("
            CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
              client_id     VARCHAR(64) PRIMARY KEY,
              client_name   VARCHAR(200) DEFAULT NULL,
              redirect_uris TEXT NOT NULL,
              created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        Database::query("
            CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
              code_hash      CHAR(64) PRIMARY KEY,
              client_id      VARCHAR(64) NOT NULL,
              key_id         INT NOT NULL,
              redirect_uri   TEXT NOT NULL,
              code_challenge VARCHAR(128) NOT NULL,
              expires_at     DATETIME NOT NULL,
              used_at        DATETIME DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        Database::query("
            CREATE TABLE IF NOT EXISTS mcp_oauth_grants (
              id                 INT AUTO_INCREMENT PRIMARY KEY,
              key_id             INT NOT NULL,
              client_id          VARCHAR(64) NOT NULL,
              access_hash        CHAR(64) NOT NULL,
              access_expires_at  DATETIME NOT NULL,
              refresh_hash       CHAR(64) NOT NULL,
              refresh_expires_at DATETIME NOT NULL,
              created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              revoked_at         DATETIME DEFAULT NULL,
              UNIQUE KEY uq_access (access_hash),
              UNIQUE KEY uq_refresh (refresh_hash),
              INDEX idx_key (key_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    /**
     * Origen público del sitio: el issuer de OAuth y la base de la URL del
     * conector (`/mcp`). Tiene que coincidir EXACTO con la URL que el
     * colaborador pega en Claude. En local se cambia con MCP_PUBLIC_URL.
     */
    public static function publicUrl(): string
    {
        return rtrim((string) (Middleware::getConfig()['MCP_PUBLIC_URL'] ?? 'https://mroscar.xyz'), '/');
    }

    private static function now(int $plus = 0): string
    {
        return date('Y-m-d H:i:s', time() + $plus);
    }

    /** Registro dinámico (RFC 7591). Devuelve el client_id o null si los redirect no sirven. */
    public static function registerClient(string $name, array $redirectUris): ?string
    {
        self::ensureTables();
        $uris = array_values(array_unique(array_filter(array_map('strval', $redirectUris))));
        if (!$uris)
            return null;
        foreach ($uris as $u) {
            if (!self::redirectAllowed($u))
                return null;
        }
        $id = 'mcpc_' . bin2hex(random_bytes(16));
        Database::insert('mcp_oauth_clients', [
            'client_id' => $id,
            'client_name' => mb_substr(trim($name), 0, 200) ?: null,
            'redirect_uris' => json_encode($uris, JSON_UNESCAPED_SLASHES),
        ]);
        return $id;
    }

    public static function client(string $clientId): ?array
    {
        self::ensureTables();
        $c = Database::fetchOne('SELECT * FROM mcp_oauth_clients WHERE client_id = ?', [$clientId]);
        if (!$c)
            return null;
        $c['redirect_uris'] = json_decode((string) $c['redirect_uris'], true) ?: [];
        return $c;
    }

    /** ¿Este redirect es uno de los que registró el cliente? Loopback: el puerto no cuenta. */
    public static function redirectMatches(array $client, string $uri): bool
    {
        foreach ($client['redirect_uris'] as $reg) {
            if ($reg === $uri)
                return true;
            $strip = fn(string $u) => preg_replace('#^(http://(?:localhost|127\.0\.0\.1)):\d+/#', '$1/', $u);
            if (str_starts_with($reg, 'http://') && $strip($reg) === $strip($uri) && self::redirectAllowed($uri))
                return true;
        }
        return false;
    }

    public static function createCode(string $clientId, int $keyId, string $redirectUri, string $challenge): string
    {
        self::ensureTables();
        $code = bin2hex(random_bytes(32));
        Database::insert('mcp_oauth_codes', [
            'code_hash' => hash('sha256', $code),
            'client_id' => $clientId,
            'key_id' => $keyId,
            'redirect_uri' => $redirectUri,
            'code_challenge' => $challenge,
            'expires_at' => self::now(self::CODE_TTL),
        ]);
        // Limpieza oportunista de lo vencido.
        if (random_int(1, 20) === 1) {
            Database::query('DELETE FROM mcp_oauth_codes WHERE expires_at < ?', [self::now(-86400)]);
            Database::query('DELETE FROM mcp_oauth_grants WHERE refresh_expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)', [self::now(), self::now(-30 * 86400)]);
        }
        return $code;
    }

    private static function pkceOk(string $verifier, string $challenge): bool
    {
        if (!preg_match('/^[A-Za-z0-9\-._~]{43,128}$/', $verifier))
            return false;
        $calc = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
        return hash_equals($challenge, $calc);
    }

    /** Llave activa por id, o null si se revocó. */
    private static function activeKey(int $keyId): ?array
    {
        return Database::fetchOne('SELECT * FROM mcp_tokens WHERE id = ? AND revoked_at IS NULL', [$keyId]) ?: null;
    }

    /** Emite un par acceso + renovación para la llave. */
    private static function issue(int $keyId, string $clientId): array
    {
        $access = self::ACCESS_PREFIX . bin2hex(random_bytes(32));
        $refresh = self::REFRESH_PREFIX . bin2hex(random_bytes(32));
        Database::insert('mcp_oauth_grants', [
            'key_id' => $keyId,
            'client_id' => $clientId,
            'access_hash' => hash('sha256', $access),
            'access_expires_at' => self::now(self::ACCESS_TTL),
            'refresh_hash' => hash('sha256', $refresh),
            'refresh_expires_at' => self::now(self::REFRESH_TTL),
        ]);
        return [
            'access_token' => $access,
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
            'refresh_token' => $refresh,
            'scope' => 'mcp',
        ];
    }

    /**
     * Canjea un código de autorización. Devuelve el par de tokens o el código
     * de error OAuth ('invalid_grant', 'invalid_client'…).
     */
    public static function exchangeCode(string $code, string $clientId, string $redirectUri, string $verifier): array|string
    {
        self::ensureTables();
        $row = Database::fetchOne('SELECT * FROM mcp_oauth_codes WHERE code_hash = ?', [hash('sha256', $code)]);
        if (!$row || $row['used_at'] !== null || strtotime((string) $row['expires_at']) < time())
            return 'invalid_grant';
        if (!hash_equals((string) $row['client_id'], $clientId))
            return 'invalid_grant';
        if ($redirectUri !== '' && !hash_equals((string) $row['redirect_uri'], $redirectUri))
            return 'invalid_grant';
        if (!self::pkceOk($verifier, (string) $row['code_challenge']))
            return 'invalid_grant';

        // Un código, un canje: el UPDATE condicionado gana la carrera si llegan dos.
        $used = Database::query(
            'UPDATE mcp_oauth_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL',
            [self::now(), $row['code_hash']]
        )->rowCount();
        if ($used !== 1)
            return 'invalid_grant';
        if (!self::activeKey((int) $row['key_id']))
            return 'invalid_grant';

        return self::issue((int) $row['key_id'], $clientId);
    }

    /** Renovación con rotación: el token de renovación usado deja de servir. */
    public static function refresh(string $refresh, string $clientId): array|string
    {
        self::ensureTables();
        $row = Database::fetchOne('SELECT * FROM mcp_oauth_grants WHERE refresh_hash = ?', [hash('sha256', $refresh)]);
        if (!$row || $row['revoked_at'] !== null || strtotime((string) $row['refresh_expires_at']) < time())
            return 'invalid_grant';
        if ($clientId !== '' && !hash_equals((string) $row['client_id'], $clientId))
            return 'invalid_grant';
        if (!self::activeKey((int) $row['key_id']))
            return 'invalid_grant';

        $rotated = Database::query(
            'UPDATE mcp_oauth_grants SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
            [self::now(), $row['id']]
        )->rowCount();
        if ($rotated !== 1)
            return 'invalid_grant';

        return self::issue((int) $row['key_id'], (string) $row['client_id']);
    }

    /** La llave detrás de un token de acceso vigente, o null. */
    public static function keyForAccessToken(string $access): ?array
    {
        self::ensureTables();
        $row = Database::fetchOne(
            'SELECT t.* FROM mcp_oauth_grants g
             JOIN mcp_tokens t ON t.id = g.key_id
             WHERE g.access_hash = ? AND g.revoked_at IS NULL AND g.access_expires_at > ? AND t.revoked_at IS NULL',
            [hash('sha256', $access), self::now()]
        );
        return $row ?: null;
    }

    /** Conexiones vivas por llave, para el CMS. */
    public static function activeConnections(): array
    {
        self::ensureTables();
        $rows = Database::fetchAll(
            'SELECT key_id, COUNT(*) AS n FROM mcp_oauth_grants
             WHERE revoked_at IS NULL AND refresh_expires_at > ? GROUP BY key_id',
            [self::now()]
        );
        $out = [];
        foreach ($rows as $r)
            $out[(int) $r['key_id']] = (int) $r['n'];
        return $out;
    }
}
