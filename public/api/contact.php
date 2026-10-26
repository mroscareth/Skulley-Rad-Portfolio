<?php
declare(strict_types = 1)
;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$requestId = bin2hex(random_bytes(8));
header('X-Request-Id: ' . $requestId);

$allowedOrigins = [
  'https://mroscar.xyz',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
  exit;
}

function readJsonBody(): array
{
  $raw = file_get_contents('php://input');
  if (!$raw)
    return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function getClientIp(): string
{
  // En shared hosting normalmente basta REMOTE_ADDR.
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  return is_string($ip) ? $ip : '';
}

function rateLimit(string $key, int $max, int $windowSeconds): bool
{
  $ip = getClientIp();
  $bucket = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $key . '_' . md5($ip);
  $now = time();
  $events = [];
  if (is_file($bucket)) {
    $json = @file_get_contents($bucket);
    $arr = json_decode($json ?: '[]', true);
    if (is_array($arr))
      $events = $arr;
  }
  // mantener solo eventos dentro de la ventana
  $events = array_values(array_filter($events, fn($t) => is_int($t) && ($now - $t) < $windowSeconds));
  if (count($events) >= $max)
    return false;
  $events[] = $now;
  @file_put_contents($bucket, json_encode($events), LOCK_EX);
  return true;
}

// Load config once (used for both DB storage and SMTP)
$configDb = [];
$configDbPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
if (is_file($configDbPath)) {
  $loadedDb = require $configDbPath;
  if (is_array($loadedDb))
    $configDb = $loadedDb;
}

$data = readJsonBody();

$name = trim((string)($data['name'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$subject = trim((string)($data['subject'] ?? ''));
$comments = trim((string)($data['comments'] ?? ''));
$company = trim((string)($data['company'] ?? '')); // honeypot
$source = trim((string)($data['source'] ?? ''));
$lang = strtolower(trim((string)($data['lang'] ?? 'en')));
$lang = ($lang === 'es') ? 'es' : 'en';

if ($company !== '') {
  // bot: responder ok para no dar pistas
  echo json_encode(['ok' => true]);
  exit;
}

if (!rateLimit('mroscar_contact', 5, 10 * 60)) {
  http_response_code(429);
  echo json_encode(['ok' => false, 'error' => 'too_many_requests']);
  exit;
}

if ($name === '' || $email === '' || $comments === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'missing_fields']);
  exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'invalid_email']);
  exit;
}

// Reuse config already loaded above
$config = $configDb;

$smtpHost = (string)($config['SMTP_HOST'] ?? getenv('SMTP_HOST') ?? 'smtp.gmail.com');
$smtpUser = (string)($config['SMTP_USER'] ?? getenv('SMTP_USER') ?? '');
$smtpPass = (string)($config['SMTP_PASS'] ?? getenv('SMTP_PASS') ?? '');
$smtpPort = (int)($config['SMTP_PORT'] ?? getenv('SMTP_PORT') ?? 587);
$smtpSecure = strtolower((string)($config['SMTP_SECURE'] ?? getenv('SMTP_SECURE') ?? 'tls')); // tls|ssl

$fromEmail = (string)($config['FROM_EMAIL'] ?? getenv('FROM_EMAIL') ?? 'om@theheritage.mx');
$fromName = (string)($config['FROM_NAME'] ?? getenv('FROM_NAME') ?? 'Portfolio');
$toEmail = (string)($config['TO_EMAIL'] ?? getenv('TO_EMAIL') ?? 'om@theheritage.mx');

// Lo de la tienda o un pedido va al correo de soporte de la tienda (el que
// publica /help), no al de proyectos. SHOP_CONTACT_EMAIL en config.local.php
// lo cambia sin tocar código.
$shopEmail = (string)($config['SHOP_CONTACT_EMAIL'] ?? getenv('SHOP_CONTACT_EMAIL') ?: 'hola@mroscar.xyz');
if ($subject === 'shop' && filter_var($shopEmail, FILTER_VALIDATE_EMAIL)) {
  $toEmail = $shopEmail;
}

// Subject fijo (requerimiento)
$fixedMailSubject = 'Incomming from portfolio';

$lines = [];
$lines[] = 'New contact message';
$lines[] = '---';
$lines[] = 'Name: ' . $name;
$lines[] = 'Email: ' . $email;
$lines[] = 'Topic: ' . ($subject !== '' ? $subject : '(none)');
$lines[] = 'Source: ' . ($source !== '' ? $source : '(unknown)');
$lines[] = 'IP: ' . getClientIp();
$lines[] = '---';
$lines[] = $comments;
$bodyText = implode("\n", $lines);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'email-template.php';

