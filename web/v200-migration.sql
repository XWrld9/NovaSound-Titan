-- ================================================================
-- v200-migration.sql — NovaSound TITAN LUX v200 FINAL
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ⚠️  Étape 19 — après v160-migration.sql
-- ================================================================

-- ── 1. Colonne is_deleted sur song_comments (soft-delete) ────────
ALTER TABLE public.song_comments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Index pour filtrer les commentaires non supprimés ─────────
CREATE INDEX IF NOT EXISTS idx_song_comments_not_deleted
  ON public.song_comments(song_id, is_deleted, created_at DESC);

-- ── 3. Permettre à l'auteur de soft-delete son commentaire ───────
DROP POLICY IF EXISTS "song_comments_softdelete_own" ON public.song_comments;
CREATE POLICY "song_comments_softdelete_own"
  ON public.song_comments FOR UPDATE
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'eloadxfamily@gmail.com'
  );

-- ── 4. S'assurer que les messages privés ont leur table ──────────
-- (table direct_messages de v90, recrée si absente)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id           TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  sender_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted_sender    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted_recipient BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dm_sender    ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON public.direct_messages(recipient_id, created_at DESC);

DROP POLICY IF EXISTS "dm_select_own" ON public.direct_messages;
CREATE POLICY "dm_select_own" ON public.direct_messages FOR SELECT
  USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

DROP POLICY IF EXISTS "dm_insert_own" ON public.direct_messages;
CREATE POLICY "dm_insert_own" ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

DROP POLICY IF EXISTS "dm_update_own" ON public.direct_messages;
CREATE POLICY "dm_update_own" ON public.direct_messages FOR UPDATE
  USING (auth.uid()::text = sender_id OR auth.uid()::text = recipient_id);

-- ── 5. Activer Realtime sur direct_messages ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;

-- ── 6. Activer Realtime sur song_comments (si pas encore fait) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'song_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comments;
  END IF;
END $$;

-- ================================================================
-- ✅  Migration v200 terminée
-- ================================================================
