-- ============================================================
-- TEST DIRECT DES RESTRICTIONS INSERT
-- ============================================================

-- 1. Tester si les restrictions INSERT fonctionnent réellement
-- Essayons d'insérer avec un user_id fake (ça devrait échouer si les restrictions marchent)

-- Test pour push_subscriptions (doit échouer)
INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES ('fake-user-id', 'https://fake-endpoint.com', 'fake-p256dh', 'fake-auth');

-- Test pour push_notification_logs (doit échouer car on n'est pas service_role)
INSERT INTO public.push_notification_logs (user_id, type, total, sent, failed, status)
VALUES ('fake-user-id', 'test', 1, 0, 1, 'failed');

-- 2. Si les insertions ci-dessus échouent, alors les restrictions MARCHENT !
-- Si elles réussissent, alors il y a un vrai problème.

-- 3. Vérifier l'état actuel des politiques avec une vue différente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY tablename, cmd, policyname;

-- 4. Alternative : vérifier les définitions complètes des politiques
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polqual, p.polrelid) as qualification,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_qualification
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname IN ('push_subscriptions', 'push_notification_logs')
ORDER BY c.relname, p.polcmd;

-- Message de test
DO $$
BEGIN
  RAISE NOTICE '🧪 Test des restrictions INSERT en cours...';
  RAISE NOTICE '❌ Si les INSERT ci-dessus échouent = restrictions OK';
  RAISE NOTICE '✅ Si les INSERT ci-dessus réussissent = problème réel';
END $$;
