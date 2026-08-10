<?php
/**
 * Configuración de DESARROLLO LOCAL (docker-compose).
 *
 * Sólo se carga cuando APP_ENV=local — es decir, únicamente dentro del
 * contenedor `api`. En prod config.php ignora este archivo por completo.
 * No poner aquí credenciales reales de prod.
 */

// Reusamos las credenciales OAuth de prod (config.local.php, no versionado) para
// no duplicarlas. El único requisito extra es dar de alta el redirect URI de
// localhost en Google Cloud Console — ver GOOGLE_REDIRECT_URI abajo.
$prod = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];

return [
    // Base de datos — servicio `db` de docker-compose.yml
    'DB_HOST' => 'db',
    'DB_NAME' => 'u580124425_mroscarxyz',
    'DB_USER' => 'root',
    'DB_PASS' => 'root',
    'DB_CHARSET' => 'utf8mb4',

    // Google OAuth 2.0 — para que el login funcione en local hay que dar de alta
    // http://localhost:5173/api/auth.php?action=callback como redirect URI
    // autorizado en Google Cloud Console (misma app que prod).
    'GOOGLE_CLIENT_ID' => $prod['GOOGLE_CLIENT_ID'] ?? '',
    'GOOGLE_CLIENT_SECRET' => $prod['GOOGLE_CLIENT_SECRET'] ?? '',
    'GOOGLE_REDIRECT_URI' => 'http://localhost:5173/api/auth.php?action=callback',

    // URLs del sitio (vite dev server)
    'SITE_URL' => 'http://localhost:5173',
    'ADMIN_URL' => 'http://localhost:5173/admin',

    // Sesiones
    'SESSION_LIFETIME' => 86400,
    'SESSION_COOKIE_NAME' => 'mroscar_session',

    // Uploads
    'UPLOAD_DIR' => __DIR__ . '/../uploads',
    'UPLOAD_URL' => '/uploads',
    'MAX_IMAGE_SIZE' => 10 * 1024 * 1024,
    'MAX_VIDEO_SIZE' => 50 * 1024 * 1024,
    'ALLOWED_IMAGE_TYPES' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'ALLOWED_VIDEO_TYPES' => ['video/mp4', 'video/webm'],

    // CORS
    'ALLOWED_ORIGINS' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8080',
    ],

    // SMTP — vacío en local: el contacto no manda mails de verdad.
    'SMTP_HOST' => '',
    'SMTP_USER' => '',
    'SMTP_PASS' => '',
    'SMTP_PORT' => 587,
    'SMTP_SECURE' => 'tls',
    'FROM_EMAIL' => 'dev@localhost',
    'FROM_NAME' => 'Oscar Moctezuma Rodriguez (local)',
    'TO_EMAIL' => 'dev@localhost',

    // Shopify Admin API — VACÍO a propósito. Con token real, el golden ticket
    // mintearía códigos de descuento de verdad en la tienda de producción.
    // shopify.php detecta el vacío y devuelve skipped:true sin romper el flujo.
    'SHOPIFY_ADMIN_TOKEN'      => getenv('SHOPIFY_ADMIN_TOKEN') ?: '',
    'SHOPIFY_SHOP_DOMAIN'      => getenv('SHOPIFY_SHOP_DOMAIN') ?: '',
    'SHOPIFY_API_VERSION'      => '2025-01',
    'SHOPIFY_DISCOUNT_TTL_MIN' => 60,

    // Debug — cookies de sesión sin `secure` (http local) y errores visibles.
    'DEBUG' => true,
];
