-- ════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v8500
-- Corrections majeures v8200 + Admin Panel + améliorations
-- Date: 2026-03-02
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Tables de messagerie avancée (héritées v8200) ─────────────────────

CREATE TABLE IF NOT EXISTS private_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  user1_unread INTEGER NOT NULL DEFAULT 0,
  user2_unread INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);
ALTER TABLE private_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_own" ON private_conversations;
CREATE POLICY "conversations_select_own"
  ON private_conversations FOR SELECT
  USING (auth.uid()::text = user1_id::text OR auth.uid()::text = user2_id::text);

DROP POLICY IF EXISTS "conversations_insert_own" ON private_conversations;
CREATE POLICY "conversations_insert_own"
  ON private_conversations FOR INSERT
  WITH CHECK (auth.uid()::text = user1_id::text OR auth.uid()::text = user2_id::text);

-- Table des messages privés
CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES private_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private_messages_select_conversation" ON private_messages;
CREATE POLICY "private_messages_select_conversation"
  ON private_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private_conversations pc
      WHERE pc.id = conversation_id
      AND (auth.uid()::text = pc.user1_id::text OR auth.uid()::text = pc.user2_id::text)
    )
  );

DROP POLICY IF EXISTS "private_messages_insert_own" ON private_messages;
CREATE POLICY "private_messages_insert_own"
  ON private_messages FOR INSERT
  WITH CHECK (
    auth.uid()::text = sender_id::text
    AND EXISTS (
      SELECT 1 FROM private_conversations pc
      WHERE pc.id = conversation_id
      AND (auth.uid()::text = pc.user1_id::text OR auth.uid()::text = pc.user2_id::text)
    )
  );

DROP POLICY IF EXISTS "private_messages_update_own" ON private_messages;
CREATE POLICY "private_messages_update_own"
  ON private_messages FOR UPDATE
  USING (auth.uid()::text = sender_id::text);

-- ── 2. Table des partages de fichiers ────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_category TEXT NOT NULL DEFAULT 'other' CHECK (file_category IN ('audio', 'video', 'image', 'document', 'other')),
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_shares_select_own" ON file_shares;
CREATE POLICY "file_shares_select_own"
  ON file_shares FOR SELECT
  USING (is_public = true OR auth.uid()::text = uploader_id::text);

DROP POLICY IF EXISTS "file_shares_insert_own" ON file_shares;
CREATE POLICY "file_shares_insert_own"
  ON file_shares FOR INSERT
  WITH CHECK (auth.uid()::text = uploader_id::text);

DROP POLICY IF EXISTS "file_shares_update_own" ON file_shares;
CREATE POLICY "file_shares_update_own"
  ON file_shares FOR UPDATE
  USING (auth.uid()::text = uploader_id::text);

DROP POLICY IF EXISTS "file_shares_delete_own" ON file_shares;
CREATE POLICY "file_shares_delete_own"
  ON file_shares FOR DELETE
  USING (auth.uid()::text = uploader_id::text);

-- ── 3. Améliorations système de notifications ─────────────────────────────

CREATE TABLE IF NOT EXISTS notification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key TEXT NOT NULL UNIQUE,
  type_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_types_select_all" ON notification_types;
CREATE POLICY "notification_types_select_all"
  ON notification_types FOR SELECT
  USING (is_active = true);

INSERT INTO notification_types (type_key, type_name, description, icon, color) VALUES
  ('like', 'Like', 'Quelqu''un a aimé votre musique', '❤️', '#ef4444'),
  ('comment', 'Commentaire', 'Quelqu''un a commenté votre musique', '💬', '#3b82f6'),
  ('follow', 'Abonnement', 'Quelqu''un vous suit', '👤', '#8b5cf6'),
  ('repost', 'Repost', 'Quelqu''un a reposté votre musique', '🔄', '#06b6d4'),
  ('mention', 'Mention', 'Quelqu''un vous a mentionné', '@', '#f59e0b'),
  ('new_song', 'Nouvelle musique', 'Artiste suivi a publié une nouvelle musique', '🎵', '#10b981'),
  ('playlist_add', 'Playlist', 'Votre musique a été ajoutée à une playlist', '📋', '#8b5cf6'),
  ('live_room_invite', 'Live Room', 'Invitation à une live room', '🎭', '#ec4899'),
  ('achievement', 'Succès', 'Nouveau succès débloqué', '🏆', '#f59e0b')
