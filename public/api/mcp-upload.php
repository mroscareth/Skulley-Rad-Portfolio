<?php
/**
 * Enlaces de subida del conector de Claude — https://mroscar.xyz/subir/{token}
 *
 * MCP no transporta archivos, y Claude en claude.ai no puede pasarle a una
 * herramienta los bytes de una foto que le adjuntaron. Así que el conector no
 * sube nada: pide un enlace (create_upload_link) y los archivos llegan directo
 * aquí, por una de dos vías:
 *
 *   - Una persona abre el enlace y arrastra sus archivos (claude.ai, celular).
 *   - Claude Code los manda con curl: POST multipart al mismo enlace.
 *
 * Cada enlace sirve para UN destino (la galería o la portada de un proyecto,
 * las fotos de un producto, la portada de una entrada), vence en una hora,
 * tiene tope de archivos y deja de servir si se revoca la llave que lo pidió.
 * Se guarda solo el hash del token, como con las llaves.
 *
 * Lo que entra pasa por upload-lib.php, lo mismo que una subida en el CMS.
 *
 *   POST ?action=link.create   (X-MCP-Token) crea un enlace
 *   GET  /subir/{token}        la página para subir
 *   POST /subir/{token}        recibe archivos (campo "file"; también file[])
 */

declare(strict_types = 1);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/mcp-auth.php';
require_once __DIR__ . '/upload-lib.php';

const UPLOAD_LINK_MINUTES = 60;
const UPLOAD_LINK_MAX_FILES = 40;

final class UploadLinks
{
    private static bool $ready = false;

