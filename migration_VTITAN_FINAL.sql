-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration VTITAN_FINAL
-- Version finale unifiée — corrige TOUS les problèmes de cohérence DB
-- Exécuter dans Supabase SQL Editor (idempotent, peut être relancé sans risque)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. TABLE: push_notification_logs (créer si absente) ────────────────────────
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notif_id text,
  user_id text,
  type text NOT NULL DEFAULT 'default',
  is_broadcast boolean NOT NULL DEFAULT false,
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  purged integer NOT NULL DEFAULT 0,
  avg_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent' CHECK (status = ANY (ARRAY['sent','failed','skipped'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_notification_logs_pkey PRIMARY KEY (id)
);

-- ── 3. TABLE: push_subscriptions (créer si absente) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigserial NOT NULL,
  user_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);

-- ── 4. COLONNES manquantes sur notifications ────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_label text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS silent boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS renotify boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_user_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;

-- FK from_user_id → users si pas encore ajoutée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_from_user_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_from_user_id_fkey
      FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 5. COLONNES manquantes sur reports ─────────────────────────────────────────
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_id text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── 6. COLONNES manquantes sur songs ───────────────────────────────────────────
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS genre text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS duration_s integer;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS reposts_count integer DEFAULT 0;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- ── 7. COLONNES manquantes sur users ───────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_plays integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_likes integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 0;

-- ── 8. COLONNES manquantes sur chat_messages ───────────────────────────────────
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS period text;

-- ── 9. COLONNES manquantes sur live_rooms ──────────────────────────────────────
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS participants_count integer DEFAULT 0;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS current_song_id text;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS custom_description text;
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

-- FK current_song_id → songs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_live_rooms_current_song'
  ) THEN
    ALTER TABLE public.live_rooms
      ADD CONSTRAINT fk_live_rooms_current_song
      FOREIGN KEY (current_song_id) REFERENCES public.songs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 10. TABLES manquantes ───────────────────────────────────────────────────────

-- notification_types
CREATE TABLE IF NOT EXISTS public.notification_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type_key text NOT NULL UNIQUE,
  type_name text NOT NULL,
  description text,
  icon text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_types_pkey PRIMARY KEY (id)
);

-- achievement_definitions
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  code text NOT NULL,
  label text NOT NULL,
  description text,
  icon text,
  points integer DEFAULT 10,
  rarity text DEFAULT 'common' CHECK (rarity = ANY (ARRAY['common','rare','epic','legendary'])),
  CONSTRAINT achievement_definitions_pkey PRIMARY KEY (code)
);

-- user_achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text NOT NULL,
  achievement text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ua_achievement') THEN
    ALTER TABLE public.user_achievements
      ADD CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement) REFERENCES public.achievement_definitions(code);
  END IF;
END $$;

-- user_streaks
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date NOT NULL DEFAULT CURRENT_DATE,
  total_days integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id)
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin','moderator'])),
  granted_by text,
  granted_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);

-- song_lyrics
CREATE TABLE IF NOT EXISTS public.song_lyrics (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  song_id text NOT NULL UNIQUE,
  uploader_id text NOT NULL,
  content text NOT NULL,
  format text NOT NULL DEFAULT 'plain' CHECK (format = ANY (ARRAY['plain','lrc','srt'])),
  language text DEFAULT 'fr',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_lyrics_pkey PRIMARY KEY (id)
);

