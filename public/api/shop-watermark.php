<?php
/**
 * Capa 4 de las descargas: cada copia lleva los datos de quien la compró
 * (pedido de Oscar, 2026-10-25). No impide compartir un archivo ya
 * descargado, pero si aparece en internet se sabe de qué pedido salió.
 *
 * - PDF: pie en cada página con nombre, correo, pedido y huella, y la huella
 *   en los metadatos. Ghostscript (pdfwrite) lo reescribe una vez por pedido y
 *   archivo; la copia queda en shop-private/stamped/ y se reusa.
 * - ZIP (brochas, herramientas): se agrega LICENCIA.txt con los mismos datos y
 *   la línea de licencia va también en el comentario del ZIP. Copia temporal
 *   por descarga.
 * - Cualquier otro tipo: se entrega tal cual (el CMS pide subir las
 *   herramientas dentro de un ZIP).
 *
 * Si algo falla se entrega el original y se anota en el log: quien pagó
 * siempre recibe su archivo.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';

final class ShopWatermark
{
    /**
     * Prepara el archivo para un pedido. Devuelve [ruta a entregar, borrarla
     * al terminar].
     */
    public static function prepare(string $path, array $dl, array $order): array
    {
        $ext = strtolower(pathinfo((string)$dl['file_name'], PATHINFO_EXTENSION) ?: pathinfo($path, PATHINFO_EXTENSION));
        try {
            if ($ext === 'pdf') return [self::pdf($path, $dl, $order), false];
            if ($ext === 'zip') return [self::zip($path, $dl, $order), true];
        } catch (\Throwable $e) {
            error_log("[shop-watermark] pedido {$order['order_number']}, archivo {$dl['id']}: " . $e->getMessage());
        }
        return [$path, false];
    }

    /** Huella corta y estable por pedido y archivo: con ella se ubica el pedido en el CMS. */
    public static function fingerprint(array $dl): string
    {
        $secret = (string)Shop::getSetting('watermark_secret', '');
        if ($secret === '') {
            $secret = bin2hex(random_bytes(16));
            Shop::setSetting('watermark_secret', $secret);
        }
        return substr(hash_hmac('sha256', $dl['order_id'] . ':' . $dl['id'], $secret), 0, 12);
    }

    /** "Licenciado a Ana López · ana@… · Pedido SR-1008 · Huella 3f9a…" */
    public static function line(array $dl, array $order): string
    {
        $es = ($order['lang'] ?? 'es') !== 'en';
        $name = trim((string)($order['customer_name'] ?: $order['shipping_name'] ?? ''));
        $parts = [
            ($es ? 'Licenciado a ' : 'Licensed to ') . ($name !== '' ? $name : ($es ? 'su comprador' : 'its buyer')),
            (string)$order['email'],
            ($es ? 'Pedido ' : 'Order ') . $order['order_number'],
            ($es ? 'Huella ' : 'Fingerprint ') . self::fingerprint($dl),
        ];
        return implode(' · ', array_filter($parts, fn($p) => trim($p) !== ''));
    }

    private static function pdf(string $path, array $dl, array $order): string
    {
        $dir = Shop::privateDir() . '/stamped';
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        $out = $dir . '/' . (int)$dl['order_id'] . '-' . (int)$dl['id'] . '.pdf';
        if (is_file($out) && filemtime($out) >= filemtime($path)) return $out;

        $gs = (string)(Middleware::getConfig()['GS_PATH'] ?? '') ?: '/usr/bin/gs';
        if (!function_exists('exec') || !is_executable($gs)) throw new \RuntimeException('Ghostscript no disponible');

        // Ghostscript escribe en Latin-1: los acentos sobreviven, lo demás se translitera.
        $latin = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT', self::line($dl, $order));
        if ($latin === false) $latin = preg_replace('/[^\x20-\x7E]/', '?', self::line($dl, $order));
        $hex = bin2hex((string)$latin);
        $subject = bin2hex((string)(@iconv('UTF-8', 'ISO-8859-1//TRANSLIT', 'mroscar.xyz · ' . $order['order_number']) ?: $order['order_number']));

        // Pie de 7 pt en gris a media opacidad, abajo a la izquierda de cada página.
        $ps = "/SRLatin1 /Helvetica findfont dup length dict begin { 1 index /FID ne { def } { pop pop } ifelse } forall"
            . " /Encoding ISOLatin1Encoding def currentdict end definefont pop\n"
            . "<< /EndPage { exch pop 0 eq dup { gsave /SRLatin1 findfont 7 scalefont setfont 0.45 setgray 24 14 moveto <{$hex}> show grestore } if } bind >> setpagedevice\n"
            . "[ /Subject <{$subject}> /Keywords <{$hex}> /DOCINFO pdfmark\n";
        $psFile = tempnam(sys_get_temp_dir(), 'srwm');
        file_put_contents($psFile, $ps);
        $tmpOut = $out . '.' . bin2hex(random_bytes(4)) . '.tmp';

        @set_time_limit(180);
        $cmd = escapeshellarg($gs) . ' -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite'
            . ' -dPassThroughJPEGImages=true -dDownsampleColorImages=false -dDownsampleGrayImages=false -dDownsampleMonoImages=false'
            . ' -sOutputFile=' . escapeshellarg($tmpOut) . ' ' . escapeshellarg($psFile) . ' ' . escapeshellarg($path) . ' 2>&1';
        $output = [];
        $code = 1;
        exec($cmd, $output, $code);
        @unlink($psFile);

        if ($code !== 0 || !is_file($tmpOut) || filesize($tmpOut) < 100) {
            @unlink($tmpOut);
            throw new \RuntimeException('Ghostscript falló (' . $code . '): ' . substr(implode(' ', $output), 0, 300));
        }
        rename($tmpOut, $out);
        return $out;
    }

    private static function zip(string $path, array $dl, array $order): string
    {
        if (!class_exists('ZipArchive')) throw new \RuntimeException('ZipArchive no disponible');
        $tmp = tempnam(sys_get_temp_dir(), 'srzip');
        if (!copy($path, $tmp)) {
            @unlink($tmp);
            throw new \RuntimeException('no se pudo copiar el ZIP');
        }
        $zip = new \ZipArchive();
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);
            throw new \RuntimeException('el archivo no es un ZIP válido');
        }
        $es = ($order['lang'] ?? 'es') !== 'en';
        $zip->addFromString($es ? 'LICENCIA.txt' : 'LICENSE.txt', self::licenseText($dl, $order, $es));
        $zip->setArchiveComment(self::line($dl, $order));
        if (!$zip->close()) {
            @unlink($tmp);
            throw new \RuntimeException('no se pudo cerrar el ZIP');
        }
        return $tmp;
    }

    private static function licenseText(array $dl, array $order, bool $es): string
    {
        $name = trim((string)($order['customer_name'] ?: $order['shipping_name'] ?? ''));
        $date = substr((string)($order['paid_at'] ?: $order['created_at']), 0, 10);
        $fp = self::fingerprint($dl);
        $lines = $es
            ? [
                'LICENCIA',
                '',
                'Archivo: ' . $dl['file_name'],
                'Licenciado a: ' . ($name !== '' ? $name : '—'),
                'Correo: ' . $order['email'],
                'Pedido: ' . $order['order_number'] . ' · ' . $date,
                'Huella: ' . $fp,
                '',
                'Este archivo es solo para quien lo compró. No se permite compartirlo,',
                'revenderlo ni publicarlo. Cada copia lleva los datos de su comprador.',
                '',
                '© Oscar Moctezuma Rodríguez · mroscar.xyz',
            ]
            : [
                'LICENSE',
                '',
                'File: ' . $dl['file_name'],
                'Licensed to: ' . ($name !== '' ? $name : '—'),
                'Email: ' . $order['email'],
                'Order: ' . $order['order_number'] . ' · ' . $date,
                'Fingerprint: ' . $fp,
                '',
                'This file is only for the person who bought it. Sharing, reselling or',
                'publishing it is not allowed. Every copy carries its buyer’s details.',
                '',
                '© Oscar Moctezuma Rodríguez · mroscar.xyz',
            ];
        return implode("\r\n", $lines) . "\r\n";
    }
}