/**
 * La respuesta automática (email-template.php): [asunto, texto, html].
 * Tono profesional y relajado, en primera persona y firmada por Oscar (textos
 * aprobados por él el 2026-10-25). Sin plazos fijos: "lo más rápido que pueda".
 */
function contactAutoReply(string $lang, string $topic, string $name, string $comments): array
{
  $es = $lang === 'es';
  $site = 'https://mroscar.xyz';
  $hello = SkulleyMail::hello($name, $es) . ($es ? ' Gracias por escribirme.' : ' thanks for reaching out.');
  // Un mensaje larguísimo no tiene por qué regresar completo (PCRE /u, por si no hay mbstring).
  $quoted = preg_match('/^.{701}/us', $comments)
    ? rtrim((string)preg_replace('/^(.{700}).*$/us', '$1', $comments)) . '…'
    : $comments;
  $quotedText = '> ' . str_replace("\n", "\n> ", $quoted);
  $subject = $es ? 'Recibí tu mensaje' : 'Got your message';
  $soon = $es ? 'Te responderé lo más rápido que pueda.' : 'I’ll get back to you as soon as I can.';
  $got = $es
    ? 'Ya tengo tu mensaje y te responderé lo más rápido que pueda.'
    : 'I’ve got your message and I’ll get back to you as soon as I can.';

  if ($topic === 'shop') {
    $help = $site . ($es ? '/help?lang=es' : '/help');
    $order = $es
      ? 'Si es sobre un pedido y no incluiste el número, respóndeme este correo con él y así lo reviso más rápido.'
      : 'If it’s about an order and you didn’t include the order number, just reply to this email with it and I’ll be able to look into it faster.';
    $sent = $es ? 'Esto es lo que me enviaste:' : 'Here’s what you sent:';
    $cta = $es ? 'Ver preguntas frecuentes' : 'Visit the help center';
    $html = SkulleyMail::layout([
      'lang' => $lang, 'site' => $site, 'seller' => true,
      'preheader' => $soon,
      'title' => $es ? 'Mensaje recibido' : 'Message received',
      'subtitle' => $es ? 'La tienda o un pedido' : 'The store or an order',
      'body' => SkulleyMail::p(SkulleyMail::e($hello))
        . SkulleyMail::p(SkulleyMail::e("$got $order"))
        . SkulleyMail::p(SkulleyMail::e($sent))
        . SkulleyMail::quote($quoted)
        . SkulleyMail::button($cta, $help),
    ]);
    $text = "$hello\n\n$got $order\n\n$sent\n\n$quotedText\n\n$cta: $help\n" . SkulleyMail::textSignOff($es, true);
    return [$subject, $text, $html];
  }

  $sent = $es ? 'Te dejo aquí lo que me enviaste:' : 'Here’s what you sent:';
  $meanwhile = $es ? 'Mientras tanto, puedes darle una vuelta a mi trabajo.' : 'In the meantime, feel free to take a look at my work.';
  $cta = $es ? 'Ver mi trabajo' : 'See my work';
  $work = $site . '/work';
  $html = SkulleyMail::layout([
    'lang' => $lang, 'site' => $site,
    'preheader' => $soon,
    'title' => $es ? 'Mensaje recibido' : 'Message received',
    'body' => SkulleyMail::p(SkulleyMail::e($hello))
      . SkulleyMail::p(SkulleyMail::e("$got $sent"))
      . SkulleyMail::quote($quoted)
      . SkulleyMail::p(SkulleyMail::e($meanwhile))
      . SkulleyMail::button($cta, $work),
  ]);
  $text = "$hello\n\n$got $sent\n\n$quotedText\n\n$meanwhile\n$cta: $work\n" . SkulleyMail::textSignOff($es);
  return [$subject, $text, $html];
}

/** Cuerpo MIME: texto plano solo, o texto + HTML (multipart/alternative). [Content-Type, cuerpo] */
function mimeBody(string $text, string $html): array
{
  if ($html === '')
    return ['text/plain; charset=UTF-8', $text];
  $boundary = 'sr_' . bin2hex(random_bytes(12));
  $body = "--{$boundary}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($text)) . "\r\n"
    . "--{$boundary}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($html)) . "\r\n"
    . "--{$boundary}--";
  return ["multipart/alternative; boundary=\"{$boundary}\"", $body];
}

