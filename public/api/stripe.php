<?php
/**
 * Cliente mínimo de la API de Stripe (cURL, sin SDK).
 *
 * Librería, no endpoint. Sin dependencias de composer, para no complicar el
 * deploy a Hostinger.
 *
 * Gated por StripeApi::isConfigured(): sin STRIPE_SECRET_KEY el checkout
 * responde "no disponible" y el resto de la tienda sigue funcionando.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

class StripeApi
{
    private const BASE = 'https://api.stripe.com/v1/';

    public static function isConfigured(): bool
    {
        $c = Middleware::getConfig();
        return !empty($c['STRIPE_SECRET_KEY']);
    }

    public static function isTestMode(): bool
    {
        $key = (string)(Middleware::getConfig()['STRIPE_SECRET_KEY'] ?? '');
        return str_starts_with($key, 'sk_test_') || str_starts_with($key, 'rk_test_');
    }

    public static function hasWebhookSecret(): bool
    {
        return !empty(Middleware::getConfig()['STRIPE_WEBHOOK_SECRET']);
    }

    public static function dashboardUrl(string $path): string
    {
        return 'https://dashboard.stripe.com/' . (self::isTestMode() ? 'test/' : '') . ltrim($path, '/');
    }

    /**
     * @return array{ok:bool,status:int,data:?array,error:?string,code:?string}
     */
    /**
     * @param string|null $apiVersion Fija Stripe-Version solo para esta llamada.
     *   Sirve cuando la versión por defecto de la cuenta cambió la forma de un
     *   endpoint y no queremos mover la del resto del backend (ver
     *   shop-coupons.php, donde promotion_codes dejó de aceptar `coupon`).
     */
    public static function request(string $method, string $path, array $params = [], ?string $idempotencyKey = null, ?string $apiVersion = null): array
    {
        if (!self::isConfigured()) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'stripe_not_configured', 'code' => null];
        }
        $c = Middleware::getConfig();
        $url = self::BASE . ltrim($path, '/');
        $method = strtoupper($method);
        $body = self::encode($params);
        if ($method === 'GET' && $body !== '') {
            $url .= (str_contains($url, '?') ? '&' : '?') . $body;
        }

        $headers = [
            'Authorization: Bearer ' . $c['STRIPE_SECRET_KEY'],
            'Content-Type: application/x-www-form-urlencoded',
        ];
        $version = $apiVersion ?: ($c['STRIPE_API_VERSION'] ?? '');
        if ($version !== '') $headers[] = 'Stripe-Version: ' . $version;
        if ($idempotencyKey) $headers[] = 'Idempotency-Key: ' . $idempotencyKey;

        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 8,
        ];
        if ($method !== 'GET') $opts[CURLOPT_POSTFIELDS] = $body;
        curl_setopt_array($ch, $opts);

        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);

        if ($raw === false) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'curl: ' . $curlErr, 'code' => null];
        }
        $data = json_decode((string)$raw, true);
        if (!is_array($data)) {
            return ['ok' => false, 'status' => $status, 'data' => null, 'error' => 'invalid_json_response', 'code' => null];
        }
        if ($status >= 400) {
            $err = $data['error'] ?? [];
            return [
                'ok' => false,
                'status' => $status,
                'data' => $data,
                'error' => (string)($err['message'] ?? "http_{$status}"),
                'code' => isset($err['code']) ? (string)$err['code'] : null,
            ];
        }
        return ['ok' => true, 'status' => $status, 'data' => $data, 'error' => null, 'code' => null];
    }

    /**
     * Form-encoding estilo Stripe: arrays anidados con corchetes y booleanos
     * como "true"/"false" (http_build_query los mandaría como 1/0).
     */
    public static function encode(array $params): string
    {
        $normalize = function ($v) use (&$normalize) {
            if (is_bool($v)) return $v ? 'true' : 'false';
            if (is_array($v)) return array_map($normalize, $v);
            return $v;
        };
        $clean = array_filter($normalize($params), fn($v) => $v !== null);
        return http_build_query($clean, '', '&', PHP_QUERY_RFC1738);
    }

    public static function createCheckoutSession(array $params, string $idempotencyKey): array
    {
        return self::request('POST', 'checkout/sessions', $params, $idempotencyKey);
    }

    public static function retrieveCheckoutSession(string $id, array $expand = []): array
    {
        return self::request('GET', 'checkout/sessions/' . rawurlencode($id), $expand ? ['expand' => $expand] : []);
    }

    public static function expireCheckoutSession(string $id): array
    {
        return self::request('POST', 'checkout/sessions/' . rawurlencode($id) . '/expire');
    }

    public static function createRefund(string $paymentIntent, ?int $amountCents, string $idempotencyKey): array
    {
        $params = ['payment_intent' => $paymentIntent];
        if ($amountCents !== null) $params['amount'] = $amountCents;
        return self::request('POST', 'refunds', $params, $idempotencyKey);
    }

    /**
     * Cupón de porcentaje reutilizable (el golden ticket). Se crea la primera
     * vez que hace falta; percent_off no depende de la moneda, así que el
     * mismo sirve para MXN y USD.
     */
    public static function ensureCoupon(string $id, int $percentOff, string $name): bool
    {
        $existing = self::request('GET', 'coupons/' . rawurlencode($id));
        if ($existing['ok']) return true;
        if ($existing['status'] !== 404) return false;
        $created = self::request('POST', 'coupons', [
            'id' => $id,
            'percent_off' => $percentOff,
            'duration' => 'once',
            'name' => $name,
        ], 'coupon_' . $id);
        return $created['ok'] || ($created['code'] === 'resource_already_exists');
    }

    /**
     * Verifica la firma `Stripe-Signature` (HMAC-SHA256 de "{t}.{payload}")
     * y devuelve el evento decodificado, o null si no es auténtico.
     */
    public static function verifyWebhook(string $payload, string $sigHeader, int $tolerance = 300): ?array
    {
        $secret = (string)(Middleware::getConfig()['STRIPE_WEBHOOK_SECRET'] ?? '');
        if ($secret === '' || $sigHeader === '') return null;

        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $sigHeader) as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) !== 2) continue;
            if ($kv[0] === 't') $timestamp = (int)$kv[1];
            if ($kv[0] === 'v1') $signatures[] = $kv[1];
        }
        if (!$timestamp || !$signatures) return null;
        if (abs(time() - $timestamp) > $tolerance) return null;

        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
        $valid = false;
        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) {
                $valid = true;
                break;
            }
        }
        if (!$valid) return null;

        $event = json_decode($payload, true);
        return is_array($event) ? $event : null;
    }
}
