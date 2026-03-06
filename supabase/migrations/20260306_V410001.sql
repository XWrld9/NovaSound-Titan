-- ============================================================
-- NovaSound TITAN LUX — Migration V410001
-- Création de la table notifications manquante
-- ============================================================

-- ── 1. Table notifications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
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

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_push_sent
  ON public.notifications (push_sent, created_at DESC)
  WHERE push_sent = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Politiques
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_read_own'
  ) THEN
    CREATE POLICY "notifications_read_own" ON public.notifications 
      FOR SELECT USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_insert_own'
  ) THEN
    CREATE POLICY "notifications_insert_own" ON public.notifications 
      FOR INSERT WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_update_own'
  ) THEN
    CREATE POLICY "notifications_update_own" ON public.notifications 
      FOR UPDATE USING (auth.uid()::text = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'notifications_delete_own'
  ) THEN
    CREATE POLICY "notifications_delete_own" ON public.notifications 
      FOR DELETE USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- Contrainte CHECK pour les types de notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like',
    'comment',
    'follow',
    'new_song',
    'news',
    'repost',
    'chat_reply',
    'chat_mention',
    'chat_mention_all',
    'mood_vote',
    'live_start',
    'live_invite',
    'live_started',
    'queue_song',
    'achievement'
  ]));
