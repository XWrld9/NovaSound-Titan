-- ============================================================
-- CRÉER UN TRIGGER POUR NOTIFICATIONS AUTOMATIQUES
-- ============================================================

-- 1. Vérifier s'il y a déjà un trigger sur les push_notification_logs
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'push_notification_logs';

-- 2. Créer une fonction pour créer automatiquement les notifications
CREATE OR REPLACE FUNCTION create_notification_from_push_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer une notification dans la table notifications
  -- seulement si c'est un push réussi et qu'il y a un user_id
  IF NEW.status = 'sent' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      url,
      icon_url,
      is_read,
      created_at,
      metadata,
      push_sent,
      push_sent_at
    ) VALUES (
      NEW.user_id,
      COALESCE(NEW.type, 'default'),
      COALESCE(
        CASE NEW.type
          WHEN 'like' THEN 'Nouveau like'
          WHEN 'comment' THEN 'Nouveau commentaire'
          WHEN 'follow' THEN 'Nouvel abonné'
          WHEN 'new_song' THEN 'Nouvelle chanson'
          WHEN 'repost' THEN 'Nouveau repost'
          WHEN 'chat_reply' THEN 'Réponse au chat'
          WHEN 'chat_mention' THEN 'Mention dans le chat'
          WHEN 'chat_mention_all' THEN 'Mention générale'
          WHEN 'live_start' THEN 'Live commencé'
          WHEN 'live_invite' THEN 'Invitation live'
          WHEN 'queue_song' THEN 'Chanson ajoutée à la file'
          WHEN 'achievement' THEN 'Succès débloqué'
          ELSE 'Notification'
        END,
        'Notification'
      ),
      COALESCE(
        CASE NEW.type
          WHEN 'like' THEN 'Quelqu''un a aimé votre contenu'
          WHEN 'comment' THEN 'Quelqu''un a commenté'
          WHEN 'follow' THEN 'Quelqu''un vous suit'
          WHEN 'new_song' THEN 'Une nouvelle chanson est disponible'
          WHEN 'repost' THEN 'Quelqu''un a partagé votre contenu'
          WHEN 'chat_reply' THEN 'Quelqu''un a répondu à votre message'
          WHEN 'chat_mention' THEN 'Vous avez été mentionné'
          WHEN 'chat_mention_all' THEN 'Mention générale dans le chat'
          WHEN 'live_start' THEN 'Un live a commencé'
          WHEN 'live_invite' THEN 'Vous êtes invité à un live'
          WHEN 'queue_song' THEN 'Votre chanson a été ajoutée à la file'
          WHEN 'achievement' THEN 'Félicitations !'
          ELSE 'Vous avez une nouvelle notification'
        END,
        'Vous avez une nouvelle notification'
      ),
      NULL, -- url
      NULL, -- icon_url
      false, -- is_read
      NEW.created_at,
      jsonb_build_object('push_log_id', NEW.id, 'sent_count', NEW.sent),
      true,
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Créer le trigger AFTER INSERT sur push_notification_logs
DROP TRIGGER IF EXISTS trigger_create_notification_from_push_log ON public.push_notification_logs;

CREATE TRIGGER trigger_create_notification_from_push_log
  AFTER INSERT ON public.push_notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_from_push_log();

-- 4. Vérifier que le trigger est bien créé
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_condition,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'push_notification_logs' AND trigger_name = 'trigger_create_notification_from_push_log';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger créé pour générer automatiquement les notifications';
  RAISE NOTICE '✅ Chaque push_log réussi créera une notification dans la table notifications';
  RAISE NOTICE '🎯 Les notifications apparaîtront maintenant dans l''application';
END $$;
