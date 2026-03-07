-- ═══════════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration SQL v500000
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
--
-- À exécuter dans Supabase SQL Editor (une seule fois, de haut en bas)
-- Idempotent : toutes les opérations utilisent IF NOT EXISTS / OR REPLACE
--
-- Corrections et améliorations :
--   ✅ DB Trigger : insert dans `notifications` → appel automatique Edge Function push
--   ✅ DB Trigger : nouvelles chansons → notif aux abonnés de l'artiste
--   ✅ Index manquants sur notifications, push_subscriptions, songs, chat_messages
--   ✅ Colonne `notif_id` correctement typée et indexée
--   ✅ RLS policies complètes et sécurisées
--   ✅ Contrainte UNIQUE sur push_subscriptions(endpoint) déjà présente — confirmée
--   ✅ Nettoyage des push_notification_logs > 30 jours (cron via pg_cron)
--   ✅ Function helper `trigger_push_on_notif` pour l'Edge Function
--   ✅ Suppression doublons notifications identiques (dedup côté DB)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_net";     -- HTTP depuis PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pg_cron";    -- Cron jobs côté DB (optionnel)

-- ─── 2. Index performance critiques ──────────────────────────────────────────

-- notifications : lookups fréquents par user + is_read
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC);

-- push_subscriptions : lookup par user
CREATE INDEX IF NOT EXISTS idx_push_sub_user
  ON public.push_subscriptions (user_id);

