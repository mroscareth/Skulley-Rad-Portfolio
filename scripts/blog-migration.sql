-- Blog posts table
-- Run this migration against the mroscar_cms database

CREATE TABLE IF NOT EXISTS blog_posts (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(255)   NOT NULL UNIQUE,
    title           VARCHAR(500)   NOT NULL,
    subtitle        VARCHAR(500)   DEFAULT NULL,
    cover_image     VARCHAR(500)   DEFAULT NULL,
    tags            JSON           DEFAULT NULL,       -- ["tag1","tag2"]
    content_blocks  JSON           DEFAULT NULL,       -- array of block objects
    excerpt         VARCHAR(1000)  DEFAULT NULL,       -- short preview text
    featured        TINYINT(1)     NOT NULL DEFAULT 0, -- 1 = sticky at top
    published       TINYINT(1)     NOT NULL DEFAULT 0,
    published_at    DATETIME       DEFAULT NULL,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    display_order   INT            NOT NULL DEFAULT 0,

    INDEX idx_published   (published),
    INDEX idx_featured    (featured),
    INDEX idx_published_at(published_at),
    INDEX idx_slug        (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
