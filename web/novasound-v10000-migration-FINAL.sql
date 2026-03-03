-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration MASTER v10000
-- Synchronise et harmonise toute la base de données
-- Idempotent : peut être run plusieurs fois sans dommages
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 1 : COLONNES MANQUANTES — users
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Colonnes leaderboard sur users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_plays   BIGINT  NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_likes   BIGINT  NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp_points     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio_url       TEXT;

-- 1b. Colonne is_deleted sur songs (soft delete)
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- 1c. Colonne description sur songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS description TEXT;

-- 1d. Colonnes sur song_comments
ALTER TABLE public.song_comments ADD COLUMN IF NOT EXISTS replies_count INTEGER NOT NULL DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 2 : TRIGGERS — sync automatique total_plays / total_likes
-- ════════════════════════════════════════════════════════════════════════════

-- 2a. Fonction de synchronisation
CREATE OR REPLACE FUNCTION public.sync_user_total_plays()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uploader TEXT;
BEGIN
  v_uploader := COALESCE(NEW.uploader_id, OLD.uploader_id)::text;
  IF v_uploader IS NULL THEN RETURN NULL; END IF;

  UPDATE public.users SET
    total_plays = COALESCE((
      SELECT SUM(plays_count) FROM public.songs
      WHERE uploader_id::text = v_uploader AND NOT is_archived
    ), 0),
    total_likes = COALESCE((
      SELECT SUM(likes_count) FROM public.songs
      WHERE uploader_id::text = v_uploader AND NOT is_archived
    ), 0)
  WHERE id::text = v_uploader;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_totals ON public.songs;
CREATE TRIGGER trg_sync_user_totals
  AFTER INSERT OR UPDATE OF plays_count, likes_count, is_archived OR DELETE
  ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_total_plays();

-- 2b. Trigger likes_count sur songs
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.songs SET likes_count = likes_count + 1 WHERE id = NEW.song_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.songs SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_likes_count ON public.likes;
CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- 2c. Trigger followers_count sur users
CREATE OR REPLACE FUNCTION public.update_followers_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.users SET followers_count = followers_count + 1 WHERE id::text = NEW.following_id::text;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.users SET followers_count = GREATEST(0, followers_count - 1) WHERE id::text = OLD.following_id::text;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_followers_count ON public.follows;
CREATE TRIGGER trigger_update_followers_count
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_followers_count();

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 3 : RECALCUL INITIAL — synchroniser les compteurs existants
-- ════════════════════════════════════════════════════════════════════════════

-- 3a. Recalculer total_plays et total_likes pour tous les artistes
UPDATE public.users u SET
  total_plays = COALESCE((
    SELECT SUM(plays_count) FROM public.songs
    WHERE uploader_id::text = u.id::text AND NOT is_archived
  ), 0),
  total_likes = COALESCE((
    SELECT SUM(likes_count) FROM public.songs
    WHERE uploader_id::text = u.id::text AND NOT is_archived
  ), 0);

-- 3b. Recalculer likes_count sur songs
UPDATE public.songs s SET
  likes_count = COALESCE((
    SELECT COUNT(*) FROM public.likes WHERE song_id = s.id
  ), 0)
WHERE likes_count IS NULL OR likes_count = 0;

-- 3c. Recalculer followers_count sur users
UPDATE public.users u SET
  followers_count = COALESCE((
    SELECT COUNT(*) FROM public.follows WHERE following_id::text = u.id::text
  ), 0)
WHERE followers_count IS NULL OR followers_count = 0;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 4 : VUES TRENDING — inclure audio_url + fix is_deleted
-- ════════════════════════════════════════════════════════════════════════════

-- Drop existing views first to allow column changes (fixes ERROR 42P16)
DROP VIEW IF EXISTS public.trending_24h CASCADE;
DROP VIEW IF EXISTS public.trending_7d CASCADE;
DROP VIEW IF EXISTS public.trending_30d CASCADE;
DROP VIEW IF EXISTS public.spotlight_songs CASCADE;

CREATE OR REPLACE VIEW public.trending_24h AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count FROM public.likes
    WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
    AND s.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY score DESC LIMIT 20;

