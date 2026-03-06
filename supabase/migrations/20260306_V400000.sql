-- ============================================================
-- NovaSound TITAN LUX — Migration V400000
-- Date: 2026-03-06
-- ============================================================
-- Améliorations :
-- 1. Index de performance sur notifications (type, user_id, created_at)
-- 2. DB Trigger : auto-push sur INSERT dans notifications
-- 3. Push rate limit tracking (index sur push_notification_logs)
-- 4. Vue v_notification_stats pour admin
-- 5. Fonction utilitaire get_unread_count(user_id)
-- ============================================================

-- ─── 1. Index de performance sur notifications ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_push_sent
  ON public.notifications (push_sent, created_at DESC)
  WHERE push_sent = false;

-- ─── 2. Index sur push_notification_logs pour rate limiting ──────────────────
CREATE INDEX IF NOT EXISTS idx_push_logs_user_created
  ON public.push_notification_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_logs_notif_id
  ON public.push_notification_logs (notif_id)
  WHERE notif_id IS NOT NULL;

-- ─── 3. Index sur push_subscriptions ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id
  ON public.push_subscriptions (user_id);

-- ─── 4. Vue d'administration des notifications ───────────────────────────────
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

-- ─── 5. Fonction get_unread_count ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- ─── 6. Fonction bulk_mark_read ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_mark_notifications_read(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = p_user_id
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ─── 7. Colonne action_url si absente ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'action_url'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
  END IF;
END $$;

-- ─── 8. RLS policies for notifications ───────────────────────────────────────
-- Assure que les utilisateurs ne voient que leurs propres notifications
DO $$
BEGIN
  -- Enable RLS if not already
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

  -- Policy: users can select their own notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_select_own'
  ) THEN
    CREATE POLICY notifications_select_own
      ON public.notifications
      FOR SELECT
      USING (user_id = auth.uid()::TEXT OR auth.role() = 'service_role');
  END IF;

  -- Policy: users can update their own notifications (mark as read, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_update_own'
  ) THEN
    CREATE POLICY notifications_update_own
      ON public.notifications
      FOR UPDATE
      USING (user_id = auth.uid()::TEXT OR auth.role() = 'service_role');
  END IF;

  -- Policy: users can delete their own notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_delete_own'
  ) THEN
    CREATE POLICY notifications_delete_own
      ON public.notifications
      FOR DELETE
      USING (user_id = auth.uid()::TEXT OR auth.role() = 'service_role');
  END IF;

  -- Policy: service_role can insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_insert_service'
  ) THEN
    CREATE POLICY notifications_insert_service
      ON public.notifications
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR user_id = auth.uid()::TEXT);
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- RLS might already be enabled or policies might exist
  RAISE NOTICE 'RLS setup: %', SQLERRM;
END $$;

-- ─── 9. Trigger function: auto-push on notification insert ───────────────────
-- Note: This calls the edge function via pg_net (requires pg_net extension)
-- Activate with: CREATE EXTENSION IF NOT EXISTS pg_net;

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
  -- Only trigger for high-urgency types that need immediate push
  IF NEW.type NOT IN ('like', 'comment', 'follow', 'new_song', 'chat_reply', 'chat_mention', 'chat_mention_all', 'live_start', 'live_invite', 'achievement') THEN
    RETURN NEW;
  END IF;

  -- Skip if push was already sent
  IF NEW.push_sent = true THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'user_id',  NEW.user_id,
    'title',    NEW.title,
    'body',     NEW.body,
    'url',      COALESCE(NEW.url, NEW.action_url, '/'),
    'type',     NEW.type,
    'notif_id', NEW.id::TEXT,
    'icon_url', NEW.icon_url,
    'image_url', NEW.image_url
  );

  -- Use pg_net to call edge function asynchronously
  IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url     := _supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body    := _payload
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the original INSERT
  RAISE WARNING 'Push trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS on_notification_insert_push ON public.notifications;

CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();

-- ─── 10. Grant permissions ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_unread_count(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_mark_notifications_read(TEXT) TO authenticated, service_role;
GRANT SELECT ON public.v_notification_stats TO service_role;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- V400000 migration complete.
-- To activate DB trigger auto-push:
--   1. Run: CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Set: ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
--   3. Set: ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
