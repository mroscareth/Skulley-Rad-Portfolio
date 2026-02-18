<?php
/**
 * Analytics API — Visitor tracking & dashboard data
 * 
 * Endpoints:
 *   POST ?action=track      — Record a visitor (public, rate-limited)
 *   POST ?action=track_time  — Record section dwell times (public)
 *   GET  ?action=dashboard   — Aggregated dashboard data (auth required)
 *   GET  ?action=visitors    — Paginated visitor log (auth required)
 *   GET  ?action=live        — Last 20 visitors for live feed (auth required)
 *   GET  ?action=messages    — Contact inbox messages (auth required)
 *   POST ?action=message_update — Update message status (auth required)
 *   POST ?action=message_delete — Delete a message (auth required)
 *
 * Tracks: IP, User-Agent, browser, OS, device type, referrer, page,
 *         screen resolution, language, timezone, country, city, ISP, etc.
 */

declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

Middleware::cors();
Middleware::json();

// ─── Auto-create table if missing ───────────────────────────────
ensureTable();

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'track':
            handleTrack();
            break;
        case 'track_time':
            handleTrackTime();
            break;
        case 'dashboard':
            Middleware::requireAuth();
            handleDashboard();
            break;
        case 'visitors':
            Middleware::requireAuth();
            handleVisitors();
            break;
        case 'live':
            Middleware::requireAuth();
            handleLive();
            break;
        case 'export':
            Middleware::requireAuth();
            handleExport();
            break;
        case 'messages':
            Middleware::requireAuth();
            handleMessages();
            break;
        case 'message_update':
            Middleware::requireAuth();
            handleMessageUpdate();
            break;
        case 'message_delete':
            Middleware::requireAuth();
            handleMessageDelete();
            break;
        default:
            Middleware::error('Unknown action', 400);
    }
} catch (Exception $e) {
    $config = Database::getConfig();
    $msg = ($config['DEBUG'] ?? false) ? $e->getMessage() : 'Internal error';
    Middleware::error($msg, 500);
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Track a visitor — public endpoint, rate-limited
 */
function handleTrack(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Middleware::error('POST required', 405);
    }

    // Rate limit: 30 tracks per minute per IP
    if (!Middleware::rateLimit('analytics', 30, 60)) {
        Middleware::error('Rate limited', 429);
    }

    $body = Middleware::getJsonBody();
    $ip   = getClientIp();
    $ua   = $_SERVER['HTTP_USER_AGENT'] ?? '';

    // Parse browser & OS from User-Agent
    $browser    = parseBrowser($ua);
    $os         = parseOS($ua);
    $deviceType = parseDeviceType($ua);

    // Deduplicate: skip if same IP visited same page within 5 minutes
    $recentVisit = Database::fetchOne(
        'SELECT id FROM visitors WHERE ip_address = ? AND page_url = ? AND visited_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)',
        [$ip, $body['page'] ?? '/']
    );
    if ($recentVisit) {
        Middleware::success(['status' => 'deduplicated']);
    }

    // Resolve geolocation from IP (non-blocking best-effort)
    $geo = resolveGeo($ip);

    // Build visitor record
    $data = [
        'ip_address'     => $ip,
        'user_agent'     => mb_substr($ua, 0, 500),
        'browser'        => $browser,
        'os'             => $os,
        'device_type'    => $deviceType,
        'referrer'       => mb_substr($body['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? ''), 0, 500),
        'page_url'       => mb_substr($body['page'] ?? '/', 0, 500),
        'screen_width'   => (int)($body['screen_w'] ?? 0),
        'screen_height'  => (int)($body['screen_h'] ?? 0),
        'language'       => mb_substr($body['language'] ?? '', 0, 10),
        'timezone'       => mb_substr($body['timezone'] ?? '', 0, 50),
        'country'        => $geo['country'] ?? '',
        'country_code'   => $geo['countryCode'] ?? '',
        'city'           => $geo['city'] ?? '',
        'region'         => $geo['regionName'] ?? '',
        'lat'            => (float)($geo['lat'] ?? 0),
        'lon'            => (float)($geo['lon'] ?? 0),
        'isp'            => mb_substr($geo['isp'] ?? '', 0, 200),
        'org'            => mb_substr($geo['org'] ?? '', 0, 200),
        'as_name'        => mb_substr($geo['as'] ?? '', 0, 200),
        'is_dark_mode'   => (int)($body['dark_mode'] ?? 0),
        'is_touch'       => (int)($body['touch'] ?? 0),
        'connection'     => mb_substr($body['connection'] ?? '', 0, 20),
        'color_depth'    => (int)($body['color_depth'] ?? 0),
        'pixel_ratio'    => round((float)($body['pixel_ratio'] ?? 1), 2),
        'session_id'     => mb_substr($body['session_id'] ?? '', 0, 64),
        'visited_at'     => date('Y-m-d H:i:s'),
    ];

    Database::insert('visitors', $data);
    Middleware::success(['status' => 'tracked']);
}

/**
 * Dashboard data — aggregated stats
 */
function handleDashboard(): void {
    $period = $_GET['period'] ?? '7d';
    $days   = $period === '30d' ? 30 : ($period === '90d' ? 90 : 7);

    // Today's visitors
    $today = Database::fetchOne(
        'SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_ips FROM visitors WHERE DATE(visited_at) = CURDATE()'
    );

    // Yesterday for comparison
    $yesterday = Database::fetchOne(
        'SELECT COUNT(*) as total FROM visitors WHERE DATE(visited_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    );

    // Total all-time
    $allTime = Database::fetchOne(
        'SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_ips FROM visitors'
    );

    // This week vs last week
    $thisWeek = Database::fetchOne(
        'SELECT COUNT(*) as total FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
    );
    $lastWeek = Database::fetchOne(
        'SELECT COUNT(*) as total FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND visited_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
    );

    // Daily traffic for period
    $daily = Database::fetchAll(
        "SELECT DATE(visited_at) as date, COUNT(*) as views, COUNT(DISTINCT ip_address) as uniques
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(visited_at)
         ORDER BY date ASC",
        [$days]
    );

    // Hourly distribution (last 7 days)
    $hourly = Database::fetchAll(
        'SELECT HOUR(visited_at) as hour, COUNT(*) as total
         FROM visitors
         WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY HOUR(visited_at)
         ORDER BY hour ASC'
    );

    // Browser breakdown
    $browsers = Database::fetchAll(
        "SELECT browser, COUNT(*) as total, 
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)), 1) as pct
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND browser != ''
         GROUP BY browser
         ORDER BY total DESC
         LIMIT 10",
        [$days, $days]
    );

    // OS breakdown
    $oses = Database::fetchAll(
        "SELECT os, COUNT(*) as total,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)), 1) as pct
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND os != ''
         GROUP BY os
         ORDER BY total DESC
         LIMIT 10",
        [$days, $days]
    );

    // Device types
    $devices = Database::fetchAll(
        "SELECT device_type, COUNT(*) as total,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)), 1) as pct
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND device_type != ''
         GROUP BY device_type
         ORDER BY total DESC",
        [$days, $days]
    );

    // Country breakdown
    $countries = Database::fetchAll(
        "SELECT country, country_code, COUNT(*) as total,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM visitors WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND country != ''), 1) as pct
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND country != ''
         GROUP BY country, country_code
         ORDER BY total DESC
         LIMIT 20",
        [$days, $days]
    );

    // Top pages
    $pages = Database::fetchAll(
        "SELECT page_url, COUNT(*) as views, COUNT(DISTINCT ip_address) as uniques
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY page_url
         ORDER BY views DESC
         LIMIT 15",
        [$days]
    );

    // Top referrers
    $referrers = Database::fetchAll(
        "SELECT referrer, COUNT(*) as total
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND referrer != '' AND referrer NOT LIKE '%mroscar%'
         GROUP BY referrer
         ORDER BY total DESC
         LIMIT 10",
        [$days]
    );

    // Screen resolutions
    $screens = Database::fetchAll(
        "SELECT CONCAT(screen_width, 'x', screen_height) as resolution, COUNT(*) as total
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND screen_width > 0
         GROUP BY resolution
         ORDER BY total DESC
         LIMIT 10",
        [$days]
    );

    // ISP breakdown (geek!)
    $isps = Database::fetchAll(
        "SELECT isp, COUNT(*) as total
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND isp != ''
         GROUP BY isp
         ORDER BY total DESC
         LIMIT 10",
        [$days]
    );

    // Unique IPs (top visitors)
    $topIps = Database::fetchAll(
        "SELECT ip_address, COUNT(*) as visits, 
                MAX(visited_at) as last_visit,
                MAX(country) as country,
                MAX(city) as city,
                MAX(browser) as browser,
                MAX(os) as os
         FROM visitors
         WHERE visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY ip_address
         ORDER BY visits DESC
         LIMIT 15",
        [$days]
    );

    // Online now (last 5 minutes)
    $onlineNow = Database::fetchOne(
        'SELECT COUNT(DISTINCT ip_address) as total FROM visitors WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
    );

    // Map points for geo visualization (lat/lon clusters)
    $mapPoints = Database::fetchAll(
        "SELECT ROUND(lat, 1) as lat, ROUND(lon, 1) as lon,
                COUNT(*) as visits, MAX(country) as country, MAX(city) as city
         FROM visitors
         WHERE lat != 0 AND lon != 0 AND visited_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY ROUND(lat, 1), ROUND(lon, 1)
         ORDER BY visits DESC
         LIMIT 100",
        [$days]
    );

    // Section dwell times (average seconds per section)
    $sectionTimes = Database::fetchAll(
        "SELECT section,
                COUNT(*) as visits,
                ROUND(AVG(duration_ms) / 1000, 1) as avg_seconds,
                ROUND(MAX(duration_ms) / 1000, 1) as max_seconds,
                ROUND(SUM(duration_ms) / 1000, 0) as total_seconds
         FROM section_times
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY section
         ORDER BY avg_seconds DESC",
        [$days]
    );

    Middleware::success([
        'today' => [
            'views'      => (int)$today['total'],
            'unique_ips' => (int)$today['unique_ips'],
        ],
        'yesterday_views' => (int)$yesterday['total'],
        'all_time' => [
            'views'      => (int)$allTime['total'],
            'unique_ips' => (int)$allTime['unique_ips'],
        ],
        'this_week'     => (int)$thisWeek['total'],
        'last_week'     => (int)$lastWeek['total'],
        'online_now'    => (int)$onlineNow['total'],
        'daily'         => $daily,
        'hourly'        => $hourly,
        'browsers'      => $browsers,
        'oses'          => $oses,
        'devices'       => $devices,
        'countries'     => $countries,
        'pages'         => $pages,
        'referrers'     => $referrers,
        'screens'       => $screens,
        'isps'          => $isps,
        'top_ips'       => $topIps,
        'map_points'    => $mapPoints,
        'section_times' => $sectionTimes,
        'period'        => $period,
    ]);
}

