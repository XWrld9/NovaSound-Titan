-- ============================================================
-- FORCER LES RESTRICTIONS INSERT - APPROCHE RADICALE
-- ============================================================

-- 1. Désactiver RLS temporairement
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer manuellement les politiques INSERT problématiques
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_notification_logs_insert_service" ON public.push_notification_logs;

-- 3. Réactiver RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- 4. Recréer avec syntaxe différente et plus explicite
-- Pour push_subscriptions
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Pour push_notification_logs (service role uniquement)
CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs
  AS RESTRICTIVE  
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- 5. Vérification avec plus de détails
SELECT 
  t.schemaname,
  t.tablename,
  p.policyname,
  p.permissive,
  p.roles,
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
  RAISE NOTICE '✅ RLS désactivé/réactivé';
  RAISE NOTICE '✅ Politiques INSERT recréées avec syntaxe RESTRICTIVE';
  RAISE NOTICE '✅ Roles explicites (authenticated/service_role)';
  RAISE NOTICE '🎯 Les restrictions devraient maintenant fonctionner';
END $$;
