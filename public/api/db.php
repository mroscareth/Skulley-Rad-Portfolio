<?php
/**
 * Conexión a base de datos PDO - Singleton
 */

declare(strict_types=1);

class Database {
    private static ?PDO $instance = null;
    private static array $config = [];

    public static function getConfig(): array {
        if (empty(self::$config)) {
            self::$config = require __DIR__ . '/config.php';
        }
        return self::$config;
    }

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $config = self::getConfig();
            
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                $config['DB_HOST'],
                $config['DB_NAME'],
                $config['DB_CHARSET'] ?? 'utf8mb4'
            );

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            try {
                self::$instance = new PDO(
                    $dsn,
                    $config['DB_USER'],
                    $config['DB_PASS'],
                    $options
                );
            } catch (PDOException $e) {
                if ($config['DEBUG'] ?? false) {
                    throw new Exception('Database connection failed: ' . $e->getMessage());
                }
                throw new Exception('Database connection failed');
            }
        }

        return self::$instance;
    }

    /**
     * Ejecutar query con parámetros
     */
    public static function query(string $sql, array $params = []): PDOStatement {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * Obtener una fila
     */
    public static function fetchOne(string $sql, array $params = []): ?array {
        $result = self::query($sql, $params)->fetch();
        return $result ?: null;
    }

    /**
     * Obtener todas las filas
     */
    public static function fetchAll(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    /**
     * Insertar y retornar ID
     */
    public static function insert(string $table, array $data): int {
        $columns = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        
        $sql = "INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})";
        self::query($sql, array_values($data));
        
        return (int) self::getInstance()->lastInsertId();
    }

    /**
     * Actualizar registros
     */
    public static function update(string $table, array $data, string $where, array $whereParams = []): int {
        $sets = implode(', ', array_map(fn($col) => "{$col} = ?", array_keys($data)));
        $sql = "UPDATE {$table} SET {$sets} WHERE {$where}";
        
        $params = array_merge(array_values($data), $whereParams);
        return self::query($sql, $params)->rowCount();
    }

    /**
     * Eliminar registros
     */
    public static function delete(string $table, string $where, array $params = []): int {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        return self::query($sql, $params)->rowCount();
    }
}
