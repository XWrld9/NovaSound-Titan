-- ============================================================
-- NovaSound TITAN LUX — Migration V100000
-- "Live Rooms 2.0 · Sync Audio · Mobile UX"
-- ============================================================
-- Prérequis : migration V60000 déjà exécutée
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. LIVE ROOMS — nouvelles colonnes                     ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS current_audio_url  text,
  ADD COLUMN IF NOT EXISTS total_songs_played integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peak_participants  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at         timestamp with time zone DEFAULT now();

COMMENT ON COLUMN public.live_rooms.current_audio_url  IS 'URL publique du son en cours (y compris fichiers locaux uploadés)';
COMMENT ON COLUMN public.live_rooms.peak_participants  IS 'Record de participants simultanés dans cette session';
COMMENT ON COLUMN public.live_rooms.total_songs_played IS 'Nombre total de sons diffusés depuis la création';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. HISTORIQUE DES LIVES                                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.live_room_history (
  id                 uuid    NOT NULL DEFAULT gen_random_uuid(),
  room_id            text    NOT NULL,
  room_name          text    NOT NULL,
  host_id            text    NOT NULL,
  peak_participants  integer NOT NULL DEFAULT 0,
  total_participants integer NOT NULL DEFAULT 0,
  total_songs_played integer NOT NULL DEFAULT 0,
  duration_s         integer NOT NULL DEFAULT 0,
  started_at         timestamp with time zone NOT NULL DEFAULT now(),
  ended_at           timestamp with time zone,
  CONSTRAINT live_room_history_pkey PRIMARY KEY (id),
  CONSTRAINT live_room_history_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_live_room_history_host
  ON public.live_room_history(host_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_room_history_started
  ON public.live_room_history(started_at DESC);

ALTER TABLE public.live_room_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_room_history' AND policyname = 'live_history_select_all'
  ) THEN
    CREATE POLICY "live_history_select_all"
      ON public.live_room_history FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_room_history' AND policyname = 'live_history_insert_host'
  ) THEN
    CREATE POLICY "live_history_insert_host"
      ON public.live_room_history FOR INSERT
      WITH CHECK (auth.uid()::text = host_id);
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. INDEX DE PERFORMANCE                                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_live_rooms_active_public
  ON public.live_rooms(is_active, is_private, participants_count DESC)
  WHERE is_active = true AND is_private = false;

CREATE INDEX IF NOT EXISTS idx_live_room_messages_room_created
  ON public.live_room_messages(room_id, created_at ASC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_live_rooms_host_active
  ON public.live_rooms(host_id, is_active)
  WHERE is_active = true;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. BUCKET SUPABASE STORAGE : live-room-audio           ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-room-audio',
  'live-room-audio',
  true,
  83886080,
  ARRAY[
    'audio/mpeg','audio/mp3','audio/mp4','audio/ogg',
    'audio/wav','audio/aac','audio/flac','audio/x-m4a',
    'audio/webm','audio/opus'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'live_audio_public_read'
  ) THEN
    CREATE POLICY "live_audio_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'live-room-audio');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'live_audio_auth_upload'
  ) THEN
    CREATE POLICY "live_audio_auth_upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'live-room-audio' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'live_audio_owner_delete'
  ) THEN
    CREATE POLICY "live_audio_owner_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'live-room-audio' AND auth.uid() = owner);
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. FONCTION : nettoyage des lives expirés              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.cleanup_expired_live_rooms()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE cleaned integer;
BEGIN
  UPDATE public.live_rooms
  SET is_active = false, participants_count = 0
  WHERE is_active = true
    AND (
      expires_at < now()
      OR updated_at < now() - interval '2 hours'
    );
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  RETURN cleaned;
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. TYPE NOTIFICATION : live_started                    ║
-- ╚══════════════════════════════════════════════════════════╝

DO $$ BEGIN
  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (
      type = ANY (ARRAY[
        'like','comment','follow','new_song','news','repost',
        'chat_reply','chat_mention','chat_mention_all','mood_vote',
        'live_started'
      ])
    );
END $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  7. VUE : stats live rooms                              ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW public.live_rooms_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_active = true AND is_private = false)       AS active_public_rooms,
  COUNT(*) FILTER (WHERE is_active = true)                               AS active_total_rooms,
  COALESCE(SUM(participants_count) FILTER (WHERE is_active = true), 0)  AS total_live_listeners,
  COUNT(*) FILTER (WHERE started_at > now() - interval '24 hours')      AS rooms_created_24h
FROM public.live_rooms;

COMMENT ON VIEW public.live_rooms_stats IS 'Stats temps réel des Live Rooms — V100000';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  8. app_meta : version                                  ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('schema_version', '100000', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('last_migration', 'V100000 — Live Rooms 2.0 · Sync Audio · Mobile UX', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================
-- FIN DE MIGRATION V100000
-- ============================================================
