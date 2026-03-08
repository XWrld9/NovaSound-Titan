-- ══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration V130000 — Critical Bug Fixes
-- À exécuter dans Supabase SQL Editor après V120000
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Foreign Keys manquantes → PostgREST join 400 sur favorites/song_reposts/playlist_songs ──

-- FK favorites.song_id → songs.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_song_id_fkey'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT favorites_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK song_reposts.song_id → songs.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'song_reposts_song_id_fkey'
  ) THEN
    ALTER TABLE public.song_reposts
      ADD CONSTRAINT song_reposts_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK playlist_songs.song_id → songs.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'playlist_songs_song_id_fkey'
  ) THEN
    ALTER TABLE public.playlist_songs
      ADD CONSTRAINT playlist_songs_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK likes.song_id → songs.id (si absent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'likes_song_id_fkey'
  ) THEN
    ALTER TABLE public.likes
      ADD CONSTRAINT likes_song_id_fkey
      FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 2. Fix clear_chat_messages_admin — PGRST203 function overloading ─────────
-- Drop toutes les variantes possibles pour éviter l'ambiguïté PostgREST
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(text, timestamptz);
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(uuid, timestamp without time zone);
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(text, timestamp without time zone);
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(uuid);
DROP FUNCTION IF EXISTS public.clear_chat_messages_admin(text);

-- Recréer avec une signature unique et propre
CREATE OR REPLACE FUNCTION public.clear_chat_messages_admin(
  admin_user_id text,
  since_date    timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uuid uuid;
BEGIN
  -- Vérifier que l'appelant est bien admin (email hardcodé ou user_roles)
  IF auth.email() IS DISTINCT FROM 'eloadxfamily@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Convertir en uuid si possible (pour cleared_by)
  BEGIN
    v_admin_uuid := admin_user_id::uuid;
  EXCEPTION WHEN others THEN
    v_admin_uuid := NULL;
  END;

  IF since_date IS NOT NULL THEN
    UPDATE public.chat_messages
    SET    is_deleted  = true,
           cleared_by  = v_admin_uuid,
           cleared_at  = NOW()
    WHERE  created_at >= since_date
      AND  is_deleted  = false;
  ELSE
    UPDATE public.chat_messages
    SET    is_deleted  = true,
           cleared_by  = v_admin_uuid,
           cleared_at  = NOW()
    WHERE  is_deleted  = false;
  END IF;
END;
$$;

-- ── 3. RLS Admin bypass — les boutons admin qui ne marchent pas ───────────────
-- Stratégie : auth.email() = 'eloadxfamily@gmail.com' court-circuite le user_roles
-- (identique à l'approche V10000 qui évitait la récursion RLS)

-- live_rooms : admin peut update/delete N'IMPORTE quelle salle
DROP POLICY IF EXISTS "Live rooms admin write"  ON public.live_rooms;
DROP POLICY IF EXISTS "Live rooms host delete"  ON public.live_rooms;
DROP POLICY IF EXISTS "Live rooms host write"   ON public.live_rooms;

CREATE POLICY "Live rooms host write"   ON public.live_rooms
  FOR UPDATE USING (
    auth.uid()::text = host_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );
CREATE POLICY "Live rooms host delete"  ON public.live_rooms
  FOR DELETE USING (
    auth.uid()::text = host_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- users : admin peut update n'importe quel user (ban/unban)
DROP POLICY IF EXISTS "Users self update"   ON public.users;
DROP POLICY IF EXISTS "Users admin update"  ON public.users;

CREATE POLICY "Users self update" ON public.users
  FOR UPDATE USING (
    auth.uid()::text = id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- songs : admin peut archiver/désarchiver/supprimer n'importe quelle chanson
DROP POLICY IF EXISTS "Songs owner write"   ON public.songs;
DROP POLICY IF EXISTS "Songs admin write"   ON public.songs;

CREATE POLICY "Songs owner write" ON public.songs
  FOR ALL USING (
    auth.uid()::text = uploader_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- chat_messages : admin peut marquer deleted n'importe quel message
DROP POLICY IF EXISTS "Chat owner update"  ON public.chat_messages;
DROP POLICY IF EXISTS "Chat admin update"  ON public.chat_messages;

CREATE POLICY "Chat owner update" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid()::text = user_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );
CREATE POLICY "Chat admin delete" ON public.chat_messages
  FOR DELETE USING (auth.email() = 'eloadxfamily@gmail.com');

-- news : admin peut créer/modifier/supprimer toutes les actualités
DROP POLICY IF EXISTS "News author write"  ON public.news;
DROP POLICY IF EXISTS "News admin write"   ON public.news;

CREATE POLICY "News author write" ON public.news
  FOR ALL USING (
    auth.uid()::text = author_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- song_comments : admin peut supprimer n'importe quel commentaire
DROP POLICY IF EXISTS "Comments owner write"  ON public.song_comments;
CREATE POLICY "Comments owner write" ON public.song_comments
  FOR ALL USING (
    auth.uid()::text = user_id
    OR auth.email() = 'eloadxfamily@gmail.com'
  );

-- ── 4. Assurez-vous que les tables avec JOIN ont RLS SELECT cohérent ──────────
-- favorites : owner SELECT ET join vers songs (public) — OK avec la FK ajoutée
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Favorites owner"        ON public.favorites;
DROP POLICY IF EXISTS "Favorites select owner" ON public.favorites;
DROP POLICY IF EXISTS "Favorites write owner"  ON public.favorites;

CREATE POLICY "Favorites select owner" ON public.favorites
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Favorites write owner" ON public.favorites
  FOR ALL USING (auth.uid()::text = user_id);

-- song_reposts : public read (pour profils publics) + owner write
ALTER TABLE public.song_reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reposts public read"  ON public.song_reposts;
DROP POLICY IF EXISTS "Reposts owner write"  ON public.song_reposts;

CREATE POLICY "Reposts public read"  ON public.song_reposts FOR SELECT USING (true);
CREATE POLICY "Reposts owner write"  ON public.song_reposts FOR ALL    USING (auth.uid()::text = user_id);

-- ── 5. Index supplémentaires pour les nouveaux FK ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_favorites_song_id     ON public.favorites(song_id);
CREATE INDEX IF NOT EXISTS idx_song_reposts_song_id  ON public.song_reposts(song_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song   ON public.playlist_songs(song_id);

-- ── 6. Nettoyage des live_rooms expirées (bonus) ─────────────────────────────
UPDATE public.live_rooms
SET    is_active = false, is_live = false, participants_count = 0
WHERE  is_active = true
  AND  updated_at < NOW() - INTERVAL '3 hours'
  AND  participants_count = 0;

-- ── Fin V130000 ───────────────────────────────────────────────────────────────
-- ✅ FK favorites/song_reposts/playlist_songs → songs (fix 400 Bad Request)
-- ✅ clear_chat_messages_admin recréé proprement (fix PGRST203)
-- ✅ Admin bypass RLS sur live_rooms/users/songs/chat_messages/news/comments
-- ✅ Index de performance pour les nouveaux FK

-- ── 7. Activer Realtime sur live_room_messages (manquait → messages live muets) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages;
  END IF;
END $$;

-- Aussi s'assurer que live_rooms et live_room_participants sont dans realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_participants;
  END IF;
END $$;