CREATE OR REPLACE VIEW public.trending_7d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count FROM public.likes
    WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
  ORDER BY score DESC LIMIT 20;

CREATE OR REPLACE VIEW public.trending_30d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.genre, s.plays_count, s.uploader_id, s.duration_s, s.is_archived,
    COALESCE(lk.likes_count, 0) AS likes_count,
    (s.plays_count + COALESCE(lk.likes_count, 0) * 3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS likes_count FROM public.likes
    WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY song_id
  ) lk ON lk.song_id = s.id
  WHERE s.is_archived = FALSE AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)
  ORDER BY score DESC LIMIT 20;

-- Vue spotlight (HomePage)
CREATE OR REPLACE VIEW public.spotlight_songs AS
  SELECT *, (plays_count * 0.6 + likes_count * 0.4) AS score
  FROM public.songs
  WHERE is_archived = FALSE AND (is_deleted IS NULL OR is_deleted = FALSE)
    AND created_at > NOW() - INTERVAL '14 days'
  ORDER BY score DESC LIMIT 5;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 5 : TABLES MANQUANTES / RLS
-- ════════════════════════════════════════════════════════════════════════════

-- 5a. user_streaks — lecture publique pour le leaderboard
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id               TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id          TEXT NOT NULL UNIQUE,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_days       INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "streaks_public_read"    ON public.user_streaks;
DROP POLICY IF EXISTS "streaks_own_write"      ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can upsert own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Streaks public read for leaderboard" ON public.user_streaks;
CREATE POLICY "streaks_public_read" ON public.user_streaks FOR SELECT USING (true);
CREATE POLICY "streaks_own_write"   ON public.user_streaks FOR ALL
  USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- 5b. song_moods — votes vibe crowd-sourcés
CREATE TABLE IF NOT EXISTS public.song_moods (
  id         TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  song_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  mood       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (song_id, user_id)
);
ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view moods"    ON public.song_moods;
DROP POLICY IF EXISTS "Auth users can vote mood" ON public.song_moods;
CREATE POLICY "Anyone can view moods"    ON public.song_moods FOR SELECT USING (true);
CREATE POLICY "Auth users can vote mood" ON public.song_moods FOR ALL
  USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE INDEX IF NOT EXISTS idx_song_moods_song_id ON public.song_moods(song_id);

-- 5c. live_room_participants
CREATE TABLE IF NOT EXISTS public.live_room_participants (
  id        TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  room_id   TEXT NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at   TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);