    public static function ensureTable(): void
    {
        if (self::$ready)
            return;
        if (!Database::fetchOne("SHOW TABLES LIKE 'mcp_upload_links'")) {
            Database::query(
                "CREATE TABLE IF NOT EXISTS mcp_upload_links (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token_hash CHAR(64) NOT NULL UNIQUE,
                    target VARCHAR(16) NOT NULL,
                    target_id INT NOT NULL,
                    slot VARCHAR(16) NOT NULL,
                    key_id INT NULL,
                    key_name VARCHAR(120) NOT NULL DEFAULT '',
                    max_files INT NOT NULL,
                    used_files INT NOT NULL DEFAULT 0,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME NOT NULL,
                    last_used_at DATETIME NULL,
                    INDEX idx_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            // Una sola vez: las rutas viejas guardadas como "api/../uploads/…".
            healUploadPaths();
        }
        self::$ready = true;
    }

    public static function create(array $key, string $target, int $targetId, string $slot, int $maxFiles, int $minutes): array
    {
        self::ensureTable();
        $token = bin2hex(random_bytes(24));
        $expires = time() + $minutes * 60;
        Database::insert('mcp_upload_links', [
            'token_hash' => hash('sha256', $token),
            'target' => $target,
            'target_id' => $targetId,
            'slot' => $slot,
            'key_id' => (int) $key['id'],
            'key_name' => mb_substr((string) $key['name'], 0, 120),
            'max_files' => $maxFiles,
            'expires_at' => date('Y-m-d H:i:s', $expires),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        return ['token' => $token, 'expires' => $expires];
    }

    /** El enlace vigente para un token, o null (no existe, venció o se revocó su llave). */
    public static function find(string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{48}$/', $token))
            return null;
        self::ensureTable();
        return Database::fetchOne(
            'SELECT l.* FROM mcp_upload_links l
             LEFT JOIN mcp_tokens k ON k.id = l.key_id
             WHERE l.token_hash = ? AND l.expires_at > ?
               AND (l.key_id IS NULL OR (k.id IS NOT NULL AND k.revoked_at IS NULL))',
            [hash('sha256', $token), date('Y-m-d H:i:s')]
        );
    }

    /**
     * Aparta un lugar antes de guardar, en una sola sentencia: dos subidas al
     * mismo tiempo no pasan el tope. Las fechas las pone PHP, no NOW(): así
     * no importa si MySQL y PHP tienen distinta zona horaria.
     */
    public static function reserve(int $id): bool
    {
        $now = date('Y-m-d H:i:s');
        return Database::query(
            'UPDATE mcp_upload_links SET used_files = used_files + 1, last_used_at = ?
             WHERE id = ? AND used_files < max_files AND expires_at > ?',
            [$now, $id, $now]
        )->rowCount() === 1;
    }

    public static function release(int $id): void
    {
        Database::query('UPDATE mcp_upload_links SET used_files = GREATEST(used_files - 1, 0) WHERE id = ?', [$id]);
    }
}

/** A dónde va un enlace: el registro destino y cómo se llama en pantalla. */
function uploadTarget(string $target, int $id): ?array
{
    switch ($target) {
        case 'project':
            $row = Database::fetchOne('SELECT id, slug, title, cover_image FROM projects WHERE id = ?', [$id]);
            return $row ? ['id' => (int) $row['id'], 'title' => (string) $row['title'], 'slug' => $row['slug'], 'preview' => $row['cover_image']] : null;
        case 'product':
            $row = Database::fetchOne('SELECT id, title_en, title_es, images FROM shop_products WHERE id = ?', [$id]);
            if (!$row)
                return null;
            $images = json_decode((string) ($row['images'] ?? ''), true) ?: [];
            return ['id' => (int) $row['id'], 'title' => (string) ($row['title_es'] ?: $row['title_en']), 'slug' => null, 'preview' => $images[0]['url'] ?? null];
        case 'post':
            $row = Database::fetchOne('SELECT id, slug, title, title_es, cover_image FROM blog_posts WHERE id = ?', [$id]);
            return $row ? ['id' => (int) $row['id'], 'title' => (string) ($row['title_es'] ?: $row['title']), 'slug' => $row['slug'], 'preview' => $row['cover_image']] : null;
    }
    return null;
}

function uploadSlotLabel(string $target, string $slot, string $title): string
{
    return match ("{$target}.{$slot}") {
        'project.cover' => "Portada de {$title}",
        'product.images' => "Fotos de {$title}",
        'post.cover' => "Portada de la entrada «{$title}»",
        default => "Galería de {$title}",
    };
}

function uploadAccepts(string $slot): string
{
    return $slot === 'gallery'
        ? 'Imágenes JPG, PNG, WebP o GIF de hasta 10 MB y videos MP4 o WebM de hasta 50 MB.'
        : 'Imágenes JPG, PNG, WebP o GIF de hasta 10 MB.';
}

/** Los códigos de error, dichos para quien está subiendo. */
function uploadMessage(string $code): string
{
    $m = [
        'invalid_file_type' => 'Ese tipo de archivo no se puede subir aquí.',
        'file_too_large' => 'Pesa demasiado: las imágenes van hasta 10 MB y los videos hasta 50 MB.',
        'upload_error_1' => 'Pesa demasiado para el servidor.',
        'upload_error_2' => 'Pesa demasiado para el servidor.',
        'upload_error_3' => 'La subida se cortó a la mitad. Inténtalo otra vez.',
        'upload_error_4' => 'No llegó ningún archivo.',
        'limit_reached' => 'Este enlace ya llegó a su máximo de archivos. Pídele a Claude uno nuevo.',
        'link_invalid' => 'Este enlace no existe, ya venció o la llave que lo pidió se revocó. Pídele a Claude uno nuevo.',
        'target_gone' => 'Ya no existe el lugar a donde iban estos archivos.',
        'project_not_found' => 'Ya no existe el proyecto a donde iban estos archivos.',
        'rate_limited' => 'Demasiadas subidas seguidas. Espera un minuto.',
        'no_file' => 'No llegó ningún archivo. Manda el archivo en el campo "file".',
    ];
    return $m[$code] ?? 'El servidor no pudo guardar el archivo. Inténtalo otra vez.';
}

function uploadJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** $_FILES como lista, venga como "file", "file[]" o "files[]". */
function incomingFiles(): array
{
    $list = [];
    foreach ($_FILES as $entry) {
        if (is_array($entry['name'] ?? null)) {
            foreach (array_keys($entry['name']) as $i) {
                $list[] = [
                    'name' => $entry['name'][$i], 'type' => $entry['type'][$i], 'tmp_name' => $entry['tmp_name'][$i],
                    'error' => $entry['error'][$i], 'size' => $entry['size'][$i],
                ];
            }
        }
        elseif (isset($entry['name'])) {
            $list[] = $entry;
        }
    }
    return $list;
}

// ─── Crear un enlace (lo llama el servidor MCP por loopback) ─────────────

function handleLinkCreate(): void
{
    Middleware::cors();
    Middleware::json();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST')
        Middleware::error('method_not_allowed', 405);

    $body = Middleware::getJsonBody();
    $target = (string) ($body['target'] ?? '');
    if (!in_array($target, ['project', 'product', 'post'], true))
        Middleware::error('invalid_target', 400);

    // Fotos de producto: llave de tienda. Proyectos y Memorias: llave "Todo".
    McpAuth::require($target === 'product' ? 'shop' : 'write');
    UploadLinks::ensureTable();

    $id = (int) ($body['id'] ?? 0);
    $slug = trim((string) ($body['slug'] ?? ''));
    if ($id <= 0 && $slug !== '' && $target !== 'product') {
        $table = $target === 'project' ? 'projects' : 'blog_posts';
        $id = (int) (Database::fetchOne("SELECT id FROM {$table} WHERE slug = ?", [$slug])['id'] ?? 0);
    }
    $dest = $id > 0 ? uploadTarget($target, $id) : null;
    if (!$dest)
        Middleware::error('not_found', 404);

    $slots = ['project' => ['gallery', 'cover'], 'product' => ['images'], 'post' => ['cover']][$target];
    $slot = (string) ($body['slot'] ?? $slots[0]);
    if (!in_array($slot, $slots, true))
        Middleware::error('invalid_slot', 400, ['allowed' => $slots]);

    $maxFiles = $slot === 'cover' ? 1 : max(1, min(UPLOAD_LINK_MAX_FILES, (int) ($body['max_files'] ?? 20)));
    $key = McpAuth::current();
    $link = UploadLinks::create($key, $target, $dest['id'], $slot, $maxFiles, UPLOAD_LINK_MINUTES);
    $url = McpOAuth::publicUrl() . '/subir/' . $link['token'];
    $label = uploadSlotLabel($target, $slot, $dest['title']);
    McpAuth::log('upload_link.create', ['target' => $target, 'id' => $dest['id'], 'slot' => $slot, 'max_files' => $maxFiles]);

    Middleware::success(['upload' => [
        'url' => $url,
        'for' => $label,
        'target' => ['type' => $target, 'id' => $dest['id'], 'slug' => $dest['slug'], 'slot' => $slot],
        'max_files' => $maxFiles,
        'expires_at' => gmdate('c', $link['expires']),
        'expires_in_minutes' => UPLOAD_LINK_MINUTES,
        'accepts' => uploadAccepts($slot),
        'with_files_access' => "Súbelos tú, uno por petición y en el orden en que deben quedar: curl -sS -F \"file=@/ruta/al/archivo\" {$url}",
        'without_files_access' => 'Dale el enlace al usuario: lo abre, arrastra sus archivos y espera a que todos digan «Listo».',
        'after' => $target === 'project'
            ? 'Revisa el resultado con list_project_media (orden, portada) y, si el proyecto está oculto, hazlo visible con update_project visible:true cuando el usuario lo pida.'
            : ($target === 'product' ? 'Revisa las fotos con get_shop_product.' : 'Revisa la entrada con get_post.'),
    ]]);
}

// ─── Recibir archivos ───────────────────────────────────────────────────

function handleIncoming(string $token): void
{
    if (!Middleware::rateLimit('mcp_upload', 120, 60))
        uploadJson(['ok' => false, 'error' => 'rate_limited', 'message' => uploadMessage('rate_limited')], 429);

    $link = UploadLinks::find($token);
    if (!$link)
        uploadJson(['ok' => false, 'error' => 'link_invalid', 'message' => uploadMessage('link_invalid')], 410);

    $files = incomingFiles();
    if (!$files) {
        // Si el cuerpo pasa de post_max_size PHP descarta todo sin avisar.
        $code = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? 'upload_error_1' : 'no_file';
        uploadJson(['ok' => false, 'error' => $code, 'message' => uploadMessage($code)], 400);
    }

    $dest = uploadTarget($link['target'], (int) $link['target_id']);
    if (!$dest)
        uploadJson(['ok' => false, 'error' => 'target_gone', 'message' => uploadMessage('target_gone')], 410);

    $results = [];
    foreach ($files as $file) {
        $name = mb_substr((string) ($file['name'] ?? 'archivo'), 0, 160);
        if (!UploadLinks::reserve((int) $link['id'])) {
            $results[] = ['name' => $name, 'ok' => false, 'error' => 'limit_reached', 'message' => uploadMessage('limit_reached')];
            continue;
        }
        try {
            $r = storeForLink($link, $file);
            $results[] = ['name' => $name, 'ok' => true, 'type' => $r['type'], 'path' => $r['path'], 'url' => McpOAuth::publicUrl() . '/' . $r['path']]
                + (isset($r['id']) ? ['media_id' => (int) $r['id']] : []);
        }
        catch (UploadError $e) {
            UploadLinks::release((int) $link['id']);
            $results[] = ['name' => $name, 'ok' => false, 'error' => $e->errorCode, 'message' => uploadMessage($e->errorCode)];
        }
        catch (Throwable $e) {
            UploadLinks::release((int) $link['id']);
            $results[] = ['name' => $name, 'ok' => false, 'error' => 'server_error', 'message' => uploadMessage('server_error')];
        }
    }

    $saved = array_values(array_filter($results, fn($r) => $r['ok']));
    $fresh = Database::fetchOne('SELECT used_files, max_files FROM mcp_upload_links WHERE id = ?', [(int) $link['id']]);
    // Sin token en este request: la bitácora lleva la llave que pidió el enlace.
    McpAuth::log('upload', [
        'llave' => ['id' => (int) $link['key_id'], 'name' => $link['key_name']],
        'target' => $link['target'], 'id' => (int) $link['target_id'], 'slot' => $link['slot'],
        'guardados' => array_map(fn($r) => $r['path'], $saved),
        'fallidos' => count($results) - count($saved),
    ]);

    uploadJson([
        'ok' => count($saved) === count($results),
        'for' => uploadSlotLabel($link['target'], $link['slot'], $dest['title']),
        'files' => $results,
        'remaining' => max(0, (int) $fresh['max_files'] - (int) $fresh['used_files']),
    ], $saved ? 200 : 400);
}

function storeForLink(array $link, array $file): array
{
    $id = (int) $link['target_id'];
    switch ($link['target'] . '.' . $link['slot']) {
        case 'project.gallery':
            return storeProjectUpload($file, $id, false);
        case 'project.cover':
            return storeProjectUpload($file, $id, true);
        case 'product.images': {
            $r = storeLooseImage($file, 'shop/products');
            $row = Database::fetchOne('SELECT images FROM shop_products WHERE id = ?', [$id]);
            if (!$row)
                throw new UploadError('target_gone', 410);
            $images = json_decode((string) ($row['images'] ?? ''), true) ?: [];
            $images[] = ['url' => $r['path'], 'alt_en' => '', 'alt_es' => ''];
            Database::update('shop_products', ['images' => json_encode($images, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)], 'id = ?', [$id]);
            return $r;
        }
        case 'post.cover': {
            // La portada anterior se queda en disco: una entrada puede usar la
            // misma imagen dentro de su texto.
            $r = storeLooseImage($file, 'blog');
            Database::update('blog_posts', ['cover_image' => $r['path']], 'id = ?', [$id]);
            return $r;
        }
    }
    throw new UploadError('target_gone', 410);
}

// ─── La página para subir ───────────────────────────────────────────────

function renderUploadPage(?array $link): void
{
    $h = fn(?string $s): string => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $nonce = base64_encode(random_bytes(16));
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'none'; img-src 'self' blob: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-{$nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

    $dest = $link ? uploadTarget($link['target'], (int) $link['target_id']) : null;
    if (!$link || !$dest)
        http_response_code(410);

    echo '<!doctype html><html lang="es-MX"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow">'
        . '<title>Subir archivos · mroscar.xyz</title>'
        . '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        . '<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">'
        . '<style>' . uploadPageCss() . '</style></head><body><main class="wrap">'
        . '<p class="brand">Skulley Rad</p><section class="panel">';

    if (!$link || !$dest) {
        echo '<h1>Este enlace ya no sirve</h1>'
            . '<p class="lead">' . $h(uploadMessage('link_invalid')) . '</p>'
            . '</section></main></body></html>';
        return;
    }

    $slot = (string) $link['slot'];
    $remaining = max(0, (int) $link['max_files'] - (int) $link['used_files']);
    $accept = $slot === 'gallery'
        ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'
        : 'image/jpeg,image/png,image/webp,image/gif';
    $label = uploadSlotLabel($link['target'], $slot, $dest['title']);
    $preview = $dest['preview'] && !str_starts_with((string) $dest['preview'], 'http') ? '/' . ltrim((string) $dest['preview'], '/') : null;
    $rules = [
        uploadAccepts($slot),
        'Las imágenes se optimizan solas: pasan a WebP y a máximo 2400 px por lado. Sube la mejor calidad que tengas.',
        match ($slot) {
            'gallery' => 'Quedan en la galería en el orden en que las subas. Después lo puedes cambiar desde Claude.',
            'cover' => 'La portada nueva reemplaza a la actual en cuanto se sube.',
            default => 'Se agregan al final de las fotos del producto.',
        },
        'El enlace vence <strong data-expires="' . strtotime((string) $link['expires_at']) . '">en una hora</strong> y sirve para '
            . ($slot === 'cover' ? 'un archivo.' : "<strong>{$remaining}</strong> archivos más."),
    ];

    echo '<div class="head">'
        . ($preview ? '<img class="thumb" src="' . $h($preview) . '" alt="">' : '')
        . '<div><h1>Sube tus archivos</h1><p class="lead">Van a <strong>' . $h($label) . '</strong> en mroscar.xyz.</p></div></div>'
        . '<ol class="steps"><li>Arrastra tus archivos aquí abajo o elígelos.</li><li>Espera a que cada uno diga <strong>Listo</strong>.</li><li>Regresa a Claude y dile que ya terminaste.</li></ol>'
        . '<div class="drop" id="drop">'
        . '<p class="drop-title">Arrastra aquí tus archivos</p>'
        . '<p class="drop-help">' . ($slot === 'cover' ? 'Una sola imagen.' : 'Puedes soltar varios a la vez.') . '</p>'
        . '<label class="btn btn-primary" for="file">Elegir archivos</label>'
        . '<input id="file" type="file" accept="' . $accept . '"' . ($slot === 'cover' ? '' : ' multiple') . ' ' . ($remaining ? '' : 'disabled') . '>'
        . '</div>'
        . '<ul class="files" id="files" aria-live="polite"></ul>'
        . '<p class="summary" id="summary" role="status"></p>'
        . '<h2>Reglas</h2><ul class="rules"><li>' . implode('</li><li>', $rules) . '</li></ul>'
        . '</section><p class="foot">Este enlace lo pidió Claude con la llave de <strong>' . $h($link['key_name']) . '</strong>. Solo sirve para este lugar del sitio.</p></main>'
        . '<script nonce="' . $nonce . '">' . uploadPageJs((int) $remaining) . '</script></body></html>';
}

function uploadPageJs(int $remaining): string
{
    $js = <<<'JS'
(function(){
var input=document.getElementById('file'),drop=document.getElementById('drop'),list=document.getElementById('files'),summary=document.getElementById('summary');
var left=__LEFT__,queue=[],busy=false,okCount=0,failCount=0;
var exp=document.querySelector('[data-expires]');
if(exp){var d=new Date(parseInt(exp.dataset.expires,10)*1000);exp.textContent='a las '+d.toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});}
function size(b){return b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';}
function row(f){
  var li=document.createElement('li');li.className='file';
  var th=document.createElement(f.type.indexOf('image/')===0?'img':'span');th.className='file-thumb';
  if(th.tagName==='IMG'){th.src=URL.createObjectURL(f);th.alt='';}else{th.textContent=f.type.indexOf('video/')===0?'Video':'Archivo';}
  var body=document.createElement('div');body.className='file-body';
  var name=document.createElement('p');name.className='file-name';name.textContent=f.name;
  var meta=document.createElement('p');meta.className='file-meta';meta.textContent=size(f.size)+' · En espera';
  var bar=document.createElement('div');bar.className='bar';var fill=document.createElement('span');bar.appendChild(fill);
  body.appendChild(name);body.appendChild(meta);body.appendChild(bar);li.appendChild(th);li.appendChild(body);list.appendChild(li);
  return {li:li,meta:meta,fill:fill,size:size(f.size)};
}
function add(files){
  for(var i=0;i<files.length;i++){
    if(left<=0){summary.textContent='Este enlace ya llegó a su máximo de archivos. Pídele a Claude uno nuevo.';break;}
    left--;queue.push({file:files[i],ui:row(files[i])});
  }
  if(left<=0)input.disabled=true;
  next();
}
function next(){
  if(busy)return;var job=queue.shift();
  if(!job){if(okCount||failCount){summary.textContent=failCount?('Se subieron '+okCount+' y '+failCount+' no. Revisa los que dicen por qué.'):('Listo: '+okCount+(okCount===1?' archivo subido.':' archivos subidos.')+' Ya puedes regresar a Claude.');}return;}
  busy=true;job.ui.meta.textContent=job.ui.size+' · Subiendo…';job.ui.li.classList.add('is-busy');
  var fd=new FormData();fd.append('file',job.file);
  var x=new XMLHttpRequest();x.open('POST',location.pathname+location.search);
  x.upload.onprogress=function(e){if(e.lengthComputable)job.ui.fill.style.width=Math.round(e.loaded/e.total*100)+'%';};
  x.onload=function(){
    var r=null;try{r=JSON.parse(x.responseText);}catch(e){}
    var f=r&&r.files&&r.files[0];job.ui.li.classList.remove('is-busy');
    if(f&&f.ok){okCount++;job.ui.li.classList.add('is-done');job.ui.fill.style.width='100%';job.ui.meta.textContent=job.ui.size+' · Listo';}
    else{failCount++;left++;input.disabled=false;job.ui.li.classList.add('is-error');job.ui.meta.textContent=(f&&f.message)||(r&&r.message)||'No se pudo subir. Inténtalo otra vez.';}
    busy=false;next();
  };
  x.onerror=function(){failCount++;left++;input.disabled=false;busy=false;job.ui.li.classList.remove('is-busy');job.ui.li.classList.add('is-error');job.ui.meta.textContent='Se perdió la conexión. Inténtalo otra vez.';next();};
  x.send(fd);
}
input.addEventListener('change',function(){add(input.files);input.value='';});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();if(!input.disabled)drop.classList.add('is-over');});});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('is-over');});});
drop.addEventListener('drop',function(e){if(!input.disabled&&e.dataTransfer)add(e.dataTransfer.files);});
})();
JS;
    return str_replace('__LEFT__', (string) $remaining, $js);
}

