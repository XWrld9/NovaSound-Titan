-- ══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v8100
-- Synchronisation et nettoyage général
-- Date: 2025-03-02
-- ══════════════════════════════════════════════════════════════════════════

-- ── S'assurer que les tables et colonnes critiques existent ──────────────

-- 1. Colonne is_archived sur songs (si absent)
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 2. Index sur is_archived pour les requêtes Explorer
CREATE INDEX IF NOT EXISTS idx_songs_not_archived
  ON songs (created_at DESC)
  WHERE is_archived = false;

-- 3. Colonne plays_count avec default 0
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS plays_count INTEGER NOT NULL DEFAULT 0;

-- 4. Colonne reposts_count
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS reposts_count INTEGER NOT NULL DEFAULT 0;

-- 5. Table messages — colonnes essentielles
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (recipient_id, is_read)
  WHERE is_read = false;

-- 6. Index messages pour conversations rapides
CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages (sender_id, recipient_id, created_at DESC);

-- 7. S'assurer que RLS est activé sur messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politique messages : voir ses propres messages
DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  USING (
    auth.uid()::text = sender_id::text
    OR auth.uid()::text = recipient_id::text
  );

-- Politique messages : envoyer
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id::text);

-- Politique messages : supprimer les siens
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own"
  ON messages FOR DELETE
  USING (auth.uid()::text = sender_id::text);

-- Politique messages : marquer comme lu
DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read"
  ON messages FOR UPDATE
  USING (auth.uid()::text = recipient_id::text);

-- 8. Fonction pour compter les messages non lus d'un utilisateur
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM messages
  WHERE recipient_id = p_user_id AND is_read = false;
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. Nettoyage des politiques songs en double
DROP POLICY IF EXISTS "songs_select_all_v2" ON songs;
DROP POLICY IF EXISTS "songs_update_owner_v2" ON songs;

-- 10. Politiques songs propres
DROP POLICY IF EXISTS "songs_select_all" ON songs;
CREATE POLICY "songs_select_all"
  ON songs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "songs_insert_auth" ON songs;
CREATE POLICY "songs_insert_auth"
  ON songs FOR INSERT
  WITH CHECK (auth.uid()::text = uploader_id::text);

DROP POLICY IF EXISTS "songs_update_owner" ON songs;
CREATE POLICY "songs_update_owner"
  ON songs FOR UPDATE
  USING (auth.uid()::text = uploader_id::text);

DROP POLICY IF EXISTS "songs_delete_owner" ON songs;
CREATE POLICY "songs_delete_owner"
  ON songs FOR DELETE
  USING (auth.uid()::text = uploader_id::text);

-- 11. Vue pour les statistiques de messages par conversation
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
  LEAST(sender_id, recipient_id) AS user1_id,
  GREATEST(sender_id, recipient_id) AS user2_id,
  MAX(created_at) AS last_message_at,
  COUNT(*) FILTER (WHERE is_read = false AND recipient_id = auth.uid()) AS unread_count
FROM messages
GROUP BY 1, 2;

-- 12. Table playlists (si non existante)
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlists_select_public" ON playlists;
CREATE POLICY "playlists_select_public"
  ON playlists FOR SELECT
  USING (is_public = true OR auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "playlists_insert_own" ON playlists;
CREATE POLICY "playlists_insert_own"
  ON playlists FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "playlists_update_own" ON playlists;
CREATE POLICY "playlists_update_own"
  ON playlists FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "playlists_delete_own" ON playlists;
CREATE POLICY "playlists_delete_own"
  ON playlists FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- 13. Table playlist_songs (si non existante)
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, song_id)
);

ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_songs_select" ON playlist_songs;
CREATE POLICY "playlist_songs_select"
  ON playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_id
      AND (p.is_public = true OR auth.uid()::text = p.user_id::text)
    )
  );

-- ✅ Migration v8100 terminée
SELECT 'NovaSound TITAN LUX v8100 — Migration appliquée avec succès ✅' AS status;
