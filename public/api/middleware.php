<?php
/**
 * Middleware de autenticación y utilidades comunes
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

class Middleware {
    private static array $config = [];

    public static function getConfig(): array {
        if (empty(self::$config)) {
            self::$config = Database::getConfig();
        }
        return self::$config;
    }

    /**
     * Configurar headers CORS
     */
    public static function cors(): void {
        $config = self::getConfig();
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if ($origin && in_array($origin, $config['ALLOWED_ORIGINS'], true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Vary: Origin');
        }

        // Preflight request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    /**
     * Headers JSON
     */
    public static function json(): void {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }

    /**
     * Headers to prevent caching
     */
    public static function noCache(): void {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Cache-Control: post-check=0, pre-check=0', false);
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    /**
     * Verificar sesión de usuario
     * @return array|null Usuario si está autenticado, null si no
     */
    public static function checkAuth(): ?array {
        $config = self::getConfig();
        $cookieName = $config['SESSION_COOKIE_NAME'] ?? 'mroscar_session';
        
        $sessionId = $_COOKIE[$cookieName] ?? null;
        if (!$sessionId) {
            return null;
        }

        // Buscar sesión válida
        $session = Database::fetchOne(
            'SELECT s.*, u.id as user_id, u.email, u.name, u.avatar_url 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.id = ? AND s.expires_at > NOW()',
            [$sessionId]
        );

        if (!$session) {
            // Limpiar cookie inválida
            self::clearSessionCookie();
            return null;
        }

        return [
            'id' => $session['user_id'],
            'email' => $session['email'],
            'name' => $session['name'],
            'avatar_url' => $session['avatar_url'],
        ];
    }

    /**
     * Requerir autenticación (termina con 401 si no está autenticado)
     */
    public static function requireAuth(): array {
        $user = self::checkAuth();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'unauthorized']);
            exit;
        }
        return $user;
    }

    /**
     * Crear sesión para usuario
     */
    public static function createSession(int $userId): string {
        $config = self::getConfig();
        $sessionId = bin2hex(random_bytes(32));
        $lifetime = $config['SESSION_LIFETIME'] ?? 86400;
        $expiresAt = date('Y-m-d H:i:s', time() + $lifetime);

        // Limpiar sesiones anteriores del usuario
        Database::delete('sessions', 'user_id = ?', [$userId]);

        // Crear nueva sesión
        Database::query(
            'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
            [$sessionId, $userId, $expiresAt]
        );

        // Establecer cookie
        $cookieName = $config['SESSION_COOKIE_NAME'] ?? 'mroscar_session';
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        
        setcookie($cookieName, $sessionId, [
            'expires' => time() + $lifetime,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        return $sessionId;
    }

    /**
     * Destruir sesión
     */
    public static function destroySession(): void {
        $config = self::getConfig();
        $cookieName = $config['SESSION_COOKIE_NAME'] ?? 'mroscar_session';
        
        $sessionId = $_COOKIE[$cookieName] ?? null;
        if ($sessionId) {
            Database::delete('sessions', 'id = ?', [$sessionId]);
        }

        self::clearSessionCookie();
    }

    /**
     * Limpiar cookie de sesión
     */
    private static function clearSessionCookie(): void {
        $config = self::getConfig();
        $cookieName = $config['SESSION_COOKIE_NAME'] ?? 'mroscar_session';
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

        setcookie($cookieName, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    /**
     * Leer body JSON
     */
    public static function getJsonBody(): array {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Respuesta JSON de éxito
     */
    public static function success(array $data = []): void {
        echo json_encode(array_merge(['ok' => true], $data));
        exit;
    }

    /**
     * Respuesta JSON de error
     */
    public static function error(string $message, int $code = 400, array $extra = []): void {
        http_response_code($code);
        echo json_encode(array_merge(['ok' => false, 'error' => $message], $extra));
        exit;
    }

    /**
     * Sanitizar string para slug
     */
    public static function slugify(string $text): string {
        $text = preg_replace('~[^\pL\d]+~u', '-', $text);
        $text = iconv('utf-8', 'us-ascii//TRANSLIT', $text);
        $text = preg_replace('~[^-\w]+~', '', $text);
        $text = trim($text, '-');
        $text = preg_replace('~-+~', '-', $text);
        $text = strtolower($text);
        return $text ?: 'untitled';
    }

    /**
     * Rate limiting simple basado en IP
     */
    public static function rateLimit(string $key, int $max, int $windowSeconds): bool {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $bucket = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "rl_{$key}_" . md5($ip);
        $now = time();
        $events = [];

        if (is_file($bucket)) {
            $json = @file_get_contents($bucket);
            $arr = json_decode($json ?: '[]', true);
            if (is_array($arr)) $events = $arr;
        }

        // Filtrar eventos dentro de la ventana
        $events = array_values(array_filter($events, fn($t) => is_int($t) && ($now - $t) < $windowSeconds));
        
        if (count($events) >= $max) {
            return false;
        }

        $events[] = $now;
        @file_put_contents($bucket, json_encode($events), LOCK_EX);
        return true;
    }
}
