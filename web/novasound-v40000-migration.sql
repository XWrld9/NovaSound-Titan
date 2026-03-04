-- ============================================================
-- NovaSound TITAN LUX — Migration V40000
-- ============================================================
-- Exécuter dans Supabase SQL Editor (une seule fois)
-- Ce script est cumulatif et safe (IF NOT EXISTS partout)
-- ============================================================

-- ── 1. Live Room Queue table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_room_queue (
  id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  room_id     text    NOT NULL,
  song_id     text,
  position    integer NOT NULL DEFAULT 0,
  added_by    text,
  song_data   jsonb,           -- snapshot si song_id est null (fichier local)
  added_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT live_room_queue_pkey PRIMARY KEY (id),
  CONSTRAINT live_room_queue_room_id_fkey  FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  CONSTRAINT live_room_queue_song_id_fkey  FOREIGN KEY (song_id) REFERENCES public.songs(id)      ON DELETE SET NULL
);

-- ── 2. Index performance ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_live_room_queue_room     ON public.live_room_queue(room_id, position);
CREATE INDEX IF NOT EXISTS idx_live_room_messages_room  ON public.live_room_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read  ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_archived_plays     ON public.songs(is_archived, plays_count DESC) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_songs_archived_created   ON public.songs(is_archived, created_at DESC) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following        ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower         ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_song_comments_song       ON public.song_comments(song_id, created_at DESC) WHERE is_deleted = false;

-- ── 3. Live room: cleanup inactive > 24h ─────────────────────
-- Colonne pour TTL de la salle
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone DEFAULT (now() + interval '24 hours');

-- ── 4. Notification types pour live rooms ─────────────────────
INSERT INTO public.notification_types (type_key, type_name, description, icon, color)
VALUES
  ('live_start',   'Live démarré',    'Une salle live a démarré',         '📡', '#ef4444'),
  ('live_invite',  'Invitation live', 'Tu as été invité dans une salle',  '🎙️', '#8b5cf6'),
  ('queue_song',   'Musique ajoutée', 'Un son a été ajouté à la file',    '🎵', '#06b6d4')
ON CONFLICT (type_key) DO NOTHING;

-- ── 5. Achievement: Premier live ─────────────────────────────
INSERT INTO public.achievement_definitions (code, label, description, icon, points, rarity)
VALUES
  ('first_live',     'Premier Live',     'Ta première session live',                '📡', 15,  'common'),
  ('live_host',      'Hôte confirmé',    'Héberger 5 salles live',                  '👑', 50,  'rare'),
  ('live_marathon',  'Marathon Live',    'Rester en live pendant 30 minutes',        '⏱️', 75,  'epic'),
  ('live_social',    'Rassembleur',      'Avoir 10 participants dans ta salle',      '🎉', 100, 'legendary')
ON CONFLICT (code) DO NOTHING;

-- ── 6. RLS pour live_room_queue ──────────────────────────────
ALTER TABLE public.live_room_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_room_queue' AND policyname='live_room_queue_read') THEN
    CREATE POLICY "live_room_queue_read" ON public.live_room_queue FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_room_queue' AND policyname='live_room_queue_insert') THEN
    CREATE POLICY "live_room_queue_insert" ON public.live_room_queue FOR INSERT
      WITH CHECK (auth.uid()::text IN (SELECT host_id FROM public.live_rooms WHERE id = room_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_room_queue' AND policyname='live_room_queue_delete') THEN
    CREATE POLICY "live_room_queue_delete" ON public.live_room_queue FOR DELETE
      USING (auth.uid()::text IN (SELECT host_id FROM public.live_rooms WHERE id = room_id));
  END IF;
END $$;

-- ── 7. Réaltime — activer sur live_room_queue ─────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_queue;

-- ── 8. Auto-purge des salles inactives (fonction + cron) ─────
CREATE OR REPLACE FUNCTION public.purge_inactive_live_rooms()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.live_rooms
  SET is_active = false
  WHERE is_active = true
    AND (
      updated_at < now() - interval '2 hours'
      OR (expires_at IS NOT NULL AND expires_at < now())
    );
END;
$$;

-- ── 9. app_meta: version courante ─────────────────────────────
INSERT INTO public.app_meta (key, value)
VALUES ('schema_version', 'v40000')
ON CONFLICT (key) DO UPDATE SET value = 'v40000', updated_at = now();

-- ── 10. Fonction helper: obtenir la file d'une salle ─────────
CREATE OR REPLACE FUNCTION public.get_live_queue(p_room_id text)
RETURNS TABLE (
  out_id       uuid,
  out_position integer,
  out_song_id  text,
  out_title    text,
  out_artist   text,
  out_cover_url text,
  out_audio_url text,
  out_added_by text,
  out_added_at  timestamp with time zone
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    q.id,
    q.position,
    COALESCE(q.song_id, (q.song_data->>'id')::text),
    COALESCE(s.title,   q.song_data->>'title'),
    COALESCE(s.artist,  q.song_data->>'artist'),
    COALESCE(s.cover_url, q.song_data->>'cover_url'),
    COALESCE(s.audio_url, q.song_data->>'audio_url'),
    q.added_by,
    q.added_at
  FROM public.live_room_queue q
  LEFT JOIN public.songs s ON s.id = q.song_id
  WHERE q.room_id = p_room_id
  ORDER BY q.position ASC;
$$;

-- ── DONE ───────────────────────────────────────────────────────
SELECT 'NovaSound V40000 migration completed ✅' AS status;
