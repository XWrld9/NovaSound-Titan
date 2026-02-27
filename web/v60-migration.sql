-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v60
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. TABLE PLAYLISTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlists (
  id          TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  owner_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  is_public   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. TABLE PLAYLIST_SONGS (relation N-N ordonnée) ──────────────────
CREATE TABLE IF NOT EXISTS public.playlist_songs (
  id          TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- ── 3. INDEX PLAYLISTS ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_playlists_owner      ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_playlists_public     ON public.playlists(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_playlist_songs_pl    ON public.playlist_songs(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song  ON public.playlist_songs(song_id);

-- ── 4. RLS PLAYLISTS ────────────────────────────────────────────────
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Lecture : publiques visibles par tous, privées seulement par le propriétaire
CREATE POLICY "playlists_select" ON public.playlists
  FOR SELECT USING (is_public = TRUE OR owner_id = auth.uid()::text);

-- Insertion : utilisateur authentifié uniquement, ne peut créer que les siennes
CREATE POLICY "playlists_insert" ON public.playlists
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

-- Mise à jour : propriétaire uniquement
CREATE POLICY "playlists_update" ON public.playlists
  FOR UPDATE USING (owner_id = auth.uid()::text);

-- Suppression : propriétaire uniquement
CREATE POLICY "playlists_delete" ON public.playlists
  FOR DELETE USING (owner_id = auth.uid()::text);

-- ── 5. RLS PLAYLIST_SONGS ───────────────────────────────────────────
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

-- Lecture : si la playlist est visible
CREATE POLICY "playlist_songs_select" ON public.playlist_songs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND (p.is_public = TRUE OR p.owner_id = auth.uid()::text)
    )
  );

-- Modification : propriétaire de la playlist uniquement
CREATE POLICY "playlist_songs_insert" ON public.playlist_songs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "playlist_songs_delete" ON public.playlist_songs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.owner_id = auth.uid()::text
    )
  );

-- ── 6. FONCTION RPC : ajouter un son en fin de playlist ─────────────
CREATE OR REPLACE FUNCTION add_song_to_playlist(p_playlist_id TEXT, p_song_id TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  max_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), -1) INTO max_pos
  FROM public.playlist_songs WHERE playlist_id = p_playlist_id;

  INSERT INTO public.playlist_songs(playlist_id, song_id, position)
  VALUES (p_playlist_id, p_song_id, max_pos + 1)
  ON CONFLICT (playlist_id, song_id) DO NOTHING;

  UPDATE public.playlists SET updated_at = NOW() WHERE id = p_playlist_id;
END;
$$;

-- ── 7. FONCTION RPC : réordonner les sons d'une playlist ─────────────
CREATE OR REPLACE FUNCTION reorder_playlist_songs(p_playlist_id TEXT, p_song_ids TEXT[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_song_ids, 1) LOOP
    UPDATE public.playlist_songs
    SET position = i - 1
    WHERE playlist_id = p_playlist_id AND song_id = p_song_ids[i];
  END LOOP;
  UPDATE public.playlists SET updated_at = NOW() WHERE id = p_playlist_id;
END;
$$;

-- ── 8. VUE TRENDING (24h / 7j / 30j) ───────────────────────────────
-- Trending 24h
CREATE OR REPLACE VIEW trending_24h AS
SELECT
  s.*,
  (s.plays_count * 0.5 + s.likes_count * 1.5) AS score
FROM public.songs s
WHERE s.is_archived = FALSE
  AND s.created_at > NOW() - INTERVAL '365 days'
ORDER BY
  CASE WHEN s.created_at > NOW() - INTERVAL '24 hours' THEN 2 ELSE 1 END DESC,
  (s.plays_count * 0.5 + s.likes_count * 1.5) DESC
LIMIT 20;

-- Trending 7 jours
CREATE OR REPLACE VIEW trending_7d AS
SELECT
  s.*,
  (s.plays_count * 0.5 + s.likes_count * 1.5) AS score
FROM public.songs s
WHERE s.is_archived = FALSE
  AND s.created_at > NOW() - INTERVAL '365 days'
ORDER BY
  CASE WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 2 ELSE 1 END DESC,
  (s.plays_count * 0.5 + s.likes_count * 1.5) DESC
LIMIT 20;

-- Trending 30 jours
CREATE OR REPLACE VIEW trending_30d AS
SELECT
  s.*,
  (s.plays_count * 0.5 + s.likes_count * 1.5) AS score
FROM public.songs s
WHERE s.is_archived = FALSE
  AND s.created_at > NOW() - INTERVAL '365 days'
ORDER BY
  CASE WHEN s.created_at > NOW() - INTERVAL '30 days' THEN 2 ELSE 1 END DESC,
  (s.plays_count * 0.5 + s.likes_count * 1.5) DESC
LIMIT 20;

GRANT SELECT ON trending_24h, trending_7d, trending_30d TO anon, authenticated;

-- ── 9. FONCTION RPC TRENDING ARTISTES ───────────────────────────────
CREATE OR REPLACE FUNCTION get_trending_artists(period TEXT DEFAULT '7d', lim INTEGER DEFAULT 10)
RETURNS TABLE(
  user_id       TEXT,
  username      TEXT,
  avatar_url    TEXT,
  total_plays   BIGINT,
  total_likes   BIGINT,
  songs_count   BIGINT,
  followers_cnt BIGINT,
  score         NUMERIC
)
LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT
    u.id            AS user_id,
    u.username,
    u.avatar_url,
    COALESCE(SUM(s.plays_count), 0)  AS total_plays,
    COALESCE(SUM(s.likes_count), 0)  AS total_likes,
    COUNT(s.id)                       AS songs_count,
    (SELECT COUNT(*) FROM public.follows f WHERE f.following_id = u.id) AS followers_cnt,
    COALESCE(SUM(s.plays_count * 0.4 + s.likes_count * 0.6), 0) AS score
  FROM public.users u
  JOIN public.songs s ON s.uploader_id = u.id AND s.is_archived = FALSE
    AND s.created_at > NOW() - (
      CASE period
        WHEN '24h' THEN INTERVAL '24 hours'
        WHEN '7d'  THEN INTERVAL '7 days'
        ELSE            INTERVAL '30 days'
      END
    )
  GROUP BY u.id, u.username, u.avatar_url
  ORDER BY score DESC
  LIMIT lim;
$$;

-- ── 10. INDEX FULL-TEXT SEARCH sur songs ────────────────────────────
-- Index GIN pour recherche rapide sur titre + artiste
CREATE INDEX IF NOT EXISTS idx_songs_fts
  ON public.songs
  USING GIN (to_tsvector('french', coalesce(title,'') || ' ' || coalesce(artist,'')))
  WHERE is_archived = FALSE;

-- ── 11. COLONNE social_links sur users (liens réseaux sociaux) ───────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════════
-- FIN MIGRATION v60
-- ═══════════════════════════════════════════════════════════════════
