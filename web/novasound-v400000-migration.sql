-- ============================================================
-- NovaSound TITAN LUX — Migration V400000
-- ============================================================
-- Amélioration i18n, notifications, live rooms, responsiveness
-- ============================================================

-- ── 1. Table i18n_overrides (traductions dynamiques admin) ──
-- Permet aux admins de corriger des clés de traduction sans redéployer
CREATE TABLE IF NOT EXISTS public.i18n_overrides (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  lang        text        NOT NULL CHECK (lang IN ('fr','en','es','it','pt')),
  key         text        NOT NULL,
  value       text        NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i18n_overrides_pkey     PRIMARY KEY (id),
  CONSTRAINT i18n_overrides_lang_key UNIQUE (lang, key),
  CONSTRAINT i18n_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);

-- Index for fast lookups by lang
CREATE INDEX IF NOT EXISTS idx_i18n_overrides_lang ON public.i18n_overrides(lang);

-- RLS
ALTER TABLE public.i18n_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "i18n read all"   ON public.i18n_overrides FOR SELECT USING (true);
CREATE POLICY "i18n admin only" ON public.i18n_overrides FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()::text AND role IN ('admin') AND is_active = true)
  );

-- ── 2. Extend notifications table with new columns ──
-- Add action_label for CTA button text in push notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS group_key    text,
  ADD COLUMN IF NOT EXISTS silent       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renotify     boolean NOT NULL DEFAULT false;

-- Index for grouping notifications (e.g. collapse multiple likes)
CREATE INDEX IF NOT EXISTS idx_notifs_group    ON public.notifications(user_id, group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifs_unread   ON public.notifications(user_id, is_read)   WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifs_created  ON public.notifications(created_at DESC);

-- ── 3. notification_preferences table ──
-- Per-user per-type notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id     text        NOT NULL,
  notif_type  text        NOT NULL,
  push_on     boolean     NOT NULL DEFAULT true,
  in_app_on   boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notif_prefs_pkey PRIMARY KEY (user_id, notif_type),
  CONSTRAINT notif_prefs_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- RLS: each user manages their own preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_prefs own" ON public.notification_preferences
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ── 4. Improve live_rooms table ──
-- Add description and genre fields for richer room cards
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS genre           text,
  ADD COLUMN IF NOT EXISTS cover_url       text,
  ADD COLUMN IF NOT EXISTS allow_requests  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS listeners_count integer NOT NULL DEFAULT 0;

-- ── 5. song_play_events — add source tracking ──
ALTER TABLE public.song_play_events
  ADD COLUMN IF NOT EXISTS source text CHECK (
    source IS NULL OR source IN ('home','explorer','trending','playlist','artist','live','search','local')
  );

-- ── 6. Performance indexes V400000 ──
CREATE INDEX IF NOT EXISTS idx_songs_genre_status   ON public.songs(genre, status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_songs_plays_count     ON public.songs(plays_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_chat_created_at       ON public.chat_messages(created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_follows_following     ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_active     ON public.live_rooms(is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_user        ON public.push_subscriptions(user_id);

-- ── 7. app_meta versioning ──
INSERT INTO public.app_meta (key, value, updated_at)
  VALUES ('version', 'V400000', now())
  ON CONFLICT (key) DO UPDATE SET value = 'V400000', updated_at = now();

INSERT INTO public.app_meta (key, value, updated_at)
  VALUES ('i18n_version', '4', now())
  ON CONFLICT (key) DO UPDATE SET value = '4', updated_at = now();

-- ── 8. Function: get_user_notification_prefs ──
CREATE OR REPLACE FUNCTION public.get_user_notification_prefs(p_user_id text)
RETURNS TABLE (notif_type text, push_on boolean, in_app_on boolean) AS $$
  -- Returns all notification type preferences, defaulting to true if not set
  SELECT
    t.type AS notif_type,
    COALESCE(np.push_on, true)   AS push_on,
    COALESCE(np.in_app_on, true) AS in_app_on
  FROM (
    VALUES
      ('like'), ('comment'), ('follow'), ('new_song'), ('repost'),
      ('news'), ('chat_reply'), ('chat_mention'), ('chat_mention_all'),
      ('mood_vote'), ('live_start'), ('live_invite'), ('queue_song'), ('achievement')
  ) AS t(type)
  LEFT JOIN public.notification_preferences np
    ON np.user_id = p_user_id AND np.notif_type = t.type;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── 9. Function: cleanup_expired_notifications ──
-- Called periodically to remove very old read notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS integer AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.notifications
  WHERE
    (expires_at IS NOT NULL AND expires_at < now())
    OR (is_read = true AND created_at < now() - interval '90 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Done ──
-- Run this migration with: supabase db push
-- Or manually in the Supabase SQL editor
