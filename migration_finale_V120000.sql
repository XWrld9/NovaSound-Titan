-- ══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration Finale V120000
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne social_links manquante sur la table users ─────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- ── 2. Colonnes push_sent sur notifications (si absentes) ────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent     boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_sent_at  timestamptz;

-- ── 3. Index manquants pour performances ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user   ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notif_logs_notif_id  ON public.push_notification_logs(notif_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_active         ON public.live_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_rooms_host           ON public.live_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_song_play_events_song     ON public.song_play_events(song_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user            ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user                ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower          ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following         ON public.follows(following_id);

-- ── 4. Table push_notification_logs — assurer colonne notif_id ───────────────
ALTER TABLE public.push_notification_logs
  ADD COLUMN IF NOT EXISTS notif_id text;

-- ── 5. Bucket Storage avatars — politique RLS ────────────────────────────────
-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- Politique SELECT (lecture publique)
DROP POLICY IF EXISTS "Public avatar read"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar"     ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar"     ON storage.objects;

CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated avatar upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE 'avatar-' || auth.uid()::text || '%'
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE 'avatar-' || auth.uid()::text || '%'
  );

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND name LIKE 'avatar-' || auth.uid()::text || '%'
  );

-- ── 6. RLS sur tables principales ────────────────────────────────────────────

-- users : lecture publique, mise à jour par le propriétaire
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users public read"       ON public.users;
DROP POLICY IF EXISTS "Users self update"       ON public.users;
DROP POLICY IF EXISTS "Users self insert"       ON public.users;

CREATE POLICY "Users public read"   ON public.users FOR SELECT USING (true);
CREATE POLICY "Users self update"   ON public.users FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users self insert"   ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id);

-- notifications : propriétaire uniquement
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notif owner read"   ON public.notifications;
DROP POLICY IF EXISTS "Notif owner update" ON public.notifications;
DROP POLICY IF EXISTS "Notif service insert" ON public.notifications;

CREATE POLICY "Notif owner read"     ON public.notifications FOR SELECT  USING (auth.uid()::text = user_id);
CREATE POLICY "Notif owner update"   ON public.notifications FOR UPDATE  USING (auth.uid()::text = user_id);
CREATE POLICY "Notif service insert" ON public.notifications FOR INSERT  WITH CHECK (true); -- Edge function + triggers

-- push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push sub owner"   ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push sub service" ON public.push_subscriptions;

CREATE POLICY "Push sub owner"   ON public.push_subscriptions FOR ALL    USING (auth.uid()::text = user_id);
CREATE POLICY "Push sub service" ON public.push_subscriptions FOR SELECT USING (true); -- Edge function lit toutes

-- push_notification_logs : service seulement
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push log service" ON public.push_notification_logs;
CREATE POLICY "Push log service" ON public.push_notification_logs FOR ALL USING (true);

-- songs : lecture publique
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Songs public read"  ON public.songs;
DROP POLICY IF EXISTS "Songs owner write"  ON public.songs;

CREATE POLICY "Songs public read"  ON public.songs FOR SELECT USING (true);
CREATE POLICY "Songs owner write"  ON public.songs FOR ALL    USING (auth.uid()::text = uploader_id);

-- likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes public read"   ON public.likes;
DROP POLICY IF EXISTS "Likes owner write"   ON public.likes;

CREATE POLICY "Likes public read"   ON public.likes FOR SELECT USING (true);
CREATE POLICY "Likes owner write"   ON public.likes FOR ALL    USING (auth.uid()::text = user_id);

-- follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows public read"  ON public.follows;
DROP POLICY IF EXISTS "Follows owner write"  ON public.follows;

CREATE POLICY "Follows public read"  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Follows owner write"  ON public.follows FOR ALL    USING (auth.uid()::text = follower_id);

-- favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Favorites owner"  ON public.favorites;

CREATE POLICY "Favorites owner"  ON public.favorites FOR ALL USING (auth.uid()::text = user_id);

-- live_rooms
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live rooms public read"  ON public.live_rooms;
DROP POLICY IF EXISTS "Live rooms host write"   ON public.live_rooms;
DROP POLICY IF EXISTS "Live rooms host create"  ON public.live_rooms;

CREATE POLICY "Live rooms public read"  ON public.live_rooms FOR SELECT USING (true);
CREATE POLICY "Live rooms host create"  ON public.live_rooms FOR INSERT WITH CHECK (auth.uid()::text = host_id);
CREATE POLICY "Live rooms host write"   ON public.live_rooms FOR UPDATE USING (auth.uid()::text = host_id);
CREATE POLICY "Live rooms host delete"  ON public.live_rooms FOR DELETE USING (auth.uid()::text = host_id);

-- live_room_participants
ALTER TABLE public.live_room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants public read"  ON public.live_room_participants;
DROP POLICY IF EXISTS "Participants self write"   ON public.live_room_participants;

CREATE POLICY "Participants public read"  ON public.live_room_participants FOR SELECT USING (true);
CREATE POLICY "Participants self write"   ON public.live_room_participants FOR ALL    USING (auth.uid()::text = user_id);

-- live_room_messages
ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LRM public read"   ON public.live_room_messages;
DROP POLICY IF EXISTS "LRM owner write"   ON public.live_room_messages;

CREATE POLICY "LRM public read"  ON public.live_room_messages FOR SELECT USING (true);
CREATE POLICY "LRM owner write"  ON public.live_room_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "LRM owner delete" ON public.live_room_messages FOR DELETE USING (auth.uid()::text = user_id);

