-- ============================================================
-- NETTOYAGE DES POLITIQUES PUSH EN DOUBLE - NovaSound TITAN LUX
-- ============================================================

-- 1. Supprimer TOUTES les politiques existantes pour repartir propre
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('push_subscriptions', 'push_notification_logs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
    END LOOP;
END $$;

-- 2. Recréer uniquement les politiques essentielles et propres

-- Pour push_subscriptions
CREATE POLICY "push_subscriptions_read_own" ON public.push_subscriptions 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions 
  FOR DELETE USING (auth.uid()::text = user_id);

-- Pour push_notification_logs
CREATE POLICY "push_notification_logs_read_own" ON public.push_notification_logs 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_notification_logs_insert_service" ON public.push_notification_logs 
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "push_notification_logs_read_service" ON public.push_notification_logs 
  FOR SELECT USING (auth.role() = 'service_role');

-- 3. S'assurer que les permissions sont correctes
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_notification_logs TO authenticated;
GRANT ALL ON public.push_notification_logs TO service_role;

-- 4. Vérification finale
SELECT 
  t.schemaname,
  t.tablename,
  p.policyname,
  p.permissive,
  p.cmd,
  p.qual
FROM pg_policies p
JOIN pg_tables t ON p.tablename = t.tablename
WHERE t.tablename IN ('push_subscriptions', 'push_notification_logs')
ORDER BY t.tablename, p.cmd, p.policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Nettoyage des politiques push terminé';
  RAISE NOTICE '✅ Seules les politiques essentielles restent';
  RAISE NOTICE '✅ Plus de conflits de politiques';
  RAISE NOTICE '🎯 L''edge function devrait maintenant fonctionner sans problème';
END $$;