ALTER TABLE public.live_room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "v5_lrp_read"   ON public.live_room_participants;
DROP POLICY IF EXISTS "v5_lrp_insert" ON public.live_room_participants;
DROP POLICY IF EXISTS "v5_lrp_update" ON public.live_room_participants;
CREATE POLICY "v5_lrp_read"   ON public.live_room_participants FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "v5_lrp_insert" ON public.live_room_participants FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "v5_lrp_update" ON public.live_room_participants FOR UPDATE USING (auth.uid()::text = user_id);
CREATE INDEX IF NOT EXISTS idx_lrp_room ON public.live_room_participants(room_id, joined_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 6 : RLS — harmonisation toutes tables
-- ════════════════════════════════════════════════════════════════════════════

-- 6a. user_roles — récursion zéro (auth.email() direct)
DROP POLICY IF EXISTS "user_roles_admin_all"          ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_own"           ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_authenticated_read" ON public.user_roles;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read_own"           ON public.user_roles FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "user_roles_admin_all"          ON public.user_roles FOR ALL USING (auth.email() = 'eloadxfamily@gmail.com');
CREATE POLICY "user_roles_authenticated_read" ON public.user_roles FOR SELECT USING (auth.role() = 'authenticated');

-- 6b. live_rooms — admin peut tout faire
DROP POLICY IF EXISTS "v5_live_rooms_read_public" ON public.live_rooms;
DROP POLICY IF EXISTS "v5_live_rooms_insert"      ON public.live_rooms;
DROP POLICY IF EXISTS "v5_live_rooms_update_host" ON public.live_rooms;
DROP POLICY IF EXISTS "v5_live_rooms_delete_host" ON public.live_rooms;
DROP POLICY IF EXISTS "live_rooms_select"         ON public.live_rooms;
DROP POLICY IF EXISTS "live_rooms_insert"         ON public.live_rooms;
DROP POLICY IF EXISTS "live_rooms_update"         ON public.live_rooms;
DROP POLICY IF EXISTS "live_rooms_delete"         ON public.live_rooms;
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_rooms_select" ON public.live_rooms FOR SELECT USING (true);
CREATE POLICY "live_rooms_insert" ON public.live_rooms FOR INSERT WITH CHECK (auth.uid()::text = host_id::text);
CREATE POLICY "live_rooms_update" ON public.live_rooms FOR UPDATE USING (
  auth.uid()::text = host_id::text OR auth.email() = 'eloadxfamily@gmail.com');
CREATE POLICY "live_rooms_delete" ON public.live_rooms FOR DELETE USING (
  auth.uid()::text = host_id::text OR auth.email() = 'eloadxfamily@gmail.com');

-- 6c. songs — lecture publique, écriture owner
DROP POLICY IF EXISTS "songs_public_read"  ON public.songs;
DROP POLICY IF EXISTS "songs_owner_insert" ON public.songs;
DROP POLICY IF EXISTS "songs_owner_update" ON public.songs;
DROP POLICY IF EXISTS "songs_owner_delete" ON public.songs;
DROP POLICY IF EXISTS "songs_admin_all"    ON public.songs;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "songs_public_read"  ON public.songs FOR SELECT USING (true);
CREATE POLICY "songs_owner_insert" ON public.songs FOR INSERT WITH CHECK (auth.uid()::text = uploader_id::text);
CREATE POLICY "songs_owner_update" ON public.songs FOR UPDATE USING (
  auth.uid()::text = uploader_id::text OR auth.email() = 'eloadxfamily@gmail.com');
CREATE POLICY "songs_owner_delete" ON public.songs FOR DELETE USING (
  auth.uid()::text = uploader_id::text OR auth.email() = 'eloadxfamily@gmail.com');

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 7 : FONCTION RPC — increment_plays (idempotent)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_plays(song_id_param TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET plays_count = plays_count + 1
  WHERE id::text = song_id_param;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_plays(TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 8 : GRANTS — accès cohérent
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT ON public.trending_24h, public.trending_7d, public.trending_30d, public.spotlight_songs
  TO anon, authenticated;
GRANT SELECT ON public.songs, public.users, public.song_moods, public.user_streaks,
  public.live_rooms, public.live_room_participants
  TO anon, authenticated;
GRANT INSERT, UPDATE ON public.song_moods, public.user_streaks TO authenticated;
GRANT INSERT, UPDATE ON public.live_rooms, public.live_room_participants TO authenticated;
GRANT DELETE ON public.song_moods TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 9 : REALTIME — activer les tables clés
-- ════════════════════════════════════════════════════════════════════════════

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_participants;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.song_moods;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 10 : INDEXES PERFORMANCE
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_songs_total_plays    ON public.songs(plays_count DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_songs_uploader_plays ON public.songs(uploader_id, plays_count DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_songs_genre_plays    ON public.songs(genre, plays_count DESC) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_total_plays    ON public.users(total_plays DESC);
CREATE INDEX IF NOT EXISTS idx_streaks_total_days   ON public.user_streaks(total_days DESC);
CREATE INDEX IF NOT EXISTS idx_song_moods_song      ON public.song_moods(song_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 11 : VERSION TRACKING
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_meta'
  ) THEN
    BEGIN
      INSERT INTO public.app_meta (key, value) VALUES ('version', '10000')
      ON CONFLICT (key) DO UPDATE SET value = '10000', updated_at = NOW();
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END; $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ════════════════════════════════════════════════════════════════════════════
-- ✅ Colonnes total_plays / total_likes / xp_points assurées sur users
-- ✅ Trigger sync_user_total_plays actif sur songs
-- ✅ Trigger likes_count actif sur likes
-- ✅ Trigger followers_count actif sur follows
-- ✅ Compteurs recalculés pour tous les utilisateurs existants
-- ✅ Vues trending_24h / 7d / 30d incluent audio_url + fix is_deleted
-- ✅ Vue spotlight_songs mise à jour
-- ✅ user_streaks lecture publique (leaderboard auditeurs)
-- ✅ song_moods table + RLS
-- ✅ live_room_participants table + RLS
-- ✅ RLS user_roles sans récursion (auth.email() direct)
-- ✅ RLS live_rooms admin peut Stopper/Supprimer
-- ✅ RLS songs cohérent
-- ✅ increment_plays() RPC sécurisée
-- ✅ Realtime activé sur toutes les tables clés
-- ✅ Indexes performance ajoutés
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 12 : FIX CRITIQUE — notifications.type CHECK trop restrictif
-- CAUSE : ancienne contrainte n'acceptait que 5 types → les types
--         repost / chat_reply / chat_mention / chat_mention_all / mood_vote
--         étaient REJETÉS silencieusement → jamais enregistrés en base.
-- ════════════════════════════════════════════════════════════════════════════

-- 12a. Supprimer l'ancienne contrainte restrictive
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 12b. Ajouter la nouvelle contrainte complète (tous les types de notifUtils.js)
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like', 'comment', 'follow', 'new_song', 'news',
    'repost', 'chat_reply', 'chat_mention', 'chat_mention_all', 'mood_vote'
  ));

-- 12c. Ajouter la colonne metadata si absente (utilisée par notifUtils mais
--      pas déclarée dans la définition initiale de la table)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata TEXT;

-- 12d. RLS — s'assurer que authenticated peut insérer (requis pour notifUtils client-side)
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 12e. Index sur type pour les requêtes de filtrage par catégorie (panel UI)
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications(user_id, type, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ PARTIE 12
-- ✅ CHECK constraint élargi à 10 types (était bloqué à 5 → bug silencieux)
-- ✅ Colonne metadata ajoutée (repost/chat/mood_vote en avaient besoin)
-- ✅ RLS INSERT permissif maintenu
-- ✅ Index type ajouté pour le filtrage par catégorie dans le panel
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 13 : FIX RLS — comment_likes (403 Forbidden sur POST)
-- CAUSE : ancienne policy "FOR ALL USING(...)" sans WITH CHECK explicite
--         ou policy absente → INSERT rejeté avec 403.
--         Ce fix réinitialise proprement les RLS sur comment_likes ET
--         song_comments pour être sûr des deux tables.
-- ════════════════════════════════════════════════════════════════════════════

-- 13a. Reset RLS song_comments
ALTER TABLE public.song_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'song_comments' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.song_comments', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "comments_select_public"
  ON public.song_comments FOR SELECT USING (true);

CREATE POLICY "comments_insert_auth"
  ON public.song_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comments_update_author"
  ON public.song_comments FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "comments_delete_author_or_admin"
  ON public.song_comments FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- 13b. Reset RLS comment_likes
ALTER TABLE public.comment_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'comment_likes' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.comment_likes', pol.policyname);
  END LOOP;
END $$;

-- SELECT public
CREATE POLICY "comment_likes_select_public"
  ON public.comment_likes FOR SELECT USING (true);

-- INSERT : utilisateur connecté, user_id doit correspondre à l'uid
CREATE POLICY "comment_likes_insert_auth"
  ON public.comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = user_id
  );

-- DELETE : uniquement son propre like
CREATE POLICY "comment_likes_delete_own"
  ON public.comment_likes FOR DELETE
  USING (auth.uid()::text = user_id);

-- 13c. Realtime sur comment_likes (idempotent)
DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comments;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

-- ════════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ PARTIE 13
-- ✅ RLS song_comments réinitialisé (select/insert/update/delete)
-- ✅ RLS comment_likes réinitialisé — INSERT avec WITH CHECK auth.uid()
-- ✅ Plus de 403 Forbidden sur POST /comment_likes
-- ✅ Realtime activé sur les deux tables
-- ════════════════════════════════════════════════════════════════════════════
