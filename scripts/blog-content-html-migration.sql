-- Add content_html column to blog_posts
-- Run this migration after the initial blog-migration.sql

ALTER TABLE blog_posts ADD COLUMN content_html LONGTEXT DEFAULT NULL AFTER content_blocks;