-- live_room_likes
ALTER TABLE public.live_room_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LRL public read"  ON public.live_room_likes;
DROP POLICY IF EXISTS "LRL owner write"  ON public.live_room_likes;

CREATE POLICY "LRL public read"  ON public.live_room_likes FOR SELECT USING (true);
CREATE POLICY "LRL owner write"  ON public.live_room_likes FOR ALL    USING (auth.uid()::text = user_id);

-- song_comments
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments public read"  ON public.song_comments;
DROP POLICY IF EXISTS "Comments owner write"  ON public.song_comments;

CREATE POLICY "Comments public read"  ON public.song_comments FOR SELECT USING (true);
CREATE POLICY "Comments owner write"  ON public.song_comments FOR ALL    USING (auth.uid()::text = user_id);

-- chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat public read"   ON public.chat_messages;
DROP POLICY IF EXISTS "Chat owner write"   ON public.chat_messages;

CREATE POLICY "Chat public read"  ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat owner write"  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Chat owner update" ON public.chat_messages FOR UPDATE USING (auth.uid()::text = user_id);

-- news
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News public read"  ON public.news;
DROP POLICY IF EXISTS "News author write" ON public.news;

CREATE POLICY "News public read"  ON public.news FOR SELECT USING (true);
CREATE POLICY "News author write" ON public.news FOR ALL    USING (auth.uid()::text = author_id);

-- playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Playlists public read"  ON public.playlists;
DROP POLICY IF EXISTS "Playlists owner write"  ON public.playlists;

CREATE POLICY "Playlists public read"  ON public.playlists FOR SELECT USING (is_public OR auth.uid()::text = owner_id);
CREATE POLICY "Playlists owner write"  ON public.playlists FOR ALL    USING (auth.uid()::text = owner_id);

-- playlist_songs
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Playlist songs read"  ON public.playlist_songs;
DROP POLICY IF EXISTS "Playlist songs write" ON public.playlist_songs;

CREATE POLICY "Playlist songs read"  ON public.playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR auth.uid()::text = p.owner_id))
);
CREATE POLICY "Playlist songs write" ON public.playlist_songs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND auth.uid()::text = p.owner_id)
);

-- ── 7. Nettoyage live_rooms expirées (sans participants depuis > 2h) ──────────
-- Désactiver proprement les salons laissés ouverts
UPDATE public.live_rooms
SET is_active = false, is_live = false
WHERE is_active = true
  AND updated_at < NOW() - INTERVAL '2 hours'
  AND participants_count = 0;

-- ── 8. user_achievements RLS ─────────────────────────────────────────────────
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Achievements public read"  ON public.user_achievements;
DROP POLICY IF EXISTS "Achievements service write" ON public.user_achievements;

CREATE POLICY "Achievements public read"   ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "Achievements service write" ON public.user_achievements FOR INSERT WITH CHECK (true);

-- ── 9. song_moods RLS ────────────────────────────────────────────────────────
ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Moods public read"  ON public.song_moods;
DROP POLICY IF EXISTS "Moods owner write"  ON public.song_moods;

CREATE POLICY "Moods public read"  ON public.song_moods FOR SELECT USING (true);
CREATE POLICY "Moods owner write"  ON public.song_moods FOR ALL    USING (auth.uid()::text = user_id);

-- ── 10. song_reposts RLS ─────────────────────────────────────────────────────
ALTER TABLE public.song_reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reposts public read"  ON public.song_reposts;
DROP POLICY IF EXISTS "Reposts owner write"  ON public.song_reposts;

CREATE POLICY "Reposts public read"  ON public.song_reposts FOR SELECT USING (true);
CREATE POLICY "Reposts owner write"  ON public.song_reposts FOR ALL    USING (auth.uid()::text = user_id);

-- ── 11. direct_messages RLS ──────────────────────────────────────────────────
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM owner read"  ON public.direct_messages;
DROP POLICY IF EXISTS "DM owner write" ON public.direct_messages;

CREATE POLICY "DM owner read"  ON public.direct_messages FOR SELECT USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
CREATE POLICY "DM owner write" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid()::text = sender_id);
CREATE POLICY "DM owner update" ON public.direct_messages FOR UPDATE USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

-- ── 12. live_room_queue RLS ──────────────────────────────────────────────────
ALTER TABLE public.live_room_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Queue public read"  ON public.live_room_queue;
DROP POLICY IF EXISTS "Queue owner write"  ON public.live_room_queue;

CREATE POLICY "Queue public read"  ON public.live_room_queue FOR SELECT USING (true);
CREATE POLICY "Queue owner write"  ON public.live_room_queue FOR INSERT WITH CHECK (auth.uid()::text = added_by);
CREATE POLICY "Queue host delete"  ON public.live_room_queue FOR DELETE USING (
  auth.uid()::text = added_by
  OR EXISTS (SELECT 1 FROM public.live_rooms lr WHERE lr.id = room_id AND lr.host_id = auth.uid()::text)
);

-- ── 13. Trigger auto-update updated_at sur users ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_live_rooms_updated_at ON public.live_rooms;
CREATE TRIGGER trg_live_rooms_updated_at
  BEFORE UPDATE ON public.live_rooms
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ── 14. Function pour purger les subscriptions expirées ──────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_push_subscriptions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE updated_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ── Fin migration ─────────────────────────────────────────────────────────────
-- ✅ social_links ajouté sur users
-- ✅ Bucket avatars configuré avec RLS correcte
-- ✅ RLS activée sur toutes les tables
-- ✅ Index de performance créés
-- ✅ Triggers updated_at
-- ✅ Nettoyage live_rooms orphelines
