-- ========================================
-- NETTOYAGE COMPLET AVANT SETUP
-- Supprime toutes les tables et politiques existantes
-- ========================================

-- Désactiver tous les triggers
DROP TRIGGER IF EXISTS trigger_update_song_likes_count ON public.likes;
DROP TRIGGER IF EXISTS trigger_update_followers_count ON public.follows;
DROP TRIGGER IF EXISTS trigger_update_live_room_likes_count ON live_room_likes;
DROP TRIGGER IF EXISTS trigger_update_live_room_participants_count ON live_room_participants;

-- Supprimer les tables dans l'ordre correct (inverse des foreign keys)
DROP TABLE IF EXISTS live_room_participants CASCADE;
DROP TABLE IF EXISTS live_room_likes CASCADE;
DROP TABLE IF EXISTS live_rooms CASCADE;
DROP TABLE IF EXISTS public.follows CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.songs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS update_song_likes_count() CASCADE;
DROP FUNCTION IF EXISTS update_followers_count() CASCADE;
DROP FUNCTION IF EXISTS update_live_room_likes_count() CASCADE;
DROP FUNCTION IF EXISTS update_live_room_participants_count() CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Nettoyage complet terminé - prêt pour setup neuf';
END $$;
