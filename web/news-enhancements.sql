-- Table pour les likes sur les news
CREATE TABLE IF NOT EXISTS public.news_likes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  news_id TEXT REFERENCES public.news(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

-- Table pour les commentaires sur les news
CREATE TABLE IF NOT EXISTS public.news_comments (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  news_id TEXT REFERENCES public.news(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter catégories à la table news
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index pour les nouvelles fonctionnalités
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON public.news_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON public.news_likes(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON public.news_comments(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id ON public.news_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news(category);
CREATE INDEX IF NOT EXISTS idx_news_featured ON public.news(featured);
