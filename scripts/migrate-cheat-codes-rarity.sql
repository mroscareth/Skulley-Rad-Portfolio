-- =============================================================================
-- Migration: cheat_codes — unify discount model
--   BEFORE: `type` ENUM(golden_ticket|discount), discount_pct nullable
--   AFTER:  every code has `discount_pct` (NOT NULL) + `rarity` enum
--           `golden_ticket` becomes rarity='legendary' + action='goldSkin'
--   Run once against prod DB. Idempotent where possible.
-- =============================================================================

-- 1) Add rarity column (with safe default for existing rows)
ALTER TABLE cheat_codes
  ADD COLUMN IF NOT EXISTS rarity
    ENUM('common','rare','legendary') NOT NULL DEFAULT 'common'
    AFTER discount_pct;

-- 2) Backfill: old type=golden_ticket → rarity=legendary (the rare, big one)
UPDATE cheat_codes
  SET rarity = 'legendary'
  WHERE type = 'golden_ticket';

-- 3) Backfill: old golden_ticket rows that had no discount_pct get a default.
--    Admin can adjust after; 50% is a reasonable "legendary" starting point.
UPDATE cheat_codes
  SET discount_pct = 50
  WHERE discount_pct IS NULL AND type = 'golden_ticket';

-- 4) Any remaining row without discount_pct → default 10 so the NOT NULL
--    migration below does not fail. Admin can edit after.
UPDATE cheat_codes
  SET discount_pct = 10
  WHERE discount_pct IS NULL;

-- 5) Ensure all golden_ticket rows keep the gold_skin perk via `action`.
--    This decouples the cosmetic from the type — from now on, the skin is
--    granted by `action='goldSkin'`, not by the type column.
UPDATE cheat_codes
  SET action = 'goldSkin'
  WHERE type = 'golden_ticket' AND (action IS NULL OR action = '');

-- 6) Enforce NOT NULL on discount_pct + set sane default.
ALTER TABLE cheat_codes
  MODIFY COLUMN discount_pct INT NOT NULL DEFAULT 10;

-- 7) Drop the `type` column — it's no longer the source of truth.
ALTER TABLE cheat_codes
  DROP COLUMN type;

-- =============================================================================
-- Post-migration note:
--   The seed row originally INSERT'ed in create-cheat-codes.sql was:
--     ('goldeneggs','golden_ticket','Legendary Gold Skin','goldSkin',0)
--   After migration, equivalent row is:
--     code='goldeneggs', discount_pct=50, rarity='legendary',
--     label='Legendary Gold Skin', action='goldSkin', max_uses=0
--   No re-seed needed — the UPDATE steps above handle it.
-- =============================================================================
