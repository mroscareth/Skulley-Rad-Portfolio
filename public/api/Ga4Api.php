<?php
/**
 * GA4 Data API Client (No dependencies)
 * Uses native PHP OpenSSL to generate JWT and authenticate with Google.
 */

declare(strict_types=1);

class Ga4Api {
    private string $propertyId;
    private string $clientEmail;
    private string $privateKey;
    private string $tokenCacheFile;

    public function __construct(string $propertyId, string $clientEmail, string $privateKey) {
        $this->propertyId = $propertyId;
        $this->clientEmail = $clientEmail;
        $this->privateKey = $privateKey;
        $this->tokenCacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ga4_access_token_' . md5($this->clientEmail) . '.json';
    }

    /**
     * Helper para base64UrlEncode
     */
    private function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Generar un token de acceso OAuth2 usando el Service Account Key (JWT)
     */
    private function getAccessToken(): string {
        // Consultar caché primero
        if (file_exists($this->tokenCacheFile)) {
            $cached = json_decode(file_get_contents($this->tokenCacheFile), true);
            if (is_array($cached) && isset($cached['access_token']) && isset($cached['expires_at'])) {
                if (time() < ($cached['expires_at'] - 60)) { // 60 segundos de margen
                    return $cached['access_token'];
                }
            }
        }

        // 1. Crear Header
        $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);

        // 2. Crear Claim Set (Payload)
        $now = time();
        $payload = json_encode([
            'iss' => $this->clientEmail,
            'scope' => 'https://www.googleapis.com/auth/analytics.readonly',
            'aud' => 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now,
        ]);

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        // 3. Crear Firma
        $signatureInput = $base64UrlHeader . '.' . $base64UrlPayload;
        $signature = '';
        $success = openssl_sign($signatureInput, $signature, $this->privateKey, OPENSSL_ALGO_SHA256);

        if (!$success) {
            throw new Exception("Error al firmar JWT con openssl_sign. Verifica formato de PRIVATE KEY.");
        }

        $base64UrlSignature = $this->base64UrlEncode($signature);
        $jwt = $signatureInput . '.' . $base64UrlSignature;

        // 4. Intercambiar JWT por Access Token
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://oauth2.googleapis.com/token");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            throw new Exception("Error cURL al obtener token GA4: " . $error);
        }

        $json = json_decode($response, true);
        if ($statusCode !== 200 || empty($json['access_token'])) {
            throw new Exception("Error de autenticación GA4: " . $response);
        }

        // Cachear token
        $expiresIn = (int)($json['expires_in'] ?? 3600);
        file_put_contents($this->tokenCacheFile, json_encode([
            'access_token' => $json['access_token'],
            'expires_at' => time() + $expiresIn
        ]));

        return $json['access_token'];
    }

    /**
     * Ejecutar un reporte en GA4 Data API
     */
    public function runReport(array $dateRanges, array $dimensions, array $metrics, ?array $orderBys = null, ?int $limit = null): array {
        $token = $this->getAccessToken();
        
        $body = [
            'dateRanges' => $dateRanges,
            'dimensions' => $dimensions,
            'metrics' => $metrics,
            'keepEmptyRows' => true
        ];
        
        if ($orderBys) {
            $body['orderBys'] = $orderBys;
        }
        if ($limit !== null) {
            $body['limit'] = $limit;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://analyticsdata.googleapis.com/v1beta/properties/" . $this->propertyId . ":runReport");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            throw new Exception("Error cURL en runReport GA4: " . $error);
        }

        if ($statusCode !== 200) {
            $errorData = json_decode($response, true);
            $msg = $errorData['error']['message'] ?? $response;
            throw new Exception("GA4 API Error ($statusCode): $msg");
        }

        return json_decode($response, true) ?: [];
    }

    /**
     * Ejecutar múltiples reportes en GA4 Data API
     */
    public function batchRunReports(array $requests): array {
        $token = $this->getAccessToken();
        
        $body = ['requests' => $requests];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://analyticsdata.googleapis.com/v1beta/properties/" . $this->propertyId . ":batchRunReports");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            throw new Exception("Error cURL en batchRunReports GA4: " . $error);
        }

        if ($statusCode !== 200) {
            $errorData = json_decode($response, true);
            $msg = $errorData['error']['message'] ?? $response;
            throw new Exception("GA4 API Error ($statusCode): $msg");
        }

        return json_decode($response, true) ?: [];
    }

    /**
     * Parsear la respuesta de runReport a un array asociativo simple
     */
    public static function parseReport(array $report): array {
        $dimensionHeaders = array_map(fn($h) => $h['name'], $report['dimensionHeaders'] ?? []);
        $metricHeaders = array_map(fn($h) => $h['name'], $report['metricHeaders'] ?? []);
        
        $results = [];
        foreach ($report['rows'] ?? [] as $row) {
            $item = [];
            foreach ($row['dimensionValues'] ?? [] as $i => $val) {
                $item[$dimensionHeaders[$i]] = $val['value'];
            }
            foreach ($row['metricValues'] ?? [] as $i => $val) {
                // Return numerical metrics as strings (API format), casting carefully downstream
                $item[$metricHeaders[$i]] = $val['value'];
            }
            $results[] = $item;
        }
        return $results;
    }
}
