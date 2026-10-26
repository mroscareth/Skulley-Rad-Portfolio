<?php
/**
 * Correos transaccionales de la tienda (confirmación, envío, avisos al admin).
 *
 * Diseño: la plantilla con Skulley Rad de email-template.php (aprobada por
 * Oscar el 2026-10-25), la misma de la respuesta automática de Contacto.
 * SMTP con las mismas credenciales que contact.php (SMTP_* en config) y
 * fallback a mail(). Manda texto + HTML. Si el envío falla solo se loguea:
 * un correo caído nunca debe tumbar un webhook de pago.
 */

declare(strict_types=1);

require_once __DIR__ . '/shop-lib.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/email-template.php';

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
        $physical = (bool)(int)$order['has_physical'];

        $subject = $es ? "Tu pedido {$num} está confirmado" : "Your order {$num} is confirmed";
        $title = $es ? 'Gracias por tu compra' : 'Thanks for your order';
        // La fecha del pago, no la de hoy: el CMS puede reenviar este correo días después.
        $ts = strtotime((string)($order['paid_at'] ?: $order['created_at'] ?: 'now')) ?: time();
        $subtitle = ($es ? 'Pedido ' : 'Order ') . $num . ' · ' . SkulleyMail::date($ts, $es);

        // Textos aprobados por Oscar (2026-10-25): profesional y relajado, en primera persona.
        $hello = SkulleyMail::hello((string)$order['customer_name'], $es);
        if ($physical) {
            // El plazo es el de la página de ayuda (/help): prometido aquí, se
            // cumple (la LFPC pide informar el plazo de entrega y en EE. UU. la FTC también).
            $intro = $es
                ? "{$hello} Ya recibí tu pago y tu pedido está confirmado. Lo voy a preparar y empacar con cuidado, y te lo envío en un plazo de 7 a 10 días hábiles. Cuando salga, te escribo con el número de guía para que puedas rastrearlo."
                : "{$hello} your payment went through and your order is confirmed. I’ll prepare and pack it with care and ship it within 7 to 10 business days. Once it ships, I’ll send you the tracking number.";
            if ($downloads) {
                $intro .= $es ? ' Tus archivos digitales ya están listos para descargar.' : ' Your digital files are ready to download.';
            }
        } else {
            $intro = $es
                ? "{$hello} Ya recibí tu pago y tus archivos están listos para descargar."
                : "{$hello} your payment went through and your files are ready to download.";
        }
        $preheader = $physical
            ? ($es ? 'Gracias por tu compra. Lo envío en 7 a 10 días hábiles.' : 'Thanks for your order. It ships within 7 to 10 business days.')
            : ($es ? 'Gracias por tu compra. Tus archivos están listos.' : 'Thanks for your order. Your files are ready.');

        $html = SkulleyMail::p(SkulleyMail::e($intro));
        $text = "{$title}\n{$subtitle}\n\n{$intro}\n";

        if ($downloads) {
            $days = (int)Shop::getSetting('download_days', '30');
            $max = (int)Shop::getSetting('download_max', '5');
            $dlTitle = $es ? 'Tus descargas' : 'Your downloads';
            $note = $es
                ? "Cada enlace se puede usar hasta {$max} veces durante {$days} días."
                : "Each link can be used up to {$max} times within {$days} days.";
            // Comprado con sesión: la biblioteca de Mi cuenta los renueva sola.
            if (!empty($order['privy_id'])) {
                $note .= $es
                    ? ' Después, los tienes siempre en Mi cuenta → Descargas.'
                    : ' After that, they’re always in My account → Downloads.';
            }
            $html .= SkulleyMail::h2($dlTitle);
            $text .= "\n{$dlTitle}\n";
            foreach ($downloads as $d) {
                $html .= SkulleyMail::p(SkulleyMail::a($d['name'], $d['url']));
                $text .= "- {$d['name']}: {$d['url']}\n";
            }
            $html .= SkulleyMail::note($note);
            $text .= "{$note}\n";
        }

        [$itemsHtml, $itemsText] = self::itemsBlock($order, $items, $es);
        $html .= $itemsHtml;
        $text .= "\n" . $itemsText;

        if ($physical) {
            [$addrHtml, $addrText] = self::addressBlock($order, $es);
            $html .= $addrHtml;
            $text .= "\n" . $addrText;
        }

        $cta = $es ? 'Ver mi pedido' : 'View my order';
        $url = Shop::orderUrl($order['token']);
        // Cancelar, devolver, pieza dañada: la página de ayuda de la tienda.
        $helpUrl = Shop::siteUrl('/help' . ($es ? '?lang=es' : ''));
        $helpLabel = $es ? 'Envíos, cancelaciones y devoluciones' : 'Shipping, cancellations and returns';
        $html .= SkulleyMail::button($cta, $url) . SkulleyMail::link($helpLabel, $helpUrl)
            . SkulleyMail::space(18) . SkulleyMail::p(SkulleyMail::e(self::questions($es)));
        $text .= "\n{$cta}: {$url}\n{$helpLabel}: {$helpUrl}\n\n" . self::questions($es) . "\n" . SkulleyMail::textSignOff($es, true);

        return self::send($to, $subject, $text, SkulleyMail::layout([
            'lang' => $es ? 'es' : 'en', 'site' => self::site(), 'seller' => true,
            'preheader' => $preheader,
            'title' => $title, 'subtitle' => $subtitle, 'body' => $html,
        ]));
    }

    public static function orderShipped(array $order): bool
    {
        $to = trim((string)$order['email']);
        if ($to === '') return false;
        $es = $order['lang'] !== 'en';
        $num = $order['order_number'];

        $subject = $es ? "Tu pedido {$num} ya va en camino" : "Your order {$num} is on its way";
        $title = $es ? 'Tu pedido va en camino' : 'Your order is on its way';
        $subtitle = ($es ? 'Pedido ' : 'Order ') . $num;
        $hello = SkulleyMail::hello((string)$order['customer_name'], $es);
        $tracked = $order['tracking_number'] !== '';
        $intro = $es
            ? "{$hello} Tu pedido ya salió y está en manos de la paquetería."
            : "{$hello} your order has shipped and is now with the carrier.";
        if ($tracked) {
            $intro .= $es ? ' Con este número de guía puedes seguirlo hasta que llegue:' : ' You can follow it with this tracking number:';
        }

        $html = SkulleyMail::p(SkulleyMail::e($intro));
        $text = "{$title}\n{$subtitle}\n\n{$intro}\n";

        $rows = [];
        if ($order['carrier'] !== '') $rows[] = [$es ? 'Paquetería' : 'Carrier', $order['carrier']];
        if ($tracked) $rows[] = [$es ? 'Número de guía' : 'Tracking number', $order['tracking_number']];
        if ($rows) {
            $html .= SkulleyMail::rows($rows);
            foreach ($rows as [$k, $v]) $text .= "{$k}: {$v}\n";
        }

        // Una sola acción de color: rastrear si hay enlace; si no, el pedido.
        $orderLabel = $es ? 'Ver mi pedido' : 'View my order';
        $url = Shop::orderUrl($order['token']);
        if ($order['tracking_url'] !== '') {
            $cta = $es ? 'Rastrear mi pedido' : 'Track my order';
            $html .= SkulleyMail::button($cta, $order['tracking_url']) . SkulleyMail::link($orderLabel, $url);
            $text .= "\n{$cta}: {$order['tracking_url']}\n";
        } else {
            $html .= SkulleyMail::button($orderLabel, $url);
        }
        $html .= SkulleyMail::space(18) . SkulleyMail::p(SkulleyMail::e(self::questions($es)));
        $text .= "{$orderLabel}: {$url}\n\n" . self::questions($es) . "\n" . SkulleyMail::textSignOff($es, true);

        return self::send($to, $subject, $text, SkulleyMail::layout([
            'lang' => $es ? 'es' : 'en', 'site' => self::site(), 'seller' => true,
            'preheader' => $tracked
                ? ($es ? 'Aquí está tu número de guía.' : 'Here’s your tracking number.')
                : ($es ? 'Tu pedido ya salió.' : 'Your order has shipped.'),
            'title' => $title, 'subtitle' => $subtitle, 'body' => $html,
        ]));
    }

    /** Aviso a Oscar: siempre en español, con lo necesario para empacar. */
    public static function adminNewOrder(array $order): void
    {
        $to = Shop::notifyEmail();
        if ($to === '') return;
        $num = $order['order_number'];
        $total = self::fmt($order['total'], $order['currency']);
        $items = Shop::orderItems((int)$order['id']);
        $physical = (bool)(int)$order['has_physical'];

        $subject = "Nuevo pedido {$num} — {$total}";
        $kind = $physical ? 'Por empacar' : 'Solo digital (ya entregado)';
        $html = SkulleyMail::p(SkulleyMail::e("{$kind}. Total {$total}."));
        $text = "Pedido {$num}\n{$kind}. Total {$total}.\n";

        $contact = [
            ['Cliente', $order['customer_name'] ?: '—'],
            ['Email', $order['email'] ?: '—'],
            ['Teléfono', $order['phone'] ?: '—'],
        ];
        // La etiqueta ya dice qué ticket fue ("Silver Ticket 10%"); los pedidos
        // de antes de los niveles solo pudieron llevar el Golden.
        if ($order['discount_label'] !== '') $contact[] = ['Descuento', $order['discount_label']];
        elseif ((int)$order['golden_ticket']) $contact[] = ['Descuento', GameTickets::label('gold')];
        $html .= SkulleyMail::rows($contact);
        foreach ($contact as [$k, $v]) $text .= "{$k}: {$v}\n";

        [$itemsHtml, $itemsText] = self::itemsBlock($order, $items, true);
        $html .= $itemsHtml;
        $text .= "\n" . $itemsText;

        if ($physical) {
            [$addrHtml, $addrText] = self::addressBlock($order, true);
            $html .= $addrHtml;
            $text .= "\n" . $addrText;
        }

        $adminUrl = Shop::siteUrl('/admin/shop/orders?id=' . (int)$order['id']);
        $html .= SkulleyMail::button('Abrir en el CMS', $adminUrl);
        $text .= "\nCMS: {$adminUrl}\n";

        self::send($to, $subject, $text, SkulleyMail::layout([
            'lang' => 'es', 'site' => self::site(),
            'preheader' => "{$kind}. Total {$total}.",
            'title' => 'Pedido nuevo', 'subtitle' => "Pedido {$num}", 'body' => $html,
        ]));
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
        $html = SkulleyMail::p(SkulleyMail::e($body)) . SkulleyMail::button('Ver en Stripe', $url);
        self::send($to, $subject, $body . "\n\n" . $url, SkulleyMail::layout([
            'lang' => 'es', 'site' => self::site(),
            'preheader' => "Pedido {$num}: hay plazo para responder.",
            'title' => 'Disputa abierta', 'subtitle' => "Pedido {$num}", 'body' => $html,
        ]));
    }

    // ═══════════════════════════════════════════════════════════════
    // BLOQUES
    // ═══════════════════════════════════════════════════════════════

    private static function itemsBlock(array $order, array $items, bool $es): array
    {
        $cur = $order['currency'];
        $title = $es ? 'Tu pedido' : 'Your order';
        $rows = [];
        $text = "{$title}\n";
        foreach ($items as $it) {
            $line = self::fmt((float)$it['unit_price'] * (int)$it['qty'], $cur);
            $sub = trim($it['options_label'] . ($it['kind'] === 'digital' ? ($it['options_label'] ? ' · ' : '') . 'Digital' : ''));
            $rows[] = [$it['title'], $sub, (int)$it['qty'], $line];
            $text .= "- {$it['title']}" . ($sub !== '' ? " ({$sub})" : '') . " × {$it['qty']}: {$line}\n";
        }

        $totals = [['Subtotal', self::fmt($order['subtotal'], $cur)]];
        if ((float)$order['discount'] > 0) {
            $label = $order['discount_label'] !== '' ? $order['discount_label'] : ($es ? 'Descuento' : 'Discount');
            $totals[] = [$label, '− ' . self::fmt($order['discount'], $cur)];
        }
        if ((int)$order['has_physical']) {
            $ship = (float)$order['shipping'] > 0 ? self::fmt($order['shipping'], $cur) : ($es ? 'Gratis' : 'Free');
            $totals[] = [$order['shipping_method'] !== '' ? $order['shipping_method'] : ($es ? 'Envío' : 'Shipping'), $ship];
        }
        foreach ($totals as [$k, $v]) $text .= "{$k}: {$v}\n";
        $total = self::fmt($order['total'], $cur);
        $text .= "Total: {$total}\n";

        return [SkulleyMail::h2($title) . SkulleyMail::items($rows, $totals, $total, $es), $text];
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
        $html = SkulleyMail::h2($title) . SkulleyMail::p(implode('<br>', array_map([SkulleyMail::class, 'e'], $lines)));
        $text = "{$title}\n" . implode("\n", $lines) . "\n";
        return [$html, $text];
    }

    public static function fmt($amount, string $currency): string
    {
        return '$' . number_format((float)$amount, 2, '.', ',') . ' ' . strtoupper($currency);
    }

    /** Cierre de los correos al comprador: contestar llega al soporte de la tienda (ver send()). */
    private static function questions(bool $es): string
    {
        return $es ? 'Si tienes cualquier duda, responde este correo.' : 'Any questions? Just reply to this email.';
    }

    /** Base de imágenes y enlaces del correo: el sitio público aunque SITE_URL falte. */
    private static function site(): string
    {
        return Shop::siteUrl() ?: 'https://mroscar.xyz';
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSPORTE
    // ═══════════════════════════════════════════════════════════════

    public static function send(string $to, string $subject, string $text, string $html): bool
    {
        $c = Middleware::getConfig();
        $fromEmail = (string)($c['FROM_EMAIL'] ?? 'om@theheritage.mx');
        $fromName = (string)($c['SHOP_FROM_NAME'] ?? 'Skulley Rad Lost & Found');
        // Contestar un correo de pedido llega al soporte de la tienda, como los
        // mensajes de Contacto con el tema de la tienda (SHOP_CONTACT_EMAIL).
        $replyTo = (string)($c['SHOP_CONTACT_EMAIL'] ?? '') ?: SkulleyMail::SUPPORT;

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
