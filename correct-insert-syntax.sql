-- ============================================================
-- CORRECTION SYNTAXE INSERT - WITH CHECK UNIQUEMENT
-- ============================================================

-- 1. Supprimer les anciennes politiques INSERT incorrectes
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_notification_logs_insert_service" ON public.push_notification_logs;

-- 2. Recréer avec la syntaxe correcte (ONLY WITH CHECK pour INSERT)
-- Pour push_subscriptions
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Pour push_notification_logs (service role uniquement)
CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 3. Vérification avec la bonne vue qui montre WITH CHECK
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

-- 4. Test simple pour vérifier que ça marche
-- Ce test devrait échouer si les restrictions sont correctes
-- (Commenté pour l'instant, à décommenter pour test)
-- INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
-- VALUES ('fake-user', 'https://fake.com', 'fake', 'fake');

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Syntaxe INSERT corrigée : WITH CHECK uniquement';
  RAISE NOTICE '✅ Plus d''erreur USING pour les politiques INSERT';
  RAISE NOTICE '🎯 Les restrictions devraient maintenant fonctionner';
END $$;
