-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v70
-- Features : Messages Privés + Radio Mode (no SQL) + Stats (no SQL)
-- ═══════════════════════════════════════════════════════════════════

-- ── Table messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  is_read       BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes de conversation (les deux sens)
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient
  ON messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread
  ON messages(recipient_id, is_read, created_at DESC);

-- ── RLS messages ─────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Voir uniquement ses propres messages (envoyés ou reçus)
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (
    auth.uid()::text = sender_id OR auth.uid()::text = recipient_id
  );

-- Envoyer uniquement en tant que soi-même
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

-- Marquer comme lu uniquement si destinataire
CREATE POLICY "messages_update_read" ON messages
  FOR UPDATE USING (auth.uid()::text = recipient_id)
  WITH CHECK (auth.uid()::text = recipient_id);

-- Supprimer uniquement ses propres messages (expéditeur)
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (auth.uid()::text = sender_id);

-- ── Fonction RPC get_conversations ───────────────────────────────
-- Retourne la liste des conversations de l'utilisateur avec le
-- dernier message et le nombre de messages non lus
CREATE OR REPLACE FUNCTION get_conversations(p_user_id TEXT)
RETURNS TABLE (
  other_user_id         TEXT,
  other_user            JSONB,
  last_message          TEXT,
  last_message_at       TIMESTAMPTZ,
  last_message_sender_id TEXT,
  unread_count          BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH conversations AS (
    SELECT
      CASE
        WHEN sender_id = p_user_id THEN recipient_id
        ELSE sender_id
      END AS other_user_id,
      content,
      created_at,
      sender_id,
      is_read,
      ROW_NUMBER() OVER (
        PARTITION BY CASE WHEN sender_id = p_user_id THEN recipient_id ELSE sender_id END
        ORDER BY created_at DESC
      ) AS rn
    FROM messages
    WHERE sender_id = p_user_id OR recipient_id = p_user_id
  ),
  latest AS (
    SELECT * FROM conversations WHERE rn = 1
  ),
  unread AS (
    SELECT sender_id AS other_user_id, COUNT(*) AS cnt
    FROM messages
    WHERE recipient_id = p_user_id AND is_read = false
    GROUP BY sender_id
  )
  SELECT
    l.other_user_id,
    jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS other_user,
    l.content AS last_message,
    l.created_at AS last_message_at,
    l.sender_id AS last_message_sender_id,
    COALESCE(ur.cnt, 0) AS unread_count
  FROM latest l
  JOIN users u ON u.id = l.other_user_id
  LEFT JOIN unread ur ON ur.other_user_id = l.other_user_id
  ORDER BY l.created_at DESC;
$$;

-- ── Notifications push pour nouveaux messages ────────────────────
-- (La fonction notify_new_message sera appelée par un trigger)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, icon_url, url)
  SELECT
    NEW.recipient_id,
    'message',
    COALESCE(u.username, 'Quelqu''un') || ' vous a envoyé un message',
    LEFT(NEW.content, 100),
    u.avatar_url,
    '/messages'
  FROM users u WHERE u.id = NEW.sender_id;
  RETURN NEW;
END;
$$;

-- Trigger message → notification (si pas déjà existant)
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- ── Commentaire fin ──────────────────────────────────────────────
-- Radio Mode : aucun SQL requis (logique côté client dans PlayerContext)
-- Stats Artiste : aucun SQL requis (lecture des tables existantes)

-- ── Colonne social_links sur users (idempotent) ───────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- ── INDEX FTS supplémentaires ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_username_fts
  ON public.users USING GIN (to_tsvector('simple', coalesce(username, '')));
