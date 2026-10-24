<?php
/**
 * Shell de SEO — sirve el index.html REAL con meta y contenido por ruta.
 *
 * El sitio es una SPA: el HTML que sale del build trae el mismo title,
 * description y canonical para toda URL. Para un crawler eso significa que
 * /blog/lo-que-sea dice ser un duplicado del home, y que el texto del
 * artículo no existe en ningún lado hasta que alguien ejecute JavaScript.
 * La mitad de los agentes (y todo lector de HTML crudo) nunca lo ejecuta.
 *
 * Esto NO es un prerender aparte para bots: lee el index.html del build,
 * le cambia el bloque de meta y le mete el contenido real dentro de #root,
 * y lo sirve IGUAL a todo el mundo. React monta encima y limpia #root, así
 * que el humano termina en la SPA de siempre — solo que con el texto ya
 * pintado mientras carga, en vez de una pantalla negra.
 *
 * Servir lo mismo a personas y a bots es a propósito: detectar por
 * User-Agent es justo lo que Google llama cloaking cuando el contenido no
 * coincide, y además deja fuera a cualquier agente que no esté en la lista.
 */

declare(strict_types = 1);

final class SeoShell
{
    private const SITE_URL = 'https://mroscar.xyz';
    private const SITE_NAME = 'Oscar Moctezuma Rodriguez';
    private const TWITTER = '@mroscareth';

    public static function siteUrl(): string
    {
        return self::SITE_URL;
    }

    /** Escapa para atributo HTML. */
    public static function attr(?string $v): string
    {
        return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
    }

    /** Absolutiza una ruta de imagen del CMS (que viene relativa). */
    public static function absoluteUrl(?string $path, string $fallback = '/sharer_MEMORY.png'): string
    {
        $p = trim((string) $path);
        if ($p === '')
            $p = $fallback;
        if (strpos($p, 'http') === 0)
            return $p;
        // Algunas rutas quedaron guardadas como "api/../uploads/..." por cómo
        // escribía el uploader; la de /api/ está bloqueada en robots.txt.
        $p = preg_replace('#^/?api/\.\./#', '', $p) ?? $p;
        return self::SITE_URL . '/' . ltrim($p, '/');
    }

    /**
     * Texto plano a partir del HTML del CMS, para description y articleBody.
     * strip_tags deja las palabras pegadas cuando no hay espacio entre
     * bloques, así que primero convertimos los cierres de bloque en espacio.
     */
    public static function plainText(?string $html, int $maxChars = 0): string
    {
        $s = preg_replace('#</(p|div|li|h[1-6]|br|tr)>#i', ' ', (string) $html) ?? '';
        $s = strip_tags($s);
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
        if ($maxChars > 0 && mb_strlen($s) > $maxChars) {
            $s = mb_substr($s, 0, $maxChars - 1);
            $cut = mb_strrpos($s, ' ');
            if ($cut !== false && $cut > $maxChars * 0.6)
                $s = mb_substr($s, 0, $cut);
            $s .= '…';
        }
        return $s;
    }

