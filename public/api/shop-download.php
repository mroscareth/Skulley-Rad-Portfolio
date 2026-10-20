<?php
/**
 * Descarga de productos digitales.
 *
 *   GET /api/shop-download.php?t=TOKEN
 *
 * Cada link se emite al confirmarse el pago (Shop::markPaid) con caducidad y
 * número máximo de descargas (configurables en el CMS). El archivo vive fuera
 * del document root, así que este endpoint es la única forma de bajarlo.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';

Shop::ensureSchema();

function downloadFail(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

if (!Middleware::rateLimit('shop_download', 30, 60)) {
    downloadFail(429, 'Demasiadas descargas seguidas. Intenta en un minuto.');
}

$token = (string)($_GET['t'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/', $token)) downloadFail(404, 'Link inválido.');

$dl = Database::fetchOne(
    'SELECT d.*, o.status AS order_status FROM shop_downloads d JOIN shop_orders o ON o.id = d.order_id WHERE d.token = ?',
    [$token]
);
if (!$dl) downloadFail(404, 'Link inválido.');
if (!in_array($dl['order_status'], ['paid', 'preparing', 'shipped', 'delivered'], true)) {
    downloadFail(403, 'Este pedido ya no tiene descargas activas.');
}
if ($dl['expires_at'] !== null && $dl['expires_at'] < Shop::now()) {
    downloadFail(410, 'Este link ya caducó. Escríbenos y te mandamos uno nuevo.');
}
if ((int)$dl['downloads'] >= (int)$dl['max_downloads']) {
    downloadFail(410, 'Este link ya alcanzó su límite de descargas. Escríbenos y te mandamos uno nuevo.');
}

$path = Shop::privateFilePath((string)$dl['file_key']);
if (!$path) downloadFail(404, 'El archivo no está disponible. Escríbenos.');

Database::query('UPDATE shop_downloads SET downloads = downloads + 1 WHERE id = ?', [(int)$dl['id']]);

$name = preg_replace('/[^\w.\- ()]+/u', '_', (string)$dl['file_name']) ?: basename($path);
$mime = function_exists('mime_content_type') ? (mime_content_type($path) ?: 'application/octet-stream') : 'application/octet-stream';

while (ob_get_level() > 0) ob_end_clean();
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header("Content-Disposition: attachment; filename=\"{$name}\"; filename*=UTF-8''" . rawurlencode((string)$dl['file_name']));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
exit;
