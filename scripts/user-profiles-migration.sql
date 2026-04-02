-- =============================================
-- User Profiles & Game Scores Migration
-- Run this AFTER create-cheat-codes.sql
-- =============================================

-- User profiles linked to Privy auth
CREATE TABLE IF NOT EXISTS user_profiles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  privy_id      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) DEFAULT NULL,
  wallet        VARCHAR(255) DEFAULT NULL,
  display_name  VARCHAR(120) DEFAULT NULL,
  avatar_url    TEXT DEFAULT NULL,
  gold_skin     TINYINT(1) DEFAULT 0,
  golden_ticket TINYINT(1) DEFAULT 0,
  ticket_source ENUM('game','code') DEFAULT NULL,
  ticket_burned TINYINT(1) DEFAULT 0,
  high_score    INT DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_wallet (wallet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game score history (each play session)
CREATE TABLE IF NOT EXISTS game_scores (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  score        INT NOT NULL,
  tier         VARCHAR(20) DEFAULT NULL,
  played_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_score_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_score (score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link code_redemptions to user profiles (nullable — legacy redemptions won't have it)
ALTER TABLE code_redemptions
  ADD COLUMN user_id INT DEFAULT NULL AFTER code_id,
  ADD CONSTRAINT fk_redemption_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
