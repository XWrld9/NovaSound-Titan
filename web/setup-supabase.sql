-- Configuration complète NovaSound-Titan pour Supabase
-- Copiez-collez ce code dans Supabase SQL Editor
-- DERNIÈRE MISE À JOUR : 23/02/2026 - Version irréprochable

-- ========================================
-- 1. CRÉATION DES TABLES
-- ========================================

-- Table users
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Si la table users existe déjà mais n'a pas les colonnes nécessaires, les ajouter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    -- Ajouter la colonne email si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN email TEXT UNIQUE;
    END IF;
    
    -- Ajouter la colonne username si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN username TEXT UNIQUE NOT NULL DEFAULT '';
    END IF;
    
    -- Ajouter la colonne avatar_url si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    END IF;
    
    -- Ajouter la colonne bio si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN bio TEXT;
    END IF;
    
    -- Ajouter la colonne followers_count si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'followers_count' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN followers_count INTEGER DEFAULT 0;
    END IF;
    
    -- Ajouter la colonne following_count si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'following_count' AND table_schema = 'public') THEN
      ALTER TABLE public.users ADD COLUMN following_count INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- Table songs (corrigée avec audio_url au lieu de audio_file_url)
CREATE TABLE IF NOT EXISTS public.songs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  uploader_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
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

-- Table news
CREATE TABLE IF NOT EXISTS public.news (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. ACTIVATION DE RLS (Row Level Security)
-- ========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 3. POLITIQUES DE SÉCURITÉ
-- ========================================

-- Politiques pour users
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((auth.uid())::text = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK ((auth.uid())::text = id);

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

-- Politiques pour news
DROP POLICY IF EXISTS "Anyone can view news" ON public.news;
CREATE POLICY "Anyone can view news" ON public.news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own news" ON public.news;
CREATE POLICY "Users can insert own news" ON public.news FOR INSERT WITH CHECK ((auth.uid())::text = author_id);

DROP POLICY IF EXISTS "Users can update own news" ON public.news;
CREATE POLICY "Users can update own news" ON public.news FOR UPDATE USING ((auth.uid())::text = author_id);

DROP POLICY IF EXISTS "Users can delete own news" ON public.news;
CREATE POLICY "Users can delete own news" ON public.news FOR DELETE USING ((auth.uid())::text = author_id);

-- ========================================
-- 4. INDEX POUR OPTIMISATION
-- ========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_songs_uploader_id ON public.songs(uploader_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_title ON public.songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON public.songs(artist);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_song_id ON public.likes(song_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON public.news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_author_id ON public.news(author_id);

-- ========================================
-- 5. TRIGGERS POUR METTRE À JOUR LES COMPTEURS
-- ========================================

-- Trigger pour mettre à jour likes_count quand un like est ajouté/supprimé
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET likes_count = likes_count + 1 WHERE id = NEW.song_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET likes_count = likes_count - 1 WHERE id = OLD.song_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_likes_count ON public.likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- Trigger pour mettre à jour followers_count
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    UPDATE public.users SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_followers_count ON public.follows;
CREATE TRIGGER trigger_update_followers_count
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION update_followers_count();

-- ========================================
-- 6. CRÉATION DES BUCKETS STORAGE
-- ========================================

-- NOTE: Les buckets doivent être créés manuellement dans l'interface Supabase:
-- 1. Allez dans "Storage" > "Buckets"
-- 2. Créez les buckets suivants:
--    - "avatars" (pour les photos de profil)
--    - "audio" (pour les fichiers audio)
--    - "covers" (pour les pochettes d'albums)

-- Politiques pour le bucket "avatars"
-- (Créez ces politiques après avoir créé le bucket dans l'interface)

-- Politiques pour le bucket "audio"
-- (Créez ces politiques après avoir créé le bucket dans l'interface)

-- Politiques pour le bucket "covers"
-- (Créez ces politiques après avoir créé le bucket dans l'interface)

-- ========================================
-- 7. FONCTIONS UTILES
-- ========================================

-- Fonction pour créer automatiquement un profil utilisateur après inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer le profil utilisateur automatiquement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 8. NETTOYAGE
-- ========================================

-- Supprimer les anciennes colonnes si elles existent
-- (Décommentez si nécessaire)
-- ALTER TABLE public.songs DROP COLUMN IF EXISTS audio_file_url;
-- ALTER TABLE public.songs DROP COLUMN IF EXISTS album_cover_url;

-- ========================================
-- 9. VÉRIFICATION
-- ========================================

-- Vérifier que tout est bien configuré
SELECT 
  schemaname,
  tablename,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Instructions manuelles restantes:
-- 1. Créer les buckets Storage: "avatars", "audio", "covers"
-- 2. Configurer les politiques Storage pour chaque bucket
-- 3. Vérifier que les variables d'environnement sont correctes
