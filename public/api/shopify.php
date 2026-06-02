<?php
/**
 * Shopify Admin API helper — minteo de códigos de descuento efímeros.
 *
 * Fase 5 del plan Shopify (ver HANDOFF §11). Librería, no endpoint:
 * se require_once desde codes.php::handleValidate.
 *
 * Gated por Shopify::isConfigured(): si falta SHOPIFY_ADMIN_TOKEN o
 * SHOPIFY_SHOP_DOMAIN, mintDiscountCode() devuelve {ok:false, skipped:true}
 * sin hacer request, permitiendo fallback silencioso pre-tokens.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

class Shopify
{
    /**
     * True si hay tokens configurados para llamar a la Admin API.
     */
    public static function isConfigured(): bool
    {
        $c = Middleware::getConfig();
        return !empty($c['SHOPIFY_ADMIN_TOKEN']) && !empty($c['SHOPIFY_SHOP_DOMAIN']);
    }

    /**
     * Minteo de un discount code efímero via Admin API GraphQL.
     *
     * @param int    $discountPct Porcentaje de descuento (1-100).
     * @param string $rarityLabel Label humano-legible (ej. 'Legendary Gold Skin'), para el title.
     * @param int|null $ttlMinutes Override del TTL. Default: SHOPIFY_DISCOUNT_TTL_MIN del config.
     *                             Pasar 0 (o negativo) para modo PERPETUO: sin endsAt, el código
     *                             solo se retira al ser usado (usageLimit=1). Útil para el
     *                             golden ticket que el user puede canjear en cualquier momento.
     * @return array {
     *   ok: bool,
     *   skipped: bool,          // true si Shopify no está configurado (no es error)
     *   shopify_code: ?string,  // el código generado (uuid-like)
     *   expires_at: ?string,    // ISO 8601 UTC, o null en modo perpetuo
     *   error: ?string          // mensaje si ok=false y skipped=false
     * }
     */
    public static function mintDiscountCode(int $discountPct, string $rarityLabel = '', ?int $ttlMinutes = null): array
    {
        if (!self::isConfigured()) {
            return [
                'ok' => false,
                'skipped' => true,
                'shopify_code' => null,
                'expires_at' => null,
                'error' => null,
            ];
        }

        if ($discountPct < 1 || $discountPct > 100) {
            return [
                'ok' => false,
                'skipped' => false,
                'shopify_code' => null,
                'expires_at' => null,
                'error' => 'invalid_discount_pct',
            ];
        }

        $c = Middleware::getConfig();
        $rawTtl = $ttlMinutes ?? (int)($c['SHOPIFY_DISCOUNT_TTL_MIN'] ?? 60);
        // ttl <= 0 → modo perpetuo (sin endsAt). Se mantiene válido hasta usage.
        $perpetual = $rawTtl <= 0;
        $ttl = $perpetual ? 0 : max(5, min(1440, (int)$rawTtl));

        $code = self::generateEphemeralCode();
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $startsAt = $now->format(\DateTimeInterface::ATOM);
        $expires = $perpetual ? null : $now->modify("+{$ttl} minutes");
        $endsAt = $perpetual ? null : $expires->format(\DateTimeInterface::ATOM);

        // discountCodeBasicCreate mutation — percentage off, usage limit 1.
        // Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBasicCreate
        $query = <<<'GQL'
mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id }
    userErrors { field message code }
  }
}
GQL;

        $basicCodeDiscount = [
            'title' => self::buildTitle($code, $rarityLabel, $discountPct),
            'code' => $code,
            'startsAt' => $startsAt,
            'customerSelection' => [
                'all' => true,
            ],
            'customerGets' => [
                'value' => [
                    'percentage' => $discountPct / 100.0, // 0.0 - 1.0
                ],
                'items' => [
                    'all' => true,
                ],
            ],
            'appliesOncePerCustomer' => false, // guests sin customer — ver HANDOFF notes
            'usageLimit' => 1,
        ];
        if (!$perpetual) {
            $basicCodeDiscount['endsAt'] = $endsAt;
        }
        $variables = ['basicCodeDiscount' => $basicCodeDiscount];

        $response = self::graphqlCall($query, $variables);
        if (!$response['ok']) {
            return [
                'ok' => false,
                'skipped' => false,
                'shopify_code' => null,
                'expires_at' => null,
                'error' => $response['error'] ?? 'graphql_error',
            ];
        }

        $payload = $response['data']['discountCodeBasicCreate'] ?? null;
        $userErrors = $payload['userErrors'] ?? [];
        if (!empty($userErrors)) {
            $msg = implode('; ', array_map(
                fn($e) => ($e['code'] ?? '') . ':' . ($e['message'] ?? ''),
                $userErrors
            ));
            return [
                'ok' => false,
                'skipped' => false,
                'shopify_code' => null,
                'expires_at' => null,
                'error' => $msg ?: 'user_errors',
            ];
        }

        return [
            'ok' => true,
            'skipped' => false,
            'shopify_code' => $code,
            'expires_at' => $perpetual ? null : $expires->format('Y-m-d H:i:s'), // MySQL DATETIME
            'error' => null,
        ];
    }

    /**
     * Trae los pedidos de un cliente buscándolo por email en la Admin API.
     *
     * Gated por isConfigured(): si faltan tokens devuelve {skipped:true,orders:[]}
     * (fallback silencioso, mismo contrato que mintDiscountCode). Devuelve solo
     * un resumen no-sensible de cada pedido (sin direcciones ni datos de pago):
     * nombre (#1001), fecha, estado de fulfillment/pago, total y line items.
     *
     * @return array {
     *   ok: bool,
     *   skipped: bool,
     *   orders: array<int, array>,
     *   error: ?string
     * }
     */
    public static function fetchCustomerOrders(string $email): array
    {
        $email = trim($email);
        if (!self::isConfigured() || $email === '') {
            return ['ok' => false, 'skipped' => true, 'orders' => [], 'error' => null];
        }

        $query = <<<'GQL'
query customerOrders($q: String!) {
  customers(first: 1, query: $q) {
    edges {
      node {
        orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              name
              processedAt
              displayFulfillmentStatus
              displayFinancialStatus
              totalPriceSet { shopMoney { amount currencyCode } }
              lineItems(first: 10) {
                edges { node { title quantity } }
              }
            }
          }
        }
      }
    }
  }
}
GQL;

        // Shopify customer search: email exacto entre comillas evita matches parciales.
        $variables = ['q' => 'email:"' . str_replace('"', '', $email) . '"'];

        $response = self::graphqlCall($query, $variables);
        if (!$response['ok']) {
            return ['ok' => false, 'skipped' => false, 'orders' => [], 'error' => $response['error'] ?? 'graphql_error'];
        }

        $customerEdges = $response['data']['customers']['edges'] ?? [];
        if (empty($customerEdges)) {
            // Cliente sin cuenta en Shopify todavía → no es error, solo sin pedidos.
            return ['ok' => true, 'skipped' => false, 'orders' => [], 'error' => null];
        }

        $orderEdges = $customerEdges[0]['node']['orders']['edges'] ?? [];
        $orders = array_map(function ($edge) {
            $n = $edge['node'] ?? [];
            $money = $n['totalPriceSet']['shopMoney'] ?? [];
            $items = array_map(
                fn($li) => [
                    'title'    => $li['node']['title'] ?? '',
                    'quantity' => (int)($li['node']['quantity'] ?? 0),
                ],
                $n['lineItems']['edges'] ?? []
            );
            return [
                'name'               => $n['name'] ?? '',
                'processed_at'       => $n['processedAt'] ?? null,
                'fulfillment_status' => $n['displayFulfillmentStatus'] ?? null,
                'financial_status'   => $n['displayFinancialStatus'] ?? null,
                'total'              => $money['amount'] ?? null,
                'currency'           => $money['currencyCode'] ?? null,
                'items'              => $items,
            ];
        }, $orderEdges);

        return ['ok' => true, 'skipped' => false, 'orders' => $orders, 'error' => null];
    }

    /**
     * Genera un código corto y random, difícil de adivinar, URL-safe.
     * Formato: SKR-XXXXXXXX (8 chars base32-like, uppercase).
     */
    private static function generateEphemeralCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/I/1 por legibilidad
        $chars = '';
        for ($i = 0; $i < 8; $i++) {
            $chars .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return 'SKR-' . $chars;
    }

    private static function buildTitle(string $code, string $rarityLabel, int $pct): string
    {
        $base = "SkulleyRad ephemeral {$pct}% off";
        if ($rarityLabel !== '') {
            $base .= " — {$rarityLabel}";
        }
        return $base . " [{$code}]";
    }

    /**
     * Ejecuta una mutation GraphQL contra Shopify Admin API.
     *
     * @return array {ok:bool, data:?array, error:?string}
     */
    private static function graphqlCall(string $query, array $variables): array
    {
        $c = Middleware::getConfig();
        $shop = $c['SHOPIFY_SHOP_DOMAIN'];
        $token = $c['SHOPIFY_ADMIN_TOKEN'];
        $version = $c['SHOPIFY_API_VERSION'] ?? '2025-01';

        $url = "https://{$shop}/admin/api/{$version}/graphql.json";
        $body = json_encode([
            'query' => $query,
            'variables' => $variables,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Shopify-Access-Token: ' . $token,
            ],
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return ['ok' => false, 'data' => null, 'error' => 'curl: ' . $curlErr];
        }

        if ($httpCode >= 400) {
            return ['ok' => false, 'data' => null, 'error' => "http_{$httpCode}: " . substr((string)$raw, 0, 200)];
        }

        $decoded = json_decode((string)$raw, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'data' => null, 'error' => 'invalid_json_response'];
        }

        if (!empty($decoded['errors'])) {
            $msg = is_array($decoded['errors'])
                ? implode('; ', array_map(fn($e) => $e['message'] ?? 'unknown', $decoded['errors']))
                : 'graphql_errors';
            return ['ok' => false, 'data' => null, 'error' => $msg];
        }

        return ['ok' => true, 'data' => $decoded['data'] ?? null, 'error' => null];
    }
}
