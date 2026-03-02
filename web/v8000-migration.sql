-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX v8000 Migration
-- À exécuter APRÈS v7000-migration.sql dans Supabase SQL Editor
--
-- Nouveautés v8000 :
--   1. Correctif uuid=text dans les RLS (cast ::uuid)
--   2. Table local_player_history — historique de lecture locale (optionnel)
--   3. Index optimisés song_reposts
--   4. Colonne is_local dans songs (pour les imports éventuels futurs)
--   5. Nettoyage des policies dupliquées
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. CORRECTIF CRITIQUE : cast ::uuid dans toutes les RLS où user_id = text ─
-- Live room messages (fix v7000)
DROP POLICY IF EXISTS "live_room_messages_insert" ON live_room_messages;
CREATE POLICY "live_room_messages_insert" ON live_room_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

-- ─── 2. Historique lecteur local (stocké côté client, table légère) ──────────
CREATE TABLE IF NOT EXISTS local_play_history (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name  text NOT NULL,
  title      text,
  artist     text,
  played_at  timestamptz DEFAULT now()
);

ALTER TABLE local_play_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "local_play_history_select" ON local_play_history;
DROP POLICY IF EXISTS "local_play_history_insert" ON local_play_history;
DROP POLICY IF EXISTS "local_play_history_delete" ON local_play_history;

CREATE POLICY "local_play_history_select" ON local_play_history
  FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "local_play_history_insert" ON local_play_history
  FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "local_play_history_delete" ON local_play_history
  FOR DELETE USING (auth.uid() = user_id::uuid);

CREATE INDEX IF NOT EXISTS idx_local_play_history_user ON local_play_history(user_id, played_at DESC);

-- ─── 3. Index optimisés sur song_reposts ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_reposts_song_id ON song_reposts(song_id);
CREATE INDEX IF NOT EXISTS idx_song_reposts_user_id ON song_reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_song_reposts_composite ON song_reposts(song_id, user_id);

-- ─── 4. Index optimisés sur likes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_likes_composite ON likes(song_id, user_id);

-- ─── 5. Index optimisés sur follows ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_follows_composite ON follows(follower_id, following_id);

-- ─── 6. Colonne is_local optionnelle sur songs (pour import futur) ────────────
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_local boolean DEFAULT false;

-- ─── 7. Purge auto local_play_history > 90 jours ─────────────────────────────
-- (activer si pg_cron disponible)
-- SELECT cron.schedule('purge-local-history', '0 3 * * 0',
--   $$DELETE FROM local_play_history WHERE played_at < now() - interval '90 days'$$);

-- ─── 8. Index partiel notifications non-lues (si pas déjà v7000) ─────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;
