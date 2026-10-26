<?php
/**
 * Plantilla de los correos del sitio, con Skulley Rad (pedido de Oscar,
 * 2026-10-25). La usan la respuesta automática de Contacto (contact.php) y los
 * correos de la tienda (shop-mailer.php).
 *
 * Lenguaje del sitio (DESIGN.md §14): fondo casi negro, tarjeta oscura con
 * borde de 2px, magenta como acento y botón en pastilla. Arriba, el "escenario"
 * de Skulley: su imagen sobre su azul (#011273) y un globo de diálogo de cómic
 * (blanco, contorno de tinta) con la frase del correo. Lo útil (pedido, guía,
 * botones) va en la tarjeta, sin chistes en medio.
 *
 * Reglas de correo: tablas, estilos en línea, ancho máximo de 600px, nada de
 * WebP (Outlook no lo lee) y fuentes con respaldo: Luckiest Guy y Outfit se
 * piden a Google Fonts (Apple Mail e iOS las usan); Gmail las quita y cae en
 * Arial Black / Helvetica. Fondo oscuro declarado (color-scheme) para que los
 * clientes que invierten colores no lo volteen.
 */

declare(strict_types=1);

final class SkulleyMail
{
    public const BG = '#0a0510';
    public const CARD = '#120a1c';
    public const LINE = '#2c2338';
    public const TEXT = '#e4dfec';
    public const MUTED = '#9a91a8';
    public const ACCENT = '#e600ff';
    public const BLUE = '#011273';
    public const INK = '#0a0510';

    // Quien vende y su contacto (LFPC art. 76 bis): lo mismo que SELLER /
    // SUPPORT_EMAIL de src/components/help/helpContent.js.
    public const SUPPORT = 'hola@mroscar.xyz';

    private const DISPLAY = "'Luckiest Guy','Arial Black',Impact,sans-serif";
    private const BODY = "Outfit,'Helvetica Neue',Helvetica,Arial,sans-serif";

    /**
     * El correo completo.
     *
     * $o = [
     *   'lang' => 'es'|'en',
     *   'preheader' => texto que el cliente de correo muestra junto al asunto,
     *   'bubble' => la frase de Skulley (texto plano),
     *   'title' => título en display,
     *   'subtitle' => línea bajo el título (opcional),
     *   'body' => HTML de la tarjeta (usar los bloques de abajo),
     *   'seller' => true para los correos de compra (domicilio y contacto, LFPC 76 bis),
     *   'site' => URL base del sitio (imágenes y enlaces),
     * ]
     */
    public static function layout(array $o): string
    {
        $es = ($o['lang'] ?? 'es') !== 'en';
        $site = rtrim((string)($o['site'] ?? 'https://mroscar.xyz'), '/');
        $hero = $site . '/email/skulley-hero.jpg';
        $e = [self::class, 'e'];

        $pre = '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">'
            . $e((string)($o['preheader'] ?? '')) . str_repeat('&#8199;&#65279;', 40) . '</div>';

        $head = '<tr><td style="padding:8px 4px 18px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td style="font-family:' . self::DISPLAY . ';font-size:24px;line-height:1;color:#ffffff;letter-spacing:.02em">'
            . '<a href="' . $e($site) . '" style="color:#ffffff;text-decoration:none">SKULLEY RAD</a></td>'
            . '<td align="right" style="font-family:' . self::BODY . ';font-size:13px;color:' . self::MUTED . '">'
            . '<a href="' . $e($site) . '" style="color:' . self::MUTED . ';text-decoration:none">mroscar.xyz</a></td>'
            . '</tr></table></td></tr>';

        // Escenario de Skulley: la imagen y, debajo, su globo sobre el mismo
        // azul. Sin imágenes (bloqueadas), queda el azul con el texto alterno.
        $stage = '<tr><td style="background:' . self::BLUE . ';border-radius:24px 24px 0 0;line-height:0">'
            . '<img src="' . $e($hero) . '" width="600" alt="Skulley Rad" '
            . 'style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:24px 24px 0 0;'
            . 'font-family:' . self::BODY . ';font-size:16px;line-height:1.4;color:#ffffff">'
            . '</td></tr>'
            . '<tr><td style="background:' . self::BLUE . ';padding:0 22px 26px">'
            . self::bubble((string)($o['bubble'] ?? ''), $site)
            . '</td></tr>';

        $sub = !empty($o['subtitle'])
            ? '<p style="margin:10px 0 0;font-family:' . self::BODY . ';font-size:15px;color:' . self::MUTED . '">' . $e((string)$o['subtitle']) . '</p>'
            : '';
        $card = '<tr><td class="sr-card" style="background:' . self::CARD . ';border:2px solid ' . self::LINE . ';border-top:0;border-radius:0 0 24px 24px;padding:30px 28px 32px">'
            . '<h1 style="margin:0;font-family:' . self::DISPLAY . ';font-weight:400;font-size:34px;line-height:1.05;color:#ffffff;letter-spacing:.01em">'
            . $e((string)($o['title'] ?? '')) . '</h1>'
            . $sub
            . '<div style="height:22px;line-height:22px">&nbsp;</div>'
            . (string)($o['body'] ?? '')
            . self::signOff($es)
            . '</td></tr>';

        $links = $es
            ? [['Tienda', '/lost-and-found-shop'], ['Ayuda', '/help?lang=es'], ['Contacto', '/contact?topic=shop']]
            : [['Store', '/lost-and-found-shop'], ['Help', '/help'], ['Contact', '/contact?topic=shop']];
        $linkHtml = implode(' &nbsp;·&nbsp; ', array_map(
            fn($l) => '<a href="' . $e($site . $l[1]) . '" style="color:' . self::MUTED . ';text-decoration:underline">' . $e($l[0]) . '</a>',
            $links
        ));
        $seller = !empty($o['seller'])
            ? '<p style="margin:10px 0 0">' . $e(self::sellerAddress($es))
                . ' · <a href="mailto:' . self::SUPPORT . '" style="color:' . self::MUTED . '">' . self::SUPPORT . '</a></p>'
            : '';
        $foot = '<tr><td style="padding:22px 10px 8px;font-family:' . self::BODY . ';font-size:12px;line-height:1.6;color:' . self::MUTED . ';text-align:center">'
            . '<p style="margin:0">' . $linkHtml . '</p>' . $seller
            . '</td></tr>';

        return '<!doctype html><html lang="' . ($es ? 'es' : 'en') . '"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">'
            . '<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">'
            . '<style>:root{color-scheme:dark}a{color:inherit}@media (max-width:620px){.sr-card{padding:24px 20px 26px!important}}</style>'
            . '</head><body style="margin:0;padding:0;background:' . self::BG . '">'
            . $pre
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . self::BG . '">'
            . '<tr><td align="center" style="padding:24px 12px 32px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">'
            . $head . $stage . $card . $foot
            . '</table></td></tr></table></body></html>';
    }

