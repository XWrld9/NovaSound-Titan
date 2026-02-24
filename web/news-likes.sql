-- ============================================================
-- TABLE news_likes + fonctions atomiques pour les compteurs
-- Compatible avec schéma TEXT de NovaSound
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

ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_likes_select" ON public.news_likes
  FOR SELECT USING (true);

CREATE POLICY "news_likes_insert" ON public.news_likes
  FOR INSERT WITH CHECK (
    (auth.uid())::text = user_id
    AND user_id != (SELECT author_id FROM public.news WHERE id = news_id)
  );

CREATE POLICY "news_likes_delete" ON public.news_likes
  FOR DELETE USING ((auth.uid())::text = user_id);

-- ============================================================
-- Colonne likes_count si absente
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
-- Fonctions atomiques (évite les race conditions)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_news_likes(news_id_param TEXT)
RETURNS void AS $$
  UPDATE public.news
  SET likes_count = (
    SELECT COUNT(*) FROM public.news_likes WHERE news_id = news_id_param
  )
  WHERE id = news_id_param;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_news_likes(news_id_param TEXT)
RETURNS void AS $$
  UPDATE public.news
  SET likes_count = (
    SELECT COUNT(*) FROM public.news_likes WHERE news_id = news_id_param
  )
  WHERE id = news_id_param;
$$ LANGUAGE sql SECURITY DEFINER;
