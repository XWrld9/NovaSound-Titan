-- ══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration V150001
-- À exécuter dans Supabase SQL Editor après V130000
-- ══════════════════════════════════════════════════════════════════════════════
-- ✅ Crée la table news_comments (manquante → 400 Bad Request)
-- ✅ Crée la table news_comment_likes (manquante → 400 Bad Request)
-- ✅ RLS complet sur les deux tables (lecture publique / écriture propriétaire / admin bypass)
-- ✅ Realtime activé sur news_comments
-- ✅ Index de performance
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table news_comments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id     uuid        NOT NULL REFERENCES public.news(id)     ON DELETE CASCADE,
  user_id     text        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  likes_count integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

-- ── 2. Table news_comment_likes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_comment_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid        NOT NULL REFERENCES public.news_comments(id) ON DELETE CASCADE,
  user_id     text        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

-- ── 3. Index de performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_news_comments_news_id    ON public.news_comments(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id    ON public.news_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_created    ON public.news_comments(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_news_comment_likes_cmt   ON public.news_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_news_comment_likes_user  ON public.news_comment_likes(user_id);

-- ── 4. Trigger updated_at sur news_comments ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_comments_updated_at ON public.news_comments;
CREATE TRIGGER trg_news_comments_updated_at
  BEFORE UPDATE ON public.news_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Trigger pour maintenir likes_count à jour ──────────────────────────────
CREATE OR REPLACE FUNCTION public.update_news_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_comments
    SET    likes_count = likes_count + 1
    WHERE  id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news_comments
    SET    likes_count = GREATEST(0, likes_count - 1)
    WHERE  id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_comment_likes_count ON public.news_comment_likes;
CREATE TRIGGER trg_news_comment_likes_count
  AFTER INSERT OR DELETE ON public.news_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_news_comment_likes_count();

-- ── 6. RLS sur news_comments ──────────────────────────────────────────────────
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "News comments public read"   ON public.news_comments;
DROP POLICY IF EXISTS "News comments owner write"   ON public.news_comments;
DROP POLICY IF EXISTS "News comments owner delete"  ON public.news_comments;

-- Lecture publique (pour afficher les commentaires à tous)
CREATE POLICY "News comments public read"
  ON public.news_comments FOR SELECT
  USING (true);

-- Création : utilisateur connecté seulement
CREATE POLICY "News comments owner insert"
  ON public.news_comments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Modification : propriétaire OU admin
CREATE POLICY "News comments owner update"
  ON public.news_comments FOR UPDATE
  USING (
    auth.uid()::text = user_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- Suppression : propriétaire OU admin
CREATE POLICY "News comments owner delete"
  ON public.news_comments FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- ── 7. RLS sur news_comment_likes ─────────────────────────────────────────────
ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "News comment likes public read"   ON public.news_comment_likes;
DROP POLICY IF EXISTS "News comment likes owner write"   ON public.news_comment_likes;

CREATE POLICY "News comment likes public read"
  ON public.news_comment_likes FOR SELECT
  USING (true);

CREATE POLICY "News comment likes owner write"
  ON public.news_comment_likes FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ── 8. Realtime sur news_comments ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'news_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comments;
  END IF;
END $$;

-- ── 9. Realtime sur news (pour rafraîchissement auto) ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'news'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
  END IF;
END $$;

-- ── 10. Colonne likes_count sur news (si absente) ─────────────────────────────
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- ── Fin V150001 ───────────────────────────────────────────────────────────────
-- ✅ news_comments créée avec likes_count automatique via trigger
-- ✅ news_comment_likes créée avec contrainte UNIQUE
-- ✅ RLS lecture publique + écriture propriétaire + bypass admin
-- ✅ Realtime activé sur news_comments et news
-- ✅ Index de performance
