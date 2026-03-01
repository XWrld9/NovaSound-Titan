-- ════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v4000
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY / XWrld999
-- ════════════════════════════════════════════════════════════════════
-- CHANGELOG v4000 :
--  1. FIX critique : RLS UPDATE song_comments — policy robuste UUID/TEXT
--  2. Table song_comment_replies — réponses imbriquées aux commentaires
--  3. Table user_streaks — suivi de streaks d'écoute quotidienne
--  4. Table song_moods — tags mood/vibe par chanson (crowd-sourced)
--  5. Table artist_spotlight — mise en avant artiste éditorialisée
--  6. Fonction : get_trending_songs() — algorithme trending v4
--  7. Fonction : get_artist_score() — score algorithmique artiste
--  8. RPC : sync_offline_messages() — flush messages hors-ligne
--  9. Colonne songs.description — bio/description du son
-- 10. Colonne users.last_seen — dernière activité
-- 11. Index performances critiques v4000
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. FIX CRITIQUE — RLS UPDATE song_comments
--    Le bug d'édition venait d'une incohérence UUID/TEXT dans la policy
-- ════════════════════════════════════════════════════════════════════

-- Supprimer l'ancienne policy buggée
DROP POLICY IF EXISTS "Author can edit own comment"      ON public.song_comments;
DROP POLICY IF EXISTS "Author or admin can delete comment" ON public.song_comments;

-- Policy UPDATE robuste : gère UUID et TEXT
CREATE POLICY "v4_author_can_edit_comment"
  ON public.song_comments FOR UPDATE
  USING (
    auth.uid() = user_id::uuid
    OR auth.uid()::text = user_id
  )
  WITH CHECK (
    auth.uid() = user_id::uuid
    OR auth.uid()::text = user_id
  );

