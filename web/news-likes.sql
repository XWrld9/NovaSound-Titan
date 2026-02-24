-- Table pour les likes sur les news
CREATE TABLE IF NOT EXISTS news_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, news_id) -- Un seul like par user par news
);

-- Index pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON news_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON news_likes(news_id);

-- Row Level Security
ALTER TABLE news_likes ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les likes
CREATE POLICY "news_likes_select" ON news_likes
  FOR SELECT USING (true);

-- Seulement l'utilisateur connecté peut liker
CREATE POLICY "news_likes_insert" ON news_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seulement l'utilisateur connecté peut enlever son like
CREATE POLICY "news_likes_delete" ON news_likes
  FOR DELETE USING (auth.uid() = user_id);
