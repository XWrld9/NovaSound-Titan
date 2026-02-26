-- ================================================================
-- notifications.sql — NovaSound TITAN LUX v10
-- Système complet de notifications in-app + push
-- ⚠️  Exécuter dans Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. TABLE DES ABONNEMENTS PUSH ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs_all" ON public.push_subscriptions;
CREATE POLICY "push_subs_all"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ── 2. TABLE DES NOTIFICATIONS IN-APP ───────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('like','comment','follow','new_song','news')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  url          TEXT,
  icon_url     TEXT,
  from_user_id TEXT,
  song_id      TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
CREATE POLICY "notif_delete"
  ON public.notifications FOR DELETE
  USING (auth.uid()::text = user_id);

-- ── 3. TRIGGER : LIKE sur un son ────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_song    RECORD;
  v_liker   RECORD;
BEGIN
  SELECT id, title, uploader_id, cover_url INTO v_song
    FROM public.songs WHERE id = NEW.song_id;
  IF NOT FOUND OR v_song.uploader_id IS NULL THEN RETURN NEW; END IF;
  IF v_song.uploader_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_liker
    FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications(user_id, type, title, body, url, icon_url, from_user_id, song_id)
  VALUES (
    v_song.uploader_id, 'like', '❤️ Nouveau like',
    COALESCE(v_liker.username, 'Quelqu''un') || ' a aimé ton son "' || v_song.title || '"',
    '/#/song/' || v_song.id,
    COALESCE(v_liker.avatar_url, v_song.cover_url),
    NEW.user_id, v_song.id::TEXT
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_notify_like ON public.likes;
CREATE TRIGGER trigger_notify_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- ── 4. TRIGGER : COMMENTAIRE sur un son ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_song      RECORD;
  v_commenter RECORD;
BEGIN
  SELECT id, title, uploader_id, cover_url INTO v_song
    FROM public.songs WHERE id = NEW.song_id;
  IF NOT FOUND OR v_song.uploader_id IS NULL THEN RETURN NEW; END IF;
  IF v_song.uploader_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT username, avatar_url INTO v_commenter
    FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications(user_id, type, title, body, url, icon_url, from_user_id, song_id)
  VALUES (
    v_song.uploader_id, 'comment', '💬 Nouveau commentaire',
    COALESCE(v_commenter.username, 'Quelqu''un') || ' : "' || LEFT(NEW.content, 80) || '"',
    '/#/song/' || v_song.id,
    COALESCE(v_commenter.avatar_url, v_song.cover_url),
    NEW.user_id, v_song.id::TEXT
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_notify_comment ON public.song_comments;
CREATE TRIGGER trigger_notify_comment
  AFTER INSERT ON public.song_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ── 5. TRIGGER : FOLLOW d'un artiste ────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_follower RECORD;
BEGIN
  SELECT username, avatar_url INTO v_follower
    FROM public.users WHERE id = NEW.follower_id;

  INSERT INTO public.notifications(user_id, type, title, body, url, icon_url, from_user_id)
  VALUES (
    NEW.following_id, 'follow', '👤 Nouvel abonné',
    COALESCE(v_follower.username, 'Quelqu''un') || ' s''est abonné à ton profil',
    '/#/artist/' || NEW.follower_id,
    v_follower.avatar_url,
    NEW.follower_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_notify_follow ON public.follows;
CREATE TRIGGER trigger_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── 6. TRIGGER : NOUVEAU SON publié ─────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_new_song()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uploader RECORD;
  v_follower RECORD;
BEGIN
  IF NEW.is_archived THEN RETURN NEW; END IF;
  SELECT username, avatar_url INTO v_uploader
    FROM public.users WHERE id = NEW.uploader_id;

  FOR v_follower IN
    SELECT follower_id FROM public.follows WHERE following_id = NEW.uploader_id
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, url, icon_url, from_user_id, song_id)
    VALUES (
      v_follower.follower_id, 'new_song', '🎵 Nouveau son',
      COALESCE(v_uploader.username, 'Un artiste') || ' vient de publier "' || NEW.title || '"',
      '/#/song/' || NEW.id,
      COALESCE(NEW.cover_url, v_uploader.avatar_url),
      NEW.uploader_id, NEW.id::TEXT
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_notify_new_song ON public.songs;
CREATE TRIGGER trigger_notify_new_song
  AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_song();

-- ── 7. Activer Realtime sur notifications ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 8. Nettoyage auto des vieilles notifs (> 30 jours) ───────────
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
$$;

-- ── Vérification ──────────────────────────────────────────────────
SELECT
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table
FROM information_schema.triggers t
WHERE t.trigger_name IN (
  'trigger_notify_like', 'trigger_notify_comment',
  'trigger_notify_follow', 'trigger_notify_new_song'
)
ORDER BY t.event_object_table;
