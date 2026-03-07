-- ============================================================
-- SOLUTION ULTIME - Supprimer et recréer la table entièrement
-- ============================================================

-- 1. Supprimer complètement la table et ses politiques
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 2. Recréer la table avec la bonne structure
CREATE TABLE public.notifications (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  type        text        NOT NULL,
  title       text        NOT NULL,
  body        text,
  url         text,
  icon_url    text,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  metadata    jsonb,
  -- Colonnes pour push notifications
  push_sent     boolean     NOT NULL DEFAULT false,
  push_sent_at  timestamp with time zone,
  action_label  text,
  group_key     text,
  silent        boolean     NOT NULL DEFAULT false,
  renotify      boolean     NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- 3. Index de performance
CREATE INDEX idx_notifications_user_type ON public.notifications (user_id, type, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notifications_push_sent ON public.notifications (push_sent, created_at DESC) WHERE push_sent = false;

-- 4. Activer RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Créer les politiques (une seule par opération)
CREATE POLICY "notifications_read_own" ON public.notifications 
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_insert_own" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications 
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications 
  FOR DELETE USING (auth.uid()::text = user_id);

-- 6. Contrainte CHECK pour les types
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like', 'comment', 'follow', 'new_song', 'news', 'repost',
    'chat_reply', 'chat_mention', 'chat_mention_all', 'mood_vote',
    'live_start', 'live_invite', 'live_started', 'queue_song', 'achievement'
  ]));

-- 7. Permissions
GRANT ALL ON public.notifications TO authenticated;
GRANT SELECT ON public.notifications TO anon;

-- 8. Vérification finale
SELECT 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Table notifications recréée entièrement';
  RAISE NOTICE '✅ Politiques RLS créées proprement';
  RAISE NOTICE '🎯 La politique INSERT DOIT avoir la bonne restriction maintenant';
END $$;