/** Mismo lenguaje que la página de autorización (DESIGN.md §14): plano, borde de 2px, magenta. */
function uploadPageCss(): string
{
    return <<<CSS
*{box-sizing:border-box;margin:0}
:root{--bg:#0a0510;--panel:#0d0714;--field:#150a1d;--line:rgba(255,255,255,.12);--text:#fff;--text2:rgba(255,255,255,.72);--text3:rgba(255,255,255,.5);--accent:#e600ff;--accent2:#f24dff;--ok:#4ade80;--danger:#f87171}
html{background:var(--bg)}
body{min-height:100vh;background:var(--bg);color:var(--text);font-family:Outfit,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;padding:2.5rem 1rem}
.brand{font-family:'Luckiest Guy',system-ui,sans-serif;font-size:1.25rem;letter-spacing:.02em}
.panel{width:min(36rem,100%);background:var(--panel);border:2px solid var(--line);border-radius:1.5rem;padding:2rem 1.25rem}
@media (min-width:480px){.panel{padding:2.5rem 2.25rem}}
.head{display:flex;align-items:center;gap:1rem}
.thumb{width:4.5rem;height:4.5rem;flex-shrink:0;object-fit:cover;border-radius:.875rem;background:var(--field)}
h1{font-family:'Luckiest Guy',system-ui,sans-serif;font-weight:400;font-size:clamp(1.8rem,6vw,2.3rem);line-height:1;letter-spacing:.01em}
h2{font-size:1rem;font-weight:700;margin-top:2rem;padding-top:1.5rem;border-top:2px solid var(--line)}
.lead{margin-top:.625rem;color:var(--text2);font-size:1.0625rem}
.lead strong{color:var(--text)}
.steps{margin-top:1.5rem;padding-left:1.25rem;display:grid;gap:.5rem;color:var(--text2);font-size:.9375rem}
.steps li::marker{color:var(--text3);font-weight:700}
.steps strong,.rules strong{color:var(--text)}
.drop{position:relative;margin-top:1.5rem;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.375rem;padding:2rem 1.25rem;border:2px dashed rgba(255,255,255,.22);border-radius:1.25rem;background:var(--field);transition:border-color .16s linear,background-color .16s linear}
.drop.is-over{border-color:var(--accent);background:#1d1027}
.drop-title{font-weight:700;font-size:1.0625rem}
.drop-help{color:var(--text3);font-size:.875rem;margin-bottom:.875rem}
.drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;border-radius:999px;border:2px solid transparent;font:inherit;font-weight:700;font-size:.875rem;letter-spacing:.14em;text-transform:uppercase;padding:0 1.75rem;cursor:pointer;transition:background-color .16s linear,border-color .16s linear}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#0a0510}
.btn-primary:hover{background:var(--accent2);border-color:var(--accent2)}
.drop input:focus-visible+.btn,.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.drop input:disabled+.btn{opacity:.35;cursor:not-allowed}
.files{list-style:none;padding:0;margin-top:1.25rem;display:grid;gap:.75rem}
.files:empty{display:none}
.file{display:flex;align-items:center;gap:.875rem;padding:.75rem;border:2px solid var(--line);border-radius:1rem}
.file-thumb{width:3.25rem;height:3.25rem;flex-shrink:0;border-radius:.625rem;background:var(--field);object-fit:cover;display:grid;place-items:center;font-size:.6875rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em}
.file-body{flex:1;min-width:0}
.file-name{font-weight:600;font-size:.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-meta{color:var(--text3);font-size:.8125rem;margin-top:.125rem}
.bar{height:4px;margin-top:.5rem;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.bar span{display:block;height:100%;width:0;background:var(--accent);transition:width .2s linear}
.file.is-done{border-color:rgba(74,222,128,.45)}
.file.is-done .file-meta{color:var(--ok);font-weight:600}
.file.is-done .bar span{background:var(--ok)}
.file.is-error{border-color:rgba(248,113,113,.5)}
.file.is-error .file-meta{color:var(--danger);font-weight:600}
.file.is-error .bar{display:none}
.summary{margin-top:1rem;font-weight:600;color:var(--text2)}
.summary:empty{display:none}
.rules{list-style:none;padding:0;margin-top:.875rem;display:grid;gap:.625rem;color:var(--text2);font-size:.9375rem}
.rules li{padding-left:1.125rem;position:relative}
.rules li::before{content:'';position:absolute;left:0;top:.6em;width:.4rem;height:.4rem;border-radius:999px;background:var(--accent)}
.foot{width:min(36rem,100%);color:var(--text3);font-size:.8125rem;text-align:center}
.foot strong{color:var(--text2)}
CSS;
}

// ─── Ruteo ──────────────────────────────────────────────────────────────

if (($_GET['action'] ?? '') === 'link.create') {
    handleLinkCreate();
    exit;
}

$token = (string) ($_GET['t'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    handleIncoming($token);
}
if ($method === 'GET' || $method === 'HEAD') {
    renderUploadPage(UploadLinks::find($token));
    exit;
}
http_response_code(405);
header('Allow: GET, POST');
