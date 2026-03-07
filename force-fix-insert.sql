-- ============================================================
-- FORCER LA CORRECTION DE LA POLITIQUE INSERT
-- ============================================================

-- 1. Désactiver temporairement RLS
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer TOUTES les politiques
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- 3. Réactiver RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Recréer toutes les politiques proprement
CREATE POLICY "notifications_read_own" ON public.notifications 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_insert_own" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications 
  FOR DELETE USING (auth.uid()::text = user_id);

-- 5. Vérification finale
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
  RAISE NOTICE '✅ RLS désactivé/réactivé avec succès';
  RAISE NOTICE '✅ Toutes les politiques recréées proprement';
  RAISE NOTICE '🎯 La politique INSERT devrait maintenant avoir la bonne restriction';
END $$;
