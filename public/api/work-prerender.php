<?php
/**
 * Work Project Prerender for Social Crawlers
 *
 * Serves proper Open Graph, Twitter Card, and JSON-LD meta tags
 * to social crawlers (Facebook, Twitter, LinkedIn, WhatsApp, Discord, Google, AI bots)
 * so shared work project links display correct previews.
 *
 * How it works:
 *   1. .htaccess routes /work/{slug} requests from crawlers here
 *   2. This script checks the User-Agent for known crawler bots
 *   3. For crawlers: renders a minimal HTML page with proper meta tags
 *   4. For humans: serves the normal SPA index.html
 */

declare(strict_types=1);

// ── Crawler detection ──
function isSocialCrawler(): bool
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $crawlers = [
        'facebookexternalhit',
        'Facebot',
        'Twitterbot',
        'LinkedInBot',
        'WhatsApp',
        'Slackbot',
        'Discordbot',
        'TelegramBot',
        'Googlebot',
        'bingbot',
        'Google-InspectionTool',
        'Google-AMPHTML',
        'OAI-SearchBot',
        'GPTBot',
        'ChatGPT-User',
        'ClaudeBot',
        'Anthropic-AI',
        'PerplexityBot',
        'meta-externalagent',
    ];
    foreach ($crawlers as $bot) {
        if (stripos($ua, $bot) !== false)
            return true;
    }
    return false;
}

// ── Extract slug from request ──
$slug = trim($_GET['slug'] ?? '');

// If it's from the direct URL path /work/{slug}, extract from REQUEST_URI
if ($slug === '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (preg_match('#/work/([a-zA-Z0-9_-]+)#', $path, $m)) {
        $slug = $m[1];
    }
}

// No slug or not a crawler → serve normal SPA
if ($slug === '' || !isSocialCrawler()) {
    $indexPath = __DIR__ . '/../index.html';
    if (is_file($indexPath)) {
        readfile($indexPath);
    } else {
        http_response_code(404);
        echo 'Not found';
    }
    exit;
}

// ── Fetch project data from DB ──
require_once __DIR__ . '/db.php';

$project = Database::fetchOne(
    'SELECT slug, title, description_en, description_es, cover_image, project_type, external_url, created_at
     FROM projects
     WHERE slug = ? AND is_active = 1',
    [$slug]
);

if (!$project) {
    $indexPath = __DIR__ . '/../index.html';
    if (is_file($indexPath)) {
        readfile($indexPath);
    }
    exit;
}

// ── Build meta values ──
$siteUrl = 'https://mroscar.xyz';
$projectUrl = $siteUrl . '/work/' . $project['slug'];
$siteName = 'Oscar Moctezuma Rodriguez';
$title = htmlspecialchars($project['title'] ?? 'Project', ENT_QUOTES, 'UTF-8');
$descEn = htmlspecialchars($project['description_en'] ?? '', ENT_QUOTES, 'UTF-8');
$descEs = htmlspecialchars($project['description_es'] ?? '', ENT_QUOTES, 'UTF-8');
// Strip rich text markers for meta description
$descClean = strip_tags($descEn ?: $descEs ?: $title);
// Truncate to ~200 chars for meta description
if (mb_strlen($descClean) > 200) {
    $descClean = mb_substr($descClean, 0, 197) . '...';
}
$desc = htmlspecialchars($descClean, ENT_QUOTES, 'UTF-8');

// Cover image — resolve to absolute URL
$ogImage = $siteUrl . '/sharer_MEMORY.png'; // fallback
if (!empty($project['cover_image'])) {
    $cover = $project['cover_image'];
    if (strpos($cover, 'http') === 0) {
        $ogImage = $cover;
    } else {
        $ogImage = $siteUrl . '/' . ltrim($cover, '/');
    }
}

// Date
$createdAt = $project['created_at'] ?? date('Y-m-d');
$isoCreated = date('c', strtotime($createdAt));

