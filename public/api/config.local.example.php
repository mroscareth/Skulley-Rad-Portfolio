<?php
/**
 * Configuración local para producción
 * 
 * INSTRUCCIONES:
 * 1. Copiar este archivo como config.local.php
 * 2. Rellenar con los valores reales de producción
 * 3. NO subir config.local.php a Git
 */

return [
    // Base de datos MySQL (datos de Hostinger)
    'DB_HOST' => 'localhost', // En Hostinger suele ser localhost
    'DB_NAME' => 'u123456789_mroscar', // Tu nombre de BD en Hostinger
    'DB_USER' => 'u123456789_admin', // Tu usuario de BD
    'DB_PASS' => 'TU_PASSWORD_AQUI', // Tu contraseña de BD
    'DB_CHARSET' => 'utf8mb4',

    // Google OAuth 2.0
    // Obtener en: https://console.cloud.google.com/apis/credentials
    'GOOGLE_CLIENT_ID' => 'TU_CLIENT_ID.apps.googleusercontent.com',
    'GOOGLE_CLIENT_SECRET' => 'TU_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI' => 'https://mroscar.xyz/api/auth.php?action=callback',

    // URLs del sitio
    'SITE_URL' => 'https://mroscar.xyz',
    'ADMIN_URL' => 'https://mroscar.xyz/admin',

    // Sesiones
    'SESSION_LIFETIME' => 86400, // 24 horas
    'SESSION_COOKIE_NAME' => 'mroscar_session',

    // Uploads - Files stored in public/uploads/{projectId}/
    'UPLOAD_DIR' => __DIR__ . '/../uploads',
    'UPLOAD_URL' => '/uploads',
    'MAX_IMAGE_SIZE' => 10 * 1024 * 1024, // 10MB
    'MAX_VIDEO_SIZE' => 50 * 1024 * 1024, // 50MB
    'ALLOWED_IMAGE_TYPES' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'ALLOWED_VIDEO_TYPES' => ['video/mp4', 'video/webm'],

    // CORS
    'ALLOWED_ORIGINS' => [
        'https://mroscar.xyz',
    ],

    // SMTP — Gmail (Google Workspace)
    // Generate an App Password at https://myaccount.google.com/apppasswords
    'SMTP_HOST' => 'smtp.gmail.com',
    'SMTP_PORT' => 587,
    'SMTP_SECURE' => 'tls',
    'SMTP_USER' => 'om@theheritage.mx',
    'SMTP_PASS' => '', // TODO: paste your 16-char Google App Password here

    // Contact form sender / recipient
    'FROM_EMAIL' => 'om@theheritage.mx',
    'FROM_NAME' => 'MrOscar Portfolio',
    'TO_EMAIL' => 'om@theheritage.mx',

    // Debug (desactivar en producción)
    'DEBUG' => false,
];
