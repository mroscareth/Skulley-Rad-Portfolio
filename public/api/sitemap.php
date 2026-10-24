<?php
/**
 * Sitemap completo: rutas base + proyectos + posts.
 *
 * El sitemap.xml estático que había listaba https://mroscar.xyz/#work y
 * /#about. Google ignora el fragmento: para él las tres eran la misma
 * URL, el home, y /work, /about, /contact, la tienda y cada proyecto no
 * aparecían en ningún lado. Esto los arma desde la base, así que una
 * pieza nueva del CMS entra al sitemap sola.
 *
 * Se sirve en /sitemap.xml por una reescritura del .htaccess.
 */

declare(strict_types = 1);

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600');

// Constante y no variable: urlEntry() no ve las variables globales, y con
// `$site` las imágenes salían relativas (/uploads/...), que el protocolo de
// sitemaps no acepta.
const SITE = 'https://mroscar.xyz';
$site = SITE;

/**
 * URL absoluta de una portada. Algunas quedaron guardadas como
 * "api/../uploads/..." por cómo las escribía el uploader.
 */
function absoluteAsset(string $path): string
{
    if (strpos($path, 'http') === 0) return $path;
    $path = preg_replace('#^/?api/\.\./#', '', $path);
    return SITE . '/' . ltrim($path, '/');
}

/** @return string una entrada <url> con sus alternates de idioma */
function urlEntry(string $loc, ?string $lastmod, string $changefreq, string $priority, ?string $image = null): string
{
    $esc = fn(string $s): string => htmlspecialchars($s, ENT_XML1, 'UTF-8');
    $sep = strpos($loc, '?') === false ? '?' : '&';

    $x = "  <url>\n";
    $x .= '    <loc>' . $esc($loc) . "</loc>\n";
    $x .= '    <xhtml:link rel="alternate" hreflang="en" href="' . $esc($loc) . "\"/>\n";
    $x .= '    <xhtml:link rel="alternate" hreflang="es" href="' . $esc($loc . $sep . 'lang=es') . "\"/>\n";
    $x .= '    <xhtml:link rel="alternate" hreflang="x-default" href="' . $esc($loc) . "\"/>\n";
    if ($lastmod)
        $x .= '    <lastmod>' . date('Y-m-d', strtotime($lastmod)) . "</lastmod>\n";
    $x .= '    <changefreq>' . $changefreq . "</changefreq>\n";
    $x .= '    <priority>' . $priority . "</priority>\n";
    if ($image) {
        $x .= "    <image:image>\n      <image:loc>" . $esc(absoluteAsset($image)) . "</image:loc>\n    </image:image>\n";
    }
    return $x . "  </url>\n";
}

$out = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
    . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n"
    . '        xmlns:xhtml="http://www.w3.org/1999/xhtml"' . "\n"
    . '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

// Rutas base. Sin fragmentos: cada una es una URL que el servidor sirve
// con su propio title y canonical (api/page-prerender.php).
$out .= urlEntry($site . '/', null, 'weekly', '1.0');
foreach ([
    ['work', 'weekly', '0.9'],
    ['about', 'monthly', '0.8'],
    ['lost-and-found-shop', 'weekly', '0.8'],
    ['blog', 'weekly', '0.7'],
    ['contact', 'monthly', '0.6'],
] as [$path, $freq, $prio]) {
    $out .= urlEntry($site . '/' . $path, null, $freq, $prio);
}

// Piezas del CMS. Si la base no responde, el sitemap sale con las rutas
// base en vez de un 500 — mejor incompleto que roto.
try {
    require_once __DIR__ . '/db.php';

    // lastmod = última edición, no la fecha de alta: es lo que le dice a
    // Google que una ficha reescrita vale otra visita.
    $projects = Database::fetchAll(
        'SELECT slug, cover_image, created_at, updated_at FROM projects
         WHERE is_active = 1 AND slug IS NOT NULL AND slug <> \'\'
         ORDER BY display_order ASC, id DESC'
    ) ?: [];
    foreach ($projects as $p) {
        $out .= urlEntry(
            $site . '/work/' . $p['slug'],
            $p['updated_at'] ?: $p['created_at'],
            'monthly',
            '0.8',
            $p['cover_image'] ?? null
        );
    }

    // Piezas de la tienda con página propia (api/shop-prerender.php).
    $pieces = Database::fetchAll(
        "SELECT slug, images, created_at, updated_at FROM shop_products
         WHERE status = 'active' AND slug IS NOT NULL AND slug <> ''
         ORDER BY display_order ASC, id DESC"
    ) ?: [];
    foreach ($pieces as $s) {
        $imgs = json_decode((string) ($s['images'] ?? ''), true) ?: [];
        $out .= urlEntry(
            $site . '/lost-and-found-shop/' . $s['slug'],
            $s['updated_at'] ?: $s['created_at'],
            'weekly',
            '0.7',
            $imgs[0]['url'] ?? null
        );
    }

    $posts = Database::fetchAll(
        'SELECT slug, cover_image, updated_at, published_at, created_at FROM blog_posts
         WHERE published = 1 ORDER BY published_at DESC, id DESC'
    ) ?: [];
    foreach ($posts as $b) {
        $out .= urlEntry(
            $site . '/blog/' . $b['slug'],
            $b['updated_at'] ?: ($b['published_at'] ?: $b['created_at']),
            'monthly',
            '0.7',
            $b['cover_image'] ?? null
        );
    }
}
catch (Throwable $e) {
    // Rutas base ya quedaron arriba.
}

echo $out . '</urlset>';
