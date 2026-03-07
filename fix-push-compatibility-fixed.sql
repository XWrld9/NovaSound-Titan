-- ============================================================
-- CORRECTION DES COMPATIBILITÉS PUSH - NovaSound TITAN LUX
-- Les tables existent, on corrige juste les incompatibilités
-- ============================================================

-- 1. Vérifier si RLS est activé sur les tables push
SELECT 
  t.schemaname,
  t.tablename,
  t.rowsecurity
FROM pg_tables t
WHERE t.schemaname = 'public' AND t.tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY t.tablename;

-- 2. Activer RLS si nécessaire
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- 3. Créer/s'assurer que les politiques existent pour push_subscriptions
DROP POLICY IF EXISTS "push_subscriptions_read_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_read_own" ON public.push_subscriptions 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions 
  FOR DELETE USING (auth.uid()::text = user_id);

-- 4. Créer/s'assurer que les politiques existent pour push_notification_logs
DROP POLICY IF EXISTS "push_notification_logs_read_own" ON public.push_notification_logs;
DROP POLICY IF EXISTS "push_notification_logs_insert_service" ON public.push_notification_logs;
DROP POLICY IF EXISTS "push_notification_logs_read_service" ON public.push_notification_logs;

CREATE POLICY "push_notification_logs_read_own" ON public.push_notification_logs 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "push_notification_logs_read_service" ON public.push_notification_logs 
  FOR SELECT USING (auth.role() = 'service_role');

-- 5. Donner les permissions nécessaires
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_subscriptions TO anon; -- Pour l'edge function
GRANT ALL ON public.push_notification_logs TO authenticated;
GRANT ALL ON public.push_notification_logs TO service_role; -- Pour l'edge function

-- 6. Ajouter des index si manquants
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
  ON public.push_subscriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_user_id 
  ON public.push_notification_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_notif_id 
  ON public.push_notification_logs (notif_id);

-- 7. Vérifier les politiques actuelles (corrigé)
SELECT 
  t.schemaname,
  t.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual
FROM pg_policies p
JOIN pg_tables t ON p.tablename = t.tablename
WHERE t.tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY t.tablename, p.cmd, p.policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS configurées pour les tables push';
  RAISE NOTICE '✅ Permissions accordées pour authenticated et service_role';
  RAISE NOTICE '✅ Index de performance créés';
  RAISE NOTICE '🎯 L''edge function devrait maintenant fonctionner';
END $$;