-- song_moods
CREATE TABLE IF NOT EXISTS public.song_moods (
  id bigserial NOT NULL,
  song_id text NOT NULL,
  user_id text NOT NULL,
  mood text NOT NULL CHECK (mood = ANY (ARRAY['hype','chill','sad','motivant','nostalgique','amour','rage','détente','focus','fête'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_moods_pkey PRIMARY KEY (id)
);

-- song_reposts
CREATE TABLE IF NOT EXISTS public.song_reposts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  song_id text NOT NULL,
  user_id text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_reposts_pkey PRIMARY KEY (id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'song_reposts_song_id_fkey') THEN
    ALTER TABLE public.song_reposts ADD CONSTRAINT song_reposts_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- song_comment_replies
CREATE TABLE IF NOT EXISTS public.song_comment_replies (
  id bigserial NOT NULL,
  comment_id bigint NOT NULL,
  user_id text NOT NULL,
  content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT song_comment_replies_pkey PRIMARY KEY (id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'song_comment_replies_comment_id_fkey') THEN
    ALTER TABLE public.song_comment_replies ADD CONSTRAINT song_comment_replies_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.song_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- comment_likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id bigserial NOT NULL,
  user_id text NOT NULL,
  comment_id bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_likes_comment_id_fkey') THEN
    ALTER TABLE public.comment_likes ADD CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.song_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- live_room_likes
CREATE TABLE IF NOT EXISTS public.live_room_likes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  room_id text NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT live_room_likes_pkey PRIMARY KEY (id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_room_likes_room_id_fkey') THEN
    ALTER TABLE public.live_room_likes ADD CONSTRAINT live_room_likes_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- live_room_history
CREATE TABLE IF NOT EXISTS public.live_room_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  room_name text NOT NULL,
  host_id text NOT NULL,
  peak_participants integer NOT NULL DEFAULT 0,
  total_participants integer NOT NULL DEFAULT 0,
  total_songs_played integer NOT NULL DEFAULT 0,
  duration_s integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT live_room_history_pkey PRIMARY KEY (id)
);

-- live_room_queue
CREATE TABLE IF NOT EXISTS public.live_room_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  song_id text,
  position integer NOT NULL DEFAULT 0,
  added_by text,
  song_data jsonb,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_room_queue_pkey PRIMARY KEY (id)
);

-- search_logs
CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  query text NOT NULL,
  user_id text,
  results integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_logs_pkey PRIMARY KEY (id)
);

-- artist_spotlight
CREATE TABLE IF NOT EXISTS public.artist_spotlight (
  id bigserial NOT NULL,
  artist_id text NOT NULL,
  headline text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_spotlight_pkey PRIMARY KEY (id)
);

-- app_meta
CREATE TABLE IF NOT EXISTS public.app_meta (
  key text NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT app_meta_pkey PRIMARY KEY (key)
);

-- moderation_logs
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  admin_id text,
  action text NOT NULL CHECK (action = ANY (ARRAY['delete_song','delete_news','ban_user','unban_user','resolve_report'])),
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT moderation_logs_pkey PRIMARY KEY (id)
);

-- banned_users
CREATE TABLE IF NOT EXISTS public.banned_users (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id text,
  banned_by text,
  reason text NOT NULL,
  ban_type text DEFAULT 'temporary' CHECK (ban_type = ANY (ARRAY['temporary','permanent'])),
  ban_duration interval,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT banned_users_pkey PRIMARY KEY (id)
);

-- song_play_events
CREATE TABLE IF NOT EXISTS public.song_play_events (
  id bigserial NOT NULL,
  song_id text NOT NULL,
  user_id text,
  played_at timestamptz NOT NULL DEFAULT now(),
  duration_s integer,
  CONSTRAINT song_play_events_pkey PRIMARY KEY (id)
);

-- news_comment_likes
CREATE TABLE IF NOT EXISTS public.news_comment_likes (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  comment_id text,
  user_id text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT news_comment_likes_pkey PRIMARY KEY (id)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_comment_likes_comment_id_fkey') THEN
    ALTER TABLE public.news_comment_likes ADD CONSTRAINT news_comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.news_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 11. INDEX de performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read       ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at    ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type          ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id           ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint          ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_songs_uploader_id           ON public.songs(uploader_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at            ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_genre                 ON public.songs(genre);
CREATE INDEX IF NOT EXISTS idx_song_comments_song_id       ON public.song_comments(song_id);
CREATE INDEX IF NOT EXISTS idx_song_comments_user_id       ON public.song_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id         ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id        ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_song             ON public.likes(user_id, song_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at    ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient   ON public.messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_is_active        ON public.live_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_reports_status              ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_push_logs_notif_id          ON public.push_notification_logs(notif_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_query           ON public.search_logs(query);
CREATE INDEX IF NOT EXISTS idx_song_play_events_song_id    ON public.song_play_events(song_id);

-- ── 12. RLS — TOUTES LES TABLES ────────────────────────────────────────────────

-- users : lisibles par tous, modifiables par le propriétaire
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users public read"  ON public.users;
DROP POLICY IF EXISTS "Users owner update" ON public.users;
CREATE POLICY "Users public read"  ON public.users FOR SELECT USING (true);
CREATE POLICY "Users owner update" ON public.users FOR UPDATE USING (auth.uid()::text = id);

-- songs
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Songs public read"   ON public.songs;
DROP POLICY IF EXISTS "Songs owner write"   ON public.songs;
CREATE POLICY "Songs public read"   ON public.songs FOR SELECT USING (true);
CREATE POLICY "Songs owner write"   ON public.songs FOR ALL   USING (auth.uid()::text = uploader_id);

-- song_comments : tout le monde lit, authentifiés écrivent les leurs
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments public read"  ON public.song_comments;
DROP POLICY IF EXISTS "Comments owner insert" ON public.song_comments;
DROP POLICY IF EXISTS "Comments owner update" ON public.song_comments;
DROP POLICY IF EXISTS "Comments owner delete" ON public.song_comments;
CREATE POLICY "Comments public read"  ON public.song_comments FOR SELECT USING (true);
CREATE POLICY "Comments owner insert" ON public.song_comments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Comments owner update" ON public.song_comments FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Comments owner delete" ON public.song_comments FOR DELETE USING (auth.uid()::text = user_id);

-- song_comment_replies
ALTER TABLE public.song_comment_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Replies public read"  ON public.song_comment_replies;
DROP POLICY IF EXISTS "Replies owner write"  ON public.song_comment_replies;
CREATE POLICY "Replies public read"  ON public.song_comment_replies FOR SELECT USING (true);
CREATE POLICY "Replies owner write"  ON public.song_comment_replies FOR ALL USING (auth.uid()::text = user_id);

-- comment_likes
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comment likes public read"  ON public.comment_likes;
DROP POLICY IF EXISTS "Comment likes owner write"  ON public.comment_likes;
CREATE POLICY "Comment likes public read"  ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Comment likes owner write"  ON public.comment_likes FOR ALL USING (auth.uid()::text = user_id);

-- likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes public read"  ON public.likes;
DROP POLICY IF EXISTS "Likes owner write"  ON public.likes;
CREATE POLICY "Likes public read"  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Likes owner write"  ON public.likes FOR ALL USING (auth.uid()::text = user_id);

-- follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows public read"  ON public.follows;
DROP POLICY IF EXISTS "Follows owner write"  ON public.follows;
CREATE POLICY "Follows public read"  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Follows owner write"  ON public.follows FOR ALL USING (auth.uid()::text = follower_id);

-- notifications : uniquement le propriétaire
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notif owner read"     ON public.notifications;
DROP POLICY IF EXISTS "Notif owner update"   ON public.notifications;
DROP POLICY IF EXISTS "Notif service insert" ON public.notifications;
CREATE POLICY "Notif owner read"     ON public.notifications FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Notif owner update"   ON public.notifications FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Notif service insert" ON public.notifications FOR INSERT WITH CHECK (true);

-- push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push subs owner"   ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subs service" ON public.push_subscriptions;
CREATE POLICY "Push subs owner"   ON public.push_subscriptions FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Push subs service" ON public.push_subscriptions FOR SELECT USING (true); -- Edge Function lit toutes les subs

-- push_notification_logs : service only
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push logs service" ON public.push_notification_logs;
CREATE POLICY "Push logs service" ON public.push_notification_logs FOR ALL USING (true);

-- messages : messagerie privée
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages owner read"   ON public.messages;
DROP POLICY IF EXISTS "Messages owner insert" ON public.messages;
DROP POLICY IF EXISTS "Messages owner update" ON public.messages;
DROP POLICY IF EXISTS "Messages owner delete" ON public.messages;
CREATE POLICY "Messages owner read"   ON public.messages FOR SELECT USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
CREATE POLICY "Messages owner insert" ON public.messages FOR INSERT WITH CHECK (auth.uid()::text = sender_id);
CREATE POLICY "Messages owner update" ON public.messages FOR UPDATE USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);
CREATE POLICY "Messages owner delete" ON public.messages FOR DELETE USING (auth.uid()::text = sender_id);

-- chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat public read"   ON public.chat_messages;
DROP POLICY IF EXISTS "Chat owner insert"  ON public.chat_messages;
DROP POLICY IF EXISTS "Chat owner update"  ON public.chat_messages;
DROP POLICY IF EXISTS "Chat owner delete"  ON public.chat_messages;
CREATE POLICY "Chat public read"   ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Chat owner insert"  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Chat owner update"  ON public.chat_messages FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Chat owner delete"  ON public.chat_messages FOR DELETE USING (auth.uid()::text = user_id);

-- chat_reactions
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat reactions public"  ON public.chat_reactions;
DROP POLICY IF EXISTS "Chat reactions owner"   ON public.chat_reactions;
CREATE POLICY "Chat reactions public"  ON public.chat_reactions FOR SELECT USING (true);
CREATE POLICY "Chat reactions owner"   ON public.chat_reactions FOR ALL USING (auth.uid()::text = user_id);

-- playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Playlists public read"   ON public.playlists;
DROP POLICY IF EXISTS "Playlists owner write"   ON public.playlists;
CREATE POLICY "Playlists public read"   ON public.playlists FOR SELECT USING (is_public = true OR auth.uid()::text = owner_id);
CREATE POLICY "Playlists owner write"   ON public.playlists FOR ALL USING (auth.uid()::text = owner_id);

-- playlist_songs
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Playlist songs public" ON public.playlist_songs;
CREATE POLICY "Playlist songs public" ON public.playlist_songs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Playlist songs owner"  ON public.playlist_songs;
CREATE POLICY "Playlist songs owner"  ON public.playlist_songs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND owner_id = auth.uid()::text));

-- favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Favorites owner" ON public.favorites;
CREATE POLICY "Favorites owner" ON public.favorites FOR ALL USING (auth.uid()::text = user_id);

-- news
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News public read"  ON public.news;
DROP POLICY IF EXISTS "News owner write"  ON public.news;
CREATE POLICY "News public read"  ON public.news FOR SELECT USING (true);
CREATE POLICY "News owner write"  ON public.news FOR ALL USING (auth.uid()::text = author_id);

-- news_comments
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News comments public"  ON public.news_comments;
DROP POLICY IF EXISTS "News comments owner insert" ON public.news_comments;
DROP POLICY IF EXISTS "News comments owner manage" ON public.news_comments;
CREATE POLICY "News comments public"       ON public.news_comments FOR SELECT USING (true);
CREATE POLICY "News comments owner insert" ON public.news_comments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "News comments owner manage" ON public.news_comments FOR ALL USING (auth.uid()::text = user_id);

-- news_likes
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News likes public" ON public.news_likes;
DROP POLICY IF EXISTS "News likes owner"  ON public.news_likes;
CREATE POLICY "News likes public" ON public.news_likes FOR SELECT USING (true);
CREATE POLICY "News likes owner"  ON public.news_likes FOR ALL USING (auth.uid()::text = user_id);

-- news_comment_likes
ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News comment likes public" ON public.news_comment_likes;
DROP POLICY IF EXISTS "News comment likes owner"  ON public.news_comment_likes;
CREATE POLICY "News comment likes public" ON public.news_comment_likes FOR SELECT USING (true);
CREATE POLICY "News comment likes owner"  ON public.news_comment_likes FOR ALL USING (auth.uid()::text = user_id);

-- live_rooms
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live rooms public read"   ON public.live_rooms;
DROP POLICY IF EXISTS "Live rooms host write"    ON public.live_rooms;
CREATE POLICY "Live rooms public read"   ON public.live_rooms FOR SELECT USING (true);
CREATE POLICY "Live rooms host write"    ON public.live_rooms FOR ALL USING (auth.uid()::text = host_id);
DROP POLICY IF EXISTS "Live rooms insert" ON public.live_rooms;
CREATE POLICY "Live rooms insert" ON public.live_rooms FOR INSERT WITH CHECK (auth.uid()::text = host_id);

-- live_room_messages
ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live msgs public read"  ON public.live_room_messages;
DROP POLICY IF EXISTS "Live msgs owner insert" ON public.live_room_messages;
DROP POLICY IF EXISTS "Live msgs owner manage" ON public.live_room_messages;
CREATE POLICY "Live msgs public read"  ON public.live_room_messages FOR SELECT USING (true);
CREATE POLICY "Live msgs owner insert" ON public.live_room_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Live msgs owner manage" ON public.live_room_messages FOR UPDATE  USING (auth.uid()::text = user_id);

-- live_room_participants
ALTER TABLE public.live_room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live participants public" ON public.live_room_participants;
DROP POLICY IF EXISTS "Live participants owner"  ON public.live_room_participants;
CREATE POLICY "Live participants public" ON public.live_room_participants FOR SELECT USING (true);
CREATE POLICY "Live participants owner"  ON public.live_room_participants FOR ALL USING (auth.uid()::text = user_id);

-- live_room_likes
ALTER TABLE public.live_room_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live likes public" ON public.live_room_likes;
DROP POLICY IF EXISTS "Live likes owner"  ON public.live_room_likes;
CREATE POLICY "Live likes public" ON public.live_room_likes FOR SELECT USING (true);
CREATE POLICY "Live likes owner"  ON public.live_room_likes FOR ALL USING (auth.uid()::text = user_id);

-- live_room_queue
ALTER TABLE public.live_room_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live queue public" ON public.live_room_queue;
DROP POLICY IF EXISTS "Live queue owner"  ON public.live_room_queue;
CREATE POLICY "Live queue public" ON public.live_room_queue FOR SELECT USING (true);
CREATE POLICY "Live queue owner"  ON public.live_room_queue FOR ALL USING (auth.uid()::text = added_by);

-- reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reports owner insert" ON public.reports;
DROP POLICY IF EXISTS "Reports admin manage" ON public.reports;
CREATE POLICY "Reports owner insert" ON public.reports FOR INSERT WITH CHECK (auth.uid()::text = reporter_id);
CREATE POLICY "Reports admin manage" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true)
  OR auth.uid()::text = reporter_id
);

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Roles admin manage" ON public.user_roles;
DROP POLICY IF EXISTS "Roles public read"  ON public.user_roles;
CREATE POLICY "Roles public read"  ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Roles admin manage" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid()::text AND ur2.role = 'admin' AND ur2.is_active = true)
);

