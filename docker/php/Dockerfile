FROM php:8.3-apache

# Extensiones que usa public/api/: PDO MySQL (db.php), gd/exif (upload.php),
# zip (export de proyectos), intl (slugs/locale).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libicu-dev \
    && docker-php-ext-configure gd --with-jpeg --with-freetype \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mysqli gd zip exif intl \
    && rm -rf /var/lib/apt/lists/*

# Ignoramos los .htaccess del repo a propósito: public/.htaccess fuerza redirect
# a HTTPS (correcto en Hostinger, rompe el dev local en http://localhost:8080) y
# api/.htaccess bloquea todo lo que empiece con "config." (incl. config.dev.php).
# Apache aquí solo sirve /api/*.php — el SPA lo sirve vite en :5173.
RUN a2enmod headers \
    && printf '%s\n' \
        'ServerName localhost' \
        '<Directory /var/www/html>' \
        '    AllowOverride None' \
        '    Require all granted' \
        '    Options -Indexes' \
        '</Directory>' \
        > /etc/apache2/conf-available/zz-local-dev.conf \
    && a2enconf zz-local-dev

# Subidas del CMS: el default de PHP (2M) tumba cualquier mp3 o video.
RUN { \
        echo 'upload_max_filesize = 64M'; \
        echo 'post_max_size = 64M'; \
        echo 'memory_limit = 256M'; \
        echo 'display_errors = On'; \
        echo 'error_reporting = E_ALL'; \
    } > /usr/local/etc/php/conf.d/zz-local-dev.ini
