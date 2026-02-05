-- ============================================
-- MROSCAR CMS Database Schema
-- Para importar en Hostinger MySQL
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------
-- Tabla de usuarios (para Google OAuth)
-- --------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `google_id` VARCHAR(255) UNIQUE NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255),
  `avatar_url` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------
-- Lista de emails permitidos (whitelist)
-- --------------------------------------------
DROP TABLE IF EXISTS `allowed_emails`;
CREATE TABLE `allowed_emails` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email autorizado para acceder al admin
INSERT INTO `allowed_emails` (`email`) VALUES ('oscarmdesign@gmail.com');

-- --------------------------------------------
-- Proyectos de Work
-- --------------------------------------------
DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(100) UNIQUE NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description_en` TEXT,
  `description_es` TEXT,
  `project_type` ENUM('link', 'gallery') NOT NULL DEFAULT 'gallery',
  `external_url` VARCHAR(500),
  `cover_image` VARCHAR(500),
  `display_order` INT DEFAULT 0,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_active_order` (`is_active`, `display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos iniciales (proyectos existentes)
INSERT INTO `projects` (`slug`, `title`, `description_en`, `description_es`, `project_type`, `external_url`, `cover_image`, `display_order`, `is_active`) VALUES
('heritage', 'Heritage Design Studio', 'This is my design business. Click to see our work for clients from all over the globe.', 'Este es mi negocio de diseño. Haz clic para ver nuestro trabajo para clientes de todo el mundo.', 'link', 'https://www.theheritage.mx/', 'heritage.jpg', 1, TRUE),
('ethereans', 'The Ethereans', 'Long live the Etherean Empire! I created The Ethereans in 2021, a digital collectible project that travels space through Blockchain technology and physical objects with 3D Printing.', '¡Larga vida al Imperio Etherean! Creé The Ethereans en 2021, un proyecto de coleccionables digitales que viaja por el espacio a través de la tecnología Blockchain y objetos físicos con impresión 3D.', 'link', 'https://ethereans.xyz/', 'Etherean.jpg', 2, TRUE),
('arttoys', 'Art Toys', 'I produced a bunch of characters straight out of my head in collaboration with Iconic Design Objects from the Netherlands. A new batch is coming soon, made in México.', 'Produje un montón de personajes directamente de mi cabeza en colaboración con Iconic Design Objects de los Países Bajos. Próximamente una nueva tanda, hecha en México.', 'gallery', NULL, 'ArtToys/HouseBird.jpg', 3, TRUE),
('heads', '3D Heads', 'A collection of 3D heads that I created for fun. They aren''t that bad, are they?', 'Una colección de cabezas 3D que creé por diversión. No están tan mal, ¿o sí?', 'gallery', NULL, '3dheads.webp', 4, TRUE),
('2dheads', '2D Heads', 'I love to draw in between projects, and this is a small collection of random heads with multiple expressions that I created in Procreate.', 'Me encanta dibujar entre proyectos, y esta es una pequeña colección de cabezas aleatorias con múltiples expresiones que creé en Procreate.', 'gallery', NULL, '2DHeads/cover.webp', 5, TRUE);

-- --------------------------------------------
-- Archivos de proyectos (galería)
-- --------------------------------------------
DROP TABLE IF EXISTS `project_files`;
CREATE TABLE `project_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_type` ENUM('image', 'video') NOT NULL,
  `display_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_project_order` (`project_id`, `display_order`),
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archivos iniciales para ArtToys (project_id = 3)
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`) VALUES
(3, 'ArtToys/1.jpg', 'image', 1),
(3, 'ArtToys/2.jpg', 'image', 2),
(3, 'ArtToys/3.jpg', 'image', 3),
(3, 'ArtToys/4.jpg', 'image', 4),
(3, 'ArtToys/5.jpg', 'image', 5),
(3, 'ArtToys/6.jpg', 'image', 6),
(3, 'ArtToys/7.jpg', 'image', 7),
(3, 'ArtToys/8.jpg', 'image', 8),
(3, 'ArtToys/9.jpg', 'image', 9),
(3, 'ArtToys/10.jpg', 'image', 10),
(3, 'ArtToys/11.jpg', 'image', 11),
(3, 'ArtToys/12.jpg', 'image', 12);

-- Archivos iniciales para 3D Heads (project_id = 4)
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`) VALUES
(4, '3Dheads/1.webp', 'image', 1),
(4, '3Dheads/2.jpg', 'image', 2),
(4, '3Dheads/3.jpg', 'image', 3),
(4, '3Dheads/4.webp', 'image', 4),
(4, '3Dheads/5.webp', 'image', 5),
(4, '3Dheads/6.webp', 'image', 6),
(4, '3Dheads/7.webp', 'image', 7),
(4, '3Dheads/8.webp', 'image', 8),
(4, '3Dheads/9.webp', 'image', 9),
(4, '3Dheads/10.webp', 'image', 10),
(4, '3Dheads/11.webp', 'image', 11);

-- Archivos iniciales para 2D Heads (project_id = 5)
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`) VALUES
(5, '2DHeads/1.webp', 'image', 1),
(5, '2DHeads/2.webp', 'image', 2),
(5, '2DHeads/3.webp', 'image', 3),
(5, '2DHeads/4.webp', 'image', 4),
(5, '2DHeads/5.webp', 'image', 5),
(5, '2DHeads/6.webp', 'image', 6),
(5, '2DHeads/7.webp', 'image', 7),
(5, '2DHeads/8.webp', 'image', 8),
(5, '2DHeads/9.webp', 'image', 9),
(5, '2DHeads/10.webp', 'image', 10),
(5, '2DHeads/11.webp', 'image', 11),
(5, '2DHeads/12.webp', 'image', 12),
(5, '2DHeads/13.webp', 'image', 13);

-- --------------------------------------------
-- Contenido About (editable)
-- --------------------------------------------
DROP TABLE IF EXISTS `about_content`;
CREATE TABLE `about_content` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lang` ENUM('en', 'es') NOT NULL,
  `paragraph_key` VARCHAR(50) NOT NULL,
  `content` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_lang_key` (`lang`, `paragraph_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contenido inicial About (copiar del LanguageContext actual)
INSERT INTO `about_content` (`lang`, `paragraph_key`, `content`) VALUES
('en', 'p1', 'I''m a Creative Director, 3D Artist, and Full-Stack Developer based in Mexico City.'),
('en', 'p2', 'I love creating digital experiences that blend art and technology.'),
('en', 'p3', 'When I''m not designing or coding, you''ll find me making music or exploring new creative tools.'),
('es', 'p1', 'Soy Director Creativo, Artista 3D y Desarrollador Full-Stack en la Ciudad de México.'),
('es', 'p2', 'Me encanta crear experiencias digitales que mezclan arte y tecnología.'),
('es', 'p3', 'Cuando no estoy diseñando o programando, me encontrarás haciendo música o explorando nuevas herramientas creativas.');

-- --------------------------------------------
-- Sesiones de usuario
-- --------------------------------------------
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` INT NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_expires` (`expires_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Notas de instalación:
-- 1. Importar este archivo en phpMyAdmin de Hostinger
-- 2. Cambiar el email en allowed_emails por tu email de Google
-- 3. Los datos iniciales de proyectos coinciden con los actuales
-- ============================================
