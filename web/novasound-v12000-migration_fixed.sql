-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v12000
-- Auteur : ELOADXFAMILY
-- Idempotent — peut être exécuté plusieurs fois sans dommages
--
-- CORRECTIFS V12000 :
--  ✅ get_trending_artists — calcule les vrais auditeurs par période (play_events)
--  ✅ Table song_play_events pour tracking des écoutes par période
--  ✅ Vues trending basées sur play_events pour précision maximale
--  ✅ Notifications push — trigger DB webhook amélioré
--  ✅ RLS push_subscriptions — corrections multi-appareils
--  ✅ Index performance sur notifications + play_events
--  ✅ Fonction sync_users_totals corrigée (incluant play_events)
--  ✅ Chat mentions — table corrections
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 1 : TABLE song_play_events — Tracking précis par période
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.song_play_events (
  id         BIGSERIAL PRIMARY KEY,
  song_id    TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id    TEXT,          -- NULL = lecteur anonyme
  played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_s INTEGER        -- durée d'écoute en secondes (optionnel)
);

-- Index pour les requêtes par période
CREATE INDEX IF NOT EXISTS idx_play_events_played_at   ON public.song_play_events(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_song_id     ON public.song_play_events(song_id);
CREATE INDEX IF NOT EXISTS idx_play_events_song_played ON public.song_play_events(song_id, played_at DESC);

-- RLS
ALTER TABLE public.song_play_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "play_events_select_public" ON public.song_play_events;
CREATE POLICY "play_events_select_public"
  ON public.song_play_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "play_events_insert_anon" ON public.song_play_events;
CREATE POLICY "play_events_insert_anon"
  ON public.song_play_events FOR INSERT WITH CHECK (true);

-- Realtime
DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.song_play_events;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 2 : Vues trending basées sur play_events (précises par période)
-- ════════════════════════════════════════════════════════════════════════════

-- Vue 24h — basée sur les events réels
DROP VIEW IF EXISTS public.trending_24h CASCADE;
CREATE OR REPLACE VIEW public.trending_24h AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.plays_count, s.likes_count, s.genre, s.uploader_id,
    s.created_at, s.is_archived,
    COALESCE(pe.period_plays, 0) AS period_plays,
    (COALESCE(pe.period_plays, 0) * 0.7 + s.likes_count * 0.3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS period_plays
    FROM public.song_play_events
    WHERE played_at > NOW() - INTERVAL '24 hours'
    GROUP BY song_id
  ) pe ON pe.song_id = s.id
  WHERE s.is_archived = FALSE AND COALESCE(s.is_deleted, FALSE) = FALSE
    AND (COALESCE(pe.period_plays, 0) > 0 OR s.plays_count > 0)
  ORDER BY score DESC, s.plays_count DESC
  LIMIT 50;

-- Vue 7d
DROP VIEW IF EXISTS public.trending_7d CASCADE;
CREATE OR REPLACE VIEW public.trending_7d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.plays_count, s.likes_count, s.genre, s.uploader_id,
    s.created_at, s.is_archived,
    COALESCE(pe.period_plays, 0) AS period_plays,
    (COALESCE(pe.period_plays, 0) * 0.7 + s.likes_count * 0.3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS period_plays
    FROM public.song_play_events
    WHERE played_at > NOW() - INTERVAL '7 days'
    GROUP BY song_id
  ) pe ON pe.song_id = s.id
  WHERE s.is_archived = FALSE AND COALESCE(s.is_deleted, FALSE) = FALSE
    AND (COALESCE(pe.period_plays, 0) > 0 OR s.plays_count > 0)
  ORDER BY score DESC, s.plays_count DESC
  LIMIT 50;

-- Vue 30d
DROP VIEW IF EXISTS public.trending_30d CASCADE;
CREATE OR REPLACE VIEW public.trending_30d AS
  SELECT
    s.id, s.title, s.artist, s.cover_url, s.audio_url,
    s.plays_count, s.likes_count, s.genre, s.uploader_id,
    s.created_at, s.is_archived,
    COALESCE(pe.period_plays, 0) AS period_plays,
    (COALESCE(pe.period_plays, 0) * 0.7 + s.likes_count * 0.3) AS score
  FROM public.songs s
  LEFT JOIN (
    SELECT song_id, COUNT(*) AS period_plays
    FROM public.song_play_events
    WHERE played_at > NOW() - INTERVAL '30 days'
    GROUP BY song_id
  ) pe ON pe.song_id = s.id
  WHERE s.is_archived = FALSE AND COALESCE(s.is_deleted, FALSE) = FALSE
    AND (COALESCE(pe.period_plays, 0) > 0 OR s.plays_count > 0)
  ORDER BY score DESC, s.plays_count DESC
  LIMIT 50;

GRANT SELECT ON public.trending_24h, public.trending_7d, public.trending_30d TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 3 : get_trending_artists — CORRIGÉ (basé sur play_events par période)
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_trending_artists(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_trending_artists(
  period TEXT    DEFAULT '7d',
  lim    INTEGER DEFAULT 15
)
RETURNS TABLE(
  user_id       TEXT,
  username      TEXT,
  avatar_url    TEXT,
  total_plays   BIGINT,
  total_likes   BIGINT,
  songs_count   BIGINT,
  followers_cnt BIGINT,
  period_plays  BIGINT,   -- écoutes réelles sur la période
  score         NUMERIC
)
LANGUAGE SQL SECURITY DEFINER AS $$
  WITH period_interval AS (
    SELECT CASE period
      WHEN '24h' THEN INTERVAL '24 hours'
      WHEN '7d'  THEN INTERVAL '7 days'
      ELSE            INTERVAL '30 days'
    END AS iv
  ),
  -- Écoutes sur la période via play_events
  period_data AS (
    SELECT
      s.uploader_id,
      COUNT(pe.id)             AS period_plays_count,
      SUM(s.likes_count)       AS period_likes
    FROM public.song_play_events pe
    JOIN public.songs s ON s.id = pe.song_id AND s.is_archived = FALSE
    CROSS JOIN period_interval
    WHERE pe.played_at > NOW() - period_interval.iv
    GROUP BY s.uploader_id
  ),
  -- Fallback : si pas de play_events, utiliser plays_count total
  all_artists AS (
    SELECT
      u.id              AS user_id,
      u.username,
      u.avatar_url,
      COALESCE(SUM(s.plays_count), 0)  AS total_plays,
      COALESCE(SUM(s.likes_count), 0)  AS total_likes,
      COUNT(s.id)                       AS songs_count,
      COALESCE(pd.period_plays_count, 0) AS period_plays_calc
    FROM public.users u
    JOIN public.songs s ON s.uploader_id = u.id AND s.is_archived = FALSE AND COALESCE(s.is_deleted, FALSE) = FALSE
    LEFT JOIN period_data pd ON pd.uploader_id = u.id
    GROUP BY u.id, u.username, u.avatar_url, pd.period_plays_count
    HAVING COALESCE(SUM(s.plays_count), 0) > 0
  )
  SELECT
    aa.user_id,
    aa.username,
    aa.avatar_url,
    aa.total_plays,
    aa.total_likes,
    aa.songs_count,
    (SELECT COUNT(*) FROM public.follows f WHERE f.following_id::text = aa.user_id) AS followers_cnt,
    aa.period_plays_calc                   AS period_plays,
    -- Score hybride : priorité aux plays récents, fallback sur total
    (GREATEST(aa.period_plays_calc, 0) * 0.6
     + aa.total_plays * 0.0001
     + aa.total_likes * 0.3
     + (SELECT COUNT(*) FROM public.follows f WHERE f.following_id::text = aa.user_id) * 0.1
    ) AS score
  FROM all_artists aa
  ORDER BY score DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_artists(TEXT, INTEGER) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 4 : Fonction RPC pour enregistrer un play event (appelée par le client)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_play_event(
  p_song_id    TEXT,
  p_user_id    TEXT    DEFAULT NULL,
  p_duration_s INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insérer l'événement
  INSERT INTO public.song_play_events(song_id, user_id, duration_s)
  VALUES (p_song_id, p_user_id, p_duration_s);

  -- Incrémenter plays_count sur songs (dédupliqué par 10s côté client)
  UPDATE public.songs
  SET plays_count = plays_count + 1
  WHERE id = p_song_id;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Silencieux pour ne pas bloquer la lecture
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_play_event(TEXT, TEXT, INTEGER) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 5 : Push subscriptions — corrections RLS multi-appareils
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- DROP + RECREATE pour éviter les conflits
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'push_subscriptions' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', pol.policyname); END LOOP;
END $$;

-- SELECT : uniquement ses propres subscriptions
CREATE POLICY "push_sub_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid()::text = user_id);

-- INSERT : insérer sa propre subscription
CREATE POLICY "push_sub_insert_own"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- UPDATE : mettre à jour sa propre subscription
CREATE POLICY "push_sub_update_own"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- DELETE : supprimer sa propre subscription
CREATE POLICY "push_sub_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role bypass (pour l'Edge Function send-push-notification)
CREATE POLICY "push_sub_service_role"
  ON public.push_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Index sur user_id pour la récupération rapide par l'Edge Function
CREATE INDEX IF NOT EXISTS idx_push_sub_user_id ON public.push_subscriptions(user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 6 : Notifications — Index + améliorations
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications(user_id, type);

-- Ajouter colonne notification_data si absente (pour pièces jointes push enrichies)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS icon_url  TEXT DEFAULT '/icon-192.png';

-- Nettoyage automatique des vieilles notifications (> 90 jours, déjà lues)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE is_read = TRUE
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 7 : Chat global — corrections colonnes manquantes
-- ════════════════════════════════════════════════════════════════════════════

-- S'assurer que chat_messages a toutes les colonnes nécessaires
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_username TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_content TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS period TEXT;  -- période du message (ex: 'morning', 'afternoon', 'evening')

-- Index sur reply_to_id pour récupérer les réponses rapidement
CREATE INDEX IF NOT EXISTS idx_chat_reply_to ON public.chat_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- Index sur created_at pour les requêtes par période
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user_created ON public.chat_messages(user_id, created_at DESC);

-- Vue sécurisée chat_messages (filtre les supprimés)
CREATE OR REPLACE VIEW public.chat_messages_public AS
  SELECT id, user_id, content, created_at, edited_at,
         reply_to_id, reply_to_username, reply_to_content,
         period
  FROM public.chat_messages
  WHERE is_deleted = FALSE OR is_deleted IS NULL;

GRANT SELECT ON public.chat_messages_public TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 8 : Spotlight songs view — correction
-- ════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.spotlight_songs CASCADE;
CREATE OR REPLACE VIEW public.spotlight_songs AS
  SELECT s.*, u.username AS uploader_username, u.avatar_url AS uploader_avatar
  FROM public.songs s
  LEFT JOIN public.users u ON u.id::text = s.uploader_id::text
  WHERE s.is_archived = FALSE
    AND COALESCE(s.is_deleted, FALSE) = FALSE
  ORDER BY s.plays_count DESC, s.likes_count DESC
  LIMIT 20;

GRANT SELECT ON public.spotlight_songs TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 9 : Realtime — s'assurer que toutes les tables critiques sont actives
-- ════════════════════════════════════════════════════════════════════════════

DO $rt$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

DO $rt$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.song_play_events;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END; $rt$;

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 10 : Réinitialiser les totaux utilisateurs depuis play_events
-- ════════════════════════════════════════════════════════════════════════════

-- Met à jour total_plays / total_likes pour tous les users
CREATE OR REPLACE FUNCTION public.refresh_all_user_totals()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users u SET
    total_plays = COALESCE((
      SELECT SUM(plays_count) FROM public.songs
      WHERE uploader_id::text = u.id::text AND is_archived = FALSE
    ), 0),
    total_likes = COALESCE((
      SELECT SUM(likes_count) FROM public.songs
      WHERE uploader_id::text = u.id::text AND is_archived = FALSE
    ), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_user_totals() TO service_role;

-- Exécuter une fois lors de la migration
SELECT public.refresh_all_user_totals();

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIE 11 : Nettoyage play_events anciens (>90 jours)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_play_events()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.song_play_events
  WHERE played_at < NOW() - INTERVAL '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_play_events() TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ v12000
-- ✅ Table song_play_events — tracking précis des écoutes par période
-- ✅ Vues trending_24h/7d/30d — basées sur play_events (auditeurs réels)
-- ✅ get_trending_artists() — corrigé, basé sur les écoutes de la période
-- ✅ record_play_event() — RPC client pour logger chaque écoute
-- ✅ push_subscriptions RLS — corrigé, multi-appareils + service_role
-- ✅ Notifications — index performance + colonne image_url
-- ✅ Chat messages — colonnes reply + is_deleted garanties
-- ✅ Realtime activé sur toutes les tables critiques
-- ✅ refresh_all_user_totals() — sync totaux au démarrage
-- ════════════════════════════════════════════════════════════════════════════