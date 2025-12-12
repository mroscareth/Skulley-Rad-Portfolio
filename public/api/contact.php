<?php
declare(strict_types=1);

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

function readJsonBody(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function getClientIp(): string {
  // En shared hosting normalmente basta REMOTE_ADDR.
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  return is_string($ip) ? $ip : '';
}

function rateLimit(string $key, int $max, int $windowSeconds): bool {
  $ip = getClientIp();
  $bucket = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $key . '_' . md5($ip);
  $now = time();
  $events = [];
  if (is_file($bucket)) {
    $json = @file_get_contents($bucket);
    $arr = json_decode($json ?: '[]', true);
    if (is_array($arr)) $events = $arr;
  }
  // mantener solo eventos dentro de la ventana
  $events = array_values(array_filter($events, fn($t) => is_int($t) && ($now - $t) < $windowSeconds));
  if (count($events) >= $max) return false;
  $events[] = $now;
  @file_put_contents($bucket, json_encode($events), LOCK_EX);
  return true;
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

$config = [];
$configPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
if (is_file($configPath)) {
  $loaded = require $configPath;
  if (is_array($loaded)) $config = $loaded;
}

$smtpHost = (string)($config['SMTP_HOST'] ?? getenv('SMTP_HOST') ?? 'smtp.gmail.com');
$smtpUser = (string)($config['SMTP_USER'] ?? getenv('SMTP_USER') ?? '');
$smtpPass = (string)($config['SMTP_PASS'] ?? getenv('SMTP_PASS') ?? '');
$smtpPort = (int)($config['SMTP_PORT'] ?? getenv('SMTP_PORT') ?? 587);
$smtpSecure = strtolower((string)($config['SMTP_SECURE'] ?? getenv('SMTP_SECURE') ?? 'tls')); // tls|ssl

$fromEmail = (string)($config['FROM_EMAIL'] ?? getenv('FROM_EMAIL') ?? 'om@theheritage.mx');
$fromName  = (string)($config['FROM_NAME'] ?? getenv('FROM_NAME') ?? 'Portfolio');
$toEmail   = (string)($config['TO_EMAIL'] ?? getenv('TO_EMAIL') ?? 'om@theheritage.mx');

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

function encodeHeaderUtf8(string $text): string {
  $t = trim($text);
  if ($t === '') return '';
  // Evitar header injection
  $t = str_replace(["\r", "\n"], ' ', $t);
  // Prefer mb_encode_mimeheader si está disponible
  if (function_exists('mb_encode_mimeheader')) {
    return mb_encode_mimeheader($t, 'UTF-8', 'B', "\r\n");
  }
  return '=?UTF-8?B?' . base64_encode($t) . '?=';
}

function smtpReadResponse($fp): array {
  $lines = [];
  $code = 0;
  while (!feof($fp)) {
    $line = fgets($fp, 515);
    if ($line === false) break;
    $lines[] = rtrim($line, "\r\n");
    if (preg_match('/^(\d{3})([ -])/', $line, $m)) {
      $code = (int)$m[1];
      if ($m[2] === ' ') break;
    } else {
      break;
    }
  }
  return [$code, implode("\n", $lines)];
}

function smtpSendCmd($fp, string $cmd, array $expectCodes): array {
  fwrite($fp, $cmd . "\r\n");
  [$code, $msg] = smtpReadResponse($fp);
  $ok = in_array($code, $expectCodes, true);
  return [$ok, $code, $msg];
}

function smtpSendMail(array $opts): array {
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
  $bodyText = $opts['bodyText'];

  $timeout = 12;
  $remote = ($secure === 'ssl')
    ? "ssl://{$host}:{$port}"
    : "tcp://{$host}:{$port}";

  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
  if (!$fp) return [false, 'smtp_connect_failed', "connect_error: {$errno} {$errstr}"];

  stream_set_timeout($fp, $timeout);

  [$code, $msg] = smtpReadResponse($fp);
  if ($code !== 220) { fclose($fp); return [false, 'smtp_greeting_failed', $msg]; }

  $ehloHost = 'mroscar.xyz';
  [$ok, $c, $m] = smtpSendCmd($fp, "EHLO {$ehloHost}", [250]);
  if (!$ok) { fclose($fp); return [false, 'smtp_ehlo_failed', $m]; }

  if ($secure === 'tls') {
    [$ok, $c, $m] = smtpSendCmd($fp, "STARTTLS", [220]);
    if (!$ok) { fclose($fp); return [false, 'smtp_starttls_failed', $m]; }
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp);
      return [false, 'smtp_tls_failed', 'tls_handshake_failed'];
    }
    [$ok, $c, $m] = smtpSendCmd($fp, "EHLO {$ehloHost}", [250]);
    if (!$ok) { fclose($fp); return [false, 'smtp_ehlo_failed', $m]; }
  }

  // AUTH LOGIN
  [$ok, $c, $m] = smtpSendCmd($fp, "AUTH LOGIN", [334]);
  if (!$ok) { fclose($fp); return [false, 'smtp_auth_failed', $m]; }
  [$ok, $c, $m] = smtpSendCmd($fp, base64_encode($user), [334]);
  if (!$ok) { fclose($fp); return [false, 'smtp_auth_failed', $m]; }
  [$ok, $c, $m] = smtpSendCmd($fp, base64_encode($pass), [235]);
  if (!$ok) { fclose($fp); return [false, 'smtp_auth_failed', $m]; }

  [$ok, $c, $m] = smtpSendCmd($fp, "MAIL FROM:<{$fromEmail}>", [250]);
  if (!$ok) { fclose($fp); return [false, 'smtp_mail_from_failed', $m]; }
  [$ok, $c, $m] = smtpSendCmd($fp, "RCPT TO:<{$toEmail}>", [250, 251]);
  if (!$ok) { fclose($fp); return [false, 'smtp_rcpt_failed', $m]; }
  [$ok, $c, $m] = smtpSendCmd($fp, "DATA", [354]);
  if (!$ok) { fclose($fp); return [false, 'smtp_data_failed', $m]; }

  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: text/plain; charset=UTF-8';
  $headers[] = 'From: ' . encodeHeaderUtf8($fromName) . " <{$fromEmail}>";
  $headers[] = "To: <{$toEmail}>";
  $headers[] = 'Subject: ' . encodeHeaderUtf8($subject);
  $headers[] = 'Reply-To: ' . encodeHeaderUtf8($replyToName) . " <{$replyToEmail}>";
  $headers[] = 'Date: ' . date('r');
  $headers[] = 'Message-ID: <' . bin2hex(random_bytes(8)) . '@mroscar.xyz>';

  $data = implode("\r\n", $headers) . "\r\n\r\n";
  // dot-stuffing
  $safeBody = preg_replace('/^\./m', '..', $bodyText);
  $data .= $safeBody . "\r\n.\r\n";

  fwrite($fp, $data);
  [$code, $msg] = smtpReadResponse($fp);
  if ($code !== 250) { fclose($fp); return [false, 'smtp_send_failed', $msg]; }

  smtpSendCmd($fp, "QUIT", [221, 250]);
  fclose($fp);
  return [true, 'ok', 'sent'];
}

