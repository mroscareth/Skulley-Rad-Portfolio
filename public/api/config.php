<?php
/**
 * Configuración del CMS - MROSCAR Portfolio
 * 
 * IMPORTANTE: No subir este archivo con credenciales reales a Git.
 * En producción, crear config.local.php con los valores reales.
 */

// Entorno local (docker-compose): APP_ENV=local sólo lo define el contenedor de
// dev, nunca Hostinger. Gracias a eso config.dev.php puede convivir en el repo
// sin riesgo de pisar las credenciales de prod si se sube por FTP.
if (getenv('APP_ENV') === 'local') {
    $devConfig = __DIR__ . '/config.dev.php';
    if (file_exists($devConfig)) {
        $dev = require $devConfig;
        if (is_array($dev)) {
            return $dev;
        }
    }
}

// Cargar configuración local si existe (no versionada)
$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
    $local = require $localConfig;
    if (is_array($local)) {
        return $local;
    }
}

// Configuración por defecto (desarrollo)
return [
    // Base de datos MySQL
    'DB_HOST' => getenv('DB_HOST') ?: 'localhost',
    'DB_NAME' => getenv('DB_NAME') ?: 'mroscar_cms',
    'DB_USER' => getenv('DB_USER') ?: 'root',
    'DB_PASS' => getenv('DB_PASS') ?: '',
    'DB_CHARSET' => 'utf8mb4',

    // Google OAuth 2.0
    // Obtener en: https://console.cloud.google.com/apis/credentials
    'GOOGLE_CLIENT_ID' => getenv('GOOGLE_CLIENT_ID') ?: '',
    'GOOGLE_CLIENT_SECRET' => getenv('GOOGLE_CLIENT_SECRET') ?: '',
    'GOOGLE_REDIRECT_URI' => getenv('GOOGLE_REDIRECT_URI') ?: 'http://localhost:5173/api/auth.php?action=callback',

    // URLs del sitio
    'SITE_URL' => getenv('SITE_URL') ?: 'http://localhost:5173',
    'ADMIN_URL' => getenv('ADMIN_URL') ?: 'http://localhost:5173/admin',

    // Sesiones
    'SESSION_LIFETIME' => 86400, // 24 horas en segundos
    'SESSION_COOKIE_NAME' => 'mroscar_session',

    // Google Analytics 4 (Data API)
    'GA4_PROPERTY_ID' => getenv('GA4_PROPERTY_ID') ?: '',
    'GA4_CLIENT_EMAIL' => getenv('GA4_CLIENT_EMAIL') ?: '',
    'GA4_PRIVATE_KEY' => getenv('GA4_PRIVATE_KEY') ?: '',

    // Uploads - Files are stored in public/uploads/{projectId}/
    'UPLOAD_DIR' => __DIR__ . '/../uploads',
    'UPLOAD_URL' => '/uploads',
    'MAX_IMAGE_SIZE' => 10 * 1024 * 1024, // 10MB
    'MAX_VIDEO_SIZE' => 50 * 1024 * 1024, // 50MB
    'ALLOWED_IMAGE_TYPES' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'ALLOWED_VIDEO_TYPES' => ['video/mp4', 'video/webm'],

    // CORS
    'ALLOWED_ORIGINS' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://mroscar.xyz',
    ],

    // Shopify Admin API — minteo de códigos de descuento efímeros.
    // Si vacíos, el flujo de redención salta el minteo (dev / pre-tokens).
    'SHOPIFY_ADMIN_TOKEN'      => getenv('SHOPIFY_ADMIN_TOKEN') ?: '',
    'SHOPIFY_SHOP_DOMAIN'      => getenv('SHOPIFY_SHOP_DOMAIN') ?: '',
    'SHOPIFY_API_VERSION'      => getenv('SHOPIFY_API_VERSION') ?: '2025-01',
    'SHOPIFY_DISCOUNT_TTL_MIN' => (int)(getenv('SHOPIFY_DISCOUNT_TTL_MIN') ?: 60),

    // Debug (desactivar en producción)
    'DEBUG' => true,
];
