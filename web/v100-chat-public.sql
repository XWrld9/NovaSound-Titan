-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v100
-- Chat Public Global — boîte de conversation commune à tous
-- ═══════════════════════════════════════════════════════════════════

-- ── Table chat_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  reply_to_id  UUID        REFERENCES chat_messages(id) ON DELETE SET NULL,
  reply_to_content TEXT,        -- snapshot du message cité (au cas où l'original est supprimé)
  reply_to_username TEXT,       -- snapshot du nom de l'auteur cité
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted   BOOLEAN     NOT NULL DEFAULT false  -- soft delete
);

-- Index pour pagination par date
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON chat_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
  ON chat_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── RLS chat_messages ────────────────────────────────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (connecté ou non)
CREATE POLICY "chat_select_all" ON chat_messages
  FOR SELECT USING (true);

-- Envoyer uniquement en tant que soi-même, connecté
CREATE POLICY "chat_insert_own" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Soft-delete : seul l'auteur ou l'admin peut marquer is_deleted=true
CREATE POLICY "chat_delete_own" ON chat_messages
  FOR UPDATE USING (
    auth.uid()::text = user_id
    OR auth.uid() IN (
      SELECT id::uuid FROM users WHERE email = 'eloadxfamily@gmail.com'
    )
  )
  WITH CHECK (true);

-- ── Réactions aux messages ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id  UUID  NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     TEXT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT  NOT NULL CHECK (char_length(emoji) <= 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_all" ON chat_reactions
  FOR SELECT USING (true);

CREATE POLICY "reactions_insert_own" ON chat_reactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "reactions_delete_own" ON chat_reactions
  FOR DELETE USING (auth.uid()::text = user_id);

-- ── Activer Realtime sur les deux tables ─────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;

-- ── FIX BUG v70 : RLS messages privés (UUID vs TEXT) ─────────────
-- Le problème : auth.uid() retourne UUID, sender_id est TEXT
-- Certains builds Supabase refusent le cast implicite → on recrée les policies
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (
    auth.uid()::text = sender_id OR auth.uid()::text = recipient_id
  );

DROP POLICY IF EXISTS "messages_update_read" ON messages;
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (auth.uid()::text = recipient_id)
  WITH CHECK (auth.uid()::text = recipient_id);

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (auth.uid()::text = sender_id);