    /** El globo de diálogo de Skulley: blanco, contorno de tinta, cola hacia arriba (hacia él). */
    private static function bubble(string $line, string $site): string
    {
        if ($line === '') return '';
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>'
            // Cola blanca con contorno, abierta abajo: baja 3px sobre el borde del globo para fundirse con él.
            // Donde el cliente quita el margen negativo (Gmail web), queda apoyada sobre la línea y se ve bien igual.
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="right" style="padding-right:30%;line-height:0;font-size:0">'
            . '<img src="' . htmlspecialchars($site . '/email/bubble-tail.png', ENT_QUOTES, 'UTF-8') . '" width="34" height="22" alt="" style="display:inline-block;width:34px;height:22px;border:0;margin-bottom:-3px;position:relative">'
            . '</td></tr></table>'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:3px solid ' . self::INK . ';border-radius:22px">'
            . '<tr><td style="padding:16px 20px">'
            . '<p style="margin:0;font-family:' . self::BODY . ';font-weight:700;font-size:18px;line-height:1.4;color:' . self::INK . '">' . self::e($line) . '</p>'
            . '</td></tr></table>'
            . '</td></tr></table>';
    }

    private static function signOff(bool $es): string
    {
        return '<div style="height:30px;line-height:30px">&nbsp;</div>'
            . '<p style="margin:0;font-family:' . self::BODY . ';font-size:14px;color:' . self::MUTED . '">' . ($es ? 'Nos vemos,' : 'See you around,') . '</p>'
            . '<p style="margin:2px 0 0;font-family:' . self::DISPLAY . ';font-size:22px;line-height:1.1;color:' . self::ACCENT . '">Skulley Rad</p>';
    }

    public static function sellerAddress(bool $es): string
    {
        return 'Oscar Moctezuma Rodríguez · 15 de Mayo 1233, Monterrey Centro, 64000 Monterrey, N.L., ' . ($es ? 'México' : 'Mexico');
    }

    /** Cierre de la versión en texto plano (la que leen los clientes sin HTML). */
    public static function textSignOff(bool $es, bool $seller = false): string
    {
        return "\n" . ($es ? 'Nos vemos,' : 'See you around,') . "\nSkulley Rad\n"
            . ($seller ? "\n" . self::sellerAddress($es) . ' · ' . self::SUPPORT . "\n" : '');
    }

    /** "25 de octubre de 2026" / "October 25, 2026". */
    public static function date(int $ts, bool $es): string
    {
        if (!$es) return date('F j, Y', $ts);
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return date('j', $ts) . ' de ' . $months[(int)date('n', $ts) - 1] . ' de ' . date('Y', $ts);
    }

