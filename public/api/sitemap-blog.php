<?php
/**
 * Dynamic Blog Sitemap
 *
 * Generates XML sitemap entries for all published blog posts.
 * Includes cover images for Google Image Search.
 *
 * Access: GET /api/sitemap-blog.php
 * Referenced from: robots.txt as Sitemap directive
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/db.php';

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600');

$siteUrl = 'https://mroscar.xyz';

// Fetch all published posts
try {
    $posts = Database::fetchAll(
        'SELECT slug, title, cover_image, updated_at, published_at, created_at
         FROM blog_posts
         WHERE published = 1
         ORDER BY published_at DESC, created_at DESC'
    );
}
catch (Throwable $e) {
    $posts = [];
}

$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<!-- Dynamic Blog Sitemap -- Oscar Moctezuma Rodriguez -->' . "\n";
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
$xml .= '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n\n";

// Blog listing page
$xml .= '  <url>' . "\n";
$xml .= '    <loc>' . $siteUrl . '/blog</loc>' . "\n";
$xml .= '    <changefreq>daily</changefreq>' . "\n";
$xml .= '    <priority>0.8</priority>' . "\n";
$xml .= '  </url>' . "\n\n";

foreach ($posts as $post) {
    $lastmod = $post['updated_at'] ?? $post['published_at'] ?? $post['created_at'];
    $lastmodDate = date('Y-m-d', strtotime($lastmod));
    $postUrl = $siteUrl . '/blog/' . $post['slug'];

    // Resolve cover image URL
    $coverUrl = '';
    if (!empty($post['cover_image'])) {
        $cover = $post['cover_image'];
        $coverUrl = (strpos($cover, 'http') === 0) ? $cover : $siteUrl . '/' . ltrim($cover, '/');
    }

    $xml .= '  <url>' . "\n";
    $xml .= '    <loc>' . htmlspecialchars($postUrl, ENT_XML1, 'UTF-8') . '</loc>' . "\n";
    $xml .= '    <lastmod>' . $lastmodDate . '</lastmod>' . "\n";
    $xml .= '    <changefreq>monthly</changefreq>' . "\n";
    $xml .= '    <priority>0.7</priority>' . "\n";

    if ($coverUrl) {
        $xml .= '    <image:image>' . "\n";
        $xml .= '      <image:loc>' . htmlspecialchars($coverUrl, ENT_XML1, 'UTF-8') . '</image:loc>' . "\n";
        $xml .= '      <image:title>' . htmlspecialchars($post['title'] ?? '', ENT_XML1, 'UTF-8') . '</image:title>' . "\n";
        $xml .= '    </image:image>' . "\n";
    }

    $xml .= '  </url>' . "\n";
}

$xml .= "\n" . '</urlset>' . "\n";

echo $xml;
