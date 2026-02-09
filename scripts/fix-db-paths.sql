-- =============================================================
-- PASO 1: LIMPIAR project_files (borrar registros viejos)
-- =============================================================
-- Estos tienen rutas que ya no existen
DELETE FROM project_files;

-- =============================================================
-- PASO 2: INSERTAR archivos para proyecto 3 (ArtToys)
-- Archivos en uploads/3/
-- =============================================================
INSERT INTO project_files (project_id, file_path, file_type, display_order) VALUES
(3, 'uploads/3/1_1770589072_1.jpg', 'image', 1),
(3, 'uploads/3/2_1770589072_2.jpg', 'image', 2),
(3, 'uploads/3/3_1770589072_3.jpg', 'image', 3),
(3, 'uploads/3/4_1770589072_4.jpg', 'image', 4),
(3, 'uploads/3/5_1770589072_5.jpg', 'image', 5),
(3, 'uploads/3/6_1770589072_6.jpg', 'image', 6),
(3, 'uploads/3/7_1770589072_7.jpg', 'image', 7),
(3, 'uploads/3/8_1770589072_8.jpg', 'image', 8),
(3, 'uploads/3/9_1770589072_9.jpg', 'image', 9),
(3, 'uploads/3/10_1770589072_10.jpg', 'image', 10),
(3, 'uploads/3/11_1770589072_11.jpg', 'image', 11),
(3, 'uploads/3/12_1770589072_12.jpg', 'image', 12);

-- =============================================================
-- PASO 3: INSERTAR archivos para proyecto 4 (3D Heads)
-- Archivos en uploads/4/
-- =============================================================
INSERT INTO project_files (project_id, file_path, file_type, display_order) VALUES
(4, 'uploads/4/1_1770589072_13.webp', 'image', 1),
(4, 'uploads/4/2_1770589072_14.jpg', 'image', 2),
(4, 'uploads/4/3_1770589072_15.jpg', 'image', 3),
(4, 'uploads/4/4_1770589072_16.webp', 'image', 4),
(4, 'uploads/4/5_1770589073_17.webp', 'image', 5),
(4, 'uploads/4/6_1770589073_18.webp', 'image', 6),
(4, 'uploads/4/7_1770589073_19.webp', 'image', 7),
(4, 'uploads/4/8_1770589073_20.webp', 'image', 8),
(4, 'uploads/4/9_1770589073_21.webp', 'image', 9),
(4, 'uploads/4/10_1770589073_22.webp', 'image', 10),
(4, 'uploads/4/11_1770589073_23.webp', 'image', 11);

-- =============================================================
-- PASO 4: INSERTAR archivos para proyecto 5 (2D Heads)
-- Archivos en uploads/5/
-- =============================================================
INSERT INTO project_files (project_id, file_path, file_type, display_order) VALUES
(5, 'uploads/5/1_1770589073_24.webp', 'image', 1),
(5, 'uploads/5/2_1770589073_25.webp', 'image', 2),
(5, 'uploads/5/3_1770589073_26.webp', 'image', 3),
(5, 'uploads/5/4_1770589073_27.webp', 'image', 4),
(5, 'uploads/5/5_1770589073_28.webp', 'image', 5),
(5, 'uploads/5/6_1770589073_29.webp', 'image', 6),
(5, 'uploads/5/7_1770589073_30.webp', 'image', 7),
(5, 'uploads/5/8_1770589073_31.webp', 'image', 8),
(5, 'uploads/5/9_1770589073_32.webp', 'image', 9),
(5, 'uploads/5/10_1770589073_33.webp', 'image', 10),
(5, 'uploads/5/11_1770589073_34.webp', 'image', 11),
(5, 'uploads/5/12_1770589073_35.webp', 'image', 12),
(5, 'uploads/5/13_1770589073_36.webp', 'image', 13);

-- =============================================================
-- PASO 5: ACTUALIZAR covers de proyectos
-- =============================================================
UPDATE projects SET cover_image = 'uploads/1/cover.jpg' WHERE id = 1;
UPDATE projects SET cover_image = 'uploads/2/cover.jpg' WHERE id = 2;
UPDATE projects SET cover_image = 'uploads/3/cover.jpg' WHERE id = 3;
UPDATE projects SET cover_image = 'uploads/4/cover.webp' WHERE id = 4;
UPDATE projects SET cover_image = 'uploads/5/cover.webp' WHERE id = 5;

-- =============================================================
-- VERIFICAR
-- =============================================================
SELECT * FROM project_files ORDER BY project_id, display_order;
SELECT id, slug, cover_image FROM projects;