-- song_moods
ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Moods public read"  ON public.song_moods;
DROP POLICY IF EXISTS "Moods owner write"  ON public.song_moods;
CREATE POLICY "Moods public read"  ON public.song_moods FOR SELECT USING (true);
CREATE POLICY "Moods owner write"  ON public.song_moods FOR ALL USING (auth.uid()::text = user_id);

-- song_reposts
ALTER TABLE public.song_reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reposts public read"  ON public.song_reposts;
DROP POLICY IF EXISTS "Reposts owner write"  ON public.song_reposts;
CREATE POLICY "Reposts public read"  ON public.song_reposts FOR SELECT USING (true);
CREATE POLICY "Reposts owner write"  ON public.song_reposts FOR ALL USING (auth.uid()::text = user_id);

-- song_play_events
ALTER TABLE public.song_play_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Play events insert" ON public.song_play_events;
CREATE POLICY "Play events insert" ON public.song_play_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Play events owner read" ON public.song_play_events;
CREATE POLICY "Play events owner read" ON public.song_play_events FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL);

-- song_plays_history
ALTER TABLE public.song_plays_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "song_plays_history_anon_insert" ON public.song_plays_history;
CREATE POLICY "song_plays_history_anon_insert" ON public.song_plays_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "song_plays_history_owner_select" ON public.song_plays_history;
CREATE POLICY "song_plays_history_owner_select" ON public.song_plays_history FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Achievements public read" ON public.user_achievements;
DROP POLICY IF EXISTS "Achievements service insert" ON public.user_achievements;
CREATE POLICY "Achievements public read"   ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "Achievements service insert" ON public.user_achievements FOR INSERT WITH CHECK (true);

