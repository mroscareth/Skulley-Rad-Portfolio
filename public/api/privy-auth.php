<?php
/**
 * Identidad del usuario del sitio (Privy), verificada en el servidor.
 *
 * El navegador manda su access token de Privy en el header `X-Privy-Token`
 * (no `Authorization`: hay hostings Apache/CGI que lo descartan). Aquí se
 * verifica la firma ES256 contra las llaves públicas de la app (JWKS) y se
 * devuelve el `sub` — el privy_id real. Ningún endpoint debe volver a creerle
 * un privy_id al body: con la tienda en Stripe, el golden ticket es dinero.
 *
 * Config: PRIVY_APP_ID (público; es el mismo VITE_PRIVY_APP_ID del frontend).
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

class PrivyAuth
{
    private const JWKS_TTL = 21600; // 6 h
    private const LEEWAY = 60;

    private static ?string $cached = null;
    private static bool $resolved = false;

    public static function isConfigured(): bool
    {
        return self::appId() !== '';
    }

    /** privy_id verificado del request, o null si no hay token válido. */
    public static function privyIdFromRequest(): ?string
    {
        if (self::$resolved) return self::$cached;
        self::$resolved = true;
        $token = trim((string)($_SERVER['HTTP_X_PRIVY_TOKEN'] ?? ''));
        self::$cached = $token !== '' ? self::verify($token) : null;
        return self::$cached;
    }

    /** Igual que privyIdFromRequest() pero termina con 401 si no hay identidad. */
    public static function requirePrivyId(): string
    {
        if (!self::isConfigured()) Middleware::error('auth_not_configured', 503);
        $id = self::privyIdFromRequest();
        if ($id === null) Middleware::error('unauthorized', 401);
        return $id;
    }

    public static function verify(string $jwt): ?string
    {
        $appId = self::appId();
        if ($appId === '') return null;

        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return null;
        [$h64, $p64, $s64] = $parts;
        $header = json_decode(self::b64(($h64)), true);
        $payload = json_decode(self::b64($p64), true);
        $sig = self::b64($s64);
        if (!is_array($header) || !is_array($payload) || strlen($sig) !== 64) return null;
        if (($header['alg'] ?? '') !== 'ES256') return null;

        $now = time();
        if (($payload['iss'] ?? '') !== 'privy.io') return null;
        $aud = $payload['aud'] ?? null;
        if (!(is_string($aud) ? $aud === $appId : (is_array($aud) && in_array($appId, $aud, true)))) return null;
        if (!isset($payload['exp']) || (int)$payload['exp'] < $now - self::LEEWAY) return null;
        if (isset($payload['nbf']) && (int)$payload['nbf'] > $now + self::LEEWAY) return null;
        $sub = (string)($payload['sub'] ?? '');
        if (!str_starts_with($sub, 'did:privy:')) return null;

        $pem = self::publicKey((string)($header['kid'] ?? ''));
        if (!$pem) return null;
        $ok = openssl_verify("{$h64}.{$p64}", self::rawSignatureToDer($sig), $pem, OPENSSL_ALGO_SHA256);
        return $ok === 1 ? $sub : null;
    }

    private static function appId(): string
    {
        return trim((string)(Middleware::getConfig()['PRIVY_APP_ID'] ?? ''));
    }

    private static function b64(string $s): string
    {
        $s = strtr($s, '-_', '+/');
        return (string)base64_decode($s . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
    }

    /**
     * PEM de la llave con ese kid. Las llaves se cachean en disco; si el kid
     * no aparece (Privy rotó llaves) se vuelve a pedir el JWKS una vez.
     */
    private static function publicKey(string $kid): ?string
    {
        $keys = self::jwks(false);
        if (!isset($keys[$kid]) && $kid !== '') $keys = self::jwks(true);
        $jwk = $keys[$kid] ?? ($kid === '' && count($keys) === 1 ? reset($keys) : null);
        if (!$jwk || ($jwk['kty'] ?? '') !== 'EC' || ($jwk['crv'] ?? '') !== 'P-256') return null;
        $x = self::b64((string)$jwk['x']);
        $y = self::b64((string)$jwk['y']);
        if (strlen($x) !== 32 || strlen($y) !== 32) return null;
        // SubjectPublicKeyInfo DER para EC P-256 + punto sin comprimir (04||x||y).
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $x . $y;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private static function jwks(bool $refresh): array
    {
        $appId = self::appId();
        $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'privy_jwks_' . md5($appId) . '.json';
        if (!$refresh && is_file($cacheFile) && (time() - filemtime($cacheFile)) < self::JWKS_TTL) {
            $cached = json_decode((string)@file_get_contents($cacheFile), true);
            if (is_array($cached) && $cached) return $cached;
        }

        $ch = curl_init('https://auth.privy.io/api/v1/apps/' . rawurlencode($appId) . '/jwks.json');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5]);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = $status === 200 ? json_decode((string)$raw, true) : null;
        $keys = [];
        foreach ((array)($data['keys'] ?? []) as $k) {
            if (is_array($k) && !empty($k['kid'])) $keys[(string)$k['kid']] = $k;
        }
        if ($keys) {
            @file_put_contents($cacheFile, json_encode($keys), LOCK_EX);
            return $keys;
        }
        // Privy no respondió: mejor una caché vieja que dejar a todos fuera.
        $stale = json_decode((string)@file_get_contents($cacheFile), true);
        return is_array($stale) ? $stale : [];
    }

    /** Firma JOSE (r||s, 64 bytes) → DER que entiende openssl_verify. */
    private static function rawSignatureToDer(string $sig): string
    {
        $int = function (string $b): string {
            $b = ltrim($b, "\x00");
            if ($b === '' || (ord($b[0]) & 0x80)) $b = "\x00" . $b;
            return "\x02" . chr(strlen($b)) . $b;
        };
        $seq = $int(substr($sig, 0, 32)) . $int(substr($sig, 32, 32));
        return "\x30" . chr(strlen($seq)) . $seq;
    }
}
