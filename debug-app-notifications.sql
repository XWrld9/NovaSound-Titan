-- ============================================================
-- DEBUG : VÉRIFIER CE QUE L'APPLICATION ESSAIE DE FAIRE
-- ============================================================

-- 1. Vérifier les tentatives récentes de création de notifications
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  created_at,
  metadata
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Vérifier les logs de push récents
SELECT 
  id,
  user_id,
  type,
  status,
  sent,
  failed,
  created_at,
  metadata
FROM public.push_notification_logs 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Compter les problèmes
SELECT 
  'notifications' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'

UNION ALL

SELECT 
  'push_logs' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour
FROM public.push_notification_logs 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb';

-- 4. Vérifier les types de notifications utilisés récemment
SELECT DISTINCT type, COUNT(*) as count
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY type
ORDER BY count DESC;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Diagnostic des problèmes en cours...';
  RAISE NOTICE '❌ Si peu de notifications = problème de création';
  RAISE NOTICE '🎯 L''application doit utiliser le système push correctement';
END $$;
