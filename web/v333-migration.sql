-- ================================================================
-- v333-migration.sql — NovaSound TITAN LUX v333
-- Corrections & améliorations : notifications, chat, trending
-- ⚠️  À exécuter UNE SEULE FOIS dans le SQL Editor Supabase
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- PARTIE A : NOTIFICATIONS — ajouter chat_mention_all si absent
-- ════════════════════════════════════════════════════════════════

-- A1. Mettre à jour la contrainte CHECK (idempotent)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like', 'comment', 'follow', 'new_song', 'news',
    'chat_reply', 'chat_mention', 'chat_mention_all'
  ));

-- A2. S'assurer que metadata existe
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata TEXT;

-- ════════════════════════════════════════════════════════════════
-- PARTIE B : CHAT — colonne is_edited pour les messages modifiés
-- ════════════════════════════════════════════════════════════════

-- B1. Ajouter is_edited sur chat_messages (flag persistant en DB)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;

-- B2. Index pour recherche rapide des messages édités
CREATE INDEX IF NOT EXISTS idx_chat_messages_edited
  ON public.chat_messages(is_edited)
  WHERE is_edited = TRUE;

-- B3. Fonction RPC pour éditer un message (respect contrainte auteur + 20min)
CREATE OR REPLACE FUNCTION edit_chat_message(
  p_message_id TEXT,
  p_user_id    TEXT,
  p_content    TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
  v_owner      TEXT;
BEGIN
  SELECT user_id, created_at INTO v_owner, v_created_at
    FROM public.chat_messages
   WHERE id = p_message_id AND is_deleted = FALSE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_owner <> p_user_id THEN RETURN FALSE; END IF;
  IF NOW() - v_created_at > INTERVAL '20 minutes' THEN RETURN FALSE; END IF;

  UPDATE public.chat_messages
     SET content = p_content, is_edited = TRUE
   WHERE id = p_message_id;

  RETURN TRUE;
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- PARTIE C : TRENDING — vues matérialisées optimisées
--            (si les vues trending_24h, trending_7d, trending_30d
--             existent déjà, on les rafraîchit / recréons)
-- ════════════════════════════════════════════════════════════════

-- C1. Vue 24h (incluant likes_count)
CREATE OR REPLACE VIEW public.trending_24h AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count
      FROM public.likes
     WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE
    AND s.is_deleted  = FALSE
    AND s.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY score DESC
  LIMIT 20;

-- C2. Vue 7 jours
CREATE OR REPLACE VIEW public.trending_7d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count
      FROM public.likes
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE
    AND s.is_deleted  = FALSE
  ORDER BY score DESC
  LIMIT 20;

-- C3. Vue 30 jours
CREATE OR REPLACE VIEW public.trending_30d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count
      FROM public.likes
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE
    AND s.is_deleted  = FALSE
  ORDER BY score DESC
  LIMIT 20;

-- C4. RLS sur les vues (lecture publique)
GRANT SELECT ON public.trending_24h  TO anon, authenticated;
GRANT SELECT ON public.trending_7d   TO anon, authenticated;
GRANT SELECT ON public.trending_30d  TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- PARTIE D : REALTIME — s'assurer que tout est activé
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- chat_reactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
  END IF;

  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  -- notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- ✅  Migration v333 terminée
-- ================================================================
