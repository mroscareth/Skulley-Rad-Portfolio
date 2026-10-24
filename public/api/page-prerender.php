<?php
/**
 * Rutas base (/, /about, /work, /blog, /contact, tienda) con meta propia.
 *
 * Sin esto las seis comparten el title, la description y el canonical del
 * home que viene en el index.html del build — o sea, Google ve seis copias
 * de la misma página y se queda con una.
 *
 * Las de índice (/work, /blog, tienda) además pintan su lista: son páginas
 * cuyo contenido ES la lista, y de paso le dan a un crawler los links a las
 * piezas sin tener que ejecutar la SPA para descubrirlos.
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

$route = trim((string) ($_GET['route'] ?? ''), '/');
$isEs = ($_GET['lang'] ?? '') === 'es';
$site = SeoShell::siteUrl();

$person = [
    '@type' => 'Person',
    'name' => 'Oscar Moctezuma Rodriguez',
    'alternateName' => 'Skulley Rad',
    'url' => $site,
    'jobTitle' => 'Creative Designer & 3D Artist',
    'address' => [
        '@type' => 'PostalAddress',
        'addressLocality' => 'Monterrey',
        'addressRegion' => 'Nuevo León',
        'addressCountry' => 'MX',
    ],
    'sameAs' => [
        'https://twitter.com/mroscareth',
        'https://instagram.com/mroscar.eth',
        'https://www.behance.net/mroscar',
    ],
];

/**
 * Title y description por ruta.
 *
 * Son el texto que sale en el resultado de búsqueda, así que dicen el
 * oficio y la ciudad en vez de adjetivos: "diseñador y artista 3D en
 * Monterrey" se puede buscar, "creatividad sin límites" no.
 */
$routes = [
    '' => [
        'title' => 'Oscar Moctezuma Rodriguez — Creative Designer & 3D Artist | Portfolio',
        'desc' => 'Creative designer and 3D artist based in Monterrey, Mexico. Brand identity, 3D art and interactive web for brands and agencies worldwide.',
        'desc_es' => 'Diseñador creativo y artista 3D en Monterrey, México. Identidad de marca, arte 3D y web interactiva para marcas y agencias.',
        'type' => 'profile',
        'ld' => ['@type' => 'ProfilePage', 'name' => 'Oscar Moctezuma Rodriguez'],
    ],
    'about' => [
        'title' => 'About — Oscar Moctezuma Rodriguez, Creative Designer in Monterrey',
        'desc' => 'Designer and 3D artist from Monterrey, Mexico. Founder of The Heritage Design. Work with Valve, Koto Studio and brands across design, 3D and technology.',
        'desc_es' => 'Diseñador y artista 3D de Monterrey, México. Fundador de The Heritage Design. Trabajo con Valve, Koto Studio y marcas en diseño, 3D y tecnología.',
        'type' => 'profile',
        'ld' => ['@type' => 'AboutPage', 'name' => 'About Oscar Moctezuma Rodriguez'],
    ],
    'work' => [
        'title' => 'Work — Brand, 3D and Interactive Projects | Oscar Moctezuma Rodriguez',
        'desc' => 'Selected projects in brand identity, 3D art, character design and interactive web, made for brands and agencies from Monterrey, Mexico.',
        'desc_es' => 'Proyectos de identidad de marca, arte 3D, diseño de personajes y web interactiva, hechos para marcas y agencias desde Monterrey, México.',
        'type' => 'website',
        'ld' => ['@type' => 'CollectionPage', 'name' => 'Work'],
    ],
    'blog' => [
        'title' => 'Memories — Notes on Design, 3D and AI | Oscar Moctezuma Rodriguez',
        'desc' => 'Writing on design practice, 3D art, creative direction and working alongside AI, by designer Oscar Moctezuma Rodriguez.',
        'desc_es' => 'Textos sobre práctica de diseño, arte 3D, dirección creativa y trabajar junto a la IA, por Oscar Moctezuma Rodriguez.',
        'type' => 'website',
        'ld' => ['@type' => 'Blog', 'name' => 'Memories'],
    ],
    'contact' => [
        'title' => 'Contact — Work With Oscar Moctezuma Rodriguez',
        'desc' => 'Available for brand, 3D and interactive projects with brands and agencies. Based in Monterrey, Mexico, working worldwide.',
        'desc_es' => 'Disponible para proyectos de marca, 3D e interactivos con marcas y agencias. Desde Monterrey, México, para todo el mundo.',
        'type' => 'website',
        'ld' => ['@type' => 'ContactPage', 'name' => 'Contact'],
    ],
    'lost-and-found-shop' => [
        'title' => 'Shop — Art Prints, Toys and Original Work | Oscar Moctezuma Rodriguez',
        'desc' => 'Original art, prints and collectibles by Oscar Moctezuma Rodriguez. Limited runs and one-of-a-kind pieces, shipping from Mexico.',
        'desc_es' => 'Arte original, impresiones y piezas de colección de Oscar Moctezuma Rodriguez. Tirajes limitados y piezas únicas, con envío desde México.',
        'type' => 'website',
        'ld' => ['@type' => 'CollectionPage', 'name' => 'Shop'],
    ],
];

