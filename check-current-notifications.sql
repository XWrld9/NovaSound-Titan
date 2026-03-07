-- ============================================================
-- VÉRIFIER L'ÉTAT ACTUEL DES NOTIFICATIONS
-- ============================================================

-- 1. Vérifier toutes les notifications actuelles
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at,
  push_sent,
  metadata
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
ORDER BY created_at DESC;

-- 2. Compter toutes les notifications
SELECT 
  COUNT(*) as total,
  user_id
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY user_id;

-- 3. Vérifier les push_notification_logs récents
SELECT 
  id,
  user_id,
  type,
  status,
  sent,
  failed,
  created_at
FROM public.push_notification_logs 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Tester l'insertion directe (pour voir si les politiques RLS fonctionnent)
-- Cette requête devrait échouer si les politiques sont correctes
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body
) VALUES (
  'df6407a8-7e12-46a1-86f0-bdf505b8b8bb',
  'test_direct',
  'Test direct',
  'Test insertion directe'
);

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Diagnostic des notifications en cours...';
  RAISE NOTICE '✅ Si les notifications existent mais l''app ne les voit pas = problème de requête';
  RAISE NOTICE '❌ Si l''insertion directe échoue = politiques RLS trop restrictives';
END $$;