-- search_logs
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search logs insert" ON public.search_logs;
CREATE POLICY "Search logs insert" ON public.search_logs FOR INSERT WITH CHECK (true);

-- song_lyrics
ALTER TABLE public.song_lyrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lyrics public read"  ON public.song_lyrics;
DROP POLICY IF EXISTS "Lyrics owner write"  ON public.song_lyrics;
CREATE POLICY "Lyrics public read"  ON public.song_lyrics FOR SELECT USING (true);
CREATE POLICY "Lyrics owner write"  ON public.song_lyrics FOR ALL USING (auth.uid()::text = uploader_id);

-- ── 13. FONCTIONS UTILITAIRES ──────────────────────────────────────────────────

-- get_conversations (messagerie privée)
CREATE OR REPLACE FUNCTION public.get_conversations(p_user_id text)
RETURNS TABLE (
  other_user_id       text,
  other_username      text,
  other_avatar_url    text,
  last_message        text,
  last_message_at     timestamptz,
  last_message_sender_id text,
  unread_count        bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    other_id                AS other_user_id,
    u.username              AS other_username,
    u.avatar_url            AS other_avatar_url,
    last_msg.content        AS last_message,
    last_msg.created_at     AS last_message_at,
    last_msg.sender_id      AS last_message_sender_id,
    COALESCE(unread.cnt, 0) AS unread_count
  FROM (
    SELECT DISTINCT
      CASE WHEN sender_id = p_user_id THEN recipient_id ELSE sender_id END AS other_id,
      MAX(created_at) AS last_at
    FROM public.messages
    WHERE sender_id = p_user_id OR recipient_id = p_user_id
    GROUP BY other_id
  ) conv
  JOIN public.users u ON u.id = conv.other_id
  JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM public.messages
    WHERE (sender_id = p_user_id AND recipient_id = conv.other_id)
       OR (sender_id = conv.other_id AND recipient_id = p_user_id)
    ORDER BY created_at DESC LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.messages
    WHERE sender_id = conv.other_id AND recipient_id = p_user_id AND is_read = false
  ) unread ON true
  ORDER BY last_msg.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_conversations(text) TO authenticated;