function encodeHeaderUtf8(string $text): string
{
  $t = trim($text);
  if ($t === '')
    return '';
  // Evitar header injection
  $t = str_replace(["\r", "\n"], ' ', $t);
  // Prefer mb_encode_mimeheader si está disponible
  if (function_exists('mb_encode_mimeheader')) {
    return mb_encode_mimeheader($t, 'UTF-8', 'B', "\r\n");
  }
  return '=?UTF-8?B?' . base64_encode($t) . '?=';
}

function smtpReadResponse($fp): array
{
  $lines = [];
  $code = 0;
  while (!feof($fp)) {
    $line = fgets($fp, 515);
    if ($line === false)
      break;
    $lines[] = rtrim($line, "\r\n");
    if (preg_match('/^(\d{3})([ -])/', $line, $m)) {
      $code = (int)$m[1];
      if ($m[2] === ' ')
        break;
    }
    else {
      break;
    }
  }
  return [$code, implode("\n", $lines)];
}

function smtpSendCmd($fp, string $cmd, array $expectCodes): array
{
  fwrite($fp, $cmd . "\r\n");
  [$code, $msg] = smtpReadResponse($fp);
  $ok = in_array($code, $expectCodes, true);
  return [$ok, $code, $msg];
}

function smtpSendMail(array $opts): array
{
  $host = $opts['host'];
  $port = (int)$opts['port'];
  $secure = $opts['secure']; // tls|ssl
  $user = $opts['user'];
  $pass = $opts['pass'];
  $fromEmail = $opts['fromEmail'];
  $fromName = $opts['fromName'];
  $toEmail = $opts['toEmail'];
  $replyToEmail = $opts['replyToEmail'];
  $replyToName = $opts['replyToName'];
  $subject = $opts['subject'];
  [$contentType, $body] = mimeBody($opts['bodyText'], (string)($opts['bodyHtml'] ?? ''));

  $timeout = 12;
  $remote = ($secure === 'ssl')
    ? "ssl://{$host}:{$port}"
    : "tcp://{$host}:{$port}";

  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
  if (!$fp)
    return [false, 'smtp_connect_failed', "connect_error: {$errno} {$errstr}"];

  stream_set_timeout($fp, $timeout);

  [$code, $msg] = smtpReadResponse($fp);
  if ($code !== 220) {
    fclose($fp);
    return [false, 'smtp_greeting_failed', $msg];
  }

  $ehloHost = 'mroscar.xyz';
  [$ok, $c, $m] = smtpSendCmd($fp, "EHLO {$ehloHost}", [250]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_ehlo_failed', $m];
  }

  if ($secure === 'tls') {
    [$ok, $c, $m] = smtpSendCmd($fp, "STARTTLS", [220]);
    if (!$ok) {
      fclose($fp);
      return [false, 'smtp_starttls_failed', $m];
    }
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp);
      return [false, 'smtp_tls_failed', 'tls_handshake_failed'];
    }
    [$ok, $c, $m] = smtpSendCmd($fp, "EHLO {$ehloHost}", [250]);
    if (!$ok) {
      fclose($fp);
      return [false, 'smtp_ehlo_failed', $m];
    }
  }

  // AUTH LOGIN
  [$ok, $c, $m] = smtpSendCmd($fp, "AUTH LOGIN", [334]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_auth_failed', $m];
  }
  [$ok, $c, $m] = smtpSendCmd($fp, base64_encode($user), [334]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_auth_failed', $m];
  }
  [$ok, $c, $m] = smtpSendCmd($fp, base64_encode($pass), [235]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_auth_failed', $m];
  }

  [$ok, $c, $m] = smtpSendCmd($fp, "MAIL FROM:<{$fromEmail}>", [250]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_mail_from_failed', $m];
  }
  [$ok, $c, $m] = smtpSendCmd($fp, "RCPT TO:<{$toEmail}>", [250, 251]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_rcpt_failed', $m];
  }
  [$ok, $c, $m] = smtpSendCmd($fp, "DATA", [354]);
  if (!$ok) {
    fclose($fp);
    return [false, 'smtp_data_failed', $m];
  }

  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: ' . $contentType;
  $headers[] = 'From: ' . encodeHeaderUtf8($fromName) . " <{$fromEmail}>";
  $headers[] = "To: <{$toEmail}>";
  $headers[] = 'Subject: ' . encodeHeaderUtf8($subject);
  $headers[] = 'Reply-To: ' . encodeHeaderUtf8($replyToName) . " <{$replyToEmail}>";
  $headers[] = 'Date: ' . date('r');
  $headers[] = 'Message-ID: <' . bin2hex(random_bytes(8)) . '@mroscar.xyz>';

  $data = implode("\r\n", $headers) . "\r\n\r\n";
  // dot-stuffing
  $safeBody = preg_replace('/^\./m', '..', $body);
  $data .= $safeBody . "\r\n.\r\n";

  fwrite($fp, $data);
  [$code, $msg] = smtpReadResponse($fp);
  if ($code !== 250) {
    fclose($fp);
    return [false, 'smtp_send_failed', $msg];
  }

  smtpSendCmd($fp, "QUIT", [221, 250]);
  fclose($fp);
  return [true, 'ok', 'sent'];
}

