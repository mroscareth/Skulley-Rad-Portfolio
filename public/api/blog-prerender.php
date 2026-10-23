<?php
/**
 * /blog/{slug} servido con el artículo dentro del HTML.
 *
 * Antes esto solo respondía a una lista de User-Agents y mandaba el
 * resumen con un "Read full post →". O sea: Google indexaba el extracto,
 * los agentes que no estaban en la lista no veían nada, y el cuerpo del
 * post no existía en el HTML para nadie.
 *
 * Ahora responde a todos con el shell real (api/seo-shell.php) y el texto
 * completo. Ver seo-shell.php para por qué no se separa por User-Agent.
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

// ── Slug: del query de la reescritura, o del propio /blog/{slug} ──
$slug = trim($_GET['slug'] ?? '');
if ($slug === '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (preg_match('#/blog/([a-zA-Z0-9_-]+)#', (string) $path, $m)) {
        $slug = $m[1];
    }
}
if ($slug === '') {
    SeoShell::passthrough();
    exit;
}

require_once __DIR__ . '/db.php';

$post = Database::fetchOne(
    'SELECT slug, title, subtitle, excerpt, content_html, cover_image, tags,
            published_at, created_at, updated_at,
            title_es, subtitle_es, excerpt_es, content_html_es
     FROM blog_posts
     WHERE slug = ? AND published = 1',
    [$slug]
);

// Post inexistente o despublicado: que la SPA resuelva (y enseñe su 404).
if (!$post) {
    SeoShell::passthrough();
    exit;
}

// ── Idioma ──
// La URL no lleva idioma; ?lang=es existe para que el CMS y los links
// compartidos puedan apuntar a la versión en español.
$isEs = ($_GET['lang'] ?? '') === 'es';
$pick = function (string $en, string $es) use ($post, $isEs): string {
    $a = trim((string) ($post[$isEs ? $es : $en] ?? ''));
    if ($a !== '')
        return $a;
    return trim((string) ($post[$isEs ? $en : $es] ?? ''));
};

$title = $pick('title', 'title_es');
$subtitle = $pick('subtitle', 'subtitle_es');
$excerpt = $pick('excerpt', 'excerpt_es');
$contentHtml = $pick('content_html', 'content_html_es');

$postUrl = SeoShell::siteUrl() . '/blog/' . $post['slug'] . ($isEs ? '?lang=es' : '');
$image = SeoShell::absoluteUrl($post['cover_image'] ?? null);

$tags = json_decode($post['tags'] ?? '[]', true) ?: [];
$publishedAt = $post['published_at'] ?: $post['created_at'];
$isoPublished = date('c', strtotime((string) $publishedAt));
$isoUpdated = date('c', strtotime((string) ($post['updated_at'] ?: $publishedAt)));

// La description de un resultado de búsqueda se corta cerca de 160.
$bodyText = SeoShell::plainText($contentHtml);
$desc = $excerpt !== '' ? $excerpt : ($subtitle !== '' ? $subtitle : SeoShell::plainText($contentHtml, 160));

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'BlogPosting',
    'headline' => $title,
    'description' => $desc,
    'image' => $image,
    'url' => $postUrl,
    'datePublished' => $isoPublished,
    'dateModified' => $isoUpdated,
    'author' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => SeoShell::siteUrl(),
    ],
    'publisher' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => SeoShell::siteUrl(),
        'logo' => ['@type' => 'ImageObject', 'url' => SeoShell::siteUrl() . '/favicon.png'],
    ],
    'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $postUrl],
    'inLanguage' => $isEs ? 'es-MX' : 'en',
];
if ($tags)
    $jsonLd['keywords'] = implode(', ', $tags);
// articleBody es lo que un asistente cita cuando resume el post.
if ($bodyText !== '')
    $jsonLd['articleBody'] = $bodyText;
if ($bodyText !== '')
    $jsonLd['wordCount'] = str_word_count($bodyText);

// ── Contenido dentro de #root ──
// Vive hasta que React monta. Se pinta con estilos inline porque el CSS
// del build carga después: sin ellos sería texto negro sobre negro.
$h = fn(?string $s): string => SeoShell::attr($s);
$body = '<article style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
    . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px;">' . $h($title) . '</h1>';

if ($subtitle !== '')
    $body .= '<p style="font-size:1.1rem;color:#b9b4c9;margin:0 0 16px;">' . $h($subtitle) . '</p>';

$body .= '<p style="color:#8e89a0;font-size:0.9rem;margin:0 0 28px;">'
    . '<time datetime="' . $h($isoPublished) . '">' . date('j F Y', strtotime((string) $publishedAt)) . '</time>'
    . '</p>';

if (!empty($post['cover_image'])) {
    $body .= '<img src="' . $h($image) . '" alt="' . $h($title) . '" width="1200" height="630"'
        . ' style="max-width:100%;height:auto;border-radius:10px;margin:0 0 28px;" />';
}

// content_html ya pasó por HtmlSanitizer al guardarse desde el CMS.
if ($contentHtml !== '')
    $body .= '<div>' . $contentHtml . '</div>';
elseif ($excerpt !== '')
    $body .= '<p>' . $h($excerpt) . '</p>';

if ($tags) {
    $body .= '<p style="margin-top:32px;color:#8e89a0;font-size:0.85rem;">'
        . ($isEs ? 'Temas: ' : 'Topics: ')
        . $h(implode(', ', $tags)) . '</p>';
}

$body .= '</article>';

SeoShell::render([
    'title' => $title . ' — Oscar Moctezuma Rodriguez',
    'description' => $desc,
    'url' => $postUrl,
    'image' => $image,
    'type' => 'article',
    'keywords' => $tags ? implode(', ', $tags) : null,
    'publishedTime' => $isoPublished,
    'modifiedTime' => $isoUpdated,
    'tags' => $tags,
    'jsonLd' => $jsonLd,
], $body);