/**
 * Paginated visitor log
 */
function handleVisitors(): void {
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $total = Database::fetchOne('SELECT COUNT(*) as total FROM visitors');
    $visitors = Database::fetchAll(
        "SELECT * FROM visitors ORDER BY visited_at DESC LIMIT ? OFFSET ?",
        [$limit, $offset]
    );

    Middleware::success([
        'visitors' => $visitors,
        'total'    => (int)$total['total'],
        'page'     => $page,
        'pages'    => (int)ceil((int)$total['total'] / $limit),
        'limit'    => $limit,
    ]);
}

/**
 * Live feed — last 20 visitors
 */
function handleLive(): void {
    $visitors = Database::fetchAll(
        "SELECT ip_address, browser, os, device_type, country, country_code, city, 
                page_url, referrer, isp, screen_width, screen_height, visited_at
         FROM visitors
         ORDER BY visited_at DESC
         LIMIT 20"
    );
    Middleware::success(['visitors' => $visitors]);
}

/**
 * Export all visitor data as CSV
 */
function handleExport(): void {
    // Override JSON headers with CSV headers
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="madre_analytics_' . date('Y-m-d_His') . '.csv"');
    header('Pragma: no-cache');
    header('Expires: 0');

    $output = fopen('php://output', 'w');

    // CSV column headers
    fputcsv($output, [
        'ID', 'Date', 'IP Address', 'Browser', 'OS', 'Device',
        'Country', 'City', 'Region', 'ISP', 'Latitude', 'Longitude',
        'Page', 'Referrer', 'Screen', 'Language', 'Timezone',
        'Dark Mode', 'Touch', 'Connection', 'Color Depth', 'Pixel Ratio', 'User Agent'
    ]);

    // Stream in chunks to avoid memory issues on large datasets
    $page = 1;
    $chunkSize = 1000;

    do {
        $offset = ($page - 1) * $chunkSize;
        $rows = Database::fetchAll(
            "SELECT * FROM visitors ORDER BY visited_at DESC LIMIT ? OFFSET ?",
            [$chunkSize, $offset]
        );

        foreach ($rows as $r) {
            fputcsv($output, [
                $r['id'],
                $r['visited_at'],
                $r['ip_address'],
                $r['browser'],
                $r['os'],
                $r['device_type'],
                $r['country'],
                $r['city'],
                $r['region'],
                $r['isp'],
                $r['lat'],
                $r['lon'],
                $r['page_url'],
                $r['referrer'],
                ($r['screen_width'] ? $r['screen_width'] . 'x' . $r['screen_height'] : ''),
                $r['language'],
                $r['timezone'],
                $r['is_dark_mode'] ? 'Yes' : 'No',
                $r['is_touch'] ? 'Yes' : 'No',
                $r['connection'],
                $r['color_depth'],
                $r['pixel_ratio'],
                $r['user_agent'],
            ]);
        }

        $page++;
    } while (count($rows) === $chunkSize);

    fclose($output);
    exit;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get real client IP behind proxies
 */
function getClientIp(): string {
    $headers = [
        'HTTP_CF_CONNECTING_IP',     // Cloudflare
        'HTTP_X_REAL_IP',            // Nginx proxy
        'HTTP_X_FORWARDED_FOR',      // Standard proxy
        'HTTP_CLIENT_IP',
        'REMOTE_ADDR',
    ];
    foreach ($headers as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = explode(',', $_SERVER[$h])[0];
            $ip = trim($ip);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Parse browser name from User-Agent
 */
function parseBrowser(string $ua): string {
    if (empty($ua)) return 'Unknown';
    
    $browsers = [
        'OPR|Opera'    => 'Opera',
        'Edg'          => 'Edge',
        'SamsungBrowser'=> 'Samsung',
        'UCBrowser'    => 'UC Browser',
        'YaBrowser'    => 'Yandex',
        'Brave'        => 'Brave',
        'Vivaldi'      => 'Vivaldi',
        'Firefox'      => 'Firefox',
        'Chrome'       => 'Chrome',
        'Safari'       => 'Safari',
        'MSIE|Trident' => 'IE',
    ];

    foreach ($browsers as $pattern => $name) {
        if (preg_match('/' . $pattern . '/i', $ua)) {
            return $name;
        }
    }
    
    // Check for bots
    if (preg_match('/bot|crawl|spider|slurp|mediapartners/i', $ua)) {
        return 'Bot';
    }
    
    return 'Other';
}

/**
 * Parse OS from User-Agent
 */
function parseOS(string $ua): string {
    if (empty($ua)) return 'Unknown';
    
    $oses = [
        '/Windows NT 10/i'    => 'Windows 10+',
        '/Windows NT 6\.3/i'  => 'Windows 8.1',
        '/Windows NT 6\.2/i'  => 'Windows 8',
        '/Windows NT 6\.1/i'  => 'Windows 7',
        '/Windows/i'          => 'Windows',
        '/Macintosh|Mac OS/i' => 'macOS',
        '/Linux.*Android/i'   => 'Android',
        '/iPhone|iPad|iPod/i' => 'iOS',
        '/CrOS/i'             => 'Chrome OS',
        '/Linux/i'            => 'Linux',
        '/Ubuntu/i'           => 'Ubuntu',
        '/FreeBSD/i'          => 'FreeBSD',
    ];

    foreach ($oses as $pattern => $name) {
        if (preg_match($pattern, $ua)) {
            return $name;
        }
    }
    
    if (preg_match('/bot|crawl|spider/i', $ua)) {
        return 'Bot';
    }
    
    return 'Other';
}

/**
 * Parse device type from User-Agent  
 */
function parseDeviceType(string $ua): string {
    if (empty($ua)) return 'unknown';
    if (preg_match('/bot|crawl|spider|slurp/i', $ua)) return 'bot';
    if (preg_match('/iPad|tablet|Kindle|PlayBook/i', $ua)) return 'tablet';
    if (preg_match('/Mobile|Android.*Mobile|iPhone|iPod|Opera Mini|IEMobile/i', $ua)) return 'mobile';
    return 'desktop';
}

/**
 * Resolve geolocation from IP using ip-api.com (free, 45 req/min)
 */
function resolveGeo(string $ip): array {
    // Skip private/local IPs
    if (in_array($ip, ['127.0.0.1', '::1', '0.0.0.0']) || 
        preg_match('/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/', $ip)) {
        return [
            'country' => 'Local',
            'countryCode' => 'LO',
            'city' => 'localhost',
            'regionName' => 'Dev',
            'lat' => 0,
            'lon' => 0,
            'isp' => 'Local Network',
            'org' => '',
            'as' => '',
        ];
    }

    $url = "http://ip-api.com/json/{$ip}?fields=status,country,countryCode,regionName,city,lat,lon,isp,org,as";
    
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 2,
            'method'  => 'GET',
            'header'  => "Accept: application/json\r\n",
        ],
    ]);

    $json = @file_get_contents($url, false, $ctx);
    if (!$json) return [];
    
    $data = json_decode($json, true);
    if (!is_array($data) || ($data['status'] ?? '') !== 'success') return [];
    
    return $data;
}

