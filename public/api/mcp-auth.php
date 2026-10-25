<?php
/**
 * Identidad del servidor MCP: tokens de servicio, no una sesión.
 *
 * El CMS se autentica con la sesión de Google (Middleware::requireAuth), que
 * sirve para un humano con navegador y no para un proceso. Esto es el otro
 * camino: un token que el cliente manda en el header `X-MCP-Token`.
 *
 * Header propio y no `Authorization` por lo mismo que privy-auth.php: hay
 * hostings Apache/CGI que descartan `Authorization` antes de que PHP lo vea.
 *
 * TOKENS EN LA BASE (desde 2026-10-24). Cada persona o computadora tiene el
 * suyo, con nombre, permiso (read/write), último uso y fecha de revocación.
 * Se crean y se revocan en el CMS (mcp-tokens.php, solo con sesión: un token
 * nunca puede crear otro). Antes había UN token en config.local.php; ese hash
 * se migra solo a la tabla como fila heredada y desde ahí se puede revocar.
 *
 * Se guarda el HASH, no el token. Los nuevos van con SHA-256: son 192 bits
 * aleatorios, no contraseñas, así que no hace falta un hash lento — y con uno
 * rápido se buscan por índice en vez de probar fila por fila. El heredado
 * venía en bcrypt y se verifica con password_verify (tiempo constante).
 *
 * Sin tokens activos, esto niega todo. Es a propósito: un deploy que no tiene
 * tokens no debe quedar abierto.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-oauth-lib.php';

/**
 * PERMISOS. Tres niveles, cada uno incluye al anterior:
 *   read   lee contenido (proyectos, posts) y el resumen de pedidos.
 *   shop   + administra la tienda: productos, pedidos, cupones.
 *   write  + edita contenido del sitio (proyectos, posts).
 * Ninguno reembolsa ni mueve dinero, y ninguno administra llaves.
 */
final class McpAuth
{
    public const SCOPES = ['read' => 1, 'shop' => 2, 'write' => 3];

    /** @var array|null|false fila del token del request; false = ya se buscó y no hay */
    private static $current = null;
    private static bool $tableReady = false;

    public const PREFIX = 'mcp_';

