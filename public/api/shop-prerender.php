<?php
/**
 * /lost-and-found-shop/{slug} servido con la pieza dentro del HTML.
 *
 * Mismo patrón que work-prerender.php (ver api/seo-shell.php para el
 * porqué), pero con JSON-LD de Product: nombre, fotos, precio por moneda y
 * disponibilidad real (estante menos apartado, igual que el checkout). Es lo
 * que Google necesita para enseñar la pieza con foto y precio en la búsqueda
 * y en la pestaña de Shopping sin pagar anuncios.
 *
 * Antes todas las piezas apuntaban a /lost-and-found-shop: una sola página
 * para todo el catálogo, que Google no puede tratar como producto.
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

$slug = trim((string) ($_GET['slug'] ?? ''), '/');
if ($slug === '' || !preg_match('/^[a-z0-9-]+$/i', $slug)) {
    SeoShell::passthrough();
    exit;
}

try {
    require_once __DIR__ . '/shop-lib.php';
    $piece = null;
    foreach (Shop::products(true) as $p) {
        if ($p['slug'] === $slug) {
            $piece = $p;
            break;
        }
    }
}
catch (Throwable $e) {
    $piece = null;
}

if (!$piece) {
    SeoShell::passthrough();
    exit;
}

$isEs = ($_GET['lang'] ?? '') === 'es';
$site = SeoShell::siteUrl();
$title = trim((string) ($piece[$isEs ? 'title_es' : 'title_en'] ?: $piece['title_en']));
$descHtml = trim((string) ($piece[$isEs ? 'description_es' : 'description_en'] ?: $piece['description_en']));
$url = $site . '/lost-and-found-shop/' . $piece['slug'] . ($isEs ? '?lang=es' : '');
$images = array_values(array_map(fn($i) => SeoShell::absoluteUrl($i['url']), $piece['images']));

$desc = SeoShell::plainText($descHtml, 160);
if ($desc === '') {
    $desc = $isEs
        ? "{$title} — pieza de la tienda de Oscar Moctezuma Rodriguez."
        : "{$title} — a piece from Oscar Moctezuma Rodriguez's shop.";
}

// Una oferta por moneda. Varias variantes con precios distintos van como
// AggregateOffer (rango); una sola, como Offer simple.
$offers = [];
$priceLines = [];
foreach (['MXN' => 'price_mxn', 'USD' => 'price_usd'] as $currency => $field) {
    $prices = [];
    $inStock = false;
    foreach ($piece['variants'] as $v) {
        if ($v[$field] === null)
            continue;
        $prices[] = (float) $v[$field];
        // available null = sin límite (digitales, bajo demanda).
        if ($v['available'] === null || $v['available'] > 0)
            $inStock = true;
    }
    if (!$prices)
        continue;

    $low = min($prices);
    $high = max($prices);
    $availability = $inStock
        ? 'https://schema.org/InStock'
        : ($piece['edition'] === 'unique' ? 'https://schema.org/SoldOut' : 'https://schema.org/OutOfStock');
    $offer = [
        'priceCurrency' => $currency,
        'availability' => $availability,
        'url' => $url,
        'itemCondition' => 'https://schema.org/NewCondition',
        'seller' => ['@type' => 'Person', 'name' => 'Oscar Moctezuma Rodriguez', 'url' => $site],
    ];
    if ($low === $high) {
        $offers[] = ['@type' => 'Offer', 'price' => number_format($low, 2, '.', '')] + $offer;
    }
    else {
        $offers[] = [
            '@type' => 'AggregateOffer',
            'lowPrice' => number_format($low, 2, '.', ''),
            'highPrice' => number_format($high, 2, '.', ''),
            'offerCount' => count($prices),
        ] + $offer;
    }
    $priceLines[] = ($low === $high ? '' : ($isEs ? 'desde ' : 'from ')) . '$' . number_format($low, 2) . ' ' . $currency;
}

$sku = '';
foreach ($piece['variants'] as $v) {
    if (!empty($v['sku'])) {
        $sku = (string) $v['sku'];
        break;
    }
}

$jsonLd = [
    '@context' => 'https://schema.org',
    '@type' => 'Product',
    'name' => $title,
    'description' => SeoShell::plainText($descHtml) ?: $desc,
    'url' => $url,
    'sku' => $sku !== '' ? $sku : $piece['archive_id'],
    'productID' => $piece['archive_id'],
    'brand' => ['@type' => 'Brand', 'name' => 'Skulley Rad'],
    'inLanguage' => $isEs ? 'es-MX' : 'en',
];
if ($images)
    $jsonLd['image'] = $images;
if (!empty($piece['category']))
    $jsonLd['category'] = $piece['category'][$isEs ? 'name_es' : 'name_en'] ?: $piece['category']['name_en'];
if ($offers)
    $jsonLd['offers'] = count($offers) === 1 ? $offers[0] : $offers;

$h = fn(?string $s): string => SeoShell::attr($s);
$body = '<article style="max-width:760px;margin:0 auto;padding:48px 24px;color:#e8e6f0;background:#06060d;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;">'
    . '<h1 style="font-size:2rem;line-height:1.2;margin:0 0 12px;">' . $h($title) . '</h1>';
if ($priceLines) {
    $body .= '<p style="color:#b9b4c9;margin:0 0 24px;">' . $h(implode(' · ', $priceLines)) . '</p>';
}
if ($images) {
    $alt = $piece['images'][0][$isEs ? 'alt_es' : 'alt_en'] ?: $title;
    $body .= '<img src="' . $h($images[0]) . '" alt="' . $h($alt) . '"'
        . ' style="max-width:100%;height:auto;border-radius:10px;margin:0 0 28px;" />';
}
if ($descHtml !== '')
    $body .= '<div>' . $descHtml . '</div>';
$body .= '<p style="margin-top:28px;"><a href="' . $h($site . '/lost-and-found-shop' . ($isEs ? '?lang=es' : '')) . '">'
    . ($isEs ? 'Ver toda la tienda' : 'See the whole shop') . '</a></p>'
    . '</article>';

SeoShell::render([
    'title' => $title . ' — Shop | Oscar Moctezuma Rodriguez',
    'description' => $desc,
    'url' => $url,
    'image' => $images[0] ?? null,
    'type' => 'product',
    'jsonLd' => $jsonLd,
], $body);
