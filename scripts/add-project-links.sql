-- Add link button fields to projects table
-- Run once on your SQLite database

ALTER TABLE projects ADD COLUMN link_url TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN link_text_en TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN link_text_es TEXT DEFAULT NULL;
