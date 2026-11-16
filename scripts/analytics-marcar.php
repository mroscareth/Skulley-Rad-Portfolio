<?php
/**
 * Marca las visitas viejas que no son de gente (columna `excluido` de
 * visitors), con las mismas reglas que analytics.php aplica a las nuevas.
 * No borra nada: el tablero solo cuenta `excluido = ''` y el CSV trae todo.
 * Se puede correr las veces que sea; solo toca lo que sigue sin marcar.
 *
 *   ssh mroscar 'cd domains/mroscar.xyz/public_html/api && php' < scripts/analytics-marcar.php
 *
 * Motivos, en este orden:
 *  - local: el referrer es un servidor local (desarrollo con la API real).
 *  - dueno: cualquier visita desde una IP que alguna vez mandó tráfico local;
 *    esa IP es la del que desarrolla el sitio.
 *  - bot: el User-Agent lo dice (bots, Chrome sin pantalla, Lighthouse…).
 *  - datacenter: el proveedor de la IP es una nube o un hosting.
 */

declare(strict_types=1);

require getcwd() . '/db.php';

$pdo = Database::getInstance();

try {
    $pdo->query('SELECT excluido FROM visitors LIMIT 0');
} catch (Throwable $e) {
    $pdo->exec("ALTER TABLE visitors ADD COLUMN excluido VARCHAR(20) NOT NULL DEFAULT '' AFTER visited_at");
    echo "Columna excluido creada\n";
}

$local = "'^https?://(localhost|127[.]|10[.]|192[.]168[.]|172[.](1[6-9]|2[0-9]|3[01])[.])'";
$bot = "'bot|crawl|spider|slurp|mediapartners|headless|lighthouse|pagespeed|ptst|inspectiontool|facebookexternalhit|preview|uptime|python|curl|wget|httpclient|go-http|java/'";
$datacenter = "'google llc|google cloud|amazon|aws|microsoft|azure|digitalocean|contabo|hostinger|datacamp|hostroyale|palo alto|cisco iot|ovh|hetzner|linode|vultr|m247|leaseweb|oracle|alibaba|tencent|facebook|scaleway|choopa|colocrossing|psychz|quadranet|zscaler'";

// Relevos de privacidad (iCloud Private Relay, Cloudflare WARP): gente de
// verdad, aunque la IP sea de una nube.
$relay = "'private relay|icloud|warp|akamai|cloudflare|fastly'";

$pasos = [
    'local' => "UPDATE visitors SET excluido = 'local'
                 WHERE excluido = '' AND referrer REGEXP $local",
    'dueno' => "UPDATE visitors SET excluido = 'dueno'
                 WHERE excluido = '' AND ip_address IN (
                     SELECT ip FROM (SELECT DISTINCT ip_address AS ip FROM visitors WHERE excluido = 'local') propias
                 )",
    'bot' => "UPDATE visitors SET excluido = 'bot'
               WHERE excluido = '' AND (user_agent = '' OR device_type = 'bot' OR LOWER(user_agent) REGEXP $bot)",
    'datacenter' => "UPDATE visitors SET excluido = 'datacenter'
                      WHERE excluido = '' AND LOWER(CONCAT(isp, ' ', org)) REGEXP $datacenter
                        AND NOT LOWER(CONCAT(isp, ' ', org)) REGEXP $relay",
];

// Si una versión anterior de este script los marcó, se desmarcan.
$n = $pdo->exec("UPDATE visitors SET excluido = '' WHERE excluido = 'datacenter' AND LOWER(CONCAT(isp, ' ', org)) REGEXP $relay");
echo "relay      : $n desmarcadas\n";

foreach ($pasos as $motivo => $sql) {
    $n = $pdo->exec($sql);
    echo str_pad($motivo, 11) . ": $n marcadas\n";
}

echo "\nResumen (todas las visitas):\n";
foreach (Database::fetchAll("SELECT IF(excluido = '', 'gente', excluido) AS motivo, COUNT(*) AS n FROM visitors GROUP BY motivo ORDER BY n DESC") as $r) {
    echo '  ' . str_pad($r['motivo'], 11) . ' ' . $r['n'] . "\n";
}
echo "\nÚltimos 30 días:\n";
foreach (Database::fetchAll("SELECT IF(excluido = '', 'gente', excluido) AS motivo, COUNT(*) AS n FROM visitors WHERE visited_at > NOW() - INTERVAL 30 DAY GROUP BY motivo ORDER BY n DESC") as $r) {
    echo '  ' . str_pad($r['motivo'], 11) . ' ' . $r['n'] . "\n";
}
