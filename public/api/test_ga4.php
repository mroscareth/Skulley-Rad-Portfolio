<?php
ini_set('display_errors', 1); error_reporting(E_ALL);
$config = require __DIR__ . '/config.local.php';
require __DIR__ . '/analytics.php';

try {
    $data = fetchGa4DashboardData(7, $config);
    echo "SUCCESS\n";
    echo print_r($data['today'], true);
    echo "GA4 Countries: " . count($data['countries']) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
