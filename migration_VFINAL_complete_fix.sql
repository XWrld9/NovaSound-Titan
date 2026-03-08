-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration VFINAL — Correction complète de tous les bugs
-- À exécuter en une seule fois dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. RLS sur la table `messages` (messagerie privée — FAILLE CRITIQUE) ──────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages owner read"   ON public.messages;
DROP POLICY IF EXISTS "Messages owner insert" ON public.messages;
DROP POLICY IF EXISTS "Messages owner update" ON public.messages;
DROP POLICY IF EXISTS "Messages owner delete" ON public.messages;

CREATE POLICY "Messages owner read" ON public.messages
  FOR SELECT USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

CREATE POLICY "Messages owner insert" ON public.messages
  FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

CREATE POLICY "Messages owner update" ON public.messages
  FOR UPDATE USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

CREATE POLICY "Messages owner delete" ON public.messages
  FOR DELETE USING (auth.uid()::text = sender_id);


-- ── 2. Fonction get_conversations — utilisée par MessageContext ───────────────
CREATE OR REPLACE FUNCTION public.get_conversations(p_user_id text)
RETURNS TABLE (
  other_user_id       text,
  other_username      text,
  other_avatar_url    text,
  last_message        text,
  last_message_at     timestamptz,
  last_message_sender_id text,
  unread_count        bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    other_id                                         AS other_user_id,
    u.username                                       AS other_username,
    u.avatar_url                                     AS other_avatar_url,
    last_msg.content                                 AS last_message,
    last_msg.created_at                              AS last_message_at,
    last_msg.sender_id                               AS last_message_sender_id,
    COALESCE(unread.cnt, 0)                          AS unread_count
  FROM (
    -- Tous les interlocuteurs distincts
    SELECT DISTINCT
      CASE WHEN sender_id = p_user_id THEN recipient_id ELSE sender_id END AS other_id,
      MAX(created_at) AS last_at
    FROM public.messages
    WHERE sender_id = p_user_id OR recipient_id = p_user_id
    GROUP BY other_id
  ) conv
  JOIN public.users u ON u.id = conv.other_id
  -- Dernier message
  JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM public.messages
    WHERE (sender_id = p_user_id AND recipient_id = conv.other_id)
       OR (sender_id = conv.other_id AND recipient_id = p_user_id)
    ORDER BY created_at DESC
    LIMIT 1
  ) last_msg ON true
  -- Comptage non-lus
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.messages
    WHERE sender_id = conv.other_id
      AND recipient_id = p_user_id
      AND is_read = false
  ) unread ON true
  ORDER BY last_msg.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversations(text) TO authenticated;


-- ── 3. Fonction record_play_event — utilisée par AudioPlayer ─────────────────
-- Enregistre dans song_play_events ET song_plays_history ET incrémente plays_count
DROP FUNCTION IF EXISTS public.record_play_event(text, text, integer);