ON CONFLICT (type_key) DO NOTHING;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_type_id UUID REFERENCES notification_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS action_data JSONB;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_priority
  ON notifications (user_id, is_read, priority DESC, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_type_priority
  ON notifications (notification_type_id, priority DESC, created_at DESC);

-- ── 4. Table des sessions audio pour iPhone ──────────────────────────────

CREATE TABLE IF NOT EXISTS audio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  current_file_url TEXT,
  current_position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
ALTER TABLE audio_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_sessions_select_own" ON audio_sessions;
CREATE POLICY "audio_sessions_select_own"
  ON audio_sessions FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "audio_sessions_insert_own" ON audio_sessions;
CREATE POLICY "audio_sessions_insert_own"
  ON audio_sessions FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "audio_sessions_update_own" ON audio_sessions;
CREATE POLICY "audio_sessions_update_own"
  ON audio_sessions FOR UPDATE USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "audio_sessions_delete_own" ON audio_sessions;
CREATE POLICY "audio_sessions_delete_own"
  ON audio_sessions FOR DELETE USING (auth.uid()::text = user_id::text);

-- ── 5. Fonctions utilitaires avancées ────────────────────────────────────

-- FIX v8500: get_user_conversations utilise désormais la table 'users' publique
-- au lieu de auth.users (inaccessible côté client sans SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER,
  other_user_name TEXT,
  other_user_avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id as conversation_id,
    CASE
      WHEN pc.user1_id::text = p_user_id::text THEN pc.user2_id
      ELSE pc.user1_id
    END as other_user_id,
    pc.last_message_at,
    pc.last_message_preview,
    CASE
      WHEN pc.user1_id::text = p_user_id::text THEN pc.user1_unread
      ELSE pc.user2_unread
    END as unread_count,
    COALESCE(u.username, 'Utilisateur supprimé') as other_user_name,
    u.avatar_url as other_user_avatar
  FROM private_conversations pc
  LEFT JOIN public.users u ON (
    (pc.user1_id::text = p_user_id::text AND u.id::text = pc.user2_id::text) OR
    (pc.user2_id::text = p_user_id::text AND u.id::text = pc.user1_id::text)
  )
  WHERE (pc.user1_id::text = p_user_id::text OR pc.user2_id::text = p_user_id::text)
  ORDER BY pc.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer une conversation privée
CREATE OR REPLACE FUNCTION create_private_conversation(p_user1_id UUID, p_user2_id UUID)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  SELECT id INTO v_conv_id
  FROM private_conversations
  WHERE (user1_id = p_user1_id AND user2_id = p_user2_id)
     OR (user1_id = p_user2_id AND user2_id = p_user1_id);

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO private_conversations (user1_id, user2_id)
  VALUES (LEAST(p_user1_id, p_user2_id), GREATEST(p_user1_id, p_user2_id))
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour envoyer un message privé
CREATE OR REPLACE FUNCTION send_private_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_file_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_user1_id UUID;
  v_user2_id UUID;
BEGIN
  SELECT user1_id, user2_id INTO v_user1_id, v_user2_id
  FROM private_conversations
  WHERE id = p_conversation_id;

  IF p_sender_id::text != v_user1_id::text AND p_sender_id::text != v_user2_id::text THEN
    RAISE EXCEPTION 'Accès non autorisé à cette conversation';
  END IF;

  INSERT INTO private_messages (
    conversation_id, sender_id, content, message_type,
    file_url, file_name, file_size
  )
  VALUES (
    p_conversation_id, p_sender_id, p_content, p_message_type,
    p_file_url, p_file_name, p_file_size
  )
  RETURNING id INTO v_message_id;

  UPDATE private_conversations
  SET
    last_message_at = now(),
    last_message_preview = LEFT(p_content, 100),
    user1_unread = CASE
      WHEN p_sender_id::text != v_user1_id::text THEN user1_unread + 1
      ELSE user1_unread
    END,
    user2_unread = CASE
      WHEN p_sender_id::text != v_user2_id::text THEN user2_unread + 1
      ELSE user2_unread
    END,
    updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Index de performance ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_private_conversations_users
  ON private_conversations (user1_id, user2_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_messages_conversation_time
  ON private_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_shares_uploader
  ON file_shares (uploader_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_shares_public
  ON file_shares (is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audio_sessions_user
  ON audio_sessions (user_id, is_active, expires_at);

-- Trigger pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM audio_sessions WHERE expires_at < now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_sessions ON audio_sessions;
CREATE TRIGGER trigger_cleanup_sessions
  AFTER INSERT OR UPDATE ON audio_sessions
  FOR EACH ROW EXECUTE FUNCTION cleanup_expired_sessions();

-- ── 7. Vue statistiques utilisateur corrigée (FIX v8500) ─────────────────
-- La vue précédente utilisait auth.users (inaccessible en RLS anonyme)
-- Corrigé : utilise uniquement public.users

DROP VIEW IF EXISTS user_stats;
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id::uuid as user_id,
  u.username,
  u.email,
  COUNT(DISTINCT s.id) as total_songs,
  COALESCE(SUM(s.plays_count), 0) as total_plays,
  COALESCE(SUM(s.reposts_count), 0) as total_reposts,
  COUNT(DISTINCT CASE WHEN fl.follower_id::text = u.id::text THEN fl.following_id END) as following_count,
  COUNT(DISTINCT CASE WHEN fl.following_id::text = u.id::text THEN fl.follower_id END) as followers_count,
  COUNT(DISTINCT lik.id) as total_likes_received,
  COUNT(DISTINCT pc.id) as conversations_count,
  COALESCE(SUM(fs.download_count), 0) as total_downloads
FROM public.users u
LEFT JOIN songs s ON s.uploader_id::text = u.id::text AND s.is_archived = false
LEFT JOIN likes lik ON lik.song_id = s.id
LEFT JOIN follows fl ON (fl.follower_id::text = u.id::text OR fl.following_id::text = u.id::text)
LEFT JOIN private_conversations pc ON (pc.user1_id::text = u.id::text OR pc.user2_id::text = u.id::text)
LEFT JOIN file_shares fs ON fs.uploader_id::text = u.id::text
GROUP BY u.id, u.username, u.email;

-- ── 8. Métadonnées iOS sur songs ─────────────────────────────────────────

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS ios_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_ios_compatible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_songs_ios_compatible
  ON songs (is_ios_compatible, created_at DESC)
  WHERE is_ios_compatible = true AND is_archived = false;

-- ── 9. Système de cache pour performances ────────────────────────────────

CREATE TABLE IF NOT EXISTS cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cache_select_all" ON cache_entries;
CREATE POLICY "cache_select_all" ON cache_entries FOR SELECT USING (true);

DROP POLICY IF EXISTS "cache_insert_all" ON cache_entries;
CREATE POLICY "cache_insert_all" ON cache_entries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "cache_update_all" ON cache_entries;
CREATE POLICY "cache_update_all" ON cache_entries FOR UPDATE USING (true);

DROP POLICY IF EXISTS "cache_delete_all" ON cache_entries;
CREATE POLICY "cache_delete_all" ON cache_entries FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cache_entries WHERE expires_at < now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_cache ON cache_entries;
CREATE TRIGGER trigger_cleanup_cache
  AFTER INSERT OR UPDATE ON cache_entries
  FOR EACH ROW EXECUTE FUNCTION cleanup_expired_cache();

-- ── 10. Mise à jour version dans app_meta ────────────────────────────────

INSERT INTO app_meta (key, value) VALUES ('version', '8500')
ON CONFLICT (key) DO UPDATE SET value = '8500', updated_at = now();

-- ✅ Migration v8500 terminée
SELECT 'NovaSound TITAN LUX v8500 — Migration appliquée avec succès ✅' AS status;
