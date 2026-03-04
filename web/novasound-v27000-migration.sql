-- ============================================================
-- NovaSound — Migration V27000
-- ✅ RLS song_reposts
-- ✅ RLS achievement_definitions (lecture publique)
-- ✅ FK user_achievements.achievement → achievement_definitions.code
-- ============================================================

-- ── 1. song_reposts RLS ───────────────────────────────────────
ALTER TABLE song_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reposts_select" ON song_reposts;
DROP POLICY IF EXISTS "reposts_insert" ON song_reposts;
DROP POLICY IF EXISTS "reposts_delete" ON song_reposts;

-- Lecture publique (pour afficher les reposts sur les profils publics)
CREATE POLICY "reposts_select" ON song_reposts
  FOR SELECT USING (true);

CREATE POLICY "reposts_insert" ON song_reposts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "reposts_delete" ON song_reposts
  FOR DELETE USING (auth.uid()::text = user_id);

-- ── 2. achievement_definitions RLS ───────────────────────────
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_select" ON achievement_definitions;
CREATE POLICY "ad_select" ON achievement_definitions
  FOR SELECT USING (true);

-- ── 3. FK user_achievements → achievement_definitions ─────────
-- (Ajouter seulement si elle n'existe pas déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ua_achievement'
      AND conrelid = 'user_achievements'::regclass
  ) THEN
    ALTER TABLE user_achievements
      ADD CONSTRAINT fk_ua_achievement
      FOREIGN KEY (achievement)
      REFERENCES achievement_definitions(code)
      ON DELETE CASCADE;
    RAISE NOTICE '✅ FK fk_ua_achievement créée';
  ELSE
    RAISE NOTICE '✅ FK fk_ua_achievement déjà présente';
  END IF;
END $$;

-- ── 4. reposts_count colonne sur songs (si absent) ───────────
ALTER TABLE songs ADD COLUMN IF NOT EXISTS reposts_count integer DEFAULT 0;

-- ── 5. Index ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_reposts_user_id ON song_reposts (user_id);
CREATE INDEX IF NOT EXISTS idx_song_reposts_song_id ON song_reposts (song_id);

-- ── Vérification ──────────────────────────────────────────────
SELECT 'song_reposts' as table_name, count(*) FROM song_reposts
UNION ALL
SELECT 'achievement_definitions', count(*) FROM achievement_definitions;
