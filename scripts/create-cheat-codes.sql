-- =============================================
-- Cheat Codes table for CMS discount/reward system
-- =============================================

CREATE TABLE IF NOT EXISTS cheat_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,
  type        ENUM('golden_ticket', 'discount') NOT NULL DEFAULT 'golden_ticket',
  discount_pct INT DEFAULT NULL,
  label       VARCHAR(120) NOT NULL,
  action      VARCHAR(50)  DEFAULT NULL,
  max_uses    INT DEFAULT 1,
  times_used  INT DEFAULT 0,
  active      TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Code Redemptions log (tracks who redeemed what)
-- =============================================

CREATE TABLE IF NOT EXISTS code_redemptions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code_id     INT NOT NULL,
  email       VARCHAR(255) NOT NULL,
  ip_address  VARCHAR(45)  DEFAULT NULL,
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_redemption_code FOREIGN KEY (code_id) REFERENCES cheat_codes(id) ON DELETE CASCADE,
  INDEX idx_code_id (code_id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: goldeneggs (unlimited uses, golden ticket, triggers goldSkin action)
INSERT INTO cheat_codes (code, type, label, action, max_uses)
VALUES ('goldeneggs', 'golden_ticket', 'Legendary Gold Skin', 'goldSkin', 0)
ON DUPLICATE KEY UPDATE label = VALUES(label);
