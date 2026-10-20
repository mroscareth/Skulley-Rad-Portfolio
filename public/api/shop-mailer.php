<?php
/**
 * Correos transaccionales de la tienda (confirmación, envío, avisos al admin).
 *
 * SMTP con las mismas credenciales que contact.php (SMTP_* en config) y
 * fallback a mail(). Manda texto + HTML. Si el envío falla solo se loguea:
 * un correo caído nunca debe tumbar un webhook de pago.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';

class ShopMailer
{
    // ═══════════════════════════════════════════════════════════════
    // PLANTILLAS
    // ═══════════════════════════════════════════════════════════════

    public static function orderConfirmation(array $order): bool
    {
        $to = trim((string)$order['email']);
        if ($to === '') return false;
        $es = $order['lang'] !== 'en';
        $num = $order['order_number'];
        $items = Shop::orderItems((int)$order['id']);
        $downloads = Shop::publicDownloads($order);

        $subject = $es ? "Pedido {$num} confirmado" : "Order {$num} confirmed";
        $lead = $es ? 'Pago recibido.' : 'Payment received.';
        $intro = $es
            ? "Tu pedido {$num} quedó registrado en el archivo."
            : "Your order {$num} is now on file.";
        $next = [];
        if ((int)$order['has_physical']) {
            $next[] = $es
                ? 'Te escribo otra vez cuando salga a paquetería, con su número de rastreo.'
                : "I'll write again when it ships, with its tracking number.";
        }

        $html = self::h1($lead) . self::p($intro);
        foreach ($next as $line) $html .= self::p($line);
        $text = "{$lead}\n\n{$intro}\n" . ($next ? "\n" . implode("\n", $next) . "\n" : '');

        if ($downloads) {
            $days = (int)Shop::getSetting('download_days', '30');
            $max = (int)Shop::getSetting('download_max', '5');
            $title = $es ? 'Tus descargas' : 'Your downloads';
            $note = $es
                ? "Cada link funciona {$max} veces durante {$days} días."
                : "Each link works {$max} times for {$days} days.";
            $html .= self::h2($title);
            $text .= "\n{$title}\n";
            foreach ($downloads as $d) {
                $html .= self::p('<a href="' . self::e($d['url']) . '" style="color:#b100c4;font-weight:700">' . self::e($d['name']) . '</a>');
                $text .= "- {$d['name']}: {$d['url']}\n";
            }
            $html .= self::small($note);
            $text .= "{$note}\n";
        }

        [$itemsHtml, $itemsText] = self::itemsBlock($order, $items, $es);
        $html .= $itemsHtml;
        $text .= "\n" . $itemsText;

        if ((int)$order['has_physical']) {
            [$addrHtml, $addrText] = self::addressBlock($order, $es);
            $html .= $addrHtml;
            $text .= "\n" . $addrText;
        }

        $cta = $es ? 'Ver mi pedido' : 'View my order';
        $url = Shop::orderUrl($order['token']);
        $html .= self::button($cta, $url) . self::signOff($es);
        $text .= "\n{$cta}: {$url}\n\n" . self::signOffText($es);

        return self::send($to, $subject, $text, self::layout($html, $es));
    }

    public static function orderShipped(array $order): bool
    {
        $to = trim((string)$order['email']);
        if ($to === '') return false;
        $es = $order['lang'] !== 'en';
        $num = $order['order_number'];

        $subject = $es ? "Tu pedido {$num} va en camino" : "Your order {$num} is on its way";
        $lead = $es ? 'Ya salió.' : "It's out.";
        $intro = $es
            ? "Tu pedido {$num} ya está en manos de la paquetería."
            : "Your order {$num} is now with the carrier.";

        $html = self::h1($lead) . self::p($intro);
        $text = "{$lead}\n\n{$intro}\n";

        $rows = [];
        if ($order['carrier'] !== '') $rows[] = [$es ? 'Paquetería' : 'Carrier', $order['carrier']];
        if ($order['tracking_number'] !== '') $rows[] = [$es ? 'Guía' : 'Tracking number', $order['tracking_number']];
        if ($rows) {
            $html .= self::table($rows);
            foreach ($rows as [$k, $v]) $text .= "{$k}: {$v}\n";
        }
        if ($order['tracking_url'] !== '') {
            $cta = $es ? 'Rastrear envío' : 'Track shipment';
            $html .= self::button($cta, $order['tracking_url']);
            $text .= "\n{$cta}: {$order['tracking_url']}\n";
        }

        $url = Shop::orderUrl($order['token']);
        $html .= self::p('<a href="' . self::e($url) . '" style="color:#b100c4">' . ($es ? 'Ver mi pedido' : 'View my order') . '</a>');
        $html .= self::signOff($es);
        $text .= "\n" . ($es ? 'Ver mi pedido' : 'View my order') . ": {$url}\n\n" . self::signOffText($es);

        return self::send($to, $subject, $text, self::layout($html, $es));
    }

    /** Aviso a Oscar: siempre en español, con lo necesario para empacar. */
    public static function adminNewOrder(array $order): void
    {
        $to = Shop::notifyEmail();
        if ($to === '') return;
        $num = $order['order_number'];
        $total = self::fmt($order['total'], $order['currency']);
        $items = Shop::orderItems((int)$order['id']);

        $subject = "Nuevo pedido {$num} — {$total}";
        $kind = (int)$order['has_physical'] ? 'Por empacar' : 'Solo digital (ya entregado)';
        $html = self::h1("Pedido {$num}") . self::p("{$kind}. Total {$total}.");
        $text = "Pedido {$num}\n{$kind}. Total {$total}.\n";

        $contact = [
            ['Cliente', $order['customer_name'] ?: '—'],
            ['Email', $order['email'] ?: '—'],
            ['Teléfono', $order['phone'] ?: '—'],
        ];
        if ((int)$order['golden_ticket']) $contact[] = ['Descuento', 'Golden ticket ' . SHOP_GOLDEN_TICKET_PCT . '%'];
        elseif ($order['discount_label'] !== '') $contact[] = ['Descuento', $order['discount_label']];
        $html .= self::table($contact);
        foreach ($contact as [$k, $v]) $text .= "{$k}: {$v}\n";

        [$itemsHtml, $itemsText] = self::itemsBlock($order, $items, true);
        $html .= $itemsHtml;
        $text .= "\n" . $itemsText;

        if ((int)$order['has_physical']) {
            [$addrHtml, $addrText] = self::addressBlock($order, true);
            $html .= $addrHtml;
            $text .= "\n" . $addrText;
        }

        $adminUrl = Shop::siteUrl('/admin/shop/orders?id=' . (int)$order['id']);
        $html .= self::button('Abrir en el CMS', $adminUrl);
        $text .= "\nCMS: {$adminUrl}\n";

        self::send($to, $subject, $text, self::layout($html, true));
    }

    public static function adminDispute(array $order, string $reason): void
    {
        $to = Shop::notifyEmail();
        if ($to === '') return;
        $num = $order['order_number'];
        $subject = "Contracargo abierto en {$num}";
        $body = "Stripe reporta una disputa en el pedido {$num} (motivo: {$reason}). "
            . 'Tienes un plazo limitado para responder con evidencia desde el Dashboard de Stripe.';
        $url = StripeApi::dashboardUrl('payments/' . $order['stripe_payment_intent']);
        $html = self::h1('Disputa abierta') . self::p(self::e($body)) . self::button('Ver en Stripe', $url);
        self::send($to, $subject, $body . "\n\n" . $url, self::layout($html, true));
    }

    // ═══════════════════════════════════════════════════════════════
    // BLOQUES
    // ═══════════════════════════════════════════════════════════════

    private static function itemsBlock(array $order, array $items, bool $es): array
    {
        $cur = $order['currency'];
        $rows = '';
        $text = ($es ? 'Detalle' : 'Details') . "\n";
        foreach ($items as $it) {
            $line = self::fmt((float)$it['unit_price'] * (int)$it['qty'], $cur);
            $sub = trim($it['options_label'] . ($it['kind'] === 'digital' ? ($it['options_label'] ? ' · ' : '') . 'Digital' : ''));
            $rows .= '<tr>'
                . '<td style="padding:10px 0;border-bottom:1px solid #eee">'
                . '<div style="font-weight:700;color:#111">' . self::e($it['title']) . ' × ' . (int)$it['qty'] . '</div>'
                . ($sub !== '' ? '<div style="font-size:13px;color:#777">' . self::e($sub) . '</div>' : '')
                . '</td>'
                . '<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;color:#111">' . self::e($line) . '</td>'
                . '</tr>';
            $text .= "- {$it['title']}" . ($sub !== '' ? " ({$sub})" : '') . " × {$it['qty']}: {$line}\n";
        }

        $totals = [[$es ? 'Subtotal' : 'Subtotal', self::fmt($order['subtotal'], $cur)]];
        if ((float)$order['discount'] > 0) {
            $label = $order['discount_label'] !== '' ? $order['discount_label'] : ($es ? 'Descuento' : 'Discount');
            $totals[] = [$label, '− ' . self::fmt($order['discount'], $cur)];
        }
        if ((int)$order['has_physical']) {
            $ship = (float)$order['shipping'] > 0 ? self::fmt($order['shipping'], $cur) : ($es ? 'Gratis' : 'Free');
            $totals[] = [$order['shipping_method'] !== '' ? $order['shipping_method'] : ($es ? 'Envío' : 'Shipping'), $ship];
        }
        foreach ($totals as [$k, $v]) {
            $rows .= '<tr><td style="padding:6px 0;color:#555">' . self::e($k) . '</td>'
                . '<td style="padding:6px 0;text-align:right;color:#555;white-space:nowrap">' . self::e($v) . '</td></tr>';
            $text .= "{$k}: {$v}\n";
        }
        $total = self::fmt($order['total'], $cur);
        $rows .= '<tr><td style="padding:10px 0;font-weight:800;color:#111;font-size:17px">Total</td>'
            . '<td style="padding:10px 0;text-align:right;font-weight:800;color:#111;font-size:17px;white-space:nowrap">' . self::e($total) . '</td></tr>';
        $text .= "Total: {$total}\n";

        $html = self::h2($es ? 'Detalle' : 'Details')
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">' . $rows . '</table>';
        return [$html, $text];
    }

    private static function addressBlock(array $order, bool $es): array
    {
        $a = Shop::jsonDecode($order['shipping_address'], []);
        $lines = array_values(array_filter([
            $order['shipping_name'] ?: $order['customer_name'],
            $a['line1'] ?? '',
            $a['line2'] ?? '',
            trim(($a['postal_code'] ?? '') . ' ' . ($a['city'] ?? '')),
            trim(($a['state'] ?? '') . ' ' . ($a['country'] ?? '')),
            $order['phone'] ?? '',
        ], fn($l) => trim((string)$l) !== ''));
        $title = $es ? 'Dirección de envío' : 'Shipping address';
        $html = self::h2($title) . self::p(implode('<br>', array_map([self::class, 'e'], $lines)));
        $text = "{$title}\n" . implode("\n", $lines) . "\n";
        return [$html, $text];
    }

    public static function fmt($amount, string $currency): string
    {
        return '$' . number_format((float)$amount, 2, '.', ',') . ' ' . strtoupper($currency);
    }

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }

    private static function h1(string $t): string
    {
        return '<h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#111;font-weight:900">' . self::e($t) . '</h1>';
    }

    private static function h2(string $t): string
    {
        return '<h2 style="margin:28px 0 8px;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#777">' . self::e($t) . '</h2>';
    }

    private static function p(string $html): string
    {
        return '<p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:#222">' . $html . '</p>';
    }

    private static function small(string $t): string
    {
        return '<p style="margin:4px 0 0;font-size:13px;color:#777">' . self::e($t) . '</p>';
    }

    private static function table(array $rows): string
    {
        $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;margin:8px 0 12px">';
        foreach ($rows as [$k, $v]) {
            $out .= '<tr><td style="padding:6px 0;color:#777;width:40%">' . self::e((string)$k) . '</td>'
                . '<td style="padding:6px 0;color:#111;font-weight:700">' . self::e((string)$v) . '</td></tr>';
        }
        return $out . '</table>';
    }

    private static function button(string $label, string $url): string
    {
        return '<p style="margin:28px 0 8px"><a href="' . self::e($url) . '" '
            . 'style="display:inline-block;background:#e600ff;color:#0a0510;text-decoration:none;font-weight:800;'
            . 'padding:14px 26px;border-radius:999px;font-size:15px">' . self::e($label) . '</a></p>';
    }

    // Misma firma que la nota de bienvenida de la tienda (WelcomeNote.jsx).
    private static function signOff(bool $es): string
    {
        $line = $es ? 'Con todo el procesamiento de mis chips,' : 'With all the processing of my chips,';
        return '<p style="margin:32px 0 0;font-size:14px;color:#777;font-style:italic">' . self::e($line) . '</p>'
            . '<p style="margin:2px 0 0;font-size:18px;font-weight:900;color:#b100c4">M.A.D.R.E.</p>';
    }

    private static function signOffText(bool $es): string
    {
        return ($es ? 'Con todo el procesamiento de mis chips,' : 'With all the processing of my chips,') . "\nM.A.D.R.E.\n";
    }

    private static function layout(string $inner, bool $es): string
    {
        $foot = $es
            ? 'Skulley Rad — Lost &amp; Found. Este correo es parte de tu compra en mroscar.xyz.'
            : 'Skulley Rad — Lost &amp; Found. This email is part of your purchase at mroscar.xyz.';
        return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
            . '<body style="margin:0;padding:0;background:#f3f1f5;font-family:Helvetica,Arial,sans-serif">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1f5;padding:24px 12px">'
            . '<tr><td align="center">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:2px solid #0a0510;border-radius:16px;overflow:hidden">'
            . '<tr><td style="background:#0a0510;padding:18px 28px;color:#ffffff;font-weight:900;letter-spacing:.08em;font-size:15px">'
            . 'SKULLEY RAD <span style="color:#e600ff">LOST &amp; FOUND</span></td></tr>'
            . '<tr><td style="padding:28px">' . $inner . '</td></tr>'
            . '</table>'
            . '<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#999;text-align:center">' . $foot . '</p>'
            . '</td></tr></table></body></html>';
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSPORTE
    // ═══════════════════════════════════════════════════════════════

    public static function send(string $to, string $subject, string $text, string $html): bool
    {
        $c = Middleware::getConfig();
        $fromEmail = (string)($c['FROM_EMAIL'] ?? 'om@theheritage.mx');
        $fromName = (string)($c['SHOP_FROM_NAME'] ?? 'Skulley Rad Lost & Found');
        $replyTo = (string)($c['TO_EMAIL'] ?? $fromEmail);

        $boundary = 'b_' . bin2hex(random_bytes(12));
        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . "\r\n"
            . "--{$boundary}--\r\n";

        $headers = [
            'MIME-Version: 1.0',
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
            'From: ' . self::encodeHeader($fromName) . " <{$fromEmail}>",
            "Reply-To: <{$replyTo}>",
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(8)) . '@mroscar.xyz>',
        ];

        $user = (string)($c['SMTP_USER'] ?? '');
        $pass = (string)($c['SMTP_PASS'] ?? '');
        if ($user !== '' && $pass !== '') {
            $ok = self::smtp($c, $fromEmail, $to, array_merge($headers, [
                "To: <{$to}>",
                'Subject: ' . self::encodeHeader($subject),
            ]), $body);
            if ($ok) return true;
        }

        try {
            $ok = @mail($to, self::encodeHeader($subject), $body, implode("\r\n", $headers), '-f' . $fromEmail);
        } catch (\Throwable $e) {
            $ok = false;
        }
        if (!$ok) error_log("[shop-mailer] send failed to {$to}: {$subject}");
        return (bool)$ok;
    }

    private static function encodeHeader(string $text): string
    {
        $text = str_replace(["\r", "\n"], ' ', $text);
        return preg_match('/[^\x20-\x7E]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
    }

    private static function smtp(array $c, string $from, string $to, array $headers, string $body): bool
    {
        $host = (string)($c['SMTP_HOST'] ?? 'smtp.gmail.com');
        $port = (int)($c['SMTP_PORT'] ?? 587);
        $secure = ($c['SMTP_SECURE'] ?? 'tls') === 'ssl' ? 'ssl' : 'tls';
        $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . "{$host}:{$port}";

        $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT);
        if (!$fp) {
            error_log("[shop-mailer] smtp connect failed: {$errno} {$errstr}");
            return false;
        }
        stream_set_timeout($fp, 12);

        $read = function () use ($fp): int {
            $code = 0;
            while (($line = fgets($fp, 515)) !== false) {
                $code = (int)substr($line, 0, 3);
                if (strlen($line) < 4 || $line[3] !== '-') break;
            }
            return $code;
        };
        $cmd = function (string $command, array $expect) use ($fp, $read): bool {
            fwrite($fp, $command . "\r\n");
            return in_array($read(), $expect, true);
        };

        $ok = $read() === 220
            && $cmd('EHLO mroscar.xyz', [250]);
        if ($ok && $secure === 'tls') {
            $ok = $cmd('STARTTLS', [220])
                && @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
                && $cmd('EHLO mroscar.xyz', [250]);
        }
        $ok = $ok
            && $cmd('AUTH LOGIN', [334])
            && $cmd(base64_encode((string)$c['SMTP_USER']), [334])
            && $cmd(base64_encode((string)$c['SMTP_PASS']), [235])
            && $cmd("MAIL FROM:<{$from}>", [250])
            && $cmd("RCPT TO:<{$to}>", [250, 251])
            && $cmd('DATA', [354]);
        if ($ok) {
            $data = implode("\r\n", $headers) . "\r\n\r\n" . preg_replace('/^\./m', '..', $body) . "\r\n.\r\n";
            fwrite($fp, $data);
            $ok = $read() === 250;
        }
        @fwrite($fp, "QUIT\r\n");
        fclose($fp);
        if (!$ok) error_log("[shop-mailer] smtp send failed to {$to}");
        return $ok;
    }
}
