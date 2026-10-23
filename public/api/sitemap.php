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

$site = 'https://mroscar.xyz';

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
        $abs = strpos($image, 'http') === 0 ? $image : $site . '/' . ltrim($image, '/');
        $x .= "    <image:image>\n      <image:loc>" . $esc($abs) . "</image:loc>\n    </image:image>\n";
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

    $projects = Database::fetchAll(
        'SELECT slug, cover_image, created_at FROM projects
         WHERE is_active = 1 AND slug IS NOT NULL AND slug <> \'\'
         ORDER BY display_order ASC, id DESC'
    ) ?: [];
    foreach ($projects as $p) {
        $out .= urlEntry(
            $site . '/work/' . $p['slug'],
            $p['created_at'] ?? null,
            'monthly',
            '0.8',
            $p['cover_image'] ?? null
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
