<?php
/**
 * Servidor de autorización OAuth del MCP remoto. Ver mcp-oauth-lib.php.
 *
 *   ?action=as_metadata        /.well-known/oauth-authorization-server (RFC 8414)
 *   ?action=resource_metadata  /.well-known/oauth-protected-resource   (RFC 9728)
 *   ?action=register           /oauth/register   registro dinámico (RFC 7591)
 *   ?action=authorize          /oauth/authorize  página donde el colaborador pega su llave
 *   ?action=token              /oauth/token      canje de código y renovación
 *
 * Las rutas bonitas las pone .htaccess. Claude descubre todo solo a partir de
 * https://mroscar.xyz/mcp: lo único que el colaborador pega es esa URL, y
 * luego su llave en la página de autorización.
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$base = McpOAuth::publicUrl();

/** JSON con los headers que OAuth pide (sin caché). */
function oauthJson(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    header('Pragma: no-cache');
    header('Access-Control-Allow-Origin: *');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function oauthError(string $error, string $description = '', int $code = 400): void
{
    oauthJson(array_filter(['error' => $error, 'error_description' => $description]), $code);
}

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, MCP-Protocol-Version');
    http_response_code(204);
    exit;
}

try {
    McpAuth::ensureTable();
    McpOAuth::ensureTables();

    switch ($action) {

        case 'as_metadata':
            oauthJson([
                'issuer' => $base,
                'authorization_endpoint' => "{$base}/oauth/authorize",
                'token_endpoint' => "{$base}/oauth/token",
                'registration_endpoint' => "{$base}/oauth/register",
                'response_types_supported' => ['code'],
                'grant_types_supported' => ['authorization_code', 'refresh_token'],
                'code_challenge_methods_supported' => ['S256'],
                'token_endpoint_auth_methods_supported' => ['none'],
                'scopes_supported' => ['mcp', 'offline_access'],
                'service_documentation' => "{$base}/",
            ]);
            break;

        case 'resource_metadata':
            oauthJson([
                'resource' => "{$base}/mcp",
                'authorization_servers' => [$base],
                'scopes_supported' => ['mcp', 'offline_access'],
                'bearer_methods_supported' => ['header'],
                'resource_name' => 'mroscar.xyz',
            ]);
            break;

        case 'register': {
            if ($method !== 'POST')
                oauthError('invalid_request', 'Use POST', 405);
            if (!Middleware::rateLimit('mcp_register', 30, 3600))
                oauthError('temporarily_unavailable', 'Too many registrations', 429);

            $data = Middleware::getJsonBody();
            $uris = is_array($data['redirect_uris'] ?? null) ? $data['redirect_uris'] : [];
            $id = McpOAuth::registerClient((string) ($data['client_name'] ?? ''), $uris);
            if (!$id)
                oauthError('invalid_redirect_uri', 'Only Claude redirect URIs are accepted.');

            $client = McpOAuth::client($id);
            oauthJson([
                'client_id' => $id,
                'client_id_issued_at' => time(),
                'client_name' => $client['client_name'],
                'redirect_uris' => $client['redirect_uris'],
                'grant_types' => ['authorization_code', 'refresh_token'],
                'response_types' => ['code'],
                'token_endpoint_auth_method' => 'none',
            ], 201);
            break;
        }

        case 'token': {
            if ($method !== 'POST')
                oauthError('invalid_request', 'Use POST', 405);
            if (!Middleware::rateLimit('mcp_token', 120, 60))
                oauthError('temporarily_unavailable', 'Slow down', 429);

            // Form-urlencoded es lo estándar; se acepta JSON por si acaso.
            $p = $_POST ?: Middleware::getJsonBody();
            $grant = (string) ($p['grant_type'] ?? '');
            $clientId = (string) ($p['client_id'] ?? '');

            if ($grant === 'authorization_code') {
                if ($clientId === '' || !McpOAuth::client($clientId))
                    oauthError('invalid_client', 'Unknown client', 401);
                $r = McpOAuth::exchangeCode(
                    (string) ($p['code'] ?? ''),
                    $clientId,
                    (string) ($p['redirect_uri'] ?? ''),
                    (string) ($p['code_verifier'] ?? '')
                );
            }
            elseif ($grant === 'refresh_token') {
                $r = McpOAuth::refresh((string) ($p['refresh_token'] ?? ''), $clientId);
            }
            else {
                oauthError('unsupported_grant_type');
            }

            if (is_string($r))
                oauthError($r);
            oauthJson($r);
            break;
        }

        case 'authorize':
            handleAuthorize($base);
            break;

        default:
            oauthError('invalid_request', 'Unknown action', 404);
    }
}
catch (Throwable $e) {
    McpAuth::log('error', ['endpoint' => 'mcp-oauth', 'action' => $action, 'message' => $e->getMessage()]);
    oauthError('server_error', '', 500);
}

