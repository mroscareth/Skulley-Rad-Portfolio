-- ============================================
-- MIGRACIÓN: Agregar archivos existentes a project_files
-- Ejecutar en phpMyAdmin de Hostinger
-- ============================================

-- Primero verificar que la tabla project_files está vacía
-- SELECT COUNT(*) FROM project_files;

-- Si tienes archivos ya insertados, puedes saltarte este script
-- o borrar los existentes con: DELETE FROM project_files;

-- ============================================
-- IMPORTANTE: Primero verifica los IDs de tus proyectos
-- ============================================
-- SELECT id, slug, title FROM projects;
-- 
-- Los IDs esperados son:
--   3 = arttoys
--   4 = heads  
--   5 = 2dheads
--
-- Si tus IDs son diferentes, ajusta los números abajo

-- ============================================
-- Archivos para ArtToys
-- ============================================
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

-- ============================================
-- Archivos para 3D Heads
-- ============================================
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

-- ============================================
-- Archivos para 2D Heads
-- ============================================
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

-- ============================================
-- Verificar que se insertaron correctamente
-- ============================================
-- SELECT p.title, COUNT(pf.id) as file_count 
-- FROM projects p 
-- LEFT JOIN project_files pf ON p.id = pf.project_id 
-- GROUP BY p.id;
