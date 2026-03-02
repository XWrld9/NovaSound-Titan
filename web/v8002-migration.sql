-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX v8002 Migration — Notifications Universelles
-- Compatible Supabase Free Tier — 0 triggers, 0 Edge Functions
--
-- Toutes les notifications sont gérées côté client (src/lib/notifUtils.js)
-- Ce script crée uniquement les indexes nécessaires aux performances.
-- ═══════════════════════════════════════════════════════════════════════════

-- Indexes notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON notifications(user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;

-- Fix RLS uuid cast live_room_messages (depuis v7000)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_room_messages') THEN
    DROP POLICY IF EXISTS "live_room_messages_insert" ON live_room_messages;
    EXECUTE $p$
      CREATE POLICY "live_room_messages_insert" ON live_room_messages
        FOR INSERT WITH CHECK (auth.uid() = user_id::uuid)
    $p$;
  END IF;
END $$;

-- Table local_play_history
CREATE TABLE IF NOT EXISTS local_play_history (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  title     text,
  artist    text,
  played_at timestamptz DEFAULT now()
);

ALTER TABLE local_play_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lph_select" ON local_play_history;
DROP POLICY IF EXISTS "lph_insert" ON local_play_history;
DROP POLICY IF EXISTS "lph_delete" ON local_play_history;

CREATE POLICY "lph_select" ON local_play_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lph_insert" ON local_play_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lph_delete" ON local_play_history FOR DELETE USING (auth.uid() = user_id);

-- Indexes autres tables
CREATE INDEX IF NOT EXISTS idx_song_reposts_composite ON song_reposts(song_id, user_id);
CREATE INDEX IF NOT EXISTS idx_likes_composite        ON likes(song_id, user_id);
CREATE INDEX IF NOT EXISTS idx_follows_composite      ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_local_play_history     ON local_play_history(user_id, played_at DESC);

-- Colonne is_local songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_local boolean DEFAULT false;
