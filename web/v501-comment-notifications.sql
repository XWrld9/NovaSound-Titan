-- ================================================================
-- v501-comment-notifications.sql — NovaSound TITAN LUX v501
-- Synchronisation des notifications de commentaires de chansons
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Assurer que le type 'comment' est bien supporté
-- ════════════════════════════════════════════════════════════════

-- Vérifier et mettre à jour la contrainte de type pour les notifications
DO $$
BEGIN
  -- Supprimer la contrainte existante si elle existe
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Recréer la contrainte avec tous les types nécessaires
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'like', 'comment', 'follow', 'new_song', 'news',
      'chat_reply', 'chat_mention', 'chat_mention_all'
    ));
  
  RAISE NOTICE '✅ Contrainte notifications_type_check mise à jour avec type comment';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erreur lors de la mise à jour de la contrainte: %', SQLERRM;
END $$;

-- ════════════════════════════════════════════════════════════════
-- INDEX : Optimiser les requêtes de notifications de commentaires
-- ════════════════════════════════════════════════════════════════

-- Index pour filtrer les notifications par type et date
CREATE INDEX IF NOT EXISTS idx_notifications_type_created_at 
ON public.notifications(type, created_at DESC);

-- Index pour les notifications de commentaires spécifiques
CREATE INDEX IF NOT EXISTS idx_notifications_comment_type 
ON public.notifications(type, created_at DESC) 
WHERE type = 'comment';

-- ════════════════════════════════════════════════════════════════
-- NETTOYAGE : Supprimer les anciennes notifications de commentaires invalides
-- ════════════════════════════════════════════════════════════════

-- Nettoyer les notifications orphelines (sans user_id valide)
DELETE FROM public.notifications 
WHERE type = 'comment' 
AND user_id IS NULL 
AND created_at < NOW() - INTERVAL '30 days';

-- ════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Afficher les statistiques
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  total_notifs BIGINT;
  comment_notifs BIGINT;
  unique_users BIGINT;
BEGIN
  -- Nombre total de notifications
  SELECT COUNT(*) INTO total_notifs FROM public.notifications;
  
  -- Nombre de notifications de commentaires
  SELECT COUNT(*) INTO comment_notifs FROM public.notifications WHERE type = 'comment';
  
  -- Nombre d'utilisateurs uniques avec des notifications de commentaires
  SELECT COUNT(DISTINCT user_id) INTO unique_users 
  FROM public.notifications 
  WHERE type = 'comment' AND user_id IS NOT NULL;
  
  RAISE NOTICE '📊 Statistiques des notifications:';
  RAISE NOTICE '   Total notifications: %', total_notifs;
  RAISE NOTICE '   Notifications commentaires: %', comment_notifs;
  RAISE NOTICE '   Utilisateurs uniques (commentaires): %', unique_users;
END $$;

-- ════════════════════════════════════════════════════════════════
-- RÉSULTAT ATTENDU
-- ════════════════════════════════════════════════════════════════
-- ✅ Type 'comment' disponible dans les notifications
-- ✅ Index optimisés pour les requêtes de commentaires
-- ✅ Nettoyage des données invalides
-- ✅ Système prêt pour les notifications de commentaires de chansons

-- FIN DE MIGRATION v501
