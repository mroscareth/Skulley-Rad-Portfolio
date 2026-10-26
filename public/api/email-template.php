<?php
/**
 * Plantilla de los correos del sitio, con Skulley Rad (pedido de Oscar,
 * 2026-10-25). La usan la respuesta automática de Contacto (contact.php) y los
 * correos de la tienda (shop-mailer.php).
 *
 * Lenguaje del sitio (DESIGN.md §14): fondo casi negro, tarjeta oscura con
 * borde de 2px, magenta como acento y botón en pastilla. Arriba, Skulley solo,
 * sobre su azul (#011273): sin globo ni frase (Oscar lo quitó el mismo día;
 * los chistes sobraban). Lo útil (pedido, guía, botones) va en la tarjeta.
 *
 * Reglas de correo: tablas, estilos en línea, ancho máximo de 600px, nada de
 * WebP (Outlook no lo lee). El logo es imagen (skulley-wordmark.png) porque
 * Gmail quita las fuentes web; los títulos piden Luckiest Guy y caen en Arial
 * Rounded (iPhone) o Arial Black.
 *
 * Gmail en iPhone con modo oscuro invierte TODOS los colores (el diseño oscuro
 * salía claro; Oscar lo vio en su iPhone el 2026-10-25). Dos defensas:
 * - Fondos con bg(): color + linear-gradient del mismo color. Gmail no toca
 *   background-image, así que el fondo se queda como está.
 * - Texto dentro de blend(): dos capas con mix-blend-mode (screen y difference)
 *   que solo se encienden en Gmail (`u + .body`) y devuelven el texto claro a
 *   su color (técnica de Rémi Parmentier). Funciona con texto claro y neutro:
 *   el magenta y las imágenes van FUERA de blend(), o saldrían invertidos.
 */

declare(strict_types=1);

final class SkulleyMail
{
    public const BG = '#0a0510';
    public const CARD = '#120a1c';
    public const LINE = '#2c2338';
    public const TEXT = '#e6e6e6';
    public const MUTED = '#9c9c9c';
    public const ACCENT = '#e600ff';
    public const BLUE = '#011273';
    public const INK = '#0a0510';

    // Quien vende y su contacto (LFPC art. 76 bis): lo mismo que SELLER /
    // SUPPORT_EMAIL de src/components/help/helpContent.js.
    public const SUPPORT = 'hola@mroscar.xyz';

    private const DISPLAY = "'Luckiest Guy','Arial Rounded MT Bold','Arial Black',sans-serif";
    private const BODY = "Outfit,'Helvetica Neue',Helvetica,Arial,sans-serif";

