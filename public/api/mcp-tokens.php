<?php
/**
 * Tokens del MCP, administrados desde el CMS.
 *
 *   GET  ?action=list     → todos los tokens (sin hash), activos primero
 *   POST ?action=create   → { name, scope } → el token EN CLARO, una sola vez
 *   POST ?action=revoke   → { id } → deja de funcionar en el siguiente request
 *
 * Solo con la sesión de Google del CMS (Middleware::requireAuth). A propósito
 * NO acepta un token MCP: si un token pudiera crear tokens, filtrar uno
 * bastaría para fabricar todos los que hagan falta y sobrevivir a la
 * revocación del primero.
 *
 * No hay "editar" ni "borrar": un token no se reutiliza para otra persona (se
 * revoca y se crea otro), y la fila revocada se queda para que la bitácora
 * (private/mcp.log) siga diciendo quién era el token N.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';

Middleware::cors();
Middleware::json();
Middleware::noCache();

$user = Middleware::requireAuth();
if (!Middleware::rateLimit('mcp_tokens', 30, 60)) {
    Middleware::error('rate_limited', 429);
}

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

/** Fila pública: todo menos el hash. */
function publicToken(array $r): array
{
    return [
        'id' => (int) $r['id'],
        'name' => $r['name'],
        'hint' => $r['token_hint'],
        'legacy' => $r['hash_algo'] === 'bcrypt',
        'scope' => $r['scope'],
        'created_by' => $r['created_by'],
        'created_at' => $r['created_at'],
        'last_used_at' => $r['last_used_at'],
        'last_used_ip' => $r['last_used_ip'],
        'revoked_at' => $r['revoked_at'],
    ];
}

try {
    McpAuth::ensureTable();

    switch ("{$method} {$action}") {

        case 'GET list': {
            $rows = Database::fetchAll(
                'SELECT * FROM mcp_tokens ORDER BY (revoked_at IS NULL) DESC, created_at DESC, id DESC'
            );
            // Cuántos Claude están conectados con cada llave ahora mismo.
            $conn = McpOAuth::activeConnections();
            Middleware::success([
                'tokens' => array_map(fn($r) => publicToken($r) + ['connections' => $r['revoked_at'] ? 0 : ($conn[(int) $r['id']] ?? 0)], $rows),
                'connector_url' => McpOAuth::publicUrl() . '/mcp',
            ]);
            break;
        }

        case 'POST create': {
            $data = Middleware::getJsonBody();
            $name = trim((string) ($data['name'] ?? ''));
            $scope = McpAuth::normalizeScope((string) ($data['scope'] ?? 'shop'));
            if ($name === '' || mb_strlen($name) > 120) {
                Middleware::error('name_required', 422, ['detail' => 'Ponle un nombre a la llave (hasta 120 caracteres).']);
            }

            $token = McpAuth::generate();
            $id = McpAuth::store($name, $scope, McpAuth::hashOf($token), substr($token, 0, 8), (string) ($user['email'] ?? ''));
            McpAuth::log('token.create', ['id' => $id, 'name' => $name, 'scope' => $scope, 'by' => $user['email'] ?? null]);

            $row = Database::fetchOne('SELECT * FROM mcp_tokens WHERE id = ?', [$id]);
            // Única vez que el token sale del servidor: no se guarda en claro.
            Middleware::success(['token' => $token, 'row' => publicToken($row)]);
            break;
        }

        case 'POST revoke': {
            $data = Middleware::getJsonBody();
            $id = (int) ($data['id'] ?? 0);
            $row = $id > 0 ? Database::fetchOne('SELECT * FROM mcp_tokens WHERE id = ?', [$id]) : null;
            if (!$row) {
                Middleware::error('not_found', 404, ['detail' => 'Esa llave no existe.']);
            }
            if ($row['revoked_at'] === null) {
                Database::query('UPDATE mcp_tokens SET revoked_at = ? WHERE id = ?', [date('Y-m-d H:i:s'), $id]);
                McpAuth::log('token.revoke', ['id' => $id, 'name' => $row['name'], 'by' => $user['email'] ?? null]);
            }
            $row = Database::fetchOne('SELECT * FROM mcp_tokens WHERE id = ?', [$id]);
            Middleware::success(['row' => publicToken($row)]);
            break;
        }

        default:
            Middleware::error('unknown_action', 400);
    }
}
catch (Throwable $e) {
    McpAuth::log('error', ['endpoint' => 'mcp-tokens', 'action' => $action, 'message' => $e->getMessage()]);
    Middleware::error('server_error', 500);
}