function mailFallback(string $toEmail, string $fromEmail, string $fromName, string $replyToEmail, string $replyToName, string $subject, string $bodyText, string $requestId, string $bodyHtml = ''): array
{
  $fromName = str_replace(["\r", "\n"], ' ', $fromName);
  $replyToName = str_replace(["\r", "\n"], ' ', $replyToName);
  [$contentType, $bodyText] = mimeBody($bodyText, $bodyHtml);
  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: ' . $contentType;
  $headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
  $headers[] = 'Reply-To: ' . $replyToName . ' <' . $replyToEmail . '>';
  $headers[] = 'X-Request-Id: ' . $requestId;

  $ok = false;
  try {
    $ok = @mail($toEmail, $subject, $bodyText, implode("\r\n", $headers), '-f' . $fromEmail);
  }
  catch (\Throwable $e) {
    $ok = false;
  }
  return [$ok, $ok ? 'ok' : 'mail_failed', $ok ? 'sent' : 'failed'];
}

// Preferimos SMTP si hay creds; si no, intentamos mail().
if ($smtpUser !== '' && $smtpPass !== '') {
  [$ok, $code, $detail] = smtpSendMail([
    'host' => $smtpHost,
    'port' => $smtpPort,
    'secure' => ($smtpSecure === 'ssl') ? 'ssl' : 'tls',
    'user' => $smtpUser,
    'pass' => $smtpPass,
    'fromEmail' => $fromEmail,
    'fromName' => $fromName,
    'toEmail' => $toEmail,
    'replyToEmail' => $email,
    'replyToName' => $name,
    'subject' => $fixedMailSubject,
    'bodyText' => $bodyText,
  ]);
  if ($ok) {
    [$autoSubject, $autoBody, $autoHtml] = contactAutoReply($lang, $subject, $name, $comments);

    [$autoOk, $autoCode, $autoDetail] = smtpSendMail([
      'host' => $smtpHost,
      'port' => $smtpPort,
      'secure' => ($smtpSecure === 'ssl') ? 'ssl' : 'tls',
      'user' => $smtpUser,
      'pass' => $smtpPass,
      'fromEmail' => $fromEmail,
      'fromName' => $fromName,
      'toEmail' => $email,
      // Si contesta (p. ej. con su número de pedido), que caiga donde llegó
      // su mensaje: el soporte de la tienda o el correo de siempre.
      'replyToEmail' => $subject === 'shop' ? $toEmail : $fromEmail,
      'replyToName' => $fromName,
      'subject' => $autoSubject,
      'bodyText' => $autoBody,
      'bodyHtml' => $autoHtml,
    ]);
    if (!$autoOk) {
      error_log("[contact:$requestId] autoresponder_failed($autoCode): $autoDetail");
    }
    // Store message in database
    storeContactMessage($configDb, $name, $email, $subject, $comments, $source, $lang, $requestId);
    echo json_encode(['ok' => true, 'method' => 'smtp', 'autoresponder' => $autoOk]);
    exit;
  }
  error_log("[contact:$requestId] smtp_failed($code): $detail");
}

