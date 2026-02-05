-- ============================================
-- MIGRACIÓN SEGURA: Agregar archivos usando slugs
-- Esta versión detecta automáticamente los IDs correctos
-- Ejecutar en phpMyAdmin de Hostinger
-- ============================================

-- Limpiar archivos existentes (opcional, descomentar si necesario)
-- DELETE FROM project_files;

-- ============================================
-- ArtToys
-- ============================================
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`)
SELECT id, 'ArtToys/1.jpg', 'image', 1 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/2.jpg', 'image', 2 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/3.jpg', 'image', 3 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/4.jpg', 'image', 4 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/5.jpg', 'image', 5 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/6.jpg', 'image', 6 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/7.jpg', 'image', 7 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/8.jpg', 'image', 8 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/9.jpg', 'image', 9 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/10.jpg', 'image', 10 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/11.jpg', 'image', 11 FROM projects WHERE slug = 'arttoys'
UNION ALL SELECT id, 'ArtToys/12.jpg', 'image', 12 FROM projects WHERE slug = 'arttoys';

-- ============================================
-- 3D Heads
-- ============================================
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`)
SELECT id, '3Dheads/1.webp', 'image', 1 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/2.jpg', 'image', 2 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/3.jpg', 'image', 3 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/4.webp', 'image', 4 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/5.webp', 'image', 5 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/6.webp', 'image', 6 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/7.webp', 'image', 7 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/8.webp', 'image', 8 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/9.webp', 'image', 9 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/10.webp', 'image', 10 FROM projects WHERE slug = 'heads'
UNION ALL SELECT id, '3Dheads/11.webp', 'image', 11 FROM projects WHERE slug = 'heads';

-- ============================================
-- 2D Heads
-- ============================================
INSERT INTO `project_files` (`project_id`, `file_path`, `file_type`, `display_order`)
SELECT id, '2DHeads/1.webp', 'image', 1 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/2.webp', 'image', 2 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/3.webp', 'image', 3 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/4.webp', 'image', 4 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/5.webp', 'image', 5 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/6.webp', 'image', 6 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/7.webp', 'image', 7 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/8.webp', 'image', 8 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/9.webp', 'image', 9 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/10.webp', 'image', 10 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/11.webp', 'image', 11 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/12.webp', 'image', 12 FROM projects WHERE slug = '2dheads'
UNION ALL SELECT id, '2DHeads/13.webp', 'image', 13 FROM projects WHERE slug = '2dheads';

-- ============================================
-- Verificar resultado
-- ============================================
SELECT p.title, p.slug, COUNT(pf.id) as archivos 
FROM projects p 
LEFT JOIN project_files pf ON p.id = pf.project_id 
GROUP BY p.id
ORDER BY p.display_order;