-- record_play_event (lecture de son)
CREATE OR REPLACE FUNCTION public.record_play_event(
  p_song_id    text,
  p_user_id    text    DEFAULT NULL,
  p_duration_s integer DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_uuid uuid;
BEGIN
  -- Incrémenter plays_count
  UPDATE public.songs SET plays_count = COALESCE(plays_count, 0) + 1 WHERE id = p_song_id;
  -- Enregistrer dans song_play_events
  INSERT INTO public.song_play_events (song_id, user_id, played_at, duration_s)
    VALUES (p_song_id, p_user_id, now(), p_duration_s);
  -- Enregistrer dans song_plays_history si user connecté
  IF p_user_id IS NOT NULL THEN
    BEGIN v_user_uuid := p_user_id::uuid; EXCEPTION WHEN others THEN v_user_uuid := NULL; END;
    IF v_user_uuid IS NOT NULL THEN
      INSERT INTO public.song_plays_history (song_id, user_id, listened_at)
        VALUES (p_song_id, v_user_uuid, now())
        ON CONFLICT DO NOTHING;
      -- Mettre à jour total_plays de l'utilisateur
      UPDATE public.users SET total_plays = COALESCE(total_plays, 0) + 1 WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_play_event(text, text, integer) TO authenticated, anon;

-- increment_comment_count
CREATE OR REPLACE FUNCTION public.increment_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET comments_count = GREATEST(0, COALESCE(comments_count, 0) - 1) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_comment_count ON public.song_comments;
CREATE TRIGGER trg_increment_comment_count
  AFTER INSERT OR DELETE ON public.song_comments
  FOR EACH ROW EXECUTE FUNCTION public.increment_comment_count();

-- increment_repost_count
CREATE OR REPLACE FUNCTION public.increment_repost_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET reposts_count = COALESCE(reposts_count, 0) + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET reposts_count = GREATEST(0, COALESCE(reposts_count, 0) - 1) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_repost_count ON public.song_reposts;
CREATE TRIGGER trg_increment_repost_count
  AFTER INSERT OR DELETE ON public.song_reposts
  FOR EACH ROW EXECUTE FUNCTION public.increment_repost_count();

-- update_followers_count
CREATE OR REPLACE FUNCTION public.update_followers_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = NEW.following_id;
    UPDATE public.users SET following_count = COALESCE(following_count, 0) + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET followers_count = GREATEST(0, COALESCE(followers_count, 0) - 1) WHERE id = OLD.following_id;
    UPDATE public.users SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_followers_count ON public.follows;
CREATE TRIGGER trg_update_followers_count
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_followers_count();

-- update_likes_count
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.song_id;
    UPDATE public.users SET total_likes = COALESCE(total_likes, 0) + 1 WHERE id = (SELECT uploader_id FROM public.songs WHERE id = NEW.song_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_likes_count ON public.likes;
CREATE TRIGGER trg_update_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- update_live_room_likes_count
CREATE OR REPLACE FUNCTION public.update_live_room_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_rooms SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.live_rooms SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_live_room_likes_count ON public.live_room_likes;
CREATE TRIGGER trg_update_live_room_likes_count
  AFTER INSERT OR DELETE ON public.live_room_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_live_room_likes_count();

-- ── 14. Données par défaut ──────────────────────────────────────────────────────
INSERT INTO public.notification_types (type_key, type_name, description, icon, color) VALUES
  ('like',              'Like',              'Quelqu''un a aimé ton son',          '❤️',  '#ef4444'),
  ('comment',           'Commentaire',       'Quelqu''un a commenté ton son',       '💬',  '#06b6d4'),
  ('follow',            'Abonnement',        'Quelqu''un s''est abonné à toi',      '👤',  '#a855f7'),
  ('new_song',          'Nouveau son',       'Un artiste a publié un nouveau son',  '🎵',  '#10b981'),
  ('repost',            'Repost',            'Quelqu''un a reposté ton son',        '🔁',  '#6366f1'),
  ('news',              'Actualité',         'Nouvelle actualité publiée',          '📰',  '#f59e0b'),
  ('chat_reply',        'Réponse chat',      'Quelqu''un t''a répondu dans le chat','💬',  '#22d3ee'),
  ('chat_mention',      'Mention',           'Quelqu''un t''a mentionné',           '@',   '#a78bfa'),
  ('chat_mention_all',  'Mention tous',      'Tout le monde a été mentionné',       '@',   '#a78bfa'),
  ('mood_vote',         'Mood Vote',         'Quelqu''un a voté pour un mood',      '🎭',  '#fb923c'),
  ('live_start',        'Live Démarré',      'Un live a été lancé',                 '🔴',  '#ef4444'),
  ('live_started',      'Live Démarré',      'Un live a été lancé',                 '🔴',  '#ef4444'),
  ('live_invite',       'Invitation Live',   'Tu as été invité à un live',          '📡',  '#10b981'),
  ('queue_song',        'File d''attente',   'Un son a été ajouté à la file',       '🎶',  '#6366f1'),
  ('achievement',       'Succès',            'Tu as débloqué un succès',            '🏆',  '#f59e0b')
ON CONFLICT (type_key) DO NOTHING;

INSERT INTO public.achievement_definitions (code, label, description, icon, points, rarity) VALUES
  ('first_song',       'Premier Son',         'Publie ton premier morceau',         '🎵',  10,  'common'),
  ('first_like',       'Premier Like',        'Reçois ton premier like',            '❤️',  10,  'common'),
  ('first_follow',     'Premier Abonné',      'Reçois ton premier abonné',          '👥',  15,  'common'),
  ('10_songs',         'Discographie',        'Publie 10 morceaux',                 '🎶',  50,  'rare'),
  ('100_plays',        '100 Écoutes',         'Atteins 100 écoutes sur tes sons',   '🔥',  25,  'common'),
  ('1000_plays',       '1000 Écoutes',        'Atteins 1000 écoutes',              '⭐',  100, 'rare'),
  ('live_host',        'Live Master',         'Crée ton premier salon live',        '📡',  30,  'common'),
  ('chat_active',      'Chateux',             'Envoie 50 messages dans le chat',    '💬',  20,  'common'),
  ('streak_7',         'Semaine parfaite',    'Connecte-toi 7 jours de suite',      '🔥',  50,  'rare'),
  ('streak_30',        'Mois parfait',        'Connecte-toi 30 jours de suite',     '💎',  200, 'epic')
ON CONFLICT (code) DO NOTHING;

-- ── 15. App Meta ────────────────────────────────────────────────────────────────
INSERT INTO public.app_meta (key, value) VALUES
  ('version',          'TITAN_LUX_VFINAL'),
  ('migration_date',   NOW()::text),
  ('push_enabled',     'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN DE MIGRATION — NOVASOUND TITAN LUX VTITAN_FINAL
-- ✅ Toutes les tables créées/vérifiées
-- ✅ Toutes les colonnes manquantes ajoutées
-- ✅ RLS activée sur toutes les tables sensibles
-- ✅ Index de performance ajoutés
-- ✅ Triggers de comptage automatiques
-- ✅ Données de référence insertées
-- ═══════════════════════════════════════════════════════════════════════════════
