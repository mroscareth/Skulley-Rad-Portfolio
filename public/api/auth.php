<?php
/**
 * Autenticación con Google OAuth 2.0
 * 
 * Endpoints:
 *   GET  ?action=login    - Redirige a Google OAuth
 *   GET  ?action=callback - Callback de Google
 *   POST ?action=logout   - Cerrar sesión
 *   GET  ?action=me       - Usuario actual
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

$config = Middleware::getConfig();
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($config);
        break;
    case 'callback':
        handleCallback($config);
        break;
    case 'logout':
        handleLogout($config);
        break;
    case 'me':
        handleMe();
        break;
    default:
        Middleware::error('invalid_action', 400);
}

/**
 * Iniciar flujo OAuth - redirigir a Google
 */
function handleLogin(array $config): void {
    $clientId = $config['GOOGLE_CLIENT_ID'] ?? '';
    $redirectUri = $config['GOOGLE_REDIRECT_URI'] ?? '';

    if (!$clientId || !$redirectUri) {
        Middleware::error('oauth_not_configured', 500);
    }

    // Generar state para prevenir CSRF
    $state = bin2hex(random_bytes(16));
    setcookie('oauth_state', $state, [
        'expires' => time() + 600, // 10 minutos
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    $params = http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => 'openid email profile',
        'state' => $state,
        'access_type' => 'online',
        'prompt' => 'select_account',
    ]);

    $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
    
    header('Location: ' . $authUrl);
    exit;
}

/**
 * Callback de Google - intercambiar code por tokens
 */
function handleCallback(array $config): void {
    $adminUrl = $config['ADMIN_URL'] ?? '/admin';
    
    // Verificar errores de Google
    if (isset($_GET['error'])) {
        $error = $_GET['error'];
        header("Location: {$adminUrl}?error=" . urlencode($error));
        exit;
    }

    $code = $_GET['code'] ?? '';
    $state = $_GET['state'] ?? '';
    $savedState = $_COOKIE['oauth_state'] ?? '';

    // Verificar state (CSRF protection)
    if (!$state || !$savedState || !hash_equals($savedState, $state)) {
        header("Location: {$adminUrl}?error=invalid_state");
        exit;
    }

    // Limpiar cookie de state
    setcookie('oauth_state', '', ['expires' => time() - 3600, 'path' => '/']);

    if (!$code) {
        header("Location: {$adminUrl}?error=no_code");
        exit;
    }

    // Intercambiar code por access token
    $tokenData = exchangeCodeForToken($config, $code);
    if (!$tokenData) {
        header("Location: {$adminUrl}?error=token_exchange_failed");
        exit;
    }

    // Obtener información del usuario
    $userInfo = getUserInfo($tokenData['access_token']);
    if (!$userInfo) {
        header("Location: {$adminUrl}?error=user_info_failed");
        exit;
    }

    $email = $userInfo['email'] ?? '';
    $googleId = $userInfo['sub'] ?? $userInfo['id'] ?? '';
    $name = $userInfo['name'] ?? '';
    $avatar = $userInfo['picture'] ?? '';

    // Verificar que el email está en la whitelist
    if (!isEmailAllowed($email)) {
        header("Location: {$adminUrl}?error=unauthorized");
        exit;
    }

    // Crear o actualizar usuario
    $userId = upsertUser($googleId, $email, $name, $avatar);

    // Crear sesión
    Middleware::createSession($userId);

    // Redirigir al admin
    header("Location: {$adminUrl}");
    exit;
}

/**
 * Cerrar sesión
 */
function handleLogout(array $config): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Middleware::error('method_not_allowed', 405);
    }

    Middleware::destroySession();
    Middleware::success(['message' => 'logged_out']);
}

/**
 * Obtener usuario actual
 */
function handleMe(): void {
    $user = Middleware::checkAuth();
    
    if (!$user) {
        Middleware::error('unauthorized', 401);
    }

    Middleware::success(['user' => $user]);
}

/**
 * Intercambiar authorization code por access token
 */
function exchangeCodeForToken(array $config, string $code): ?array {
    $url = 'https://oauth2.googleapis.com/token';
    
    $postData = http_build_query([
        'client_id' => $config['GOOGLE_CLIENT_ID'],
        'client_secret' => $config['GOOGLE_CLIENT_SECRET'],
        'code' => $code,
        'grant_type' => 'authorization_code',
        'redirect_uri' => $config['GOOGLE_REDIRECT_URI'],
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $postData,
            'timeout' => 10,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if (!$response) {
        return null;
    }

    $data = json_decode($response, true);
    if (!isset($data['access_token'])) {
        return null;
    }

    return $data;
}

/**
 * Obtener información del usuario de Google
 */
function getUserInfo(string $accessToken): ?array {
    $url = 'https://www.googleapis.com/oauth2/v3/userinfo';
    
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Authorization: Bearer {$accessToken}\r\n",
            'timeout' => 10,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if (!$response) {
        return null;
    }

    return json_decode($response, true);
}

/**
 * Verificar si el email está en la whitelist
 */
function isEmailAllowed(string $email): bool {
    if (!$email) return false;
    
    $result = Database::fetchOne(
        'SELECT id FROM allowed_emails WHERE email = ?',
        [strtolower($email)]
    );

    return $result !== null;
}

/**
 * Crear o actualizar usuario
 */
function upsertUser(string $googleId, string $email, string $name, string $avatar): int {
    $existing = Database::fetchOne(
        'SELECT id FROM users WHERE google_id = ?',
        [$googleId]
    );

    if ($existing) {
        // Actualizar usuario existente
        Database::update('users', [
            'email' => $email,
            'name' => $name,
            'avatar_url' => $avatar,
            'last_login' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$existing['id']]);

        return (int) $existing['id'];
    }

    // Crear nuevo usuario
    return Database::insert('users', [
        'google_id' => $googleId,
        'email' => $email,
        'name' => $name,
        'avatar_url' => $avatar,
    ]);
}