// JSON-LD structured data
$jsonLd = json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'CreativeWork',
    'name' => $project['title'],
    'description' => $descClean,
    'image' => $ogImage,
    'url' => $projectUrl,
    'dateCreated' => $isoCreated,
    'creator' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => $siteUrl,
    ],
    'publisher' => [
        '@type' => 'Person',
        'name' => 'Oscar Moctezuma Rodriguez',
        'url' => $siteUrl,
        'logo' => [
            '@type' => 'ImageObject',
            'url' => $siteUrl . '/favicon.png',
        ],
    ],
    'mainEntityOfPage' => [
        '@type' => 'WebPage',
        '@id' => $projectUrl,
    ],
    'inLanguage' => ['en', 'es'],
    'keywords' => 'graphic design, branding, 3D art, web design, creative design, diseño gráfico, diseño web, diseño 3D',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

// ── Render minimal HTML for crawlers ──
header('Content-Type: text/html; charset=UTF-8');
$safeProjectUrl = htmlspecialchars($projectUrl, ENT_QUOTES, 'UTF-8');
$safeSiteName = htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8');
$safeOgImage = htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8');
$safeSiteUrl = htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8');
$year = date('Y');

echo '<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- SEO Core -->
  <title>' . $title . ' — ' . $safeSiteName . '</title>
  <meta name="description" content="' . $desc . '" />
  <meta name="keywords" content="' . $title . ', Oscar Moctezuma Rodriguez, creative design, graphic design, branding, 3D art, web design, diseño gráfico, diseño web, diseño 3D, animación" />
  <meta name="author" content="' . $safeSiteName . '" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="' . $safeProjectUrl . '" />

  <!-- Open Graph (Facebook, LinkedIn, WhatsApp) -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="' . $safeSiteName . ' — Portfolio" />
  <meta property="og:title" content="' . $title . ' — ' . $safeSiteName . '" />
  <meta property="og:description" content="' . $desc . '" />
  <meta property="og:image" content="' . $safeOgImage . '" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="' . $title . ' by Oscar Moctezuma Rodriguez" />
  <meta property="og:url" content="' . $safeProjectUrl . '" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="es_MX" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="' . $title . ' — ' . $safeSiteName . '" />
  <meta name="twitter:description" content="' . $desc . '" />
  <meta name="twitter:image" content="' . $safeOgImage . '" />
  <meta name="twitter:image:alt" content="' . $title . ' by Oscar Moctezuma Rodriguez" />
  <meta name="twitter:site" content="@mroscareth" />
  <meta name="twitter:creator" content="@mroscareth" />

  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/favicon.png" />

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">' . $jsonLd . '</script>

  <!-- Redirect humans to SPA (crawlers won\'t execute JS) -->
  <noscript><meta http-equiv="refresh" content="0;url=' . $safeProjectUrl . '" /></noscript>
</head>
<body style="background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;">
  <article>
    <h1>' . $title . '</h1>';

if ($descEn)
    echo '
    <p>' . $descEn . '</p>';

if ($descEs)
    echo '
    <p><em>' . $descEs . '</em></p>';

if (!empty($project['cover_image']))
    echo '
    <img src="' . $safeOgImage . '" alt="' . $title . '" style="max-width:100%;border-radius:8px;" />';

echo '
    <p>By <a href="' . $safeSiteUrl . '" style="color:#38bdf8;">Oscar Moctezuma Rodriguez</a></p>
    <p><a href="' . $safeProjectUrl . '" style="color:#ff8c33;">View full project &rarr;</a></p>
  </article>
  <footer style="margin-top:40px;border-top:1px solid #334155;padding-top:20px;">
    <p>&copy; ' . $year . ' ' . $safeSiteName . ' &mdash; <a href="' . $safeSiteUrl . '" style="color:#ff8c33;">mroscar.xyz</a></p>
  </footer>
</body>
</html>';
