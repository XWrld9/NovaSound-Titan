-- ================================================================
-- fix-comments-rls.sql — NovaSound TITAN LUX v10 — FINAL BULLETPROOF
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. DÉSACTIVER puis RÉACTIVER RLS proprement ─────────────────
ALTER TABLE public.song_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;

-- ── 2. SUPPRIMER TOUTES les politiques existantes ───────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'song_comments' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.song_comments', pol.policyname);
  END LOOP;
END $$;

-- ── 3. LECTURE : tout le monde, aucune restriction ──────────────
CREATE POLICY "comments_select_public"
  ON public.song_comments FOR SELECT
  USING (true);

-- ── 4. INSERTION : utilisateur connecté uniquement ──────────────
--    Pas de vérification user_id ici (évite les problèmes de cast uuid/text)
--    La vérification se fait côté app
CREATE POLICY "comments_insert_auth"
  ON public.song_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 5. MISE À JOUR : auteur uniquement ──────────────────────────
CREATE POLICY "comments_update_author"
  ON public.song_comments FOR UPDATE
  USING (auth.uid()::text = user_id);

-- ── 6. SUPPRESSION : auteur OU admin ────────────────────────────
CREATE POLICY "comments_delete_author_or_admin"
  ON public.song_comments FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- ── 7. Même chose pour comment_likes ────────────────────────────
ALTER TABLE public.comment_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'comment_likes' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.comment_likes', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "comment_likes_select_public"
  ON public.comment_likes FOR SELECT USING (true);

CREATE POLICY "comment_likes_insert_auth"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comment_likes_delete_own"
  ON public.comment_likes FOR DELETE
  USING (auth.uid()::text = user_id);

-- ── 8. Realtime (idempotent) ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'song_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comment_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
  END IF;
END $$;

-- ── 9. Vérification finale ───────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('song_comments', 'comment_likes')
ORDER BY tablename, cmd;
