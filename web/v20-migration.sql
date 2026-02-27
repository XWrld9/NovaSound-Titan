-- ============================================================
-- NovaSound TITAN LUX — Migration v20
-- Nouvelles colonnes : genre, duration_s sur la table songs
-- À exécuter dans Supabase SQL Editor (étape 10)
-- ============================================================

-- 1. Colonnes genre et durée
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS genre      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_s INTEGER DEFAULT NULL;

-- 2. Index sur genre pour filtrage rapide dans l'Explorer
CREATE INDEX IF NOT EXISTS idx_songs_genre
  ON public.songs(genre)
  WHERE genre IS NOT NULL AND is_archived = false;

-- 3. Mise à jour du tri "Plus aimés" : assurer que likes_count est indexé
CREATE INDEX IF NOT EXISTS idx_songs_likes_count
  ON public.songs(likes_count DESC NULLS LAST)
  WHERE is_archived = false;

-- 4. Index plays_count pour le Top 3 homepage (déjà présent dans la plupart des cas,
--    on crée si absent)
CREATE INDEX IF NOT EXISTS idx_songs_plays_count
  ON public.songs(plays_count DESC NULLS LAST)
  WHERE is_archived = false;

-- ============================================================
-- Genres disponibles côté front (référence non contraignante)
-- 'Afrobeats','Hip-Hop','R&B','Pop','Électronique','Trap',
-- 'Gospel','Jazz','Reggae','Dancehall','Amapiano','Coupé-Décalé',
-- 'Rock','Classique','Folk','Latin','Drill'
-- ============================================================
-- FIN