function mailFallback(string $toEmail, string $fromEmail, string $fromName, string $replyToEmail, string $replyToName, string $subject, string $bodyText, string $requestId): array {
  $fromName = str_replace(["\r", "\n"], ' ', $fromName);
  $replyToName = str_replace(["\r", "\n"], ' ', $replyToName);
  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-Type: text/plain; charset=UTF-8';
  $headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
  $headers[] = 'Reply-To: ' . $replyToName . ' <' . $replyToEmail . '>';
  $headers[] = 'X-Request-Id: ' . $requestId;

  $ok = false;
  try {
    $ok = @mail($toEmail, $subject, $bodyText, implode("\r\n", $headers), '-f' . $fromEmail);
  } catch (\Throwable $e) {
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
    // Autoresponder (idioma según `lang`)
    $autoSubject = ($lang === 'es') ? 'Gracias por tu mensaje' : 'Thanks for reaching out';
    $autoBody = ($lang === 'es')
      ? "Muchas gracias por ponerte en contacto conmigo, espero que mi website te haya gustado y que hayas visto el potencial de que trabajemos juntos.\n\nEn breve me pondré en contacto contigo.\nQue tengas un día muy felíz!"
      : "Thank you so much for reaching out. I hope you enjoyed my website and saw the potential for us to work together.\n\nI'll get back to you shortly.\nHave a wonderful day!";

    [$autoOk, $autoCode, $autoDetail] = smtpSendMail([
      'host' => $smtpHost,
      'port' => $smtpPort,
      'secure' => ($smtpSecure === 'ssl') ? 'ssl' : 'tls',
      'user' => $smtpUser,
      'pass' => $smtpPass,
      'fromEmail' => $fromEmail,
      'fromName' => $fromName,
      'toEmail' => $email,
      'replyToEmail' => $fromEmail,
      'replyToName' => $fromName,
      'subject' => $autoSubject,
      'bodyText' => $autoBody,
    ]);
    if (!$autoOk) {
      error_log("[contact:$requestId] autoresponder_failed($autoCode): $autoDetail");
    }
    echo json_encode(['ok' => true, 'method' => 'smtp', 'autoresponder' => $autoOk]);
    exit;
  }
  error_log("[contact:$requestId] smtp_failed($code): $detail");
}

// Fallback final: mail()
[$ok, $code, $detail] = mailFallback($toEmail, $fromEmail, $fromName, $email, $name, $fixedMailSubject, $bodyText, $requestId);
if ($ok) {
  $autoSubject = ($lang === 'es') ? 'Gracias por tu mensaje' : 'Thanks for reaching out';
  $autoBody = ($lang === 'es')
    ? "Muchas gracias por ponerte en contacto conmigo, espero que mi website te haya gustado y que hayas visto el potencial de que trabajemos juntos.\n\nEn breve me pondré en contacto contigo.\nQue tengas un día muy felíz!"
    : "Thank you so much for reaching out. I hope you enjoyed my website and saw the potential for us to work together.\n\nI'll get back to you shortly.\nHave a wonderful day!";
  [$autoOk, $autoCode, $autoDetail] = mailFallback($email, $fromEmail, $fromName, $fromEmail, $fromName, $autoSubject, $autoBody, $requestId);
  if (!$autoOk) {
    error_log("[contact:$requestId] autoresponder_failed($autoCode): $autoDetail");
  }
  echo json_encode(['ok' => true, 'method' => 'mail', 'autoresponder' => $autoOk]);
  exit;
}

http_response_code(500);
error_log("[contact:$requestId] send_failed (smtp+mail). Last=$code");
echo json_encode(['ok' => false, 'error' => 'send_failed', 'requestId' => $requestId, 'code' => $code]);

