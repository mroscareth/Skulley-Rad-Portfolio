<?php
/**
 * /work/{slug} servido con el proyecto dentro del HTML.
 *
 * Mismo cambio que blog-prerender.php: deja de filtrar por User-Agent y
 * deja de mandar solo meta. Ver api/seo-shell.php para el porqué.
 *
 * Un proyecto es la página que más importa para que una agencia te
 * encuentre, así que además del texto lleva JSON-LD de CreativeWork con
 * el autor — es lo que una búsqueda conversacional usa para atribuir el
 * trabajo a una persona.
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

$slug = trim($_GET['slug'] ?? '');
if ($slug === '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (preg_match('#/work/([a-zA-Z0-9_-]+)#', (string) $path, $m)) {
        $slug = $m[1];
    }
}
if ($slug === '') {
    SeoShell::passthrough();
    exit;
}

require_once __DIR__ . '/db.php';

$project = Database::fetchOne(
    'SELECT slug, title, description_en, description_es, cover_image,
            project_type, external_url, link_url, link_text_en, link_text_es, created_at
     FROM projects
     WHERE slug = ? AND is_active = 1',
    [$slug]
);

if (!$project) {
    SeoShell::passthrough();
    exit;
}

$isEs = ($_GET['lang'] ?? '') === 'es';
$title = trim((string) ($project['title'] ?? ''));
$descHtml = trim((string) ($project[$isEs ? 'description_es' : 'description_en'] ?? ''));
if ($descHtml === '')
    $descHtml = trim((string) ($project[$isEs ? 'description_en' : 'description_es'] ?? ''));

$projectUrl = SeoShell::siteUrl() . '/work/' . $project['slug'] . ($isEs ? '?lang=es' : '');
$image = SeoShell::absoluteUrl($project['cover_image'] ?? null);
$type = trim((string) ($project['project_type'] ?? ''));

$bodyText = SeoShell::plainText($descHtml);
$desc = SeoShell::plainText($descHtml, 160);
if ($desc === '') {
    $desc = $isEs
        ? "{$title} — proyecto de Oscar Moctezuma Rodriguez, diseñador y artista 3D."
        : "{$title} — a project by Oscar Moctezuma Rodriguez, designer and 3D artist.";
}

$created = $project['created_at'] ?: null;
$isoCreated = $created ? date('c', strtotime((string) $created)) : null;

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'CreativeWork',
    'name' => $title,
    'headline' => $title,
    'description' => $desc,
    'image' => $image,
    'url' => $projectUrl,
    'author' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => SeoShell::siteUrl(),
        'jobTitle' => 'Creative Designer & 3D Artist',
    ],
    'creator' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => SeoShell::siteUrl(),
    ],
    'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $projectUrl],
    'inLanguage' => $isEs ? 'es-MX' : 'en',
];
if ($type !== '')
    $jsonLd['genre'] = $type;
if ($isoCreated)
    $jsonLd['dateCreated'] = $isoCreated;
if ($bodyText !== '')
    $jsonLd['text'] = $bodyText;

$h = fn(?string $s): string => SeoShell::attr($s);
$body = '<article style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
    . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px;">' . $h($title) . '</h1>';

if ($type !== '') {
    $body .= '<p style="color:#8e89a0;font-size:0.9rem;margin:0 0 24px;">' . $h($type) . '</p>';
}

if (!empty($project['cover_image'])) {
    $body .= '<img src="' . $h($image) . '" alt="' . $h($title) . '" width="1200" height="630"'
        . ' style="max-width:100%;height:auto;border-radius:10px;margin:0 0 28px;" />';
}

if ($descHtml !== '')
    $body .= '<div>' . $descHtml . '</div>';

$external = trim((string) ($project['external_url'] ?: $project['link_url'] ?: ''));
if ($external !== '') {
    // El CMS tiene campos propios para el texto del botón; usarlos importa
    // porque no todos los links van al "proyecto" (el de Heritage lleva al
    // sitio del estudio). Si están vacíos, cae al genérico.
    $label = trim((string) ($project[$isEs ? 'link_text_es' : 'link_text_en'] ?? ''));
    if ($label === '')
        $label = trim((string) ($project[$isEs ? 'link_text_en' : 'link_text_es'] ?? ''));
    if ($label === '')
        $label = $isEs ? 'Ver el proyecto' : 'View the project';

    $body .= '<p style="margin-top:28px;"><a href="' . $h($external) . '" rel="noopener">'
        . $h($label) . '</a></p>';
}

$body .= '</article>';

SeoShell::render([
    'title' => $title . ' — Oscar Moctezuma Rodriguez',
    'description' => $desc,
    'url' => $projectUrl,
    'image' => $image,
    'type' => 'article',
    'keywords' => $type !== '' ? $type : null,
    'jsonLd' => $jsonLd,
], $body);
