-- ============================================================
-- NovaSound TITAN LUX — v20 : Genres, Tags, Durée
-- À exécuter en étape 9 dans Supabase SQL Editor
-- ============================================================

-- 1. Ajouter les colonnes à la table songs
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS genre       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags        TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_s  INTEGER DEFAULT NULL;

-- 2. Index sur genre pour le filtre Explorer
CREATE INDEX IF NOT EXISTS idx_songs_genre ON public.songs(genre)
  WHERE genre IS NOT NULL;

-- 3. Index GIN sur tags pour les recherches par tag
CREATE INDEX IF NOT EXISTS idx_songs_tags ON public.songs USING GIN(tags);

-- 4. Genres disponibles (référence)
-- Utilisés côté front pour le sélecteur — aucune contrainte DB pour rester flexible.
-- Valeurs : 'Afrobeats', 'Hip-Hop', 'R&B', 'Pop', 'Électronique', 'Trap',
--           'Gospel', 'Jazz', 'Reggae', 'Dancehall', 'Amapiano', 'Coupé-Décalé',
--           'Rock', 'Classique', 'Folk', 'Country', 'Latin', 'Drill', 'Outro'

-- 5. Vue publique "songs avec genre" pour l'Explorer (lecture optimisée)
-- Pas obligatoire mais utile pour des requêtes futures
-- CREATE OR REPLACE VIEW public.songs_public AS
--   SELECT * FROM public.songs WHERE is_archived = false AND is_deleted = false;

-- ============================================================
-- FIN
-- ============================================================
