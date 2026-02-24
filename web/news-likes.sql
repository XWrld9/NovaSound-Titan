-- ============================================================
-- TABLE news_likes — compatible avec schéma TEXT de NovaSound
-- ⚠️  IMPORTANT : votre table "news" utilise id TEXT (pas UUID)
--     Ce script est corrigé en conséquence.
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- Nettoyer si une tentative précédente a échoué
DROP TABLE IF EXISTS public.news_likes CASCADE;

CREATE TABLE public.news_likes (
  id           TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id      TEXT NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  news_id      TEXT NOT NULL REFERENCES public.news(id)   ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, news_id)  -- Un seul like par utilisateur par news
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON public.news_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON public.news_likes(news_id);

-- Row Level Security
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout le monde voit les likes)
CREATE POLICY "news_likes_select" ON public.news_likes
  FOR SELECT USING (true);

-- Insert : uniquement l'utilisateur connecté, pas l'auteur de la news
CREATE POLICY "news_likes_insert" ON public.news_likes
  FOR INSERT WITH CHECK (
    (auth.uid())::text = user_id
    AND user_id != (SELECT author_id FROM public.news WHERE id = news_id)
  );

-- Delete : uniquement celui qui a liké
CREATE POLICY "news_likes_delete" ON public.news_likes
  FOR DELETE USING ((auth.uid())::text = user_id);

-- ============================================================
-- Ajouter likes_count à news si pas encore présent
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE public.news ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
END $$;