// Fallback final: mail()
[$ok, $code, $detail] = mailFallback($toEmail, $fromEmail, $fromName, $email, $name, $fixedMailSubject, $bodyText, $requestId);
if ($ok) {
  [$autoSubject, $autoBody, $autoHtml] = contactAutoReply($lang, $subject, $name, $comments);
  $autoReplyTo = $subject === 'shop' ? $toEmail : $fromEmail;
  [$autoOk, $autoCode, $autoDetail] = mailFallback($email, $fromEmail, $fromName, $autoReplyTo, $fromName, $autoSubject, $autoBody, $requestId, $autoHtml);
  if (!$autoOk) {
    error_log("[contact:$requestId] autoresponder_failed($autoCode): $autoDetail");
  }
  // Store message in database
  storeContactMessage($configDb, $name, $email, $subject, $comments, $source, $lang, $requestId);
  echo json_encode(['ok' => true, 'method' => 'mail', 'autoresponder' => $autoOk]);
  exit;
}

// Both SMTP and mail() failed — still store in DB so admin sees it in Contact Inbox
error_log("[contact:$requestId] send_failed (smtp+mail). Last=$code — storing in DB only");
storeContactMessage($configDb, $name, $email, $subject, $comments, $source, $lang, $requestId);

// Return success to the visitor (message is saved even if email failed)
echo json_encode(['ok' => true, 'method' => 'db_only', 'emailSent' => false]);

/**
 * Resolve country code from IP using ip-api.com (same service as analytics)
 */
function resolveCountryCode(string $ip): string
{
  if (in_array($ip, ['127.0.0.1', '::1', '0.0.0.0']) ||
  preg_match('/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/', $ip)) {
    return 'LO';
  }
  $url = "http://ip-api.com/json/{$ip}?fields=status,countryCode";
  $ctx = stream_context_create(['http' => ['timeout' => 2, 'method' => 'GET']]);
  $json = @file_get_contents($url, false, $ctx);
  if (!$json)
    return '';
  $data = json_decode($json, true);
  if (!is_array($data) || ($data['status'] ?? '') !== 'success')
    return '';
  return (string)($data['countryCode'] ?? '');
}

/**
 * Store contact message in the database for admin inbox.
 * Runs silently — does not affect email delivery on failure.
 */
function storeContactMessage(array $dbConfig, string $name, string $email, string $subject, string $comments, string $source, string $lang, string $requestId): void
{
  try {
    $dbHost = (string)($dbConfig['DB_HOST'] ?? getenv('DB_HOST') ?? 'localhost');
    $dbName = (string)($dbConfig['DB_NAME'] ?? getenv('DB_NAME') ?? '');
    $dbUser = (string)($dbConfig['DB_USER'] ?? getenv('DB_USER') ?? '');
    $dbPass = (string)($dbConfig['DB_PASS'] ?? getenv('DB_PASS') ?? '');
    if ($dbName === '' || $dbUser === '')
      return;

    $pdo = new PDO(
      "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
      $dbUser, $dbPass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
      );

    // Ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS contact_messages (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(255)   NOT NULL DEFAULT '',
      email         VARCHAR(255)   NOT NULL DEFAULT '',
      subject       VARCHAR(100)   NOT NULL DEFAULT '',
      message       TEXT           NOT NULL,
      source        VARCHAR(100)   NOT NULL DEFAULT '',
      lang          VARCHAR(5)     NOT NULL DEFAULT 'en',
      ip_address    VARCHAR(45)    NOT NULL DEFAULT '',
      country_code  VARCHAR(5)     NOT NULL DEFAULT '',
      user_agent    VARCHAR(500)   NOT NULL DEFAULT '',
      request_id    VARCHAR(32)    NOT NULL DEFAULT '',
      is_read       TINYINT(1)     NOT NULL DEFAULT 0,
      is_starred    TINYINT(1)     NOT NULL DEFAULT 0,
      is_archived   TINYINT(1)     NOT NULL DEFAULT 0,
      created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_email   (email),
      INDEX idx_read    (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Add country_code column if missing (existing tables)
    try {
      $pdo->exec("ALTER TABLE contact_messages ADD COLUMN country_code VARCHAR(5) NOT NULL DEFAULT '' AFTER ip_address");
    }
    catch (Throwable $ignore) {
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
    $countryCode = resolveCountryCode($ip);

    $stmt = $pdo->prepare(
      'INSERT INTO contact_messages (name, email, subject, message, source, lang, ip_address, country_code, user_agent, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$name, $email, $subject, $comments, $source, $lang, $ip, $countryCode, $ua, $requestId]);
  }
  catch (Throwable $e) {
    error_log('[contact:store] ' . $e->getMessage());
  }
}
