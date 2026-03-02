-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX v8001 Migration
-- À exécuter APRÈS v8000-migration.sql dans Supabase SQL Editor
--
-- v8001 : corrections visuelles + offline player + indexes optimisés
--   Aucun changement de schéma majeur, uniquement consolidation
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── S'assurer que local_play_history existe (idempotent) ────────────────────
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

-- ─── Fix RLS uuid=text live_room_messages ──────────────────────────────────
DROP POLICY IF EXISTS "live_room_messages_insert" ON live_room_messages;
CREATE POLICY "live_room_messages_insert" ON live_room_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

-- ─── Indexes performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_song_reposts_composite ON song_reposts(song_id, user_id);
CREATE INDEX IF NOT EXISTS idx_likes_composite        ON likes(song_id, user_id);
CREATE INDEX IF NOT EXISTS idx_follows_composite      ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_local_play_history     ON local_play_history(user_id, played_at DESC);

-- ─── Colonne is_local songs ─────────────────────────────────────────────────
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_local boolean DEFAULT false;
