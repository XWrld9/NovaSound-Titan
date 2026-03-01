-- ════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v3000
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. Table pending_messages — Background Sync offline
-- (pas de colonne room : chat_messages n'en a pas)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.pending_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at   TIMESTAMPTZ,
  is_synced   BOOLEAN     NOT NULL DEFAULT FALSE
);

ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pending_messages_policy ON public.pending_messages;
CREATE POLICY pending_messages_policy ON public.pending_messages
  FOR ALL
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_messages TO authenticated;

CREATE INDEX IF NOT EXISTS idx_pending_messages_user_id   ON public.pending_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_is_synced ON public.pending_messages (is_synced) WHERE is_synced = FALSE;

-- ════════════════════════════════════════════════════════════════════
-- 2. Colonnes supplémentaires dans notifications
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'icon_url'
  ) THEN ALTER TABLE public.notifications ADD COLUMN icon_url TEXT; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'badge_url'
  ) THEN ALTER TABLE public.notifications ADD COLUMN badge_url TEXT DEFAULT '/notification-badge.png'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'image_url'
  ) THEN ALTER TABLE public.notifications ADD COLUMN image_url TEXT; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 3. Index manquants sur notifications
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- 4. Fonction : nombre de notifs non lues
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id TEXT)
RETURNS BIGINT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*) FROM public.notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
$$;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 5. Fonction : créer une notification avec badge v3000
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id   TEXT,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT,
  p_url       TEXT  DEFAULT NULL,
  p_icon_url  TEXT  DEFAULT NULL,
  p_image_url TEXT  DEFAULT NULL,
  p_data      JSONB DEFAULT NULL
)
RETURNS UUID LANGUAGE PLPGSQL SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, type, title, body, url, icon_url, image_url, badge_url, data, is_read, created_at
  ) VALUES (
    p_user_id, p_type, p_title, p_body, p_url,
    COALESCE(p_icon_url, '/icon-192.png'),
    p_image_url,
    '/notification-badge.png',
    p_data, FALSE, NOW()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_notification(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 6. Colonne updated_at sur push_subscriptions (si absente)
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_subscriptions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- 7. Nettoyage push_subscriptions inactives (>90 jours)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_expired_push_subscriptions()
RETURNS void LANGUAGE SQL SECURITY DEFINER AS $$
  DELETE FROM public.push_subscriptions WHERE updated_at < NOW() - INTERVAL '90 days';
$$;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_push_subscriptions() TO service_role;

-- ════════════════════════════════════════════════════════════════════
-- 8. Index performances
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id  ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_desc  ON public.chat_messages (created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- 9. Vérification finale
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✅ NovaSound v3000 migration completed';
  RAISE NOTICE '   • pending_messages (Background Sync — sans colonne room)';
  RAISE NOTICE '   • notifications: icon_url, badge_url, image_url';
  RAISE NOTICE '   • get_unread_notification_count() RPC';
  RAISE NOTICE '   • create_notification() RPC';
  RAISE NOTICE '   • cleanup_expired_push_subscriptions() + trigger updated_at';
  RAISE NOTICE '   • Index performances chat_messages, push_subscriptions, notifications';
END $$;

COMMIT;
