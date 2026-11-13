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
    SeoShell::notFound();
    exit;
}

// Solo es 404 si la base contestó y la pieza no está; si la base falla, el
// shell normal (no vaya Google a sacar una pieza que sí existe).
$baseOk = true;
try {
    require_once __DIR__ . '/shop-lib.php';
    $piece = null;
    $all = Shop::products(true);
    foreach ($all as $p) {
        if ($p['slug'] === $slug) {
            $piece = $p;
            break;
        }
    }
}
catch (Throwable $e) {
    $piece = null;
    $all = [];
    $baseOk = false;
}

if (!$piece) {
    $baseOk ? SeoShell::notFound() : SeoShell::passthrough();
    exit;
}

$isEs = ($_GET['lang'] ?? '') === 'es';
$site = SeoShell::siteUrl();
$title = trim((string) ($piece[$isEs ? 'title_es' : 'title_en'] ?: $piece['title_en']));
$descHtml = trim((string) ($piece[$isEs ? 'description_es' : 'description_en'] ?: $piece['description_en']));
$url = SeoShell::localUrl('lost-and-found-shop/' . $piece['slug'], $isEs);
$images = array_values(array_map(fn($i) => SeoShell::absoluteUrl($i['url']), $piece['images']));

$desc = SeoShell::plainText($descHtml, 160);
if ($desc === '') {
    $desc = $isEs
        ? "{$title} — pieza de la tienda de Oscar Moctezuma Rodriguez."
        : "{$title} — a piece from Oscar Moctezuma Rodriguez's shop.";
}

// ── Envío y devoluciones ──
// Google los pide en cada oferta para enseñar la pieza con precio en la
// búsqueda y en Shopping. Salen de lo mismo que cobra el checkout (las
// regiones del CMS: shop-checkout.php ofrece sus tarifas, y la primera queda
// gratis arriba de free_over) y de las políticas de helpContent.js:
// preparación de 7 a 10 días hábiles, devolución en 5 días hábiles con el
// regreso a cargo de quien compra, y lo digital sin devolución.
$isDigital = $piece['kind'] === 'digital';
try {
    $zones = Shop::zones(true);
}
catch (Throwable $e) {
    $zones = [];
}
$zonesFor = fn(string $currency): array => array_values(array_filter(
    $zones,
    fn($z) => $z['currency'] === $currency && $z['countries']
));
$shippingFor = function (string $currency, float $price) use ($zonesFor): array {
    $details = [];
    foreach ($zonesFor($currency) as $z) {
        if (!$z['rates'])
            continue;
        $rate = $z['rates'][0];
        $free = $z['free_over'] !== null && $z['free_over'] > 0 && $price >= $z['free_over'];
        $time = [
            '@type' => 'ShippingDeliveryTime',
            'handlingTime' => ['@type' => 'QuantitativeValue', 'minValue' => 7, 'maxValue' => 10, 'unitCode' => 'DAY'],
        ];
        if ($rate['min_days'] !== null && $rate['max_days'] !== null) {
            $time['transitTime'] = [
                '@type' => 'QuantitativeValue',
                'minValue' => $rate['min_days'],
                'maxValue' => $rate['max_days'],
                'unitCode' => 'DAY',
            ];
        }
        $details[] = [
            '@type' => 'OfferShippingDetails',
            'shippingRate' => [
                '@type' => 'MonetaryAmount',
                'value' => $free ? '0.00' : number_format((float) $rate['amount'], 2, '.', ''),
                'currency' => $currency,
            ],
            'shippingDestination' => array_map(
                fn($c) => ['@type' => 'DefinedRegion', 'addressCountry' => $c],
                $z['countries']
            ),
            'deliveryTime' => $time,
        ];
    }
    return $details;
};
$returnPolicy = function (string $currency) use ($zonesFor, $isDigital): array {
    $countries = [];
    foreach ($zonesFor($currency) as $z)
        $countries = array_merge($countries, $z['countries']);
    $policy = [
        '@type' => 'MerchantReturnPolicy',
        'applicableCountry' => array_values(array_unique($countries)) ?: ['MX'],
    ];
    if ($isDigital) {
        $policy['returnPolicyCategory'] = 'https://schema.org/MerchantReturnNotPermitted';
        return $policy;
    }
    return $policy + [
        'returnPolicyCategory' => 'https://schema.org/MerchantReturnFiniteReturnWindow',
        'merchantReturnDays' => 5,
        'returnMethod' => 'https://schema.org/ReturnByMail',
        'returnFees' => 'https://schema.org/ReturnFeesCustomerResponsibility',
    ];
};

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
        'hasMerchantReturnPolicy' => $returnPolicy($currency),
    ];
    if (!$isDigital) {
        $shipping = $shippingFor($currency, $low);
        if ($shipping)
            $offer['shippingDetails'] = $shipping;
    }
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
$policy = $isDigital
    ? ($isEs ? 'Descarga digital desde tu cuenta. Lo digital no tiene devolución.'
        : 'Digital download from your account. Digital items can’t be returned.')
    : ($isEs ? 'Se prepara y se envía desde Monterrey en 7 a 10 días hábiles. Tienes 5 días hábiles desde que lo recibes para devolverlo.'
        : 'Prepared and shipped from Monterrey within 7 to 10 business days. You have 5 business days after delivery to return it.');
$body .= '<p style="margin-top:28px;color:#b9b4c9;">' . $h($policy) . ' '
    . '<a href="' . $h(SeoShell::localUrl('help', $isEs)) . '">'
    . ($isEs ? 'Envíos, cancelaciones y devoluciones' : 'Shipping, cancellations and returns') . '</a></p>'
    . '<p style="margin-top:12px;"><a href="' . $h(SeoShell::localUrl('lost-and-found-shop', $isEs)) . '">'
    . ($isEs ? 'Ver toda la tiendita' : 'See the whole store') . '</a></p>'
    . '</article>';

// Las piezas que siguen en el orden de la tienda (dando la vuelta al final).
$at = array_search($piece['slug'], array_column($all, 'slug'), true);
$others = $at === false ? $all : array_merge(array_slice($all, $at + 1), array_slice($all, 0, $at));
$more = [];
foreach (array_slice($others, 0, 4) as $o) {
    if ($o['slug'] === $piece['slug'])
        continue;
    $more[] = [
        'url' => SeoShell::localUrl('lost-and-found-shop/' . $o['slug'], $isEs),
        'title' => trim((string) ($o[$isEs ? 'title_es' : 'title_en'] ?: $o['title_en'])),
    ];
}
$body .= SeoShell::related($isEs ? 'Más de la tiendita' : 'More from the store', $more)
    . SeoShell::nav($isEs, 'lost-and-found-shop');

SeoShell::render([
    'title' => $title . ($isEs ? ' — Tiendita' : ' — Shop') . ' | Oscar Moctezuma Rodriguez',
    'description' => $desc,
    'url' => $url,
    'image' => $images[0] ?? null,
    'type' => 'product',
    'jsonLd' => $jsonLd,
    'lang' => $isEs ? 'es' : 'en',
], $body);