    /**
     * El correo completo.
     *
     * $o = [
     *   'lang' => 'es'|'en',
     *   'preheader' => texto que el cliente de correo muestra junto al asunto,
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
        $e = [self::class, 'e'];

        $pre = '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">'
            . $e((string)($o['preheader'] ?? '')) . str_repeat('&#8199;&#65279;', 40) . '</div>';

        $head = '<tr><td style="padding:8px 4px 18px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td style="line-height:0"><a href="' . $e($site) . '">'
            . '<img src="' . $e($site . '/email/skulley-wordmark.png') . '" width="157" height="22" alt="SKULLEY RAD" '
            . 'style="display:block;width:157px;height:22px;border:0;font-family:' . self::DISPLAY . ';font-size:22px;line-height:22px;color:#ffffff"></a></td>'
            . '<td align="right" style="font-family:' . self::BODY . ';font-size:13px;color:' . self::MUTED . '">'
            . self::blend('<a href="' . $e($site) . '" style="color:' . self::MUTED . ';text-decoration:none">mroscar.xyz</a>') . '</td>'
            . '</tr></table></td></tr>';

        // Escenario de Skulley. Sin imágenes (bloqueadas), queda el azul con el texto alterno.
        $stage = '<tr><td style="' . self::bg(self::BLUE) . 'border-radius:24px 24px 0 0;line-height:0">'
            . '<img src="' . $e($site . '/email/skulley-hero.jpg') . '" width="600" alt="Skulley Rad" '
            . 'style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:24px 24px 0 0;'
            . 'font-family:' . self::BODY . ';font-size:16px;line-height:1.4;color:#ffffff">'
            . '</td></tr>';

        $sub = !empty($o['subtitle'])
            ? '<div style="margin:10px 0 0;font-family:' . self::BODY . ';font-size:15px;color:' . self::MUTED . '">' . $e((string)$o['subtitle']) . '</div>'
            : '';
        // El borde de la tarjeta es un relleno de 2px con fondo (no `border`):
        // Gmail también invierte el color de los bordes.
        $card = '<tr><td style="' . self::bg(self::LINE) . 'padding:0 2px 2px;border-radius:0 0 24px 24px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td class="sr-card" style="' . self::bg(self::CARD) . 'border-radius:0 0 22px 22px;padding:30px 28px 32px">'
            . self::blend('<h1 style="margin:0;font-family:' . self::DISPLAY . ';font-weight:400;font-size:34px;line-height:1.05;color:#ffffff;letter-spacing:.01em">'
                . $e((string)($o['title'] ?? '')) . '</h1>' . $sub)
            . '<div style="height:22px;line-height:22px">&nbsp;</div>'
            . (string)($o['body'] ?? '')
            . self::signOff($es)
            . '</td></tr></table></td></tr>';

        $links = $es
            ? [['Tienda', '/lost-and-found-shop'], ['Ayuda', '/help?lang=es'], ['Contacto', '/contact?topic=shop']]
            : [['Store', '/lost-and-found-shop'], ['Help', '/help'], ['Contact', '/contact?topic=shop']];
        $linkHtml = implode(' &nbsp;·&nbsp; ', array_map(
            fn($l) => '<a href="' . $e($site . $l[1]) . '" style="color:' . self::MUTED . ';text-decoration:underline">' . $e($l[0]) . '</a>',
            $links
        ));
        $seller = !empty($o['seller'])
            ? '<div style="margin:10px 0 0">' . $e(self::sellerAddress($es))
                . ' · <a href="mailto:' . self::SUPPORT . '" style="color:' . self::MUTED . '">' . self::SUPPORT . '</a></div>'
            : '';
        $foot = '<tr><td style="padding:22px 10px 8px;font-family:' . self::BODY . ';font-size:12px;line-height:1.6;color:' . self::MUTED . ';text-align:center">'
            . self::blend('<div>' . $linkHtml . '</div>' . $seller)
            . '</td></tr>';

        return '<!doctype html><html lang="' . ($es ? 'es' : 'en') . '"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">'
            . '<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">'
            . '<style>:root{color-scheme:dark}a{color:inherit}'
            . 'u+.body .gb-s{background:#000;mix-blend-mode:screen}u+.body .gb-d{background:#000;mix-blend-mode:difference}'
            . '@media (max-width:620px){.sr-card{padding:24px 20px 26px!important}}</style>'
            . '</head><body class="body" style="margin:0;padding:0;' . self::bg(self::BG) . '">'
            . $pre
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="' . self::bg(self::BG) . '">'
            . '<tr><td align="center" style="padding:24px 12px 32px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">'
            . $head . $stage . $card . $foot
            . '</table></td></tr></table></body></html>';
    }

    /** Fondo que Gmail no invierte: el color y un degradado del mismo color. */
    private static function bg(string $c): string
    {
        return "background-color:{$c};background-image:linear-gradient({$c},{$c});";
    }

    /** Texto claro que sobrevive al modo oscuro de Gmail en iPhone (ver arriba). Nada de magenta ni imágenes adentro. */
    private static function blend(string $html): string
    {
        return '<div class="gb-s"><div class="gb-d">' . $html . '</div></div>';
    }

    // Firma Oscar, en primera persona: profesional y relajado (Oscar, 2026-10-25).
    private static function signOff(bool $es): string
    {
        return '<div style="height:30px;line-height:30px">&nbsp;</div>'
            . self::blend('<div style="font-family:' . self::BODY . ';font-size:14px;color:' . self::MUTED . '">' . ($es ? 'Saludos,' : 'Best,') . '</div>')
            . '<div style="margin:2px 0 0;font-family:' . self::DISPLAY . ';font-size:22px;line-height:1.1;color:' . self::ACCENT . '">Oscar</div>';
    }

