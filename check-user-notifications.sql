-- ============================================================
-- VÉRIFIER LES NOTIFICATIONS DE L'UTILISATEUR
-- ============================================================

-- 1. Vérifier s'il y a des notifications pour cet utilisateur spécifique
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
LIMIT 10;

-- 2. Compter le nombre total de notifications pour cet utilisateur
SELECT 
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
  user_id
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY user_id;

-- 3. Vérifier toutes les notifications dans la table (pour voir s'il y en a)
SELECT 
  COUNT(*) as total_all_notifications,
  COUNT(DISTINCT user_id) as unique_users
FROM public.notifications;

-- 4. Vérifier les notifications récentes (tous utilisateurs)
SELECT 
  id,
  user_id,
  type,
  title,
  created_at
FROM public.notifications 
ORDER BY created_at DESC
LIMIT 5;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Vérification des notifications pour l''utilisateur df6407a8-7e12-46a1-86f0-bdf505b8b8bb';
  RAISE NOTICE '✅ Si les requêtes retournent des lignes = problème de filtre';
  RAISE NOTICE '❌ Si les requêtes retournent vide = pas de notifications dans la base';
END $$;
