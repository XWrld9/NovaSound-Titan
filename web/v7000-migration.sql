-- ═══════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX v7000 Migration
-- À exécuter APRÈS v5000-fix.sql dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Table live_room_messages (si pas encore créée)
CREATE TABLE IF NOT EXISTS live_room_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     uuid REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE live_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_room_messages_select" ON live_room_messages;
DROP POLICY IF EXISTS "live_room_messages_insert" ON live_room_messages;

CREATE POLICY "live_room_messages_select" ON live_room_messages
  FOR SELECT USING (true);

CREATE POLICY "live_room_messages_insert" ON live_room_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_live_room_messages_room_id ON live_room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_live_room_messages_created_at ON live_room_messages(created_at);

-- 2. S'assurer que live_rooms a bien participants_count
ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS participants_count integer DEFAULT 0;
ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS current_song_id uuid REFERENCES songs(id) ON DELETE SET NULL;

-- 3. Purge auto messages > 7 jours (optionnel, à activer si pg_cron disponible)
-- SELECT cron.schedule('purge-live-messages', '0 4 * * *',
--   $$DELETE FROM live_room_messages WHERE created_at < now() - interval '7 days'$$);

-- 4. Index manquants sur notifications pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;

-- 5. Index sur chat_messages pour les requêtes par période
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_period
  ON chat_messages(created_at DESC);

-- 6. Colonne is_edited sur chat_messages (si absente)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

