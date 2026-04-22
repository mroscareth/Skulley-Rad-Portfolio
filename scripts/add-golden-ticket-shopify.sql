-- =============================================
-- Golden Ticket → Shopify ephemeral code.
-- El golden ticket SOLO se gana jugando el minijuego (score ≥ 3000).
-- Al cruzar el threshold, profile.php mintea un discount code via Admin API
-- con usageLimit=1 (Shopify enforcea la quema al primer uso).
--
-- Columnas añadidas a user_profiles:
--   - golden_ticket_shopify_code    → el código SKR-XXXXXXXX devuelto por Admin API
--   - golden_ticket_minted_at       → cuándo se minteó
-- El flag `ticket_burned` (ya existente) se setea via webhook Shopify o al
-- detectar que el checkout rechazó el code por ya usado.
-- =============================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS golden_ticket_shopify_code VARCHAR(64) DEFAULT NULL AFTER ticket_burned,
  ADD COLUMN IF NOT EXISTS golden_ticket_minted_at DATETIME DEFAULT NULL AFTER golden_ticket_shopify_code;

CREATE INDEX IF NOT EXISTS idx_golden_shopify_code ON user_profiles (golden_ticket_shopify_code);