if (!array_key_exists($route, $routes)) {
    SeoShell::passthrough();
    exit;
}

$cfg = $routes[$route];
$url = $site . ($route === '' ? '/' : '/' . $route) . ($isEs ? '?lang=es' : '');
$desc = $isEs ? $cfg['desc_es'] : $cfg['desc'];

$jsonLd = array_merge(
    ['@context' => 'https://schema.org'],
    $cfg['ld'],
    [
        'url' => $url,
        'description' => $desc,
        'inLanguage' => $isEs ? 'es-MX' : 'en',
        'about' => $person,
    ]
);
if ($route === '') {
    $jsonLd['mainEntity'] = $person;
}

// ── Listas de las páginas índice ──
// Una consulta que falle (tabla que no existe en un entorno) no debe
// tumbar la página: sin lista sigue sirviendo meta correcta.
$body = '';
$items = [];

try {
    require_once __DIR__ . '/db.php';

    if ($route === 'work') {
        $rows = Database::fetchAll(
            'SELECT slug, title, description_en, description_es FROM projects
             WHERE is_active = 1 ORDER BY display_order ASC, id DESC'
        ) ?: [];
        foreach ($rows as $r) {
            if (empty($r['slug']))
                continue;
            $items[] = [
                'url' => $site . '/work/' . $r['slug'],
                'title' => (string) $r['title'],
                'text' => SeoShell::plainText($r[$isEs ? 'description_es' : 'description_en'] ?? '', 200),
            ];
        }
    }
    elseif ($route === 'blog') {
        $rows = Database::fetchAll(
            'SELECT slug, title, excerpt, published_at FROM blog_posts
             WHERE published = 1 ORDER BY published_at DESC, id DESC'
        ) ?: [];
        foreach ($rows as $r) {
            if (empty($r['slug']))
                continue;
            $items[] = [
                'url' => $site . '/blog/' . $r['slug'],
                'title' => (string) $r['title'],
                'text' => SeoShell::plainText($r['excerpt'] ?? '', 200),
                'date' => $r['published_at'] ?? null,
            ];
        }
    }
    elseif ($route === 'lost-and-found-shop') {
        $rows = Database::fetchAll(
            "SELECT slug, title_en, title_es, description_en, description_es FROM shop_products
             WHERE status = 'active' ORDER BY display_order ASC, id DESC"
        ) ?: [];
        foreach ($rows as $r) {
            // Cada pieza tiene página propia (api/shop-prerender.php).
            $items[] = [
                'url' => $site . '/lost-and-found-shop/' . $r['slug'] . ($isEs ? '?lang=es' : ''),
                'title' => (string) ($r[$isEs ? 'title_es' : 'title_en'] ?: $r['title_en']),
                'text' => SeoShell::plainText($r[$isEs ? 'description_es' : 'description_en'] ?? '', 160),
            ];
        }
    }
}
catch (Throwable $e) {
    $items = [];
}

if ($items) {
    $jsonLd['mainEntity'] = [
        '@type' => 'ItemList',
        'numberOfItems' => count($items),
        'itemListElement' => array_values(array_map(function (array $it, int $i) {
            return [
                '@type' => 'ListItem',
                'position' => $i + 1,
                'name' => $it['title'],
                'url' => $it['url'],
            ];
        }, $items, array_keys($items))),
    ];

    $h = fn(?string $s): string => SeoShell::attr($s);
    $body = '<section style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
        . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 8px;">' . $h($cfg['ld']['name'] ?? '') . '</h1>'
        . '<p style="color:#b9b4c9;margin:0 0 32px;">' . $h($desc) . '</p>';
    foreach ($items as $it) {
        $body .= '<article style="margin:0 0 28px;">'
            . '<h2 style="font-size:1.15rem;margin:0 0 6px;"><a href="' . $h($it['url']) . '" style="color:#e8e6f0;">' . $h($it['title']) . '</a></h2>';
        if (!empty($it['text']))
            $body .= '<p style="margin:0;color:#b9b4c9;">' . $h($it['text']) . '</p>';
        $body .= '</article>';
    }
    $body .= '</section>';
}

SeoShell::render([
    'title' => $cfg['title'],
    'description' => $desc,
    'url' => $url,
    'type' => $cfg['type'],
    'jsonLd' => $jsonLd,
], $body);
