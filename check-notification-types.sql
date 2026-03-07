-- ============================================================
-- VÉRIFIER LES TYPES DE NOTIFICATIONS AUTORISÉS
-- ============================================================

-- 1. Voir la contrainte CHECK sur la table notifications
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.notifications'::regclass AND contype = 'c';

-- 2. Vérifier les types existants dans la table
SELECT DISTINCT type, COUNT(*) as count
FROM public.notifications 
GROUP BY type
ORDER BY type;

-- 3. Vérifier les notifications actuelles avec les bons types
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
ORDER BY created_at DESC;

-- 4. Tester avec un type valide (selon la contrainte)
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body
) VALUES (
  'df6407a8-7e12-46a1-86f0-bdf505b8b8bb',
  'like',  -- Type valide selon les types usuels
  'Test valide',
  'Test avec type valide'
);

-- 5. Vérifier que l'insertion a fonctionné
SELECT 
  id,
  user_id,
  type,
  title,
  created_at
FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
AND type = 'like'
ORDER BY created_at DESC;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Vérification des types de notifications...';
  RAISE NOTICE '✅ Si l''insertion avec type "like" fonctionne = problème de type';
  RAISE NOTICE '🎯 L''application doit utiliser les types autorisés seulement';
END $$;