    /** Crea la tabla y migra el token heredado de config.local.php (una vez). */
    public static function ensureTable(): void
    {
        if (self::$tableReady)
            return;
        self::$tableReady = true;

        Database::query("
            CREATE TABLE IF NOT EXISTS mcp_tokens (
              id            INT AUTO_INCREMENT PRIMARY KEY,
              name          VARCHAR(120) NOT NULL,
              token_hash    VARCHAR(255) NOT NULL,
              hash_algo     VARCHAR(10)  NOT NULL DEFAULT 'sha256',
              token_hint    VARCHAR(16)  DEFAULT NULL,
              scope         VARCHAR(10)  NOT NULL DEFAULT 'read',
              created_by    VARCHAR(255) DEFAULT NULL,
              created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              last_used_at  DATETIME DEFAULT NULL,
              last_used_ip  VARCHAR(45) DEFAULT NULL,
              revoked_at    DATETIME DEFAULT NULL,
              UNIQUE KEY uq_token_hash (token_hash)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // El token de config.local.php entra a la tabla UNA vez y desde ahí la
        // tabla manda. Se mira si ya hubo migración (aunque esa fila esté
        // revocada: revocar en el CMS no debe revivirlo) y no si existe ese
        // hash: una config que genera el hash al vuelo (config.dev.php hace
        // password_hash en cada request) daría un hash distinto cada vez.
        $legacy = trim((string) (Middleware::getConfig()['MCP_TOKEN_HASH'] ?? ''));
        if ($legacy !== '' && !Database::fetchOne("SELECT id FROM mcp_tokens WHERE created_by = 'config.local.php' LIMIT 1")) {
            $scope = strtolower(trim((string) (Middleware::getConfig()['MCP_SCOPE'] ?? 'read'))) === 'write' ? 'write' : 'read';
            Database::insert('mcp_tokens', [
                'name' => 'First token (server config)',
                'token_hash' => $legacy,
                'hash_algo' => 'bcrypt',
                'scope' => $scope,
                'created_by' => 'config.local.php',
            ]);
        }
    }

    /** Un token nuevo en claro. Se enseña una sola vez; aquí no se guarda. */
    public static function generate(): string
    {
        return self::PREFIX . bin2hex(random_bytes(24));
    }

    public static function hashOf(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Guarda un token por su hash. Lo usan el CMS (que acaba de generarlo) y
     * la línea de comandos (que lo generó en otra máquina y solo manda el
     * hash: el token en claro nunca sale de donde se va a usar).
     */
    public static function store(string $name, string $scope, string $sha256, string $hint, string $createdBy): int
    {
        self::ensureTable();
        return Database::insert('mcp_tokens', [
            'name' => $name,
            'token_hash' => $sha256,
            'hash_algo' => 'sha256',
            'token_hint' => $hint,
            'scope' => self::normalizeScope($scope),
            'created_by' => $createdBy,
        ]);
    }

    public static function normalizeScope(?string $scope): string
    {
        return isset(self::SCOPES[$scope]) ? $scope : 'read';
    }

    /** ¿Un token con `$have` alcanza para algo que pide `$need`? */
    public static function allows(string $have, string $need): bool
    {
        return (self::SCOPES[$have] ?? 0) >= (self::SCOPES[$need] ?? 99);
    }

    /**
     * La llave (fila de mcp_tokens) que corresponde a una credencial en claro,
     * si existe y no está revocada. Sirve para la llave misma (`mcp_…`) y para
     * la heredada en bcrypt; los tokens OAuth se resuelven aparte.
     */
    public static function findKey(string $raw): ?array
    {
        if ($raw === '')
            return null;
        self::ensureTable();
        $row = Database::fetchOne(
            "SELECT * FROM mcp_tokens WHERE token_hash = ? AND hash_algo = 'sha256' AND revoked_at IS NULL",
            [self::hashOf($raw)]
        );
        if ($row)
            return $row;
        // Heredados en bcrypt: son uno o dos, se prueban uno por uno.
        foreach (Database::fetchAll("SELECT * FROM mcp_tokens WHERE hash_algo = 'bcrypt' AND revoked_at IS NULL") as $candidate) {
            if (password_verify($raw, $candidate['token_hash']))
                return $candidate;
        }
        return null;
    }

    /** Marca el último uso de una llave (como mucho una escritura por minuto). */
    public static function touch(array $key): void
    {
        $last = $key['last_used_at'] ? strtotime((string) $key['last_used_at']) : 0;
        if (time() - $last > 60) {
            Database::query(
                'UPDATE mcp_tokens SET last_used_at = ?, last_used_ip = ? WHERE id = ?',
                [date('Y-m-d H:i:s'), substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), $key['id']]
            );
        }
    }

    public static function isConfigured(): bool
    {
        self::ensureTable();
        return (bool) Database::fetchOne('SELECT id FROM mcp_tokens WHERE revoked_at IS NULL LIMIT 1');
    }

    /**
     * La credencial del request. `X-MCP-Token` (servidor local y llamadas
     * internas del servidor remoto) o `Authorization: Bearer` (conectores de
     * Claude). Algunos Apache/CGI solo entregan Authorization como
     * REDIRECT_HTTP_AUTHORIZATION tras una reescritura (ver .htaccess).
     */
    public static function credentialFromRequest(): string
    {
        $x = trim((string) ($_SERVER['HTTP_X_MCP_TOKEN'] ?? ''));
        if ($x !== '')
            return $x;
        $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if ($auth === '' && function_exists('getallheaders')) {
            // mod_php sin la regla del .htaccess: el header sigue disponible
            // aquí aunque no llegue a $_SERVER.
            foreach ((array) getallheaders() as $name => $value) {
                if (strcasecmp((string) $name, 'Authorization') === 0) {
                    $auth = (string) $value;
                    break;
                }
            }
        }
        return preg_match('/^Bearer\s+(\S+)$/i', trim($auth), $m) ? $m[1] : '';
    }

    /**
     * La llave con que llegó el request, o null. Acepta la llave misma o un
     * token de acceso OAuth emitido para ella; en los dos casos devuelve la
     * fila de mcp_tokens, así que revocar la llave corta también sus
     * conexiones.
     */
    public static function current(): ?array
    {
        if (self::$current !== null)
            return self::$current ?: null;

        $cred = self::credentialFromRequest();
        $row = null;
        if ($cred !== '') {
            self::ensureTable();
            $row = str_starts_with($cred, McpOAuth::ACCESS_PREFIX)
                ? McpOAuth::keyForAccessToken($cred)
                : self::findKey($cred);
        }
        if (!$row) {
            self::$current = false;
            return null;
        }
        self::touch($row);
        return self::$current = $row;
    }

    public static function isAuthenticated(): bool
    {
        return self::current() !== null;
    }

    /** El permiso de la llave del request ('read' | 'shop' | 'write'). Sin llave, 'read'. */
    public static function scope(): string
    {
        return self::normalizeScope(self::current()['scope'] ?? 'read');
    }

    /**
     * Puerta de entrada de todo endpoint MCP. Termina el request si algo falla.
     *
     * Rate limit en dos carriles. Sin credencial válida, por IP y corto: es
     * el que frena a quien prueba llaves al azar (aunque con 192 bits no hay
     * fuerza bruta posible). Con llave válida, por llave: el servidor remoto
     * llama a estos endpoints desde la IP del propio servidor, y por IP todos
     * los colaboradores compartirían un mismo cupo.
     */
    public static function require(string $neededScope = 'read'): void
    {
        if (!self::isConfigured()) {
            Middleware::error('mcp_not_configured', 503);
        }
        if (!self::isAuthenticated()) {
            if (!Middleware::rateLimit('mcp_fail', 30, 60)) {
                Middleware::error('rate_limited', 429);
            }
            self::log('auth_failed', ['scope' => $neededScope]);
            Middleware::error('unauthorized', 401);
        }
        if (!Middleware::rateLimit('mcp_key_' . self::current()['id'], 180, 60)) {
            Middleware::error('rate_limited', 429);
        }
        if (!self::allows(self::scope(), $neededScope)) {
            Middleware::error($neededScope === 'shop' ? 'shop_scope_required' : 'read_only_token', 403);
        }
    }

    /**
     * Puerta compartida entre el CMS y el MCP para los endpoints de la tienda.
     *
     * Pasa con la sesión de Google (un humano en el CMS) o con una llave con
     * permiso de tienda. Se usa para abrirle a MCP endpoints de admin que YA
     * existen, en vez de reimplementar su validación: los productos tienen
     * doscientas líneas de reglas de ediciones, variantes y precios, y dos
     * caminos que validan distinto terminan divergiendo.
     *
     * Se abre por acción, no por archivo. Lo que mueve dinero —reembolsos,
     * cancelar un PaymentIntent— se queda con requireAuth() a secas. Igual que
     * administrar las propias llaves (mcp-tokens.php).
     */
    public static function requireAdminOrToken(string $endpoint): void
    {
        if (Middleware::checkAuth())
            return;

        self::require('shop');
        self::log('admin_access', ['endpoint' => $endpoint]);
    }

    /**
     * Bitácora de lo que hace cada token.
     *
     * Un humano en el CMS deja rastro en la pantalla; un proceso no deja
     * ninguno. Sin esto, si algo cambia en el sitio no hay forma de saber si
     * fue un agente ni cuál, y esa duda es peor que el cambio.
     *
     * Vive fuera del document root: es un archivo con actividad de admin.
     */
    public static function log(string $action, array $detail = []): void
    {
        try {
            $dir = dirname(__DIR__, 2) . '/private';
            if (!is_dir($dir))
                @mkdir($dir, 0775, true);
            if (!is_dir($dir))
                return;

            $tok = self::$current ?: null;
            $line = json_encode([
                'at' => date('c'),
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'token' => $tok ? ['id' => (int) $tok['id'], 'name' => $tok['name']] : null,
                'action' => $action,
                'detail' => $detail,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            @file_put_contents($dir . '/mcp.log', $line . "\n", FILE_APPEND | LOCK_EX);
        }
        catch (Throwable $e) {
            // Que un fallo de bitácora no tumbe la petición.
        }
    }
}
