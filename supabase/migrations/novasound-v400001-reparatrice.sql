-- ============================================================
-- NovaSound TITAN LUX — Migration Réparatrice V400001
-- Date: 2026-03-06
-- Objectif : Corriger les incohérences entre le schéma DB,
--            l'Edge Function et le trigger auto-push.
-- ============================================================

-- ─── 1. Élargir la contrainte CHECK sur notifications.type ───────────────────
-- Le schéma actuel manque : live_start, live_invite, queue_song, achievement
-- Ces types sont utilisés par l'Edge Function et le trigger auto-push.
-- Sans cette correction, les INSERTs avec ces types échouent silencieusement.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like',
    'comment',
    'follow',
    'new_song',
    'news',
    'repost',
    'chat_reply',
    'chat_mention',
    'chat_mention_all',
    'mood_vote',
    'live_start',
    'live_invite',
    'live_started',
    'queue_song',
    'achievement'
  ]));

-- ─── 2. Assurer que push_notification_logs.notif_id accepte bigint textualisé ─
-- notif_id est TEXT dans push_notification_logs mais notifications.id est BIGINT.
-- La conversion est faite côté Edge Function (notif_id::TEXT) donc pas de changement
-- de type nécessaire — on s'assure juste que l'index existe pour les lookups.

CREATE INDEX IF NOT EXISTS idx_push_logs_notif_id_text
  ON public.push_notification_logs (notif_id)
  WHERE notif_id IS NOT NULL;

-- ─── 3. S'assurer que push_sent_at existe bien sur notifications ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'push_sent_at'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN push_sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- ─── 4. S'assurer que image_url existe sur notifications ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'image_url'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- ─── 5. Vue admin enrichie (remplace v_notification_stats) ────────────────────
CREATE OR REPLACE VIEW public.v_notification_stats AS
SELECT
  type,
  COUNT(*)                                                       AS total,
  COUNT(*) FILTER (WHERE is_read = false)                       AS unread,
  COUNT(*) FILTER (WHERE push_sent = true)                      AS push_delivered,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24h') AS last_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7d')  AS last_7d,
  ROUND(AVG(EXTRACT(EPOCH FROM (push_sent_at - created_at)))::NUMERIC, 2) AS avg_push_delay_s
FROM public.notifications
WHERE type IS NOT NULL
GROUP BY type
ORDER BY total DESC;

-- ─── 6. Recréer le trigger auto-push avec types mis à jour ───────────────────
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _supabase_url TEXT := current_setting('app.supabase_url', true);
  _service_key  TEXT := current_setting('app.service_role_key', true);
  _payload      JSONB;
BEGIN
  -- Tous les types qui déclenchent un push immédiat
  IF NEW.type NOT IN (
    'like', 'comment', 'follow', 'new_song', 'news',
    'chat_reply', 'chat_mention', 'chat_mention_all',
    'live_start', 'live_invite', 'live_started',
    'achievement', 'queue_song', 'repost', 'mood_vote'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.push_sent = true THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'user_id',   NEW.user_id,
    'title',     NEW.title,
    'body',      NEW.body,
    'url',       COALESCE(NEW.url, NEW.action_url, '/'),
    'type',      NEW.type,
    'notif_id',  NEW.id::TEXT,
    'icon_url',  NEW.icon_url,
    'image_url', NEW.image_url
  );

  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url     := _supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body    := _payload
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_insert_push ON public.notifications;
CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();

-- ─── 7. Index manquant sur notifications.from_user_id ────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_from_user
  ON public.notifications (from_user_id)
  WHERE from_user_id IS NOT NULL;

-- ─── 8. Grants ────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_unread_count(TEXT)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_mark_notifications_read(TEXT) TO authenticated, service_role;
GRANT SELECT ON public.v_notification_stats TO service_role;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Migration V400001 réparatrice terminée.