    /**
     * Arma el bloque <head> de la ruta.
     *
     * $meta: title, description, url, image, type ('article'|'website'|'profile'),
     *        keywords, jsonLd (array|null), publishedTime, modifiedTime, tags[]
     */
    private static function metaBlock(array $meta): string
    {
        $title = self::attr($meta['title'] ?? self::SITE_NAME);
        $desc = self::attr($meta['description'] ?? '');
        $url = self::attr($meta['url'] ?? self::SITE_URL);
        $image = self::attr(self::absoluteUrl($meta['image'] ?? null));
        $type = self::attr($meta['type'] ?? 'website');
        $name = self::attr(self::SITE_NAME);

        $out = "\n  <title>{$title}</title>"
            . "\n  <meta name=\"description\" content=\"{$desc}\" />";

        if (!empty($meta['keywords'])) {
            $out .= "\n  <meta name=\"keywords\" content=\"" . self::attr($meta['keywords']) . "\" />";
        }

        $out .= "\n  <meta name=\"author\" content=\"{$name}\" />"
            . "\n  <meta name=\"robots\" content=\"index, follow, max-image-preview:large, max-snippet:-1\" />"
            . "\n  <link rel=\"canonical\" href=\"{$url}\" />";

        // El sitio es bilingüe sin URL por idioma: ?lang=es es la variante.
        // Sin hreflang, Google trata las dos como la misma página y elige
        // una al azar para cada país.
        $base = self::attr(preg_replace('/[?&]lang=es/', '', (string) ($meta['url'] ?? self::SITE_URL)) ?? '');
        $sep = strpos($base, '?') === false ? '?' : '&';
        $out .= "\n  <link rel=\"alternate\" hreflang=\"en\" href=\"{$base}\" />"
            . "\n  <link rel=\"alternate\" hreflang=\"es\" href=\"{$base}{$sep}lang=es\" />"
            . "\n  <link rel=\"alternate\" hreflang=\"x-default\" href=\"{$base}\" />";

        $out .= "\n  <meta property=\"og:type\" content=\"{$type}\" />"
            . "\n  <meta property=\"og:site_name\" content=\"{$name}\" />"
            . "\n  <meta property=\"og:title\" content=\"{$title}\" />"
            . "\n  <meta property=\"og:description\" content=\"{$desc}\" />"
            . "\n  <meta property=\"og:image\" content=\"{$image}\" />"
            . "\n  <meta property=\"og:image:width\" content=\"1200\" />"
            . "\n  <meta property=\"og:image:height\" content=\"630\" />"
            . "\n  <meta property=\"og:image:alt\" content=\"{$title}\" />"
            . "\n  <meta property=\"og:url\" content=\"{$url}\" />"
            . "\n  <meta property=\"og:locale\" content=\"en_US\" />"
            . "\n  <meta property=\"og:locale:alternate\" content=\"es_MX\" />";

        if (!empty($meta['publishedTime'])) {
            $out .= "\n  <meta property=\"article:published_time\" content=\"" . self::attr($meta['publishedTime']) . "\" />";
        }
        if (!empty($meta['modifiedTime'])) {
            $out .= "\n  <meta property=\"article:modified_time\" content=\"" . self::attr($meta['modifiedTime']) . "\" />";
        }
        foreach (($meta['tags'] ?? []) as $tag) {
            $out .= "\n  <meta property=\"article:tag\" content=\"" . self::attr($tag) . "\" />";
        }

        $out .= "\n  <meta name=\"twitter:card\" content=\"summary_large_image\" />"
            . "\n  <meta name=\"twitter:title\" content=\"{$title}\" />"
            . "\n  <meta name=\"twitter:description\" content=\"{$desc}\" />"
            . "\n  <meta name=\"twitter:image\" content=\"{$image}\" />"
            . "\n  <meta name=\"twitter:image:alt\" content=\"{$title}\" />"
            . "\n  <meta name=\"twitter:site\" content=\"" . self::TWITTER . "\" />"
            . "\n  <meta name=\"twitter:creator\" content=\"" . self::TWITTER . "\" />";

        if (!empty($meta['jsonLd'])) {
            $json = json_encode($meta['jsonLd'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            // </script> dentro del JSON cerraría la etiqueta antes de tiempo.
            $json = str_replace('</', '<\/', (string) $json);
            $out .= "\n  <script type=\"application/ld+json\">{$json}</script>";
        }

        return $out . "\n  ";
    }

    /**
     * Sirve el index.html con el head de la ruta y, si viene, el contenido
     * dentro de #root. Sin $bodyHtml solo cambia los meta (secciones que no
     * tienen texto propio que pintar).
     */
    public static function render(array $meta, string $bodyHtml = ''): void
    {
        $indexPath = __DIR__ . '/../index.html';
        if (!is_file($indexPath)) {
            http_response_code(500);
            echo 'Shell no disponible';
            return;
        }
        $html = (string) file_get_contents($indexPath);

        $head = self::metaBlock($meta);
        $replaced = preg_replace(
            '/<!-- SEO:START -->.*?<!-- SEO:END -->/s',
            '<!-- SEO:START -->' . str_replace('$', '\$', $head) . '<!-- SEO:END -->',
            $html,
            1
        );
        if ($replaced !== null)
            $html = $replaced;

        if ($bodyHtml !== '') {
            // Reemplaza el boot-shim: en una ruta de contenido es mejor
            // enseñar el texto que una pantalla negra. React limpia #root
            // al montar, así que esto vive medio segundo.
            $replaced = preg_replace(
                '/<!-- PRERENDER:START -->.*?<!-- PRERENDER:END -->/s',
                '<!-- PRERENDER:START -->' . str_replace('$', '\$', $bodyHtml) . '<!-- PRERENDER:END -->',
                $html,
                1
            );
            if ($replaced !== null)
                $html = $replaced;

            // El noscript del shell describe el HOME. En una pieza con
            // texto propio sobra, y quien lee HTML crudo se lo come como
            // si fuera parte del artículo.
            $replaced = preg_replace(
                '/<!-- HOME-NOSCRIPT:START -->.*?<!-- HOME-NOSCRIPT:END -->/s',
                '',
                $html,
                1
            );
            if ($replaced !== null)
                $html = $replaced;
        }

        header('Content-Type: text/html; charset=UTF-8');
        // El contenido lo edita el CMS: que el HTML no se quede cacheado,
        // pero dejando que un CDN lo revalide en vez de pedirlo entero.
        header('Cache-Control: public, max-age=0, must-revalidate');
        echo $html;
    }

    /** Devuelve el index.html tal cual (ruta sin datos, 404 de contenido). */
    public static function passthrough(): void
    {
        $indexPath = __DIR__ . '/../index.html';
        if (is_file($indexPath)) {
            header('Content-Type: text/html; charset=UTF-8');
            readfile($indexPath);
            return;
        }
        http_response_code(404);
        echo 'Not found';
    }
}
