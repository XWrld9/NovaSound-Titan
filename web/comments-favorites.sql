-- ============================================================
-- comments-favorites.sql — NovaSound TITAN LUX v9.0
-- 1. Table favorites (séparée des likes)
-- 2. Table song_comments avec likes, reports, édition
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. TABLE FAVORITES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorites (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  song_id    TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_song_id ON public.favorites(song_id);

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid()::text = user_id);

-- ── 2. TABLE SONG_COMMENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.song_comments (
  id          BIGSERIAL PRIMARY KEY,
  song_id     TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 800),
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_edited   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comments_song_id   ON public.song_comments(song_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id   ON public.song_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.song_comments(created_at DESC);

-- Lecture publique
DROP POLICY IF EXISTS "Anyone can view comments" ON public.song_comments;
CREATE POLICY "Anyone can view comments"
  ON public.song_comments FOR SELECT USING (true);

-- Insertion : utilisateur connecté uniquement
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.song_comments;
CREATE POLICY "Authenticated users can insert comments"
  ON public.song_comments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Mise à jour (édition) : auteur du commentaire uniquement
DROP POLICY IF EXISTS "Author can edit own comment" ON public.song_comments;
CREATE POLICY "Author can edit own comment"
  ON public.song_comments FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Suppression : auteur OU admin
DROP POLICY IF EXISTS "Author or admin can delete comment" ON public.song_comments;
CREATE POLICY "Author or admin can delete comment"
  ON public.song_comments FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- ── 3. TABLE COMMENT_LIKES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  comment_id BIGINT NOT NULL REFERENCES public.song_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id    ON public.comment_likes(user_id);

DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.comment_likes;
CREATE POLICY "Anyone can view comment likes"
  ON public.comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users can manage own comment likes"
  ON public.comment_likes FOR ALL
  USING (auth.uid()::text = user_id);

-- ── 4. TRIGGER — likes_count auto sur song_comments ─────────
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.song_comments
      SET likes_count = likes_count + 1
      WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.song_comments
      SET likes_count = GREATEST(0, likes_count - 1)
      WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_comment_likes ON public.comment_likes;
CREATE TRIGGER trigger_update_comment_likes
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- ── 5. TRIGGER — updated_at auto sur song_comments ──────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_comment_updated_at ON public.song_comments;
CREATE TRIGGER trigger_set_comment_updated_at
  BEFORE UPDATE ON public.song_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. Activer Realtime sur les nouvelles tables ─────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