CREATE OR REPLACE FUNCTION public.record_play_event(
  p_song_id    text,
  p_user_id    text    DEFAULT NULL,
  p_duration_s integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid uuid;
BEGIN
  -- Incrémenter plays_count sur songs
  UPDATE public.songs
  SET plays_count = COALESCE(plays_count, 0) + 1,
      updated_at  = NOW()
  WHERE id = p_song_id;

  -- Insérer dans song_play_events (pour trending)
  INSERT INTO public.song_play_events (song_id, user_id, played_at, duration_s)
  VALUES (p_song_id, p_user_id, NOW(), p_duration_s);

  -- Insérer dans song_plays_history si user connecté
  -- user_id est uuid dans song_plays_history → conversion
  IF p_user_id IS NOT NULL THEN
    BEGIN
      v_user_uuid := p_user_id::uuid;
      INSERT INTO public.song_plays_history (song_id, user_id, listened_at)
      VALUES (p_song_id, v_user_uuid, NOW());
    EXCEPTION WHEN OTHERS THEN
      -- Pas bloquant si la conversion uuid échoue
      NULL;
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_play_event(text, text, integer) TO authenticated, anon;


-- ── 4. Fonction increment_plays — fallback legacy ──────────────────────────────
DROP FUNCTION IF EXISTS public.increment_plays(text);

CREATE OR REPLACE FUNCTION public.increment_plays(song_id_param text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.songs
  SET plays_count = COALESCE(plays_count, 0) + 1,
      updated_at  = NOW()
  WHERE id = song_id_param;
$$;

GRANT EXECUTE ON FUNCTION public.increment_plays(text) TO authenticated, anon;


-- ── 5. Trigger mise à jour followers_count / following_count ──────────────────
CREATE OR REPLACE FUNCTION public.fn_update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
      SET followers_count = GREATEST(0, COALESCE(followers_count, 0) + 1)
      WHERE id = NEW.following_id;
    UPDATE public.users
      SET following_count = GREATEST(0, COALESCE(following_count, 0) + 1)
      WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
      SET followers_count = GREATEST(0, COALESCE(followers_count, 0) - 1)
      WHERE id = OLD.following_id;
    UPDATE public.users
      SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1)
      WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_follow_counts();


-- ── 6. Recalcul ponctuel des compteurs followers/following existants ──────────
UPDATE public.users u
SET followers_count = (
  SELECT COUNT(*) FROM public.follows WHERE following_id = u.id
);

UPDATE public.users u
SET following_count = (
  SELECT COUNT(*) FROM public.follows WHERE follower_id = u.id
);


-- ── 7. FK manquante : song_comments.song_id → songs(id) ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'song_comments_song_id_fkey'
  ) THEN
    ALTER TABLE public.song_comments
      ADD CONSTRAINT song_comments_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ── 8. Trigger mise à jour total_plays / total_likes sur users ────────────────
-- Alimente les colonnes total_plays / total_likes sur la table users
-- afin que le Leaderboard puisse les lire directement sans re-agréger

CREATE OR REPLACE FUNCTION public.fn_update_user_song_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalcule les totaux pour l'uploader concerné
  IF TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    DECLARE v_uid text;
    BEGIN
      v_uid := COALESCE(NEW.uploader_id, OLD.uploader_id);
      IF v_uid IS NOT NULL THEN
        UPDATE public.users
        SET total_plays = COALESCE((
              SELECT SUM(plays_count) FROM public.songs
              WHERE uploader_id = v_uid AND is_archived = false
            ), 0),
            total_likes = COALESCE((
              SELECT SUM(likes_count) FROM public.songs
              WHERE uploader_id = v_uid AND is_archived = false
            ), 0)
        WHERE id = v_uid;
      END IF;
    END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_song_totals ON public.songs;
CREATE TRIGGER trg_user_song_totals
  AFTER INSERT OR UPDATE OF plays_count, likes_count, is_archived OR DELETE
  ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_user_song_totals();


-- ── 9. Recalcul ponctuel de total_plays / total_likes ────────────────────────
UPDATE public.users u
SET
  total_plays = COALESCE((
    SELECT SUM(s.plays_count) FROM public.songs s
    WHERE s.uploader_id = u.id AND s.is_archived = false
  ), 0),
  total_likes = COALESCE((
    SELECT SUM(s.likes_count) FROM public.songs s
    WHERE s.uploader_id = u.id AND s.is_archived = false
  ), 0);


-- ── 10. RLS sur song_plays_history ───────────────────────────────────────────
-- Autoriser aussi les inserts anonymes (user_id = null) pour les non-connectés
DROP POLICY IF EXISTS "song_plays_history_anon_insert" ON public.song_plays_history;

CREATE POLICY "song_plays_history_anon_insert" ON public.song_plays_history
  FOR INSERT WITH CHECK (user_id IS NULL);


-- ── 11. Index supplémentaires pour performances ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created   ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv      ON public.messages(
  LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC
);
CREATE INDEX IF NOT EXISTS idx_songs_uploader_plays ON public.songs(uploader_id, plays_count DESC)
  WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_follows_both ON public.follows(follower_id, following_id);


-- ── Fin migration VFINAL ──────────────────────────────────────────────────────
-- ✅ messages RLS activée (faille sécurité critique corrigée)
-- ✅ get_conversations() créée (messagerie fonctionnelle)
-- ✅ record_play_event() créée + song_plays_history alimentée
-- ✅ increment_plays() recréée (fallback AudioPlayer)
-- ✅ Trigger followers/following_count sur follows
-- ✅ Trigger + recalcul total_plays/total_likes sur users
-- ✅ FK song_comments.song_id → songs(id)
-- ✅ Index performances messages + songs