/**
 * Create visitors table if it doesn't exist
 */
function ensureTable(): void {
    $pdo = Database::getInstance();
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS visitors (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        ip_address    VARCHAR(45)  NOT NULL DEFAULT '',
        user_agent    VARCHAR(500) NOT NULL DEFAULT '',
        browser       VARCHAR(100) NOT NULL DEFAULT '',
        os            VARCHAR(100) NOT NULL DEFAULT '',
        device_type   VARCHAR(20)  NOT NULL DEFAULT '',
        referrer      VARCHAR(500) NOT NULL DEFAULT '',
        page_url      VARCHAR(500) NOT NULL DEFAULT '/',
        screen_width  INT          NOT NULL DEFAULT 0,
        screen_height INT          NOT NULL DEFAULT 0,
        language      VARCHAR(10)  NOT NULL DEFAULT '',
        timezone      VARCHAR(50)  NOT NULL DEFAULT '',
        country       VARCHAR(100) NOT NULL DEFAULT '',
        country_code  VARCHAR(5)   NOT NULL DEFAULT '',
        city          VARCHAR(100) NOT NULL DEFAULT '',
        region        VARCHAR(100) NOT NULL DEFAULT '',
        lat           DECIMAL(10,6) NOT NULL DEFAULT 0,
        lon           DECIMAL(10,6) NOT NULL DEFAULT 0,
        isp           VARCHAR(200) NOT NULL DEFAULT '',
        org           VARCHAR(200) NOT NULL DEFAULT '',
        as_name       VARCHAR(200) NOT NULL DEFAULT '',
        is_dark_mode  TINYINT(1)   NOT NULL DEFAULT 0,
        is_touch      TINYINT(1)   NOT NULL DEFAULT 0,
        connection    VARCHAR(20)  NOT NULL DEFAULT '',
        color_depth   INT          NOT NULL DEFAULT 0,
        pixel_ratio   DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        session_id    VARCHAR(64)  NOT NULL DEFAULT '',
        visited_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_visited  (visited_at),
        INDEX idx_ip       (ip_address),
        INDEX idx_page     (page_url(100)),
        INDEX idx_country  (country),
        INDEX idx_browser  (browser),
        INDEX idx_device   (device_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Section dwell-time tracking
    $pdo->exec("CREATE TABLE IF NOT EXISTS section_times (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        session_id  VARCHAR(64)  NOT NULL DEFAULT '',
        section     VARCHAR(50)  NOT NULL DEFAULT '',
        duration_ms INT          NOT NULL DEFAULT 0,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session  (session_id),
        INDEX idx_section  (section),
        INDEX idx_created  (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

/**
 * Store section dwell times — public endpoint
 */
function handleTrackTime(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Middleware::error('POST required', 405);
        return;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || empty($body['session_id']) || empty($body['sections'])) {
        Middleware::error('Invalid payload', 400);
        return;
    }

    $sessionId = substr($body['session_id'], 0, 64);
    $sections  = $body['sections'];

    if (!is_array($sections) || count($sections) > 20) {
        Middleware::error('Invalid sections', 400);
        return;
    }

    $pdo = Database::getInstance();
    $stmt = $pdo->prepare(
        'INSERT INTO section_times (session_id, section, duration_ms) VALUES (?, ?, ?)'
    );

    $inserted = 0;
    foreach ($sections as $s) {
        $section = substr(trim($s['section'] ?? ''), 0, 50);
        $duration = max(0, min(3600000, (int)($s['duration_ms'] ?? 0))); // cap at 1h
        if ($section && $duration > 500) { // ignore < 0.5s (noise)
            $stmt->execute([$sessionId, $section, $duration]);
            $inserted++;
        }
    }

    Middleware::success(['inserted' => $inserted]);
}

// ═══════════════════════════════════════════════════════════════
// CONTACT INBOX HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * List contact messages — paginated, with filters
 */
function handleMessages(): void {
    $pdo = Database::getInstance();

    // Ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS contact_messages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255)   NOT NULL DEFAULT '',
      email       VARCHAR(255)   NOT NULL DEFAULT '',
      subject     VARCHAR(100)   NOT NULL DEFAULT '',
      message     TEXT           NOT NULL,
      source      VARCHAR(100)   NOT NULL DEFAULT '',
      lang        VARCHAR(5)     NOT NULL DEFAULT 'en',
      ip_address  VARCHAR(45)    NOT NULL DEFAULT '',
      user_agent  VARCHAR(500)   NOT NULL DEFAULT '',
      request_id  VARCHAR(32)    NOT NULL DEFAULT '',
      is_read     TINYINT(1)     NOT NULL DEFAULT 0,
      is_starred  TINYINT(1)     NOT NULL DEFAULT 0,
      is_archived TINYINT(1)     NOT NULL DEFAULT 0,
      created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_email   (email),
      INDEX idx_read    (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(10, (int)($_GET['limit'] ?? 20)));
    $filter = $_GET['filter'] ?? 'all'; // all, unread, starred, archived
    $offset = ($page - 1) * $limit;

    // Build WHERE clause
    $where = 'WHERE 1=1';
    $params = [];
    switch ($filter) {
        case 'unread':   $where .= ' AND is_read = 0 AND is_archived = 0'; break;
        case 'starred':  $where .= ' AND is_starred = 1 AND is_archived = 0'; break;
        case 'archived': $where .= ' AND is_archived = 1'; break;
        default:         $where .= ' AND is_archived = 0'; break;
    }

    // Count total
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM contact_messages $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch messages
    $stmt = $pdo->prepare("SELECT id, name, email, subject, message, source, lang, ip_address, user_agent, request_id, is_read, is_starred, is_archived, created_at FROM contact_messages $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
    $stmt->execute($params);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get counts for badges
    $unreadCount = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE is_read = 0 AND is_archived = 0")->fetchColumn();
    $starredCount = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE is_starred = 1 AND is_archived = 0")->fetchColumn();
    $archivedCount = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE is_archived = 1")->fetchColumn();
    $totalAll = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages")->fetchColumn();

    Middleware::success([
        'messages' => $messages,
        'total' => $total,
        'page' => $page,
        'pages' => max(1, (int)ceil($total / $limit)),
        'counts' => [
            'total' => $totalAll,
            'unread' => $unreadCount,
            'starred' => $starredCount,
            'archived' => $archivedCount,
        ],
    ]);
}

/**
 * Update message status (read, starred, archived)
 */
function handleMessageUpdate(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Middleware::error('POST required', 405);
        return;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $id = (int)($body['id'] ?? 0);
    $field = (string)($body['field'] ?? '');
    $value = (int)($body['value'] ?? 0);

    if (!$id || !in_array($field, ['is_read', 'is_starred', 'is_archived'])) {
        Middleware::error('Invalid params', 400);
        return;
    }

    $pdo = Database::getInstance();
    $stmt = $pdo->prepare("UPDATE contact_messages SET $field = ? WHERE id = ?");
    $stmt->execute([$value ? 1 : 0, $id]);

    Middleware::success(['updated' => $stmt->rowCount()]);
}

/**
 * Delete a message permanently
 */
function handleMessageDelete(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Middleware::error('POST required', 405);
        return;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $id = (int)($body['id'] ?? 0);

    if (!$id) {
        Middleware::error('Invalid id', 400);
        return;
    }

    $pdo = Database::getInstance();
    $stmt = $pdo->prepare('DELETE FROM contact_messages WHERE id = ?');
    $stmt->execute([$id]);

    Middleware::success(['deleted' => $stmt->rowCount()]);
}
