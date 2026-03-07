-- ============================================================
-- CORRECTION FINALE DES POLITIQUES INSERT
-- ============================================================

-- 1. Corriger push_subscriptions INSERT
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 2. Corriger push_notification_logs INSERT
DROP POLICY IF EXISTS "push_notification_logs_insert_service" ON public.push_notification_logs;

CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 3. Vérification finale
SELECT 
  t.schemaname,
  t.tablename,
  p.policyname,
  p.cmd,
  p.qual,
  CASE 
    WHEN p.qual IS NULL THEN '❌ SANS RESTRICTION'
    WHEN p.qual LIKE '%auth.uid()%' THEN '✅ UTILISATEUR'
    WHEN p.qual LIKE '%service_role%' THEN '✅ SERVICE'
    ELSE '⚠️ AUTRE'
  END as statut
FROM pg_policies p
JOIN pg_tables t ON p.tablename = t.tablename
WHERE t.tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY t.tablename, p.cmd, p.policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques INSERT corrigées avec restrictions';
  RAISE NOTICE '🎯 Toutes les erreurs 403 devraient maintenant être résolues';
END $$;
