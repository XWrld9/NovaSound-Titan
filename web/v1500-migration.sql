-- ═══════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v1500
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
--
-- PROBLÈME RACINE : toutes les RLS qui font
--   (SELECT email FROM auth.users WHERE id = auth.uid()) = 'eloadxfamily@gmail.com'
-- échouent avec "permission denied for table users" car le rôle
-- `authenticated` ne peut pas lire auth.users directement.
--
-- SOLUTION : utiliser auth.jwt() ->> 'email' (pas de requête SQL)
--            + fonctions RPC SECURITY DEFINER pour les actions admin
--            qui touchent les lignes d'AUTRES utilisateurs.
-- ═══════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. HELPER : fonction qui retourne l'email de l'utilisateur connecté
--    sans passer par auth.users (utilise le JWT directement)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, anon;

-- ════════════════════════════════════════════════════════════════════
-- 2. RLS chat_messages — corriger TOUTES les politiques UPDATE/DELETE
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS chat_update_own           ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_update_own  ON public.chat_messages;
DROP POLICY IF EXISTS chat_admin_update         ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_delete_own  ON public.chat_messages;
DROP POLICY IF EXISTS chat_delete_own           ON public.chat_messages;

-- UPDATE : auteur modifie son propre message (fenêtre 20min gérée côté frontend)
CREATE POLICY chat_update_own ON public.chat_messages
FOR UPDATE
USING  ((auth.uid())::text = user_id OR public.current_user_email() = 'eloadxfamily@gmail.com')
WITH CHECK ((auth.uid())::text = user_id OR public.current_user_email() = 'eloadxfamily@gmail.com');

GRANT UPDATE ON public.chat_messages TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 3. RPC SECURITY DEFINER : nettoyage chat avec filtre de durée
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.clear_chat_messages_admin(
  admin_user_id UUID,
  since_date    TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
  admin_email TEXT;
BEGIN
  -- Vérifier l'email depuis auth.users (SECURITY DEFINER a les droits)
  SELECT email INTO admin_email FROM auth.users WHERE id = admin_user_id;
  IF admin_email IS DISTINCT FROM 'eloadxfamily@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF since_date IS NOT NULL THEN
    UPDATE public.chat_messages
    SET is_deleted = true, cleared_by = admin_user_id, cleared_at = NOW()
    WHERE is_deleted = false AND created_at >= since_date;
  ELSE
    UPDATE public.chat_messages
    SET is_deleted = true, cleared_by = admin_user_id, cleared_at = NOW()
    WHERE is_deleted = false;
  END IF;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clear_chat_messages_admin(UUID, TIMESTAMPTZ) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 4. RPC SECURITY DEFINER : suppression d'un message par l'admin
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_chat_message_admin(
  admin_user_id UUID,
  message_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email TEXT;
BEGIN
  SELECT email INTO admin_email FROM auth.users WHERE id = admin_user_id;
  IF admin_email IS DISTINCT FROM 'eloadxfamily@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE public.chat_messages
  SET is_deleted = true, cleared_by = admin_user_id, cleared_at = NOW()
  WHERE id = message_id AND is_deleted = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_chat_message_admin(UUID, UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 5. RLS songs — admin peut modifier/archiver/supprimer tous les sons
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can update own songs"  ON public.songs;
DROP POLICY IF EXISTS "Users can delete own songs"  ON public.songs;
DROP POLICY IF EXISTS "admin_update_songs"           ON public.songs;
DROP POLICY IF EXISTS "admin_delete_songs"           ON public.songs;

CREATE POLICY "songs_update_own_or_admin" ON public.songs
FOR UPDATE
USING  ((auth.uid())::text = uploader_id OR public.current_user_email() = 'eloadxfamily@gmail.com')
WITH CHECK ((auth.uid())::text = uploader_id OR public.current_user_email() = 'eloadxfamily@gmail.com');

CREATE POLICY "songs_delete_own_or_admin" ON public.songs
FOR DELETE
USING  ((auth.uid())::text = uploader_id OR public.current_user_email() = 'eloadxfamily@gmail.com');

GRANT UPDATE, DELETE ON public.songs TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 6. RLS song_comments — admin peut supprimer les commentaires d'autres
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "comments_delete_own"          ON public.song_comments;
DROP POLICY IF EXISTS "admin_delete_comments"        ON public.song_comments;
DROP POLICY IF EXISTS "comments_update_own"          ON public.song_comments;

CREATE POLICY "comments_delete_own_or_admin" ON public.song_comments
FOR DELETE
USING ((auth.uid())::text = user_id OR public.current_user_email() = 'eloadxfamily@gmail.com');

CREATE POLICY "comments_update_own" ON public.song_comments
FOR UPDATE
USING ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

GRANT UPDATE, DELETE ON public.song_comments TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 7. RLS news_comments — admin peut supprimer les commentaires news
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "news_comments_delete"         ON public.news_comments;
DROP POLICY IF EXISTS "news_comments_update"         ON public.news_comments;

CREATE POLICY "news_comments_delete" ON public.news_comments
FOR DELETE
USING ((auth.uid())::text = user_id OR public.current_user_email() = 'eloadxfamily@gmail.com');

CREATE POLICY "news_comments_update" ON public.news_comments
FOR UPDATE
USING ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

GRANT UPDATE, DELETE ON public.news_comments TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 8. RLS notifications — insert inter-utilisateurs + admin peut tout lire
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "notif_insert"              ON public.notifications;
DROP POLICY IF EXISTS "notif_select"              ON public.notifications;
DROP POLICY IF EXISTS "notif_update"              ON public.notifications;
DROP POLICY IF EXISTS "notif_delete"              ON public.notifications;

CREATE POLICY "notif_select" ON public.notifications
FOR SELECT USING (
  (auth.uid())::text = user_id
  OR public.current_user_email() = 'eloadxfamily@gmail.com'
);

CREATE POLICY "notif_insert" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notif_update" ON public.notifications
FOR UPDATE USING ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "notif_delete" ON public.notifications
FOR DELETE USING (
  (auth.uid())::text = user_id
  OR public.current_user_email() = 'eloadxfamily@gmail.com'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 9. push_subscriptions — politique unique propre (fix upsert 403)
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS push_all     ON public.push_subscriptions;
DROP POLICY IF EXISTS push_insert  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_update  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_select  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_delete  ON public.push_subscriptions;
DROP POLICY IF EXISTS push_upsert  ON public.push_subscriptions;

-- USING(true) permet à Supabase de résoudre le ON CONFLICT endpoint
-- WITH CHECK protège : on ne peut écrire que ses propres lignes
CREATE POLICY push_all ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK ((auth.uid())::text = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 10. Vérification finale
-- ════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✅ NovaSound v1500 migration completed';
  RAISE NOTICE '   • current_user_email() helper créé (JWT-based, sans auth.users)';
  RAISE NOTICE '   • clear_chat_messages_admin() RPC avec filtre de durée';
  RAISE NOTICE '   • delete_chat_message_admin() RPC pour suppression individuelle';
  RAISE NOTICE '   • RLS chat_messages, songs, song_comments, news_comments corrigés';
  RAISE NOTICE '   • RLS notifications : insert inter-users + admin peut tout lire';
  RAISE NOTICE '   • push_subscriptions : politique unique USING(true)';
END $$;

-- ════════════════════════════════════════════════════════════════════
-- VÉRIFICATION : Lance ces SELECT pour confirmer
-- ════════════════════════════════════════════════════════════════════
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'chat_messages';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'songs';
-- SELECT proname FROM pg_proc WHERE proname IN ('clear_chat_messages_admin','delete_chat_message_admin','current_user_email');