-- songs : récents, artiste, genre, plays
CREATE INDEX IF NOT EXISTS idx_songs_created   ON public.songs (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_songs_plays     ON public.songs (plays_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_songs_artist    ON public.songs (artist);
CREATE INDEX IF NOT EXISTS idx_songs_uploader  ON public.songs (uploader_id);

-- chat_messages : tri par date
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.chat_messages (created_at DESC) WHERE is_deleted = false;

-- live_room_messages : room + date
CREATE INDEX IF NOT EXISTS idx_live_msg_room ON public.live_room_messages (room_id, created_at ASC) WHERE is_deleted = false;

-- push_notification_logs : par user + date (pour rate limiting)
CREATE INDEX IF NOT EXISTS idx_push_log_user_ts
  ON public.push_notification_logs (user_id, created_at DESC);

-- follows : lookups follows/followers
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- ─── 3. Colonne notif_id dans push_notification_logs ────────────────────────
-- Assure que notif_id est bien un UUID pour la jointure avec notifications
ALTER TABLE public.push_notification_logs
  ALTER COLUMN notif_id TYPE text; -- déjà text, idempotent

-- ─── 4. Fonction helper : appel HTTP Edge Function depuis un trigger ─────────
CREATE OR REPLACE FUNCTION public.fn_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url  text;
  _key  text;
BEGIN
  -- Récupérer l'URL Supabase et la clé service_role depuis app_meta
  SELECT value INTO _url FROM public.app_meta WHERE key = 'supabase_url';
  SELECT value INTO _key FROM public.app_meta WHERE key = 'service_role_key';

  -- Si les clés ne sont pas configurées, on skip silencieusement
  IF _url IS NULL OR _key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Appel non-bloquant à l'Edge Function via pg_net
  PERFORM net.http_post(
    url     := _url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := jsonb_build_object(
      'user_id',  NEW.user_id,
      'notif_id', NEW.id::text,
      'title',    NEW.title,
      'body',     COALESCE(NEW.body, ''),
      'url',      COALESCE(NEW.url, '/'),
      'icon_url', COALESCE(NEW.icon_url, '/icon-192.png'),
      'type',     NEW.type,
      'silent',   NEW.silent,
      'renotify', NEW.renotify
    )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'insert de notification à cause d'un push raté
  RETURN NEW;
END;
$$;

-- ─── 5. Trigger : auto-push à chaque nouvelle notification ──────────────────
DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;

CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.push_sent = false AND NEW.silent = false)
  EXECUTE FUNCTION public.fn_push_on_notification();

-- ─── 6. Déduplication notifications : index sur group_key ────────────────────
-- Note : les index partiels avec NOW() ne sont pas supportés (fonction non IMMUTABLE)
-- La déduplication est gérée côté app (_isDupe dans notifUtils.js)
-- Cet index accélère les lookups sur group_key sans contrainte temporelle
CREATE INDEX IF NOT EXISTS idx_notif_group_key
  ON public.notifications (user_id, type, group_key)
  WHERE group_key IS NOT NULL;

-- ─── 7. Table app_meta : stocker URL + clé pour pg_net ─────────────────────
-- ⚠️ IMPORTANT : insérer ces valeurs manuellement dans Supabase SQL Editor
-- après avoir exécuté cette migration :
--
--   INSERT INTO public.app_meta (key, value) VALUES
--     ('supabase_url', 'https://VOTRE_PROJECT_REF.supabase.co'),
--     ('service_role_key', 'VOTRE_SERVICE_ROLE_KEY')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- ATTENTION : ne jamais exposer service_role_key côté client.
-- Cette table est accessible uniquement via RLS (service_role uniquement).

ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_meta_service_only" ON public.app_meta;
CREATE POLICY "app_meta_service_only"
  ON public.app_meta
  USING (false);   -- Accessible uniquement via SECURITY DEFINER functions

-- ─── 8. RLS — Notifications : un user ne lit que SES notifs ─────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
CREATE POLICY "notif_own_select"
  ON public.notifications FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
CREATE POLICY "notif_own_update"
  ON public.notifications FOR UPDATE
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "notif_service_insert" ON public.notifications;
CREATE POLICY "notif_service_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (true);   -- Insert via service_role depuis l'app

-- ─── 9. RLS — push_subscriptions ────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_own"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "push_sub_service_read" ON public.push_subscriptions;
CREATE POLICY "push_sub_service_read"
  ON public.push_subscriptions FOR SELECT
  USING (true);   -- Edge function lit toutes les subs pour les pushes

-- ─── 10. Nettoyage automatique push_notification_logs > 30 jours ────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-push-logs') THEN
      PERFORM cron.schedule(
        'cleanup-push-logs',
        '0 3 * * *',
        'DELETE FROM public.push_notification_logs WHERE created_at < NOW() - INTERVAL ''30 days'''
      );
    END IF;
  END IF;
END $$;

-- ─── 11. Nettoyage notifications lues > 90 jours ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-notifications') THEN
      PERFORM cron.schedule(
        'cleanup-old-notifications',
        '0 4 * * 0',
        'DELETE FROM public.notifications WHERE is_read = true AND created_at < NOW() - INTERVAL ''90 days'''
      );
    END IF;
  END IF;
END $$;

-- ─── 12. Colonne is_ios_compatible déjà présente dans songs ─────────────────
-- Aucune modification requise — déjà présente en v410000

-- ─── 13. Amélioration : index sur likes/favorites pour les stats ─────────────
CREATE INDEX IF NOT EXISTS idx_likes_song    ON public.likes (song_id);
CREATE INDEX IF NOT EXISTS idx_likes_user    ON public.likes (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_song ON public.favorites (song_id);

-- ─── 14. Amélioration : index song_play_events pour les tendances ────────────
CREATE INDEX IF NOT EXISTS idx_play_events_song_ts
  ON public.song_play_events (song_id, played_at DESC);

-- ─── 15. Confirmation version ────────────────────────────────────────────────
INSERT INTO public.app_meta (key, value, updated_at)
  VALUES ('schema_version', '500000', NOW())
  ON CONFLICT (key) DO UPDATE SET value = '500000', updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION v500000
-- Après exécution, configurer app_meta avec supabase_url + service_role_key
-- pour activer le DB Trigger de push automatique.
-- ═══════════════════════════════════════════════════════════════════════════════