    public static function sellerAddress(bool $es): string
    {
        return 'Oscar Moctezuma Rodríguez · 15 de Mayo 1233, Monterrey Centro, 64000 Monterrey, N.L., ' . ($es ? 'México' : 'Mexico');
    }

    /** Cierre de la versión en texto plano (la que leen los clientes sin HTML). */
    public static function textSignOff(bool $es, bool $seller = false): string
    {
        return "\n" . ($es ? 'Saludos,' : 'Best,') . "\nOscar\n"
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

    /** "Hola, Ana." / "Hi Ana," (o sin nombre si no lo hay); el resto de la frase lo pone quien llama. */
    public static function hello(string $name, bool $es): string
    {
        $first = self::firstName($name);
        if ($es) return $first !== '' ? "Hola, {$first}." : 'Hola.';
        return $first !== '' ? "Hi {$first}," : 'Hi,';
    }

    // ── Bloques de la tarjeta ──

    public static function p(string $html): string
    {
        return self::blend('<div style="margin:0 0 14px;font-family:' . self::BODY . ';font-size:16px;line-height:1.6;color:' . self::TEXT . '">' . $html . '</div>');
    }

    /** Espacio vertical entre bloques (p. ej. antes del cierre "Si tienes cualquier duda…"). */
    public static function space(int $px): string
    {
        return '<div style="height:' . $px . 'px;line-height:' . $px . 'px">&nbsp;</div>';
    }

    /** Enlace dentro de un párrafo (descargas…): claro y subrayado, no magenta, porque va dentro de blend(). */
    public static function a(string $label, string $url): string
    {
        return '<a href="' . self::e($url) . '" style="color:#ffffff;font-weight:700;text-decoration:underline">' . self::e($label) . '</a>';
    }

    /** Aclaración chica bajo un bloque (vigencia de descargas…). */
    public static function note(string $text): string
    {
        return self::blend('<div style="margin:2px 0 14px;font-family:' . self::BODY . ';font-size:13px;line-height:1.5;color:' . self::MUTED . '">' . self::e($text) . '</div>');
    }

    /** Título de sección: Sentence case, sin versalitas (no es un eyebrow). */
    public static function h2(string $t): string
    {
        return self::blend('<div style="margin:26px 0 8px;font-family:' . self::BODY . ';font-weight:700;font-size:16px;color:#ffffff">' . self::e($t) . '</div>');
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
        return self::blend($out . '</table>');
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
        return self::blend($out . '</table>');
    }

    /** Texto que la persona escribió (Contacto). La barra magenta es una celda con fondo, fuera de blend(). */
    public static function quote(string $text): string
    {
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px"><tr>'
            . '<td width="3" style="' . self::bg(self::ACCENT) . 'width:3px;font-size:0;line-height:0">&nbsp;</td>'
            . '<td style="padding:4px 0 4px 14px">'
            . self::blend('<div style="font-family:' . self::BODY . ';font-size:15px;line-height:1.6;color:' . self::MUTED . '">' . nl2br(self::e($text)) . '</div>')
            . '</td></tr></table>';
    }

    /** Botón principal: pastilla magenta con texto de tinta, como el de la tienda. */
    public static function button(string $label, string $url): string
    {
        return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr>'
            . '<td style="' . self::bg(self::ACCENT) . 'border-radius:999px">'
            . '<a href="' . self::e($url) . '" style="display:inline-block;padding:15px 28px;font-family:' . self::BODY . ';font-weight:700;'
            . 'font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:' . self::INK . ';text-decoration:none">' . self::e($label) . '</a>'
            . '</td></tr></table>';
    }

    /** Enlace secundario discreto (Ayuda, Ver mi pedido…). */
    public static function link(string $label, string $url): string
    {
        return self::blend('<div style="margin:14px 0 0;font-family:' . self::BODY . ';font-size:14px">'
            . '<a href="' . self::e($url) . '" style="color:' . self::TEXT . ';text-decoration:underline">' . self::e($label) . '</a></div>');
    }

    public static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }
}