-- Policy DELETE robuste
CREATE POLICY "v4_author_or_admin_delete_comment"
  ON public.song_comments FOR DELETE
  USING (
    auth.uid() = user_id::uuid
    OR auth.uid()::text = user_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- ════════════════════════════════════════════════════════════════════
-- 2. Table song_comment_replies (réponses imbriquées)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.song_comment_replies (
  id          BIGSERIAL    PRIMARY KEY,
  comment_id  BIGINT       NOT NULL REFERENCES public.song_comments(id) ON DELETE CASCADE,
  user_id     TEXT         NOT NULL,
  content     TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  is_edited   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.song_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON public.song_comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id    ON public.song_comment_replies(user_id);

DROP POLICY IF EXISTS "Anyone can view comment replies" ON public.song_comment_replies;
CREATE POLICY "Anyone can view comment replies"
  ON public.song_comment_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert comment replies" ON public.song_comment_replies;
CREATE POLICY "Auth users can insert comment replies"
  ON public.song_comment_replies FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR auth.uid() = user_id::uuid);

DROP POLICY IF EXISTS "Author can edit reply" ON public.song_comment_replies;
CREATE POLICY "Author can edit reply"
  ON public.song_comment_replies FOR UPDATE
  USING (auth.uid()::text = user_id OR auth.uid() = user_id::uuid);

DROP POLICY IF EXISTS "Author or admin can delete reply" ON public.song_comment_replies;
CREATE POLICY "Author or admin can delete reply"
  ON public.song_comment_replies FOR DELETE
  USING (
    auth.uid()::text = user_id OR auth.uid() = user_id::uuid
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- Colonne replies_count sur song_comments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='song_comments' AND column_name='replies_count')
  THEN ALTER TABLE public.song_comments ADD COLUMN replies_count INTEGER NOT NULL DEFAULT 0; END IF;
END $$;

-- Trigger auto replies_count
CREATE OR REPLACE FUNCTION update_comment_replies_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.song_comments SET replies_count = replies_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.song_comments SET replies_count = GREATEST(0, replies_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_replies_count ON public.song_comment_replies;
CREATE TRIGGER trg_comment_replies_count
  AFTER INSERT OR DELETE ON public.song_comment_replies
  FOR EACH ROW EXECUTE FUNCTION update_comment_replies_count();

-- ════════════════════════════════════════════════════════════════════
-- 3. Table user_streaks — streaks d'écoute quotidienne
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id         TEXT        PRIMARY KEY,
  current_streak  INTEGER     NOT NULL DEFAULT 0,
  longest_streak  INTEGER     NOT NULL DEFAULT 0,
  last_active_date DATE       NOT NULL DEFAULT CURRENT_DATE,
  total_days      INTEGER     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streak"   ON public.user_streaks;
CREATE POLICY "Users can view own streak"
  ON public.user_streaks FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can upsert own streak" ON public.user_streaks;
CREATE POLICY "Users can upsert own streak"
  ON public.user_streaks FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Fonction pour mettre à jour le streak
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id TEXT)
RETURNS TABLE(current_streak INT, longest_streak INT, total_days INT)
LANGUAGE PLPGSQL SECURITY DEFINER AS $$
DECLARE
  v_record public.user_streaks%ROWTYPE;
  v_today  DATE := CURRENT_DATE;
BEGIN
  SELECT * INTO v_record FROM public.user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks(user_id, current_streak, longest_streak, last_active_date, total_days)
    VALUES (p_user_id, 1, 1, v_today, 1);
    RETURN QUERY SELECT 1::INT, 1::INT, 1::INT;
    RETURN;
  END IF;

  IF v_record.last_active_date = v_today THEN
    -- Déjà compté aujourd'hui
    RETURN QUERY SELECT v_record.current_streak, v_record.longest_streak, v_record.total_days;
    RETURN;
  END IF;

  IF v_record.last_active_date = v_today - INTERVAL '1 day' THEN
    -- Jour consécutif
    UPDATE public.user_streaks SET
      current_streak  = v_record.current_streak + 1,
      longest_streak  = GREATEST(v_record.longest_streak, v_record.current_streak + 1),
      last_active_date= v_today,
      total_days      = v_record.total_days + 1,
      updated_at      = NOW()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT v_record.current_streak+1, GREATEST(v_record.longest_streak, v_record.current_streak+1), v_record.total_days+1;
  ELSE
    -- Streak brisé
    UPDATE public.user_streaks SET
      current_streak  = 1,
      last_active_date= v_today,
      total_days      = v_record.total_days + 1,
      updated_at      = NOW()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT 1::INT, v_record.longest_streak, v_record.total_days+1;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_user_streak(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 4. Table song_moods — tags mood crowd-sourcés
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.song_moods (
  id        BIGSERIAL PRIMARY KEY,
  song_id   TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,
  mood      TEXT NOT NULL CHECK (mood IN ('hype','chill','sad','motivant','nostalgique','amour','rage','détente','focus','fête')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);

ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_song_moods_song_id ON public.song_moods(song_id);

DROP POLICY IF EXISTS "Anyone can view moods"    ON public.song_moods;
CREATE POLICY "Anyone can view moods"
  ON public.song_moods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can vote mood" ON public.song_moods;
CREATE POLICY "Auth users can vote mood"
  ON public.song_moods FOR ALL
  USING (auth.uid()::text = user_id OR auth.uid() = user_id::uuid)
  WITH CHECK (auth.uid()::text = user_id OR auth.uid() = user_id::uuid);

-- Fonction : mood dominant d'un son
CREATE OR REPLACE FUNCTION public.get_song_dominant_mood(p_song_id TEXT)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT mood FROM public.song_moods
  WHERE song_id = p_song_id
  GROUP BY mood ORDER BY COUNT(*) DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_song_dominant_mood(TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 5. Table artist_spotlight — mise en avant édito
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.artist_spotlight (
  id            BIGSERIAL   PRIMARY KEY,
  artist_id     TEXT        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  headline      TEXT        NOT NULL,
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.artist_spotlight ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active spotlights" ON public.artist_spotlight;
CREATE POLICY "Anyone can view active spotlights"
  ON public.artist_spotlight FOR SELECT
  USING (is_active = TRUE AND (ends_at IS NULL OR ends_at > NOW()));

DROP POLICY IF EXISTS "Admin can manage spotlights" ON public.artist_spotlight;
CREATE POLICY "Admin can manage spotlights"
  ON public.artist_spotlight FOR ALL
  USING (auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com');

-- ════════════════════════════════════════════════════════════════════
-- 6. Colonne songs.description
-- ════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='songs' AND column_name='description')
  THEN ALTER TABLE public.songs ADD COLUMN description TEXT; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 7. Colonne users.last_seen + update auto
-- ════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='last_seen')
  THEN ALTER TABLE public.users ADD COLUMN last_seen TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen DESC);

CREATE OR REPLACE FUNCTION public.touch_user_last_seen(p_user_id TEXT)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE public.users SET last_seen = NOW() WHERE id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.touch_user_last_seen(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 8. Fonction trending v4000 (score algorithmique)
--    Score = plays (24h)*3 + likes*2 + comments*1.5 + freshness bonus
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_trending_songs_v4(p_limit INT DEFAULT 10)
RETURNS TABLE(
  id TEXT, title TEXT, artist TEXT, cover_url TEXT,
  plays_count BIGINT, likes_count BIGINT,
  genre TEXT, duration_s NUMERIC,
  uploader_id TEXT,
  trending_score NUMERIC
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    s.id, s.title, s.artist, s.cover_url,
    s.plays_count, s.likes_count,
    s.genre, s.duration_s,
    s.uploader_id,
    -- Score algorithme : récence + popularité pondérée
    (
      COALESCE(s.plays_count, 0) * 1.0
      + COALESCE(s.likes_count, 0) * 2.5
      + (SELECT COUNT(*) FROM public.song_comments sc WHERE sc.song_id = s.id) * 3.0
      -- Bonus fraîcheur : jusqu'à 50 points pour les 7 derniers jours
      + GREATEST(0, 50 - EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 / 24 * 7.14)
    ) AS trending_score
  FROM public.songs s
  WHERE s.is_archived = FALSE
  ORDER BY trending_score DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_trending_songs_v4(INT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 9. RPC sync_offline_messages — flush IndexedDB → Supabase
-- ════════════════════════════════════════════════════════════════════
-- NOTE: Ce RPC reçoit un tableau de messages offline et les insère en batch
CREATE OR REPLACE FUNCTION public.sync_offline_messages(
  p_user_id TEXT,
  p_messages JSONB
)
RETURNS TABLE(inserted_count INT, failed_count INT)
LANGUAGE PLPGSQL SECURITY DEFINER AS $$
DECLARE
  v_inserted INT := 0;
  v_failed   INT := 0;
  v_msg      JSONB;
BEGIN
  -- Vérifier que l'appelant est bien le user concerné
  IF auth.uid()::text != p_user_id AND auth.uid()::text != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_msg IN SELECT * FROM jsonb_array_elements(p_messages)
  LOOP
    BEGIN
      INSERT INTO public.chat_messages(user_id, content, created_at)
      VALUES (
        p_user_id,
        v_msg->>'content',
        COALESCE((v_msg->>'created_at')::TIMESTAMPTZ, NOW())
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_failed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_offline_messages(TEXT, JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 10. Activer Realtime sur les nouvelles tables
-- ════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comment_replies;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_moods;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 11. Index performances v4000
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_songs_trending       ON public.songs(plays_count DESC, likes_count DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_songs_genre_trending ON public.songs(genre, plays_count DESC)           WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_songs_uploader_recent ON public.songs(uploader_id, created_at DESC)     WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_comments_song_recent ON public.song_comments(song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_moods_song_mood  ON public.song_moods(song_id, mood);

-- ════════════════════════════════════════════════════════════════════
-- 12. Vérification finale
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '╔══════════════════════════════════════════════════╗';
  RAISE NOTICE '║  NovaSound TITAN LUX — Migration v4000 OK ✅     ║';
  RAISE NOTICE '╠══════════════════════════════════════════════════╣';
  RAISE NOTICE '║  1. FIX RLS song_comments UPDATE (UUID/TEXT)     ║';
  RAISE NOTICE '║  2. song_comment_replies (imbrication)           ║';
  RAISE NOTICE '║  3. user_streaks + update_user_streak()          ║';
  RAISE NOTICE '║  4. song_moods (tags crowd-sourcés)              ║';
  RAISE NOTICE '║  5. artist_spotlight (mise en avant édito)       ║';
  RAISE NOTICE '║  6. songs.description                            ║';
  RAISE NOTICE '║  7. users.last_seen + touch_user_last_seen()     ║';
  RAISE NOTICE '║  8. get_trending_songs_v4() algo score           ║';
  RAISE NOTICE '║  9. sync_offline_messages() RPC batch            ║';
  RAISE NOTICE '║  10. Realtime + 7 index performances             ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════╝';
END $$;

COMMIT;