/**
 * La página de autorización. GET la pinta; POST valida la llave y regresa a
 * Claude con un código. Todo el estado viaja en el propio formulario (los
 * parámetros OAuth como campos ocultos), así que no hace falta sesión.
 */
function handleAuthorize(string $base): void
{
    $src = $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : $_GET;
    $q = [
        'response_type' => (string) ($src['response_type'] ?? ''),
        'client_id' => (string) ($src['client_id'] ?? ''),
        'redirect_uri' => (string) ($src['redirect_uri'] ?? ''),
        'state' => (string) ($src['state'] ?? ''),
        'code_challenge' => (string) ($src['code_challenge'] ?? ''),
        'code_challenge_method' => (string) ($src['code_challenge_method'] ?? ''),
        'scope' => (string) ($src['scope'] ?? ''),
        'resource' => (string) ($src['resource'] ?? ''),
    ];
    $es = preg_match('/^es\b/i', (string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')) === 1;

    // Sin cliente o redirect válidos NO se redirige a ningún lado: sería
    // mandar a la gente a una URL que no controlamos.
    $client = $q['client_id'] !== '' ? McpOAuth::client($q['client_id']) : null;
    if (!$client || $q['redirect_uri'] === '' || !McpOAuth::redirectMatches($client, $q['redirect_uri'])) {
        renderAuthorizePage($es, null, $q, 'bad_request');
        return;
    }

    $back = function (array $params) use ($q): void {
        $sep = str_contains($q['redirect_uri'], '?') ? '&' : '?';
        $params['state'] = $q['state'];
        header('Location: ' . $q['redirect_uri'] . $sep . http_build_query(array_filter($params, fn($v) => $v !== '')), true, 302);
        exit;
    };

    if ($q['response_type'] !== 'code' || $q['code_challenge'] === '' || $q['code_challenge_method'] !== 'S256') {
        $back(['error' => 'invalid_request', 'error_description' => 'PKCE S256 and response_type=code are required']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (($_POST['decision'] ?? '') === 'deny') {
            $back(['error' => 'access_denied']);
        }
        if (!Middleware::rateLimit('mcp_authorize', 10, 60)) {
            renderAuthorizePage($es, $client, $q, 'rate_limited');
            return;
        }
        $key = McpAuth::findKey(trim((string) ($_POST['key'] ?? '')));
        if (!$key) {
            McpAuth::log('authorize_failed', ['client' => $client['client_name']]);
            renderAuthorizePage($es, $client, $q, 'bad_key');
            return;
        }
        $code = McpOAuth::createCode($client['client_id'], (int) $key['id'], $q['redirect_uri'], $q['code_challenge']);
        McpAuth::log('authorize', ['key' => (int) $key['id'], 'name' => $key['name'], 'client' => $client['client_name']]);
        $back(['code' => $code, 'iss' => $base]);
    }

    renderAuthorizePage($es, $client, $q, null);
}

function renderAuthorizePage(bool $es, ?array $client, array $q, ?string $error): void
{
    $h = fn(?string $s): string => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $t = $es ? [
        'lang' => 'es',
        'title' => 'Conectar con mroscar.xyz',
        'lead' => fn($app) => "<strong>{$app}</strong> quiere trabajar en mroscar.xyz con tu llave de acceso.",
        'back' => fn($host) => "Al terminar te regresa a <strong>{$host}</strong>.",
        'scope' => 'Podrá hacer solo lo que tu llave permita, y Oscar puede revocarla cuando quiera.',
        'label' => 'Tu llave de acceso',
        'help' => 'Empieza con <span class="mono">mcp_</span>. Te la da Oscar desde el CMS.',
        'show' => 'Mostrar',
        'hide' => 'Ocultar',
        'connect' => 'Conectar',
        'cancel' => 'Cancelar',
        'bad_key' => 'Esa llave no existe o ya fue revocada. Revisa que la copiaste completa o pídele a Oscar una nueva.',
        'rate_limited' => 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
        'bad_title' => 'Este enlace no sirve',
        'bad_body' => 'La solicitud de conexión no es válida o ya caducó. Vuelve a Claude y agrega el conector otra vez.',
        'foot' => 'Tu llave no se comparte con Claude: recibe un permiso propio que se corta en cuanto la llave se revoca.',
    ] : [
        'lang' => 'en',
        'title' => 'Connect to mroscar.xyz',
        'lead' => fn($app) => "<strong>{$app}</strong> wants to work on mroscar.xyz with your access key.",
        'back' => fn($host) => "When you are done it takes you back to <strong>{$host}</strong>.",
        'scope' => 'It can only do what your key allows, and Oscar can revoke it at any time.',
        'label' => 'Your access key',
        'help' => 'It starts with <span class="mono">mcp_</span>. Oscar gives it to you from the CMS.',
        'show' => 'Show',
        'hide' => 'Hide',
        'connect' => 'Connect',
        'cancel' => 'Cancel',
        'bad_key' => 'That key does not exist or was revoked. Check you copied all of it, or ask Oscar for a new one.',
        'rate_limited' => 'Too many tries in a row. Wait a minute and try again.',
        'bad_title' => 'This link does not work',
        'bad_body' => 'The connection request is not valid or has expired. Go back to Claude and add the connector again.',
        'foot' => 'Your key is never shared with Claude: it gets its own permission, which ends as soon as the key is revoked.',
    ];

    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: frame-ancestors 'none'");
    http_response_code($error === 'bad_request' ? 400 : 200);

    $app = $h($client['client_name'] ?? '') ?: 'Claude';
    $host = $h(parse_url($q['redirect_uri'], PHP_URL_HOST) ?: '');
    if ($host === 'localhost' || $host === '127.0.0.1')
        $host = 'Claude Code';
    $msg = ($error && $error !== 'bad_request') ? $t[$error] : null;

    echo '<!doctype html><html lang="' . $t['lang'] . '"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow">'
        . '<title>' . $h($t['title']) . '</title>'
        . '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        . '<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">'
        . '<style>' . authorizeCss() . '</style></head><body><main class="wrap">'
        . '<p class="brand" aria-label="Skulley Rad">Skulley Rad</p>'
        . '<section class="panel">';

    if ($error === 'bad_request') {
        echo '<h1>' . $h($t['bad_title']) . '</h1><p class="lead">' . $h($t['bad_body']) . '</p></section></main></body></html>';
        return;
    }

    echo '<h1>' . $h($t['title']) . '</h1>'
        . '<p class="lead">' . $t['lead']($app) . '</p>'
        . '<ul class="facts"><li>' . $t['back']($host) . '</li><li>' . $h($t['scope']) . '</li></ul>'
        . '<form method="post" action="" novalidate>';
    foreach ($q as $k => $v) {
        echo '<input type="hidden" name="' . $h($k) . '" value="' . $h($v) . '">';
    }
    echo '<label for="key">' . $h($t['label']) . '</label>'
        . '<div class="field' . ($msg ? ' is-invalid' : '') . '">'
        . '<input id="key" name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required autofocus'
        . ' placeholder="mcp_…" aria-describedby="key-help' . ($msg ? ' key-error' : '') . '"' . ($msg ? ' aria-invalid="true"' : '') . '>'
        . '<button type="button" class="reveal" data-show="' . $h($t['show']) . '" data-hide="' . $h($t['hide']) . '" aria-controls="key">' . $h($t['show']) . '</button>'
        . '</div>'
        . '<p id="key-help" class="help">' . $t['help'] . '</p>'
        . ($msg ? '<p id="key-error" class="error" role="alert">' . $h($msg) . '</p>' : '')
        . '<div class="actions">'
        . '<button type="submit" name="decision" value="allow" class="btn btn-primary">' . $h($t['connect']) . '</button>'
        . '<button type="submit" name="decision" value="deny" class="btn btn-ghost" formnovalidate>' . $h($t['cancel']) . '</button>'
        . '</div></form></section>'
        . '<p class="foot">' . $h($t['foot']) . '</p>'
        . '</main><script>'
        . 'document.querySelector(".reveal").addEventListener("click",function(){var i=document.getElementById("key"),s=i.type==="password";i.type=s?"text":"password";this.textContent=s?this.dataset.hide:this.dataset.show;i.focus()});'
        . '</script></body></html>';
}

/** Lenguaje del sitio (DESIGN.md §14): plano, borde de 2px, magenta, sin sombras ni glow. */
function authorizeCss(): string
{
    return <<<CSS
*{box-sizing:border-box;margin:0}
:root{--bg:#0a0510;--panel:#0d0714;--field:#150a1d;--line:rgba(255,255,255,.12);--text:#fff;--text2:rgba(255,255,255,.72);--text3:rgba(255,255,255,.5);--accent:#e600ff;--accent2:#f24dff;--danger:#f87171}
html{background:var(--bg)}
body{min-height:100vh;background:var(--bg);color:var(--text);font-family:Outfit,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;padding:2.5rem 1rem}
.brand{font-family:'Luckiest Guy',system-ui,sans-serif;font-size:1.25rem;letter-spacing:.02em;color:var(--text)}
.panel{width:min(30rem,100%);background:var(--panel);border:2px solid var(--line);border-radius:1.5rem;padding:2rem 1.5rem}
@media (min-width:480px){.panel{padding:2.5rem 2.25rem}}
h1{font-family:'Luckiest Guy',system-ui,sans-serif;font-weight:400;font-size:clamp(1.9rem,6vw,2.4rem);line-height:1;letter-spacing:.01em}
.lead{margin-top:1rem;color:var(--text2);font-size:1.0625rem}
.lead strong{color:var(--text)}
.facts{list-style:none;padding:0;margin-top:1.25rem;padding-top:1.25rem;border-top:2px solid var(--line);display:grid;gap:.625rem;color:var(--text3);font-size:.9375rem}
.facts li{padding-left:1.125rem;position:relative}
.facts li::before{content:'';position:absolute;left:0;top:.6em;width:.4rem;height:.4rem;border-radius:999px;background:var(--accent)}
.facts strong{color:var(--text2)}
form{margin-top:1.75rem}
label{display:block;font-weight:700;font-size:.9375rem;margin-bottom:.5rem}
.field{display:flex;align-items:stretch;background:var(--field);border:2px solid rgba(255,255,255,.15);border-radius:.875rem;transition:border-color .16s linear}
.field:focus-within{border-color:var(--accent)}
.field.is-invalid{border-color:var(--danger)}
.field input{flex:1;min-width:0;background:transparent;border:0;color:var(--text);font:inherit;font-size:1rem;padding:.875rem 1rem;caret-color:var(--accent);outline:none}
.field input::placeholder{color:var(--text3)}
.reveal{flex-shrink:0;background:none;border:0;border-left:2px solid var(--line);color:var(--text2);font:inherit;font-weight:700;font-size:.8125rem;letter-spacing:.08em;text-transform:uppercase;padding:0 1rem;cursor:pointer}
.reveal:hover{color:var(--text)}
.reveal:focus-visible,.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.help{margin-top:.625rem;color:var(--text3);font-size:.875rem}
.mono{font-family:'Cascadia Code','Fira Code',ui-monospace,monospace;font-size:.875em;color:var(--text2)}
.error{margin-top:.75rem;color:var(--danger);font-size:.9375rem;font-weight:600}
.actions{margin-top:1.75rem;display:flex;flex-direction:column;gap:.75rem}
@media (min-width:480px){.actions{flex-direction:row-reverse}.actions .btn-primary{flex:1}}
.btn{min-height:52px;border-radius:999px;border:2px solid transparent;font:inherit;font-weight:700;font-size:.875rem;letter-spacing:.14em;text-transform:uppercase;padding:0 1.75rem;cursor:pointer;transition:background-color .16s linear,border-color .16s linear,color .16s linear}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#0a0510}
.btn-primary:hover{background:var(--accent2);border-color:var(--accent2)}
.btn-ghost{background:transparent;border-color:rgba(255,255,255,.25);color:var(--text2)}
.btn-ghost:hover{border-color:#fff;color:#fff}
.foot{width:min(30rem,100%);color:var(--text3);font-size:.8125rem;text-align:center;line-height:1.5}
CSS;
}
