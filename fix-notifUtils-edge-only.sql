-- ============================================================
-- SOLUTION : PERMETTRE LES INSERTIONS DE NOTIFICATIONS
-- ============================================================

-- Le problème : notifUtils.js essaie d'insérer directement dans notifications
-- mais les politiques RLS bloquent. On doit permettre les insertions
-- depuis l'application mais seulement pour les types valides.

-- 1. Ajouter une politique pour permettre les insertions depuis l'application
-- (uniquement pour les types valides définis dans la contrainte)
CREATE POLICY "notifications_insert_app" ON public.notifications 
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id AND 
    type IN (
      'like', 'comment', 'follow', 'new_song', 'repost', 'news',
      'chat_reply', 'chat_mention', 'chat_mention_all', 'mood_vote',
      'live_start', 'live_invite', 'queue_song', 'achievement'
    )
  );

-- 2. Vérifier que la politique est bien créée
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_qualification
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'notifications' AND p.polcmd = 'a'
ORDER BY p.polname;

-- 3. Tester l'insertion avec un type valide
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body
) VALUES (
  'df6407a8-7e12-46a1-86f0-bdf505b8b8bb',
  'like',
  'Test app insertion',
  'Test depuis notifUtils'
)
RETURNING id, type, title;

-- 4. Nettoyer le test
DELETE FROM public.notifications 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb' 
AND type = 'like' 
AND title = 'Test app insertion';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Politique d''insertion pour l''application créée';
  RAISE NOTICE '✅ notifUtils.js pourra maintenant insérer des notifications';
  RAISE NOTICE '🎯 Seuls les types valides sont autorisés';
END $$;
