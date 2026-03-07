-- ============================================================
-- TEST DU TRIGGER DE NOTIFICATIONS
-- ============================================================

-- 1. Insérer un test dans push_notification_logs (ça devrait déclencher le trigger)
INSERT INTO public.push_notification_logs (
  user_id,
  type,
  is_broadcast,
  total,
  sent,
  failed,
  purged,
  avg_ms,
  status,
  created_at
) VALUES (
  'df6407a8-7e12-46a1-86f0-bdf505b8b8bb',  -- Votre user_id
  'like',
  false,
  1,
  1,
  0,
  0,
  100,
  'sent',
  NOW()
);

-- 2. Vérifier si une notification a été créée automatiquement
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
ORDER BY created_at DESC
LIMIT 5;

-- 3. Compter les notifications pour cet utilisateur
SELECT 
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
  user_id
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY user_id;

-- 4. Nettoyer le test
DELETE FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb' 
AND type = 'like' 
AND created_at >= NOW() - INTERVAL '1 minute';

DELETE FROM public.push_notification_logs 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb' 
AND type = 'like' 
AND created_at >= NOW() - INTERVAL '1 minute';

-- Message de test
DO $$
BEGIN
  RAISE NOTICE '🧪 Test du trigger en cours...';
  RAISE NOTICE '✅ Si une notification apparaît = trigger fonctionne';
  RAISE NOTICE '🎯 Les notifications devraient maintenant être synchronisées';
END $$;
