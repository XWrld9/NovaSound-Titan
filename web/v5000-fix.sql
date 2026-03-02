-- ══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Correctif v5000 (fix migration)
-- À exécuter APRÈS v5000-migration.sql
-- Corrige :
--   1. live_room_participants  — table de présence manquante
--   2. user_streaks RLS        — bloquait le leaderboard auditeurs
--   3. achievement_definitions — clé étrangère pour le select frontend
--   4. Trigger auto-achievements sur likes & plays
--   5. Politiques RLS song_reposts pour les lectures pub
--   6. Vue leaderboard_listeners — accès public
--   7. Réinitialisation xp_points initiale
--   8. Permissions GRANT pour les nouvelles tables
-- ══════════════════════════════════════════════════════════════════

-- ── 1. live_room_participants ─────────────────────────────────────
-- (mentionnée dans les specs v5000 mais absente de la migration)
CREATE TABLE IF NOT EXISTS live_room_participants (
  id         TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  room_id    TEXT        NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at    TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);

ALTER TABLE live_room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v5_lrp_read"
  ON live_room_participants FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "v5_lrp_insert"
  ON live_room_participants FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "v5_lrp_update"
  ON live_room_participants FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE INDEX IF NOT EXISTS idx_lrp_room
  ON live_room_participants (room_id, joined_at DESC);

-- ── 2. user_streaks : autoriser la lecture publique ───────────────
-- La politique précédente bloquait le leaderboard auditeurs.
-- On autorise la lecture de TOUS les streaks (pas de données sensibles).
DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;

CREATE POLICY "Streaks public read for leaderboard"
  ON public.user_streaks FOR SELECT
  USING (true);

-- On garde la politique d'écriture stricte
DROP POLICY IF EXISTS "Users can upsert own streak" ON public.user_streaks;
CREATE POLICY "Users can upsert own streak"
  ON public.user_streaks FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ── 3. achievement_definitions — accès public en lecture ─────────
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievement_def_read" ON achievement_definitions;
CREATE POLICY "achievement_def_read"
  ON achievement_definitions FOR SELECT USING (true);

-- ── 4. Trigger auto-achievements sur INSERT song ──────────────────
-- Déclenche le calcul d'achievements quand un son est uploadé.
CREATE OR REPLACE FUNCTION trigger_achievements_on_upload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM calculate_achievements(NEW.uploader_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_on_upload ON songs;
CREATE TRIGGER trg_achievements_on_upload
  AFTER INSERT ON songs
  FOR EACH ROW EXECUTE FUNCTION trigger_achievements_on_upload();

-- Déclenche aussi sur changements plays_count / likes_count
CREATE OR REPLACE FUNCTION trigger_achievements_on_song_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Seulement si les compteurs changent de façon significative
  IF (NEW.plays_count <> OLD.plays_count AND NEW.plays_count IN (100, 1000, 10000, 100000))
  OR (NEW.likes_count <> OLD.likes_count AND NEW.likes_count IN (1, 100)) THEN
    PERFORM calculate_achievements(NEW.uploader_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_on_song_update ON songs;
CREATE TRIGGER trg_achievements_on_song_update
  AFTER UPDATE OF plays_count, likes_count ON songs
  FOR EACH ROW EXECUTE FUNCTION trigger_achievements_on_song_update();

-- ── 5. song_reposts : s'assurer que RLS permet lecture publique ───
DROP POLICY IF EXISTS "v5_reposts_read" ON song_reposts;
CREATE POLICY "v5_reposts_read"
  ON song_reposts FOR SELECT USING (true);

-- ── 6. Droits d'accès pour le service role et anon ────────────────
GRANT SELECT ON live_rooms              TO anon, authenticated;
GRANT SELECT ON live_room_messages      TO authenticated;
GRANT SELECT ON live_room_participants  TO authenticated;
GRANT SELECT ON song_lyrics             TO anon, authenticated;
GRANT SELECT ON song_reposts            TO anon, authenticated;
GRANT SELECT ON user_achievements       TO anon, authenticated;
GRANT SELECT ON achievement_definitions TO anon, authenticated;
GRANT SELECT ON user_streaks            TO anon, authenticated;

GRANT INSERT, DELETE ON song_reposts            TO authenticated;
GRANT INSERT, UPDATE ON song_lyrics             TO authenticated;
GRANT INSERT, UPDATE ON live_rooms              TO authenticated;
GRANT INSERT        ON live_room_messages       TO authenticated;
GRANT INSERT, UPDATE ON live_room_participants  TO authenticated;
GRANT INSERT        ON user_achievements        TO authenticated;

-- ── 7. Réinitialisation xp_points pour tous les users ────────────
UPDATE users u
SET xp_points = COALESCE((
  SELECT SUM(d.points)
  FROM user_achievements ua
  JOIN achievement_definitions d ON d.code = ua.achievement
  WHERE ua.user_id = u.id
), 0)
WHERE EXISTS (SELECT 1 FROM user_achievements WHERE user_id = u.id);

-- ── 8. Rafraîchir les total_plays / total_likes ───────────────────
-- Au cas où ils n'auraient pas été mis à jour correctement
UPDATE users u SET
  total_plays = COALESCE((
    SELECT SUM(plays_count) FROM songs WHERE uploader_id = u.id AND NOT is_archived
  ), 0),
  total_likes = COALESCE((
    SELECT SUM(likes_count) FROM songs WHERE uploader_id = u.id AND NOT is_archived
  ), 0)
WHERE EXISTS (SELECT 1 FROM songs WHERE uploader_id = u.id);

-- ── 9. Calcul initial des achievements pour les users existants ───
DO $$
DECLARE v_uid TEXT;
BEGIN
  FOR v_uid IN
    SELECT DISTINCT uploader_id FROM songs WHERE NOT is_archived
  LOOP
    BEGIN
      PERFORM calculate_achievements(v_uid);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
$$;

-- ── 10. Realtime pour live_room_participants ──────────────────────
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_room_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END;
$realtime$;

-- ══════════════════════════════════════════════════════════════════
-- FIN DU CORRECTIF v5000
-- Toutes les requêtes sont idempotentes (IF NOT EXISTS / ON CONFLICT)
-- ══════════════════════════════════════════════════════════════════
