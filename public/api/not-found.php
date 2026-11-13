<?php
/**
 * Cualquier ruta que no es del sitio (la última regla de .htaccess).
 * Ver SeoShell::notFound().
 */

declare(strict_types = 1);

require_once __DIR__ . '/seo-shell.php';

SeoShell::notFound();