    /** El nombre de pila, para saludar ("Ana López" → "Ana"). */
    public static function firstName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        return (string)($parts[0] ?? '');
    }

    // ── Bloques de la tarjeta ──

    public static function p(string $html): string
    {
        return '<p style="margin:0 0 14px;font-family:' . self::BODY . ';font-size:16px;line-height:1.6;color:' . self::TEXT . '">' . $html . '</p>';
    }

    /** Aclaración chica bajo un bloque (vigencia de descargas…). */
    public static function note(string $text): string
    {
        return '<p style="margin:2px 0 14px;font-family:' . self::BODY . ';font-size:13px;line-height:1.5;color:' . self::MUTED . '">' . self::e($text) . '</p>';
    }

    /** Título de sección: Sentence case, sin versalitas (no es un eyebrow). */
    public static function h2(string $t): string
    {
        return '<p style="margin:26px 0 8px;font-family:' . self::BODY . ';font-weight:700;font-size:16px;color:#ffffff">' . self::e($t) . '</p>';
    }

    /** Pares etiqueta / valor (guía, paquetería…), sobre divisores. */
    public static function rows(array $rows): string
    {
        $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 6px">';
        foreach ($rows as [$k, $v]) {
            $out .= '<tr>'
                . '<td style="padding:10px 0;border-bottom:1px solid ' . self::LINE . ';font-family:' . self::BODY . ';font-size:15px;color:' . self::MUTED . '">' . self::e((string)$k) . '</td>'
                . '<td align="right" style="padding:10px 0;border-bottom:1px solid ' . self::LINE . ';font-family:' . self::BODY . ';font-size:15px;font-weight:700;color:#ffffff">' . self::e((string)$v) . '</td>'
                . '</tr>';
        }
        return $out . '</table>';
    }

    /**
     * Artículos y totales. $items = [[title, sub, qty, line]], $totals = [[label, value]], $total = string.
     */
    public static function items(array $items, array $totals, string $total, bool $es): string
    {
        $td = 'font-family:' . self::BODY . ';border-bottom:1px solid ' . self::LINE . ';';
        $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">';
        foreach ($items as [$title, $sub, $qty, $line]) {
            $out .= '<tr><td style="' . $td . 'padding:12px 0">'
                . '<div style="font-size:15px;font-weight:700;color:#ffffff">' . self::e((string)$title) . ' × ' . (int)$qty . '</div>'
                . ($sub !== '' ? '<div style="font-size:13px;color:' . self::MUTED . ';margin-top:2px">' . self::e((string)$sub) . '</div>' : '')
                . '</td><td align="right" style="' . $td . 'padding:12px 0;font-size:15px;color:#ffffff;white-space:nowrap">' . self::e((string)$line) . '</td></tr>';
        }
        foreach ($totals as [$k, $v]) {
            $out .= '<tr><td style="font-family:' . self::BODY . ';padding:8px 0 0;font-size:14px;color:' . self::MUTED . '">' . self::e((string)$k) . '</td>'
                . '<td align="right" style="font-family:' . self::BODY . ';padding:8px 0 0;font-size:14px;color:' . self::MUTED . ';white-space:nowrap">' . self::e((string)$v) . '</td></tr>';
        }
        $out .= '<tr><td style="font-family:' . self::BODY . ';padding:14px 0 0;font-size:18px;font-weight:700;color:#ffffff">Total</td>'
            . '<td align="right" style="font-family:' . self::BODY . ';padding:14px 0 0;font-size:18px;font-weight:700;color:#ffffff;white-space:nowrap">' . self::e($total) . '</td></tr>';
        return $out . '</table>';
    }

    /** Texto que la persona escribió (Contacto), en una franja con barra magenta. */
    public static function quote(string $text): string
    {
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px"><tr>'
            . '<td style="border-left:3px solid ' . self::ACCENT . ';padding:4px 0 4px 14px;font-family:' . self::BODY . ';font-size:15px;line-height:1.6;color:' . self::MUTED . '">'
            . nl2br(self::e($text)) . '</td></tr></table>';
    }

    /** Botón principal: pastilla magenta con texto de tinta, como el de la tienda. */
    public static function button(string $label, string $url): string
    {
        return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr>'
            . '<td style="background:' . self::ACCENT . ';border-radius:999px">'
            . '<a href="' . self::e($url) . '" style="display:inline-block;padding:15px 28px;font-family:' . self::BODY . ';font-weight:700;'
            . 'font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:' . self::INK . ';text-decoration:none">' . self::e($label) . '</a>'
            . '</td></tr></table>';
    }

    /** Enlace secundario discreto (Ayuda, Ver mi pedido…). */
    public static function link(string $label, string $url): string
    {
        return '<p style="margin:14px 0 0;font-family:' . self::BODY . ';font-size:14px">'
            . '<a href="' . self::e($url) . '" style="color:' . self::TEXT . ';text-decoration:underline">' . self::e($label) . '</a></p>';
    }

    public static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }
}
