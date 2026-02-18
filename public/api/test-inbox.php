<?php
/**
 * Diagnostic: Test message starring + country code resolution
 * DELETE AFTER USE!
 */
header('Content-Type: text/plain; charset=UTF-8');

require __DIR__ . '/middleware.php';
Middleware::cors();

echo "=== Contact Inbox Diagnostic ===\n\n";

// 1. Check DB connection
try {
    $pdo = Database::getInstance();
    echo "✅ Database connected\n\n";
}
catch (Throwable $e) {
    echo "❌ Database error: " . $e->getMessage() . "\n";
    exit;
}

// 2. Check if contact_messages table exists and its columns
echo "--- Table Schema ---\n";
try {
    $cols = $pdo->query("SHOW COLUMNS FROM contact_messages")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        echo "  {$col['Field']} ({$col['Type']}) default={$col['Default']}\n";
    }
}
catch (Throwable $e) {
    echo "❌ Table error: " . $e->getMessage() . "\n";
}

// 3. Fetch all messages
echo "\n--- All Messages ---\n";
try {
    $msgs = $pdo->query("SELECT id, name, email, is_read, is_starred, is_archived, ip_address, country_code, created_at FROM contact_messages ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($msgs as $m) {
        echo "  ID={$m['id']} name={$m['name']} starred={$m['is_starred']} read={$m['is_read']} archived={$m['is_archived']} ip={$m['ip_address']} cc={$m['country_code']} date={$m['created_at']}\n";
    }
    echo "  Total: " . count($msgs) . " messages\n";
}
catch (Throwable $e) {
    echo "❌ Query error: " . $e->getMessage() . "\n";
}

// 4. Test starring the first message
if (!empty($msgs)) {
    $testId = $msgs[0]['id'];
    $currentStar = (int)$msgs[0]['is_starred'];
    $newStar = $currentStar ? 0 : 1;
    echo "\n--- Test Starring ---\n";
    echo "  Toggling message ID={$testId} from starred={$currentStar} to starred={$newStar}\n";
    try {
        $stmt = $pdo->prepare("UPDATE contact_messages SET is_starred = ? WHERE id = ?");
        $result = $stmt->execute([$newStar, $testId]);
        $affected = $stmt->rowCount();
        echo "  Result: " . ($result ? 'TRUE' : 'FALSE') . ", rows affected: {$affected}\n";

        // Verify
        $check = $pdo->prepare("SELECT is_starred FROM contact_messages WHERE id = ?");
        $check->execute([$testId]);
        $verified = $check->fetchColumn();
        echo "  Verified: is_starred is now {$verified}\n";
        echo "  " . ($verified == $newStar ? "✅ Star toggle works!" : "❌ Star toggle FAILED!") . "\n";
    }
    catch (Throwable $e) {
        echo "  ❌ Error: " . $e->getMessage() . "\n";
    }
}

// 5. Test count queries
echo "\n--- Count Queries ---\n";
try {
    $starred = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE is_starred = 1 AND is_archived = 0")->fetchColumn();
    $unread = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE is_read = 0 AND is_archived = 0")->fetchColumn();
    $total = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages")->fetchColumn();
    echo "  Total: {$total}, Unread: {$unread}, Starred: {$starred}\n";
}
catch (Throwable $e) {
    echo "  ❌ Error: " . $e->getMessage() . "\n";
}

// 6. Test country code resolution
echo "\n--- Country Code Resolution ---\n";
if (!empty($msgs) && !empty($msgs[0]['ip_address'])) {
    $testIp = $msgs[0]['ip_address'];
    echo "  Testing IP: {$testIp}\n";

    // Check visitors table
    try {
        $geoStmt = $pdo->prepare("SELECT country_code, country FROM visitors WHERE ip = ? AND country_code != '' LIMIT 1");
        $geoStmt->execute([$testIp]);
        $row = $geoStmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            echo "  ✅ Found in visitors: {$row['country_code']} ({$row['country']})\n";
        }
        else {
            echo "  ⚠️ Not found in visitors table for this IP\n";

            // Try ip-api.com
            $url = "http://ip-api.com/json/{$testIp}?fields=status,countryCode,country";
            $ctx = stream_context_create(['http' => ['timeout' => 3, 'method' => 'GET']]);
            $json = @file_get_contents($url, false, $ctx);
            if ($json) {
                $data = json_decode($json, true);
                echo "  ip-api.com response: " . print_r($data, true) . "\n";
            }
            else {
                echo "  ❌ ip-api.com request failed (blocked?)\n";
            }
        }
    }
    catch (Throwable $e) {
        echo "  ❌ Error: " . $e->getMessage() . "\n";
    }
}
else {
    echo "  No messages with IP to test\n";
}

echo "\n=== Done ===\n";
echo "DELETE THIS FILE!\n";
