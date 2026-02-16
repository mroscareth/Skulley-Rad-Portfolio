<?php
/**
 * Blog Posts CRUD
 *
 * Endpoints:
 *   GET    /blog.php              - List published posts (public)
 *   GET    /blog.php?slug=X       - Single post by slug
 *   GET    /blog.php?admin=1      - List all posts (auth required)
 *   POST   /blog.php              - Create post (auth)
 *   PUT    /blog.php              - Update post (auth)
 *   DELETE /blog.php?id=X         - Delete post (auth)
 *
 * Query params for GET (public):
 *   ?tag=X       - Filter by tag
 *   ?q=X         - Search in title/subtitle/excerpt
 *   ?page=N      - Page number (default 1)
 *   ?limit=N     - Per page (default 20, max 100)
 */

declare(strict_types = 1)
;

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet();
        break;
    case 'POST':
        handlePost();
        break;
    case 'PUT':
        handlePut();
        break;
    case 'DELETE':
        handleDelete();
        break;
    default:
        Middleware::error('method_not_allowed', 405);
}

// ────────────────────────────── GET ──────────────────────────────

function handleGet(): void
{
    // Single post by slug
    if (isset($_GET['slug'])) {
        $slug = trim($_GET['slug']);
        $post = Database::fetchOne(
            'SELECT * FROM blog_posts WHERE slug = ? AND published = 1',
        [$slug]
        );
        if (!$post) {
            Middleware::error('not_found', 404);
        }
        Middleware::success(['post' => formatPost($post)]);
        return;
    }

    // Admin list (all posts)
    if (isset($_GET['admin']) && $_GET['admin'] === '1') {
        Middleware::requireAuth();
        $posts = Database::fetchAll(
            'SELECT * FROM blog_posts ORDER BY featured DESC, created_at DESC'
        );
        Middleware::success([
            'posts' => array_map('formatPost', $posts),
        ]);
        return;
    }

    // Public list with optional filters
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where = ['published = 1'];
    $params = [];

    // Tag filter
    if (isset($_GET['tag']) && trim($_GET['tag']) !== '') {
        $tag = trim($_GET['tag']);
        // JSON_CONTAINS checks if the tag value exists in the tags JSON array
        $where[] = 'JSON_CONTAINS(tags, ?, \'$\')';
        $params[] = json_encode($tag);
    }

    // Search
    if (isset($_GET['q']) && trim($_GET['q']) !== '') {
        $q = '%' . trim($_GET['q']) . '%';
        $where[] = '(title LIKE ? OR subtitle LIKE ? OR excerpt LIKE ?)';
        $params[] = $q;
        $params[] = $q;
        $params[] = $q;
    }

    $whereSql = implode(' AND ', $where);

    // Count total
    $total = (int)Database::fetchOne(
        "SELECT COUNT(*) as cnt FROM blog_posts WHERE {$whereSql}",
        $params
    )['cnt'];

    // Fetch page — featured posts first, then by published_at desc
    $params[] = $limit;
    $params[] = $offset;
    $posts = Database::fetchAll(
        "SELECT * FROM blog_posts WHERE {$whereSql}
         ORDER BY featured DESC, published_at DESC, created_at DESC
         LIMIT ? OFFSET ?",
        $params
    );

    // Collect all unique tags across published posts (for tag filter UI)
    $allTags = [];
    $tagRows = Database::fetchAll(
        "SELECT DISTINCT tags FROM blog_posts WHERE published = 1 AND tags IS NOT NULL"
    );
    foreach ($tagRows as $row) {
        $decoded = json_decode($row['tags'], true);
        if (is_array($decoded)) {
            foreach ($decoded as $t) {
                $allTags[$t] = true;
            }
        }
    }

    Middleware::success([
        'posts' => array_map('formatPost', $posts),
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => (int)ceil($total / $limit),
        'allTags' => array_keys($allTags),
    ]);
}

// ────────────────────────────── POST ──────────────────────────────

function handlePost(): void
{
    Middleware::requireAuth();

    if (!Middleware::rateLimit('blog_create', 10, 60)) {
        Middleware::error('rate_limit', 429);
    }

    $data = Middleware::getJsonBody();
    $title = trim($data['title'] ?? '');

    if ($title === '') {
        Middleware::error('title_required', 400);
    }

    $slug = Middleware::slugify($data['slug'] ?? $title);

    // Ensure unique slug
    $existing = Database::fetchOne('SELECT id FROM blog_posts WHERE slug = ?', [$slug]);
    if ($existing) {
        $slug .= '-' . time();
    }

    $published = !empty($data['published']) ? 1 : 0;
    $featured = !empty($data['featured']) ? 1 : 0;
    $publishedAt = $published ? ($data['published_at'] ?? date('Y-m-d H:i:s')) : null;

    // If setting as featured, un-feature all others
    if ($featured) {
        Database::query('UPDATE blog_posts SET featured = 0');
    }

    $id = Database::insert('blog_posts', [
        'slug' => $slug,
        'title' => $title,
        'subtitle' => trim($data['subtitle'] ?? '') ?: null,
        'cover_image' => trim($data['cover_image'] ?? '') ?: null,
        'tags' => isset($data['tags']) ? json_encode($data['tags']) : null,
        'content_blocks' => isset($data['content_blocks']) ? json_encode($data['content_blocks']) : '[]',
        'content_html' => isset($data['content_html']) ? $data['content_html'] : null,
        'excerpt' => trim($data['excerpt'] ?? '') ?: null,
        'title_es' => trim($data['title_es'] ?? '') ?: null,
        'subtitle_es' => trim($data['subtitle_es'] ?? '') ?: null,
        'content_html_es' => isset($data['content_html_es']) ? $data['content_html_es'] : null,
        'excerpt_es' => trim($data['excerpt_es'] ?? '') ?: null,
        'featured' => $featured,
        'published' => $published,
        'published_at' => $publishedAt,
    ]);

    $post = Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [$id]);

    Middleware::success([
        'message' => 'created',
        'post' => formatPost($post),
    ]);
}

