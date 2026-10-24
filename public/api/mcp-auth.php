<?php
/**
 * Identidad del servidor MCP: un token de servicio, no una sesión.
 *
 * El CMS se autentica con la sesión de Google (Middleware::requireAuth), que
 * sirve para un humano con navegador y no para un proceso. Esto es el otro
 * camino: un token fijo que vive en config.local.php (fuera del repo, solo en
 * el servidor) y que el cliente manda en el header `X-MCP-Token`.
 *
 * Header propio y no `Authorization` por lo mismo que privy-auth.php: hay
 * hostings Apache/CGI que descartan `Authorization` antes de que PHP lo vea.
 *
 * Config esperada en config.local.php:
 *   'MCP_TOKEN_HASH' => '<salida de password_hash(TOKEN, PASSWORD_DEFAULT)>'
 *   'MCP_SCOPE'      => 'read'   // 'read' | 'write'  (default: 'read')
 *
 * Se guarda el HASH, no el token: si alguien lee el config no obtiene una
 * credencial usable contra otro sitio. La comparación va con password_verify,
 * que es de tiempo constante.
 *
 * Sin MCP_TOKEN_HASH configurado, esto niega todo. Es a propósito: un deploy
 * que no definió el token no debe quedar abierto.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';

final class McpAuth
{
    private static ?bool $cached = null;

    private static function configuredHash(): string
    {
        return trim((string) (Middleware::getConfig()['MCP_TOKEN_HASH'] ?? ''));
    }

    public static function isConfigured(): bool
    {
        return self::configuredHash() !== '';
    }

    /** 'read' o 'write'. Por defecto 'read': ampliar es una decisión explícita. */
    public static function scope(): string
    {
        $s = strtolower(trim((string) (Middleware::getConfig()['MCP_SCOPE'] ?? 'read')));
        return $s === 'write' ? 'write' : 'read';
    }

    private static function tokenFromRequest(): string
    {
        return trim((string) ($_SERVER['HTTP_X_MCP_TOKEN'] ?? ''));
    }

    public static function isAuthenticated(): bool
    {
        if (self::$cached !== null)
            return self::$cached;

        $hash = self::configuredHash();
        $token = self::tokenFromRequest();

        if ($hash === '' || $token === '') {
            return self::$cached = false;
        }
        return self::$cached = password_verify($token, $hash);
    }

    /**
     * Puerta de entrada de todo endpoint MCP. Termina el request si algo falla.
     *
     * El rate limit va antes de comparar el token: si no, un atacante puede
     * probar tokens a la velocidad que aguante el servidor. 60 por minuto deja
     * trabajar a un agente y no deja hacer fuerza bruta.
     */
    public static function require(string $neededScope = 'read'): void
    {
        if (!Middleware::rateLimit('mcp', 60, 60)) {
            Middleware::error('rate_limited', 429);
        }
        if (!self::isConfigured()) {
            Middleware::error('mcp_not_configured', 503);
        }
        if (!self::isAuthenticated()) {
            self::log('auth_failed', ['scope' => $neededScope]);
            Middleware::error('unauthorized', 401);
        }
        if ($neededScope === 'write' && self::scope() !== 'write') {
            Middleware::error('read_only_token', 403);
        }
    }

    /**
     * Puerta compartida entre el CMS y el MCP.
     *
     * Pasa con la sesión de Google (un humano en el CMS) o con un token de
     * escritura (un proceso). Se usa para abrirle a MCP endpoints de admin
     * que YA existen, en vez de reimplementar su validación: los productos
     * tienen doscientas líneas de reglas de ediciones, variantes y precios, y
     * dos caminos que validan distinto terminan divergiendo.
     *
     * Se abre por acción, no por archivo. Lo que mueve dinero —reembolsos,
     * cancelar un PaymentIntent— se queda con requireAuth() a secas.
     */
    public static function requireAdminOrToken(string $endpoint): void
    {
        if (Middleware::checkAuth())
            return;

        self::require('write');
        self::log('admin_access', ['endpoint' => $endpoint]);
    }

    /**
     * Bitácora de lo que hace el token.
     *
     * Un humano en el CMS deja rastro en la pantalla; un proceso no deja
     * ninguno. Sin esto, si algo cambia en el sitio no hay forma de saber si
     * fue el agente, y esa duda es peor que el cambio.
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

            $line = json_encode([
                'at' => date('c'),
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
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
