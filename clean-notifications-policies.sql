-- ============================================================
-- NETTOYAGE DES POLITIQUES NOTIFICATIONS - NovaSound TITAN LUX
-- Exécuter ce script dans Supabase SQL Editor
-- ============================================================

-- 1. Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- 2. Recréer les politiques correctes (une seule par opération)
CREATE POLICY "notifications_read_own" ON public.notifications 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_insert_own" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications 
  FOR DELETE USING (auth.uid()::text = user_id);

-- 3. Vérification
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques nettoyées avec succès';
  RAISE NOTICE '✅ Seules les politiques essentielles restent';
  RAISE NOTICE '🎯 Les erreurs 403 devraient être résolues';
END $$;
