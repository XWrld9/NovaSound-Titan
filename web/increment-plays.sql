-- ============================================================
-- Fonction atomique pour incrémenter les écoutes d'un morceau
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION increment_plays(song_id_param TEXT)
RETURNS void AS $$
  UPDATE public.songs
  SET plays_count = COALESCE(plays_count, 0) + 1
  WHERE id = song_id_param;
$$ LANGUAGE sql SECURITY DEFINER;
