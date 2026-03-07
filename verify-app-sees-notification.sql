-- ============================================================
-- VÉRIFIER SI L'APPLICATION VOIT LA NOTIFICATION
-- ============================================================

-- 1. Vérifier toutes les notifications actuelles de l'utilisateur
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

-- 2. Compter les notifications
SELECT 
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
  COUNT(*) FILTER (WHERE type = 'like') as like_notifications,
  user_id
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY user_id;

-- 3. Simuler la requête exacte de l'application
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
ORDER BY created_at DESC
LIMIT 60;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Vérification finale...';
  RAISE NOTICE '✅ Si vous voyez des notifications ici mais pas dans l''app = problème de cache ou de requête';
  RAISE NOTICE '🎯 Actualisez votre application et vérifiez la console';
END $$;
