-- ============================================================
-- CRÉATION DES TABLES POUR PUSH NOTIFICATIONS - NovaSound TITAN LUX
-- Requis pour l'edge function send-push-notification
-- ============================================================

-- 1. Table push_subscriptions (pour stocker les abonnements push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

-- 2. Table push_notification_logs (pour le suivi des envois)
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  notif_id    uuid,
  user_id     text,
  type        text        NOT NULL,
  is_broadcast boolean    NOT NULL DEFAULT false,
  total       integer     NOT NULL DEFAULT 0,
  sent        integer     NOT NULL DEFAULT 0,
  failed      integer     NOT NULL DEFAULT 0,
  purged      integer     NOT NULL DEFAULT 0,
  avg_ms      integer,
  status      text        NOT NULL DEFAULT 'pending',
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_notification_logs_pkey PRIMARY KEY (id)
);

-- 3. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
  ON public.push_subscriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_user_id 
  ON public.push_notification_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_notif_id 
  ON public.push_notification_logs (notif_id);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status 
  ON public.push_notification_logs (status, created_at DESC);

-- 4. Activer RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS pour push_subscriptions
CREATE POLICY "push_subscriptions_read_own" ON public.push_subscriptions 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions 
  FOR DELETE USING (auth.uid()::text = user_id);

-- 6. Politiques RLS pour push_notification_logs
CREATE POLICY "push_notification_logs_read_own" ON public.push_notification_logs 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 7. Permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_subscriptions TO anon; -- Pour l'edge function
GRANT ALL ON public.push_notification_logs TO authenticated;
GRANT INSERT ON public.push_notification_logs TO service_role; -- Pour l'edge function

-- 8. Contraintes CHECK
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_type_check
  CHECK (endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL);

ALTER TABLE public.push_notification_logs
  ADD CONSTRAINT push_notification_logs_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'rate_limited'));

-- 9. Vérification
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY tablename;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Tables push_subscriptions et push_notification_logs créées';
  RAISE NOTICE '✅ Index créés pour les performances';
  RAISE NOTICE '✅ Politiques RLS appliquées';
  RAISE NOTICE '✅ Permissions configurées';
  RAISE NOTICE '🎯 L''edge function devrait maintenant fonctionner';
END $$;
