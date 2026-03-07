-- ============================================================
-- TEST D'AUTHENTIFICATION POUR NOTIFICATIONS
-- ============================================================

-- 1. Test direct : qui suis-je ?
SELECT 
  auth.uid() as current_uid,
  auth.role() as current_role,
  auth.email() as current_email,
  'user_info' as info;

-- 2. Test simple : essayer de lire nos propres notifications
-- Cette requête devrait fonctionner si l'auth est OK
SELECT 
  id,
  user_id,
  type,
  title,
  is_read,
  created_at
FROM public.notifications 
WHERE auth.uid()::text = user_id
LIMIT 5;

-- 3. Test : essayer d'insérer une notification test
-- Cette requête devrait fonctionner si l'auth est OK
INSERT INTO public.notifications (
  user_id, 
  type, 
  title, 
  body
) 
VALUES (
  auth.uid()::text,
  'test',
  'Notification test',
  'Ceci est un test'
)
RETURNING id, user_id, type, title;

-- 4. Nettoyer le test
DELETE FROM public.notifications 
WHERE type = 'test' AND user_id = auth.uid()::text;

-- Message de test
DO $$
BEGIN
  RAISE NOTICE '🧪 Test d''authentification en cours...';
  RAISE NOTICE '✅ Si tout fonctionne = problème ailleurs';
  RAISE NOTICE '❌ Si erreurs 403 = problème d''auth';
END $$;
