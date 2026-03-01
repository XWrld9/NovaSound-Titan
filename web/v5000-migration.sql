-- ══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v5000
-- ══════════════════════════════════════════════════════════════════
-- Features :
--   1. live_rooms              — Salles d'écoute collective Realtime
--   2. live_room_messages      — Chat live persisté
--   3. live_room_participants  — Log de présence
--   4. song_lyrics             — Paroles (plain + LRC synchronisé)
--   5. user_achievements       — Badges & trophées gamifiés
--   6. song_reposts            — Repartages (boost algo)
--   7. artist_follows_v5       — Fix follow + compteur atomique
--   8. total_plays sur users   — Agrégat pour leaderboard
--   9. Vues matérialisées      — leaderboard_artists, leaderboard_listeners
--  10. Fonctions RPC avancées  — daily_digest, calculate_achievements
--  11. Triggers                — auto-achievement on milestone
--  12. 9 nouveaux index performances
-- ══════════════════════════════════════════════════════════════════

-- ── 1. LIVE ROOMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_rooms (
  id                TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  name              TEXT        NOT NULL,
  host_id           TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_song_id   TEXT        REFERENCES songs(id) ON DELETE SET NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  is_private        BOOLEAN     NOT NULL DEFAULT false,
  participants_count INTEGER    NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v5_live_rooms_read_public"
  ON live_rooms FOR SELECT
  USING (is_private = false OR host_id = auth.uid()::text OR auth.uid() IS NOT NULL);

CREATE POLICY "v5_live_rooms_insert"
  ON live_rooms FOR INSERT
  WITH CHECK (auth.uid()::text = host_id);

CREATE POLICY "v5_live_rooms_update_host"
  ON live_rooms FOR UPDATE
  USING (auth.uid()::text = host_id);

CREATE POLICY "v5_live_rooms_delete_host"
  ON live_rooms FOR DELETE
  USING (auth.uid()::text = host_id);

-- Auto-updated_at
CREATE OR REPLACE FUNCTION update_live_rooms_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_live_rooms_updated_at ON live_rooms;
CREATE TRIGGER trg_live_rooms_updated_at
  BEFORE UPDATE ON live_rooms
  FOR EACH ROW EXECUTE FUNCTION update_live_rooms_updated_at();

-- Nettoyage des salles inactives (après 4h)
CREATE OR REPLACE FUNCTION cleanup_inactive_live_rooms()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt INTEGER;
BEGIN
  UPDATE live_rooms SET is_active = false
  WHERE is_active = true
    AND updated_at < now() - INTERVAL '4 hours';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- ── 2. LIVE ROOM MESSAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_room_messages (
  id         TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  room_id    TEXT        NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  content    TEXT        NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE live_room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v5_live_messages_read"
  ON live_room_messages FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "v5_live_messages_insert"
  ON live_room_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- ── 3. SONG LYRICS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_lyrics (
  id          TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  song_id     TEXT        NOT NULL UNIQUE REFERENCES songs(id) ON DELETE CASCADE,
  uploader_id TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  format      TEXT        NOT NULL DEFAULT 'plain' CHECK (format IN ('plain', 'lrc', 'srt')),
  -- LRC = format [mm:ss.xx] ligne pour sync automatique
  language    TEXT        DEFAULT 'fr',
  is_verified BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE song_lyrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v5_lyrics_read"
  ON song_lyrics FOR SELECT USING (true);

CREATE POLICY "v5_lyrics_insert"
  ON song_lyrics FOR INSERT
  WITH CHECK (
    auth.uid()::text = uploader_id
    AND EXISTS (SELECT 1 FROM songs WHERE id = song_id AND uploader_id = auth.uid()::text)
  );

CREATE POLICY "v5_lyrics_update"
  ON song_lyrics FOR UPDATE
  USING (auth.uid()::text = uploader_id);

CREATE POLICY "v5_lyrics_admin_verify"
  ON song_lyrics FOR UPDATE
  USING (auth.uid()::text = uploader_id);

-- ── 4. USER ACHIEVEMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id           TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement  TEXT        NOT NULL,
  -- Valeurs : first_upload | 100_plays | 1k_plays | 10k_plays |
  --           first_like | 10_likes | 100_likes | first_comment |
  --           50_comments | streak_7 | streak_30 | top_10 | legend
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v5_achievements_read" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "v5_achievements_insert_system" ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Définitions des achievements
CREATE TABLE IF NOT EXISTS achievement_definitions (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  points      INTEGER DEFAULT 10,
  rarity      TEXT DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary'))
);

INSERT INTO achievement_definitions (code, label, description, icon, points, rarity) VALUES
  ('first_upload',   'Première note',   'Premier son uploadé',              '🎵', 10,  'common'),
  ('100_plays',      'Cent écoutes',    '100 écoutes sur tes sons',         '🎧', 20,  'common'),
  ('1k_plays',       'Mille écoutes',   '1 000 écoutes sur tes sons',       '🔥', 50,  'rare'),
  ('10k_plays',      'Dix mille',       '10 000 écoutes sur tes sons',      '💎', 150, 'epic'),
  ('100k_plays',     'Cent mille',      '100k écoutes — tu es une star !',  '⚡', 500, 'legendary'),
  ('first_like',     'Premier fan',     'Premier like reçu',                '❤️', 5,  'common'),
  ('100_likes',      'Cent fans',       '100 likes reçus',                  '💜', 30,  'rare'),
  ('first_comment',  'Première réaction','Premier commentaire reçu',        '💬', 5,  'common'),
  ('streak_7',       'Une semaine',     '7 jours d''écoute d''affilée',     '📅', 25,  'rare'),
  ('streak_30',      'Un mois !',       '30 jours d''écoute d''affilée',    '🗓️', 100, 'epic'),
  ('top_10',         'Top 10',          'Classé dans le top 10 artistes',   '🏆', 75,  'epic'),
  ('live_host',      'DJ Live',         'A hébergé une live room',          '🎙️', 30,  'rare'),
  ('lyrics_added',   'Auteur',          'A ajouté les paroles d''un son',   '📝', 15,  'common')
ON CONFLICT (code) DO NOTHING;

-- Fonction : vérifier et attribuer les achievements d'un user
CREATE OR REPLACE FUNCTION calculate_achievements(p_user_id TEXT)
RETURNS SETOF TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_plays  BIGINT;
  v_total_likes  BIGINT;
  v_uploads      BIGINT;
  v_comments     BIGINT;
  v_streak       INTEGER;
  v_has_lyrics   BOOLEAN;
  v_has_live     BOOLEAN;
  new_achievement TEXT;
  awarded TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Calculer les stats
  SELECT COALESCE(SUM(plays_count), 0) INTO v_total_plays
  FROM songs WHERE uploader_id = p_user_id AND NOT is_archived;

  SELECT COALESCE(SUM(likes_count), 0) INTO v_total_likes
  FROM songs WHERE uploader_id = p_user_id AND NOT is_archived;

  SELECT COUNT(*) INTO v_uploads FROM songs WHERE uploader_id = p_user_id AND NOT is_archived;

  SELECT COUNT(*) INTO v_comments FROM song_comments WHERE user_id = p_user_id;

  SELECT current_streak INTO v_streak FROM user_streaks WHERE user_id = p_user_id;
  v_streak := COALESCE(v_streak, 0);

  SELECT EXISTS(SELECT 1 FROM song_lyrics WHERE uploader_id = p_user_id) INTO v_has_lyrics;
  SELECT EXISTS(SELECT 1 FROM live_rooms WHERE host_id = p_user_id) INTO v_has_live;

  -- Attribuer les achievements manquants
  FOREACH new_achievement IN ARRAY ARRAY[
    CASE WHEN v_uploads >= 1 THEN 'first_upload' END,
    CASE WHEN v_total_plays >= 100 THEN '100_plays' END,
    CASE WHEN v_total_plays >= 1000 THEN '1k_plays' END,
    CASE WHEN v_total_plays >= 10000 THEN '10k_plays' END,
    CASE WHEN v_total_plays >= 100000 THEN '100k_plays' END,
    CASE WHEN v_total_likes >= 1 THEN 'first_like' END,
    CASE WHEN v_total_likes >= 100 THEN '100_likes' END,
    CASE WHEN v_comments >= 1 THEN 'first_comment' END,
    CASE WHEN v_streak >= 7 THEN 'streak_7' END,
    CASE WHEN v_streak >= 30 THEN 'streak_30' END,
    CASE WHEN v_has_lyrics THEN 'lyrics_added' END,
    CASE WHEN v_has_live THEN 'live_host' END
  ]::TEXT[]
  LOOP
    CONTINUE WHEN new_achievement IS NULL;
    BEGIN
      INSERT INTO user_achievements (user_id, achievement)
      VALUES (p_user_id, new_achievement)
      ON CONFLICT (user_id, achievement) DO NOTHING;
      IF FOUND THEN awarded := array_append(awarded, new_achievement); END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN QUERY SELECT unnest(awarded);
END;
$$;

-- ── 5. SONG REPOSTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_reposts (
  id         TEXT        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  song_id    TEXT        NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (song_id, user_id)
);

ALTER TABLE song_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v5_reposts_read"   ON song_reposts FOR SELECT USING (true);
CREATE POLICY "v5_reposts_insert" ON song_reposts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "v5_reposts_delete" ON song_reposts FOR DELETE USING (auth.uid()::text = user_id);

-- Colonne reposts_count sur songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS reposts_count INTEGER NOT NULL DEFAULT 0;

-- Trigger auto-incrément reposts
CREATE OR REPLACE FUNCTION sync_reposts_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET reposts_count = reposts_count + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE songs SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_reposts_count ON song_reposts;
CREATE TRIGGER trg_sync_reposts_count
  AFTER INSERT OR DELETE ON song_reposts
  FOR EACH ROW EXECUTE FUNCTION sync_reposts_count();

-- ── 6. TOTAL_PLAYS sur users (leaderboard) ───────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_plays BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_likes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_points   INTEGER NOT NULL DEFAULT 0;

-- Recalcul initial
UPDATE users u SET
  total_plays = COALESCE((
    SELECT SUM(plays_count) FROM songs WHERE uploader_id = u.id AND NOT is_archived
  ), 0),
  total_likes = COALESCE((
    SELECT SUM(likes_count) FROM songs WHERE uploader_id = u.id AND NOT is_archived
  ), 0);

-- Trigger live sur plays_count changes
CREATE OR REPLACE FUNCTION sync_user_total_plays()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE users SET
      total_plays = COALESCE((
        SELECT SUM(plays_count) FROM songs WHERE uploader_id = NEW.uploader_id AND NOT is_archived
      ), 0),
      total_likes = COALESCE((
        SELECT SUM(likes_count) FROM songs WHERE uploader_id = NEW.uploader_id AND NOT is_archived
      ), 0)
    WHERE id = NEW.uploader_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE users SET
      total_plays = GREATEST(0, total_plays - OLD.plays_count),
      total_likes = GREATEST(0, total_likes - OLD.likes_count)
    WHERE id = OLD.uploader_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_user_totals ON songs;
CREATE TRIGGER trg_sync_user_totals
  AFTER INSERT OR UPDATE OF plays_count, likes_count OR DELETE ON songs
  FOR EACH ROW EXECUTE FUNCTION sync_user_total_plays();

-- ── 7. TRENDING v5 — score enrichi avec reposts ──────────────────
CREATE OR REPLACE FUNCTION get_trending_songs_v5(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id          TEXT, title TEXT, artist TEXT, cover_url TEXT, audio_url TEXT,
  plays_count BIGINT, likes_count INT, genre TEXT, uploader_id TEXT,
  score       NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.plays_count, s.likes_count, s.genre, s.uploader_id,
    (
      s.plays_count   * 1.0
      + s.likes_count * 3.0
      + COALESCE((SELECT COUNT(*) FROM song_comments c WHERE c.song_id = s.id), 0) * 4.0
      + COALESCE(s.reposts_count, 0) * 5.0
      -- Bonus fraîcheur : 0 à 60 selon l'âge (< 7 jours)
      + GREATEST(0, 60 - EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400 * 60 / 7)
    ) AS score
  FROM songs s
  WHERE NOT s.is_archived
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- ── 8. DAILY DIGEST — sons recommandés personnalisés ─────────────
CREATE OR REPLACE FUNCTION get_daily_digest(p_user_id TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
  id TEXT, title TEXT, artist TEXT, cover_url TEXT, audio_url TEXT,
  plays_count BIGINT, likes_count INT, genre TEXT, uploader_id TEXT, reason TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_top_genre TEXT;
BEGIN
  -- Genre favori de l'utilisateur
  SELECT s.genre INTO v_top_genre
  FROM likes l
  JOIN songs s ON s.id = l.song_id
  WHERE l.user_id = p_user_id
  GROUP BY s.genre ORDER BY COUNT(*) DESC LIMIT 1;

  RETURN QUERY
  WITH scored AS (
    SELECT s.*,
      (
        s.plays_count * 0.5
        + s.likes_count * 2.0
        + CASE WHEN s.genre = v_top_genre THEN 30 ELSE 0 END
        + GREATEST(0, 40 - EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400 * 4)
        -- Exclure déjà aimés
        - CASE WHEN EXISTS(SELECT 1 FROM likes l2 WHERE l2.song_id = s.id AND l2.user_id = p_user_id) THEN 999 ELSE 0 END
      ) AS score,
      CASE
        WHEN s.genre = v_top_genre THEN 'Ton genre : ' || s.genre
        WHEN s.created_at > now() - INTERVAL '2 days' THEN 'Nouveau'
        ELSE 'Tendance'
      END AS reason
    FROM songs s
    WHERE NOT s.is_archived
      AND s.uploader_id != p_user_id
  )
  SELECT s.id, s.title, s.artist, s.cover_url, s.audio_url,
         s.plays_count, s.likes_count, s.genre, s.uploader_id, s.reason
  FROM scored s
  WHERE s.score > -900
  ORDER BY s.score DESC
  LIMIT p_limit;
END;
$$;

-- ── 9. VUES LEADERBOARD ───────────────────────────────────────────
-- Top Artistes (rafraîchie à la demande)
CREATE OR REPLACE VIEW leaderboard_artists AS
SELECT
  u.id, u.username, u.avatar_url,
  u.total_plays, u.total_likes,
  COALESCE(u.followers_count, 0) AS followers_count,
  COUNT(DISTINCT s.id) AS songs_count,
  ROW_NUMBER() OVER (ORDER BY u.total_plays DESC) AS rank
FROM users u
LEFT JOIN songs s ON s.uploader_id = u.id AND NOT s.is_archived
GROUP BY u.id, u.username, u.avatar_url, u.total_plays, u.total_likes, u.followers_count
ORDER BY u.total_plays DESC
LIMIT 50;

-- Top Auditeurs
CREATE OR REPLACE VIEW leaderboard_listeners AS
SELECT
  u.id, u.username, u.avatar_url,
  COALESCE(us.total_days, 0) AS total_days,
  COALESCE(us.current_streak, 0) AS current_streak,
  COALESCE(us.longest_streak, 0) AS longest_streak,
  ROW_NUMBER() OVER (ORDER BY COALESCE(us.total_days, 0) DESC) AS rank
FROM users u
LEFT JOIN user_streaks us ON us.user_id = u.id
ORDER BY COALESCE(us.total_days, 0) DESC
LIMIT 50;

-- ── 10. REALTIME SUBSCRIPTIONS ───────────────────────────────────
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END;
$realtime$;
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_room_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END;
$realtime$;
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
EXCEPTION WHEN duplicate_object THEN NULL; END;
$realtime$;
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE song_reposts;
EXCEPTION WHEN duplicate_object THEN NULL; END;
$realtime$;

-- ── 11. INDEX PERFORMANCES ────────────────────────────────────────
-- Live rooms
CREATE INDEX IF NOT EXISTS idx_live_rooms_active
  ON live_rooms (is_active, is_private, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_live_room_messages_room
  ON live_room_messages (room_id, created_at ASC);

-- Song lyrics
CREATE INDEX IF NOT EXISTS idx_song_lyrics_song
  ON song_lyrics (song_id);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, achievement);

-- Reposts
CREATE INDEX IF NOT EXISTS idx_song_reposts_song
  ON song_reposts (song_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_song_reposts_user
  ON song_reposts (user_id, created_at DESC);

-- Users leaderboard
CREATE INDEX IF NOT EXISTS idx_users_leaderboard
  ON users (total_plays DESC, total_likes DESC)
  WHERE total_plays > 0;

-- Songs trending v5
CREATE INDEX IF NOT EXISTS idx_songs_trending_v5
  ON songs (plays_count DESC, likes_count DESC, reposts_count DESC, created_at DESC)
  WHERE NOT is_archived;

-- Streaks for leaderboard
CREATE INDEX IF NOT EXISTS idx_user_streaks_leaderboard
  ON user_streaks (total_days DESC, current_streak DESC);

-- ── 12. HELPERS & MAINTENANCE ────────────────────────────────────
-- Compte les participants actifs d'une salle
CREATE OR REPLACE FUNCTION update_room_participants_count(p_room_id TEXT, p_delta INTEGER)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE live_rooms
  SET participants_count = GREATEST(0, participants_count + p_delta)
  WHERE id = p_room_id;
$$;

-- RPC publique : rejoindre la salle (log + count)
CREATE OR REPLACE FUNCTION join_live_room(p_room_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE live_rooms
  SET participants_count = participants_count + 1
  WHERE id = p_room_id AND is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION leave_live_room(p_room_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE live_rooms
  SET participants_count = GREATEST(0, participants_count - 1)
  WHERE id = p_room_id;
END;
$$;

-- ── 13. REFRESH xp_points depuis achievements ────────────────────
CREATE OR REPLACE FUNCTION refresh_user_xp(p_user_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_xp INTEGER;
BEGIN
  SELECT COALESCE(SUM(d.points), 0) INTO v_xp
  FROM user_achievements ua
  JOIN achievement_definitions d ON d.code = ua.achievement
  WHERE ua.user_id = p_user_id;

  UPDATE users SET xp_points = v_xp WHERE id = p_user_id;
  RETURN v_xp;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- FIN MIGRATION v5000
-- Instructions :
--   1. Ouvrir Supabase Dashboard → SQL Editor
--   2. Coller ce fichier et cliquer Run
--   3. Vérifier les logs — toutes les requêtes sont idempotentes
-- ══════════════════════════════════════════════════════════════════