// ────────────────────────────── PUT ──────────────────────────────

function handlePut(): void
{
    Middleware::requireAuth();

    $data = Middleware::getJsonBody();
    $id = (int)($data['id'] ?? 0);

    if ($id <= 0) {
        Middleware::error('id_required', 400);
    }

    $existing = Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [$id]);
    if (!$existing) {
        Middleware::error('not_found', 404);
    }

    $update = [];

    if (isset($data['title'])) {
        $update['title'] = trim($data['title']);
    }
    if (isset($data['subtitle'])) {
        $update['subtitle'] = trim($data['subtitle']) ?: null;
    }
    if (isset($data['slug'])) {
        $newSlug = Middleware::slugify($data['slug']);
        // Check uniqueness (excluding self)
        $dup = Database::fetchOne(
            'SELECT id FROM blog_posts WHERE slug = ? AND id != ?',
        [$newSlug, $id]
        );
        if ($dup) {
            $newSlug .= '-' . time();
        }
        $update['slug'] = $newSlug;
    }
    if (isset($data['cover_image'])) {
        $update['cover_image'] = trim($data['cover_image']) ?: null;
    }
    if (isset($data['tags'])) {
        $update['tags'] = json_encode($data['tags']);
    }
    if (isset($data['content_blocks'])) {
        $update['content_blocks'] = json_encode($data['content_blocks']);
    }
    if (isset($data['content_html'])) {
        $update['content_html'] = $data['content_html'];
    }
    if (isset($data['excerpt'])) {
        $update['excerpt'] = trim($data['excerpt']) ?: null;
    }
    if (isset($data['title_es'])) {
        $update['title_es'] = trim($data['title_es']) ?: null;
    }
    if (isset($data['subtitle_es'])) {
        $update['subtitle_es'] = trim($data['subtitle_es']) ?: null;
    }
    if (isset($data['content_html_es'])) {
        $update['content_html_es'] = $data['content_html_es'];
    }
    if (isset($data['excerpt_es'])) {
        $update['excerpt_es'] = trim($data['excerpt_es']) ?: null;
    }
    if (isset($data['published'])) {
        $update['published'] = $data['published'] ? 1 : 0;
        if ($update['published'] && !$existing['published_at']) {
            $update['published_at'] = $data['published_at'] ?? date('Y-m-d H:i:s');
        }
    }
    if (isset($data['featured'])) {
        $update['featured'] = $data['featured'] ? 1 : 0;
        // Only one featured post at a time
        if ($update['featured']) {
            Database::query('UPDATE blog_posts SET featured = 0 WHERE id != ?', [$id]);
        }
    }

    if (!empty($update)) {
        Database::update('blog_posts', $update, 'id = ?', [$id]);
    }

    $post = Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [$id]);
    Middleware::success([
        'message' => 'updated',
        'post' => formatPost($post),
    ]);
}

// ────────────────────────────── DELETE ──────────────────────────────

function handleDelete(): void
{
    Middleware::requireAuth();

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        Middleware::error('id_required', 400);
    }

    $post = Database::fetchOne('SELECT * FROM blog_posts WHERE id = ?', [$id]);
    if (!$post) {
        Middleware::error('not_found', 404);
    }

    // Delete cover image file if exists
    if ($post['cover_image']) {
        $fullPath = __DIR__ . '/../' . $post['cover_image'];
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }

    // Delete any images referenced in content blocks
    $blocks = json_decode($post['content_blocks'] ?? '[]', true);
    if (is_array($blocks)) {
        foreach ($blocks as $block) {
            if (($block['type'] ?? '') === 'image' && !empty($block['src'])) {
                $imgPath = __DIR__ . '/../' . $block['src'];
                if (is_file($imgPath)) {
                    @unlink($imgPath);
                }
            }
        }
    }

    Database::delete('blog_posts', 'id = ?', [$id]);
    Middleware::success(['message' => 'deleted']);
}

// ────────────────────────────── Helpers ──────────────────────────────

function formatPost(array $post): array
{
    return [
        'id' => (int)$post['id'],
        'slug' => $post['slug'],
        'title' => $post['title'],
        'subtitle' => $post['subtitle'],
        'cover_image' => $post['cover_image'],
        'tags' => json_decode($post['tags'] ?? '[]', true) ?: [],
        'content_blocks' => json_decode($post['content_blocks'] ?? '[]', true) ?: [],
        'content_html' => $post['content_html'] ?? null,
        'excerpt' => $post['excerpt'],
        'title_es' => $post['title_es'] ?? null,
        'subtitle_es' => $post['subtitle_es'] ?? null,
        'content_html_es' => $post['content_html_es'] ?? null,
        'excerpt_es' => $post['excerpt_es'] ?? null,
        'featured' => (bool)$post['featured'],
        'published' => (bool)$post['published'],
        'published_at' => $post['published_at'],
        'created_at' => $post['created_at'],
        'updated_at' => $post['updated_at'],
    ];
}
