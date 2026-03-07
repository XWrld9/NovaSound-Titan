-- ============================================================
-- DEBUG : Vérifier l'état de l'authentification depuis l'app
-- ============================================================

-- Dans la console du navigateur de votre application, exécutez :

/*
// 1. Vérifier l'état de l'authentification
supabase.auth.getUser().then(({ data, error }) => {
  console.log('User:', data.user);
  console.log('Error:', error);
  console.log('User ID:', data.user?.id);
});

// 2. Vérifier la session
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('Session:', session);
  console.log('Session user ID:', session?.user?.id);
});

// 3. Tester une requête simple
supabase
  .from('notifications')
  .select('id, user_id, title')
  .eq('user_id', 'VOTRE_USER_ID_ICI')
  .limit(1)
  .then(({ data, error }) => {
    console.log('Notifications:', data);
    console.log('Error:', error);
  });
*/

-- 4. Si vous n'êtes pas connecté, essayez de vous connecter
-- et vérifiez que currentUser.id n'est pas null

-- Message de debug
DO $$
BEGIN
  RAISE NOTICE '🐛 Debug : Le problème est probablement dans l''application web';
  RAISE NOTICE '🔍 Vérifiez que l''utilisateur est bien connecté dans le navigateur';
  RAISE NOTICE '📱 Ouvrez la console de votre application et exécutez les commandes JS ci-dessus';
END $$;
