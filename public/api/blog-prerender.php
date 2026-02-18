<?php
/**
 * Blog Post Prerender for Social Crawlers
 *
 * Serves proper Open Graph, Twitter Card, and JSON-LD meta tags
 * to social crawlers (Facebook, Twitter, LinkedIn, WhatsApp, Discord, Google)
 * so shared blog post links display correct previews.
 *
 * How it works:
 *   1. .htaccess routes /blog/{slug} requests from crawlers here
 *   2. This script checks the User-Agent for known crawler bots
 *   3. For crawlers: renders a minimal HTML page with proper meta tags
 *   4. For humans: serves the normal SPA index.html
 */

declare(strict_types = 1)
;

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

// If it's from the direct URL path /blog/{slug}, extract from REQUEST_URI
if ($slug === '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (preg_match('#/blog/([a-zA-Z0-9_-]+)#', $path, $m)) {
        $slug = $m[1];
    }
}

// No slug or not a crawler → serve normal SPA
if ($slug === '' || !isSocialCrawler()) {
    $indexPath = __DIR__ . '/../index.html';
    if (is_file($indexPath)) {
        readfile($indexPath);
    }
    else {
        http_response_code(404);
        echo 'Not found';
    }
    exit;
}

// ── Fetch post data from DB ──
require_once __DIR__ . '/db.php';

$post = Database::fetchOne(
    'SELECT slug, title, subtitle, excerpt, cover_image, tags, published_at, created_at, updated_at,
            title_es, subtitle_es, excerpt_es
     FROM blog_posts
     WHERE slug = ? AND published = 1',
[$slug]
);

if (!$post) {
    $indexPath = __DIR__ . '/../index.html';
    if (is_file($indexPath)) {
        readfile($indexPath);
    }
    exit;
}

// ── Build meta values ──
$siteUrl = 'https://mroscar.xyz';
$postUrl = $siteUrl . '/blog/' . $post['slug'];
$siteName = 'Oscar Moctezuma Rodriguez';
$title = htmlspecialchars($post['title'] ?? 'Blog Post', ENT_QUOTES, 'UTF-8');
$subtitle = htmlspecialchars($post['subtitle'] ?? '', ENT_QUOTES, 'UTF-8');
$excerpt = htmlspecialchars($post['excerpt'] ?? '', ENT_QUOTES, 'UTF-8');
$desc = $excerpt ?: ($subtitle ?: $title);

// Cover image — resolve to absolute URL
$ogImage = $siteUrl . '/sharer_MEMORY.png'; // fallback
if (!empty($post['cover_image'])) {
    $cover = $post['cover_image'];
    if (strpos($cover, 'http') === 0) {
        $ogImage = $cover;
    }
    else {
        $ogImage = $siteUrl . '/' . ltrim($cover, '/');
    }
}

// Tags
$tags = json_decode($post['tags'] ?? '[]', true) ?: [];
$keywordsArr = array_map(function ($t) {
    return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); }, $tags);
$keywords = implode(', ', $keywordsArr);

// Dates
$publishedAt = $post['published_at'] ?? $post['created_at'];
$updatedAt = $post['updated_at'] ?? $publishedAt;
$isoPublished = date('c', strtotime($publishedAt));
$isoUpdated = date('c', strtotime($updatedAt));

// JSON-LD structured data
$jsonLd = json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'BlogPosting',
    'headline' => $post['title'],
    'description' => $post['excerpt'] ?? $post['subtitle'] ?? '',
    'image' => $ogImage,
    'url' => $postUrl,
    'datePublished' => $isoPublished,
    'dateModified' => $isoUpdated,
    'author' => [
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
        '@id' => $postUrl,
    ],
    'keywords' => implode(', ', $tags),
    'inLanguage' => ['en', 'es'],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

// ── Render minimal HTML for crawlers ──
header('Content-Type: text/html; charset=UTF-8');
$safePostUrl = htmlspecialchars($postUrl, ENT_QUOTES, 'UTF-8');
$safeSiteName = htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8');
$safeOgImage = htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8');
$safeSiteUrl = htmlspecialchars($siteUrl, ENT_QUOTES, 'UTF-8');
$displayDate = date('F j, Y', strtotime($publishedAt));
$tagsDisplay = implode(', ', $keywordsArr);
$year = date('Y');

echo '<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- SEO Core -->
  <title>' . $title . ' — ' . $safeSiteName . '</title>
  <meta name="description" content="' . $desc . '" />';

if ($keywords) {
    echo '
  <meta name="keywords" content="' . $keywords . '" />';
}

echo '
  <meta name="author" content="' . $safeSiteName . '" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="' . $safePostUrl . '" />

  <!-- Open Graph (Facebook, LinkedIn, WhatsApp) -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="' . $safeSiteName . ' Blog" />
  <meta property="og:title" content="' . $title . '" />
  <meta property="og:description" content="' . $desc . '" />
  <meta property="og:image" content="' . $safeOgImage . '" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="' . $title . '" />
  <meta property="og:url" content="' . $safePostUrl . '" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="es_MX" />
  <meta property="article:published_time" content="' . $isoPublished . '" />
  <meta property="article:modified_time" content="' . $isoUpdated . '" />
  <meta property="article:author" content="' . $safeSiteUrl . '" />';

foreach ($tags as $tag) {
    echo '
  <meta property="article:tag" content="' . htmlspecialchars($tag, ENT_QUOTES, 'UTF-8') . '" />';
}

echo '

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="' . $title . '" />
  <meta name="twitter:description" content="' . $desc . '" />
  <meta name="twitter:image" content="' . $safeOgImage . '" />
  <meta name="twitter:image:alt" content="' . $title . '" />
  <meta name="twitter:site" content="@mroscareth" />
  <meta name="twitter:creator" content="@mroscareth" />

  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/favicon.png" />

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">' . $jsonLd . '</script>

  <!-- Redirect humans to SPA (crawlers won\'t execute JS) -->
  <noscript><meta http-equiv="refresh" content="0;url=' . $safePostUrl . '" /></noscript>
</head>
<body style="background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;">
  <article>
    <h1>' . $title . '</h1>';

if ($subtitle)
    echo '
    <p><em>' . $subtitle . '</em></p>';

if ($excerpt)
    echo '
    <p>' . $excerpt . '</p>';

if (!empty($post['cover_image']))
    echo '
    <img src="' . $safeOgImage . '" alt="' . $title . '" style="max-width:100%;border-radius:8px;" />';

echo '
    <p><time datetime="' . $isoPublished . '">' . $displayDate . '</time></p>';

if ($tags)
    echo '
    <p>Tags: ' . $tagsDisplay . '</p>';

echo '
    <p><a href="' . $safePostUrl . '" style="color:#ff8c33;">Read full post &rarr;</a></p>
  </article>
  <footer style="margin-top:40px;border-top:1px solid #334155;padding-top:20px;">
    <p>&copy; ' . $year . ' ' . $safeSiteName . ' &mdash; <a href="' . $safeSiteUrl . '" style="color:#ff8c33;">mroscar.xyz</a></p>
  </footer>
</body>
</html>';
