-- =============================================
-- Añadir columnas Shopify a code_redemptions para trackear
-- códigos de descuento efímeros minteados via Admin API.
-- Fase 5 del plan Shopify (ver HANDOFF §11).
--
-- Idempotente: ALTER IGNORE-like usando IF NOT EXISTS (MySQL 8+).
-- Si tu MySQL < 8, correr manualmente chequeando cada column.
-- =============================================

ALTER TABLE code_redemptions
  ADD COLUMN IF NOT EXISTS shopify_code VARCHAR(64) DEFAULT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS shopify_code_expires_at DATETIME DEFAULT NULL AFTER shopify_code,
  ADD COLUMN IF NOT EXISTS shopify_sync_status VARCHAR(20) DEFAULT NULL AFTER shopify_code_expires_at;

-- shopify_sync_status valores esperados:
--   NULL      → no se intentó minteo (Shopify no configurado)
--   'success' → código minteado OK
--   'failed'  → minteo falló (ver log / ver campo opcional para detalle)

CREATE INDEX IF NOT EXISTS idx_shopify_code ON code_redemptions (shopify_code);
