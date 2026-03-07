-- ============================================================
-- CORRECTION FINALE DE LA POLITIQUE INSERT
-- ============================================================

-- 1. Supprimer la politique INSERT incorrecte
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;

-- 2. Recréer la politique INSERT avec la bonne restriction
CREATE POLICY "notifications_insert_own" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 3. Vérification finale
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
  RAISE NOTICE '✅ Politique INSERT corrigée avec restriction auth.uid()';
  RAISE NOTICE '🎯 Toutes les erreurs 403 devraient maintenant être résolues';
END $$;
