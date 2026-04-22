-- =============================================
-- User Achievements table — persistent life-goals por usuario autenticado.
-- Ejemplos de keys: 'section6_unlocked', 'sphere_game_master',
-- 'first_portal_crossed', 'runic_codex_visited', 'all_portals_crossed'.
-- =============================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  achievement_key  VARCHAR(64) NOT NULL,
  unlocked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata         JSON NULL,
  UNIQUE KEY uk_user_achievement (user_id, achievement_key),
  CONSTRAINT fk_achievement_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  INDEX idx_key (achievement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
