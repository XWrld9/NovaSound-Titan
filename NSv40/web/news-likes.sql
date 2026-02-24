-- ============================================================
-- TABLE news_likes + trigger auto pour likes_count
-- Compatible schéma TEXT de NovaSound
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

DROP TABLE IF EXISTS public.news_likes CASCADE;

CREATE TABLE public.news_likes (
  id           TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id      TEXT NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  news_id      TEXT NOT NULL REFERENCES public.news(id)   ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON public.news_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON public.news_likes(news_id);

-- RLS
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_likes_select" ON public.news_likes
  FOR SELECT USING (true);

-- Tout utilisateur connecté peut liker sauf l'auteur
CREATE POLICY "news_likes_insert" ON public.news_likes
  FOR INSERT WITH CHECK (
    (auth.uid())::text = user_id
    AND user_id != (SELECT author_id FROM public.news WHERE id = news_id)
  );

CREATE POLICY "news_likes_delete" ON public.news_likes
  FOR DELETE USING ((auth.uid())::text = user_id);

-- ============================================================
-- Colonne likes_count sur news si absente
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE public.news ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- Trigger atomique pour maintenir news.likes_count
-- (même pattern que le trigger update_likes_count pour songs)
-- Pas besoin d'update manuel dans le code JS
-- ============================================================
CREATE OR REPLACE FUNCTION update_news_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news SET likes_count = likes_count + 1 WHERE id = NEW.news_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.news_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_news_likes_count ON public.news_likes;
CREATE TRIGGER trigger_update_news_likes_count
  AFTER INSERT OR DELETE ON public.news_likes
  FOR EACH ROW EXECUTE FUNCTION update_news_likes_count();
