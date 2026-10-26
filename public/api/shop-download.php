<?php
/**
 * Descarga de productos digitales.
 *
 *   GET /api/shop-download.php?t=TOKEN
 *
 * TOKEN es un enlace de UN uso (shop_download_tickets): lo emite Mi cuenta →
 * Descargas para la cuenta que compró (dura 5 minutos) o el admin desde el CMS
 * para soporte (48 horas). Al usarse se marca y ya no sirve: un enlace que
 * circule no le sirve a nadie. El archivo vive fuera del document root y sale
 * marcado con los datos de quien lo compró (shop-watermark.php).
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/shop-watermark.php';

Shop::ensureSchema();

function downloadFail(int $code, string $es, string $en): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: private, no-store');
    echo "{$es}\n\n{$en}";
    exit;
}

$again = 'Descárgalo otra vez desde Mi cuenta → Descargas en mroscar.xyz, con la cuenta con la que compraste.';
$againEn = 'Download it again from My account → Downloads at mroscar.xyz, signed in with the account you bought it with.';

if (!Middleware::rateLimit('shop_download', 30, 60)) {
    downloadFail(429, 'Demasiadas descargas seguidas. Intenta en un minuto.', 'Too many downloads in a row. Try again in a minute.');
}

$token = (string)($_GET['t'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
    downloadFail(404, "Este enlace no es válido. {$again}", "This link isn't valid. {$againEn}");
}

$t = Database::fetchOne(
    'SELECT t.id AS ticket_id, t.used_at, t.expires_at AS ticket_expires, d.*, o.status AS order_status, o.downloads_paused
     FROM shop_download_tickets t
     JOIN shop_downloads d ON d.id = t.download_id
     JOIN shop_orders o ON o.id = t.order_id
     WHERE t.token = ?',
    [$token]
);
if (!$t) downloadFail(404, "Este enlace no es válido. {$again}", "This link isn't valid. {$againEn}");
if ($t['used_at'] !== null) {
    downloadFail(410, "Este enlace ya se usó: cada enlace sirve una sola vez. {$again}", "This link was already used: each link works only once. {$againEn}");
}
if ($t['ticket_expires'] < Shop::now()) {
    downloadFail(410, "Este enlace ya venció. {$again}", "This link has expired. {$againEn}");
}
if (!in_array($t['order_status'], ['paid', 'preparing', 'shipped', 'delivered'], true)) {
    downloadFail(403, 'Este pedido ya no tiene descargas activas.', 'This order no longer has active downloads.');
}
if ((int)$t['downloads_paused'] === 1) {
    downloadFail(403, 'Las descargas de este pedido están en pausa. Escríbenos a hola@mroscar.xyz.', 'Downloads for this order are paused. Email us at hola@mroscar.xyz.');
}

$path = Shop::privateFilePath((string)$t['file_key']);
if (!$path) downloadFail(404, 'El archivo no está disponible. Escríbenos a hola@mroscar.xyz.', "The file isn't available. Email us at hola@mroscar.xyz.");

// Un solo uso, también si llegan dos peticiones a la vez con el mismo enlace.
$claim = Database::query(
    'UPDATE shop_download_tickets SET used_at = ?, used_ip = ? WHERE id = ? AND used_at IS NULL',
    [Shop::now(), Shop::clientIp(), (int)$t['ticket_id']]
);
if ($claim->rowCount() !== 1) {
    downloadFail(410, "Este enlace ya se usó: cada enlace sirve una sola vez. {$again}", "This link was already used: each link works only once. {$againEn}");
}
Database::query('UPDATE shop_downloads SET downloads = downloads + 1 WHERE id = ?', [(int)$t['id']]);

$order = Shop::orderById((int)$t['order_id']);
[$file, $cleanup] = ShopWatermark::prepare($path, $t, $order ?: []);

$name = preg_replace('/[^\w.\- ()]+/u', '_', (string)$t['file_name']) ?: basename($path);
$mime = function_exists('mime_content_type') ? (mime_content_type($file) ?: 'application/octet-stream') : 'application/octet-stream';

while (ob_get_level() > 0) ob_end_clean();
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($file));
header("Content-Disposition: attachment; filename=\"{$name}\"; filename*=UTF-8''" . rawurlencode((string)$t['file_name']));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
readfile($file);
if ($cleanup) @unlink($file);
exit;
