-- Création de toutes les tables NovaSound-Titan
-- Copiez-collez ce code dans Supabase SQL Editor

-- Table users
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table songs
CREATE TABLE IF NOT EXISTS public.songs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  uploader_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  audio_file_url TEXT NOT NULL,
  album_cover_url TEXT,
  plays_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table likes
CREATE TABLE IF NOT EXISTS public.likes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  song_id TEXT REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, song_id)
);

-- Table follows
CREATE TABLE IF NOT EXISTS public.follows (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  follower_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  following_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- Activer RLS sur toutes les tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Politiques pour users
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((auth.uid())::text = id);

-- Politiques pour songs
DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
CREATE POLICY "Anyone can view songs" ON public.songs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own songs" ON public.songs;
CREATE POLICY "Users can insert own songs" ON public.songs FOR INSERT WITH CHECK ((auth.uid())::text = uploader_id);

DROP POLICY IF EXISTS "Users can update own songs" ON public.songs;
CREATE POLICY "Users can update own songs" ON public.songs FOR UPDATE USING ((auth.uid())::text = uploader_id);

DROP POLICY IF EXISTS "Users can delete own songs" ON public.songs;
CREATE POLICY "Users can delete own songs" ON public.songs FOR DELETE USING ((auth.uid())::text = uploader_id);

-- Politiques pour likes
DROP POLICY IF EXISTS "Users can view all likes" ON public.likes;
CREATE POLICY "Users can view all likes" ON public.likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON public.likes;
CREATE POLICY "Users can manage own likes" ON public.likes FOR ALL USING ((auth.uid())::text = user_id);

-- Politiques pour follows
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
CREATE POLICY "Users can view all follows" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON public.follows;
CREATE POLICY "Users can manage own follows" ON public.follows FOR ALL USING ((auth.uid())::text = follower_id);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_songs_uploader_id ON public.songs(uploader_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_song_id ON public.likes(song_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
