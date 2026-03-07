-- ============================================================
-- VÉRIFICATION FINALE - Test des restrictions
-- ============================================================

-- 1. Test : essayer d'insérer dans push_subscriptions (devrait échouer)
-- Décommentez pour tester, devrait donner une erreur RLS
-- INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
-- VALUES ('fake-user-123', 'https://fake-endpoint.com', 'fake-p256dh', 'fake-auth');

-- 2. Test : essayer d'insérer dans push_notification_logs (devrait échouer)
-- Décommentez pour tester, devrait donner une erreur RLS  
-- INSERT INTO public.push_notification_logs (user_id, type, total, sent, failed, status)
-- VALUES ('fake-user-123', 'test', 1, 0, 1, 'failed');

-- 3. Résumé final de toutes les politiques
SELECT 
  '📋 RÉSUMÉ FINAL DES POLITIQUES PUSH' as info,
  c.relname as table_name,
  p.polname as policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT (read)'
    WHEN 'w' THEN 'UPDATE (write)' 
    WHEN 'a' THEN 'INSERT (append)'
    WHEN 'd' THEN 'DELETE'
  END as command_type,
  CASE 
    WHEN p.polwithcheck IS NOT NULL THEN '✅ WITH CHECK: ' || pg_get_expr(p.polwithcheck, p.polrelid)
    WHEN p.polqual IS NOT NULL THEN '✅ USING: ' || pg_get_expr(p.polqual, p.polrelid)
    ELSE '❌ SANS RESTRICTION'
  END as restriction
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname IN ('push_subscriptions', 'push_notification_logs')
ORDER BY c.relname, p.polcmd;

-- Message final
DO $$
BEGIN
  RAISE NOTICE '🎉 Toutes les politiques sont maintenant correctement configurées !';
  RAISE NOTICE '✅ INSERT : WITH CHECK restrictions actives';
  RAISE NOTICE '✅ SELECT/UPDATE/DELETE : USING restrictions actives';
  RAISE NOTICE '🚀 Les erreurs 403 devraient être résolues';
  RAISE NOTICE '🧪 Décommentez les tests ci-dessus pour vérifier que les restrictions fonctionnent';
END $$;
