-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v30
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Index supplémentaires pour les nouvelles requêtes de découverte
CREATE INDEX IF NOT EXISTS idx_songs_genre_plays ON songs(genre, plays_count DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_songs_uploader_created ON songs(uploader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_likes_count ON songs(likes_count DESC) WHERE is_archived = FALSE;

-- 2. Colonne bio_url (lien externe artiste — optionnel)
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_url TEXT;

-- 3. Vue "spotlight" — top 5 sons récents (< 14 jours) par popularité combinée
CREATE OR REPLACE VIEW spotlight_songs AS
SELECT *,
  (plays_count * 0.6 + likes_count * 0.4) AS score
FROM songs
WHERE is_archived = FALSE
  AND created_at > NOW() - INTERVAL '14 days'
ORDER BY score DESC
LIMIT 5;

-- Grant public access
GRANT SELECT ON spotlight_songs TO anon, authenticated;

-- 4. Fonction RPC pour les stats artiste (aggregate songs en 1 appel)
CREATE OR REPLACE FUNCTION get_artist_stats(artist_id UUID)
RETURNS TABLE(
  total_plays   BIGINT,
  total_likes   BIGINT,
  songs_count   BIGINT,
  followers_cnt BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(s.plays_count), 0)  AS total_plays,
    COALESCE(SUM(s.likes_count), 0)  AS total_likes,
    COUNT(s.id)                       AS songs_count,
    (SELECT COUNT(*) FROM follows WHERE following_id::text = artist_id::text) AS followers_cnt
  FROM songs s
  WHERE s.uploader_id::text = artist_id::text
    AND s.is_archived = FALSE;
$$;

COMMENT ON FUNCTION get_artist_stats IS 'Retourne les stats agrégées pour un artiste (plays, likes, sons, abonnés)';
