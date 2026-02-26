-- ============================================================
-- fix-comments-rls.sql — NovaSound TITAN LUX v10.0
-- Fix RLS commentaires : lecture visible par tous sans auth
-- À exécuter si les commentaires publiés n'apparaissent pas
-- ============================================================

-- S'assurer que la politique de lecture est bien "public"
DROP POLICY IF EXISTS "Anyone can view comments" ON public.song_comments;
CREATE POLICY "Anyone can view comments"
  ON public.song_comments FOR SELECT USING (true);

-- Fix politique insertion : accepter uuid ET text
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.song_comments;
CREATE POLICY "Authenticated users can insert comments"
  ON public.song_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid()::text = user_id
      OR auth.uid() = user_id::uuid
    )
  );

-- Fix politique édition
DROP POLICY IF EXISTS "Author can edit own comment" ON public.song_comments;
CREATE POLICY "Author can edit own comment"
  ON public.song_comments FOR UPDATE
  USING (
    auth.uid()::text = user_id
    OR auth.uid() = user_id::uuid
  );

-- Fix politique suppression
DROP POLICY IF EXISTS "Author or admin can delete comment" ON public.song_comments;
CREATE POLICY "Author or admin can delete comment"
  ON public.song_comments FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR auth.uid() = user_id::uuid
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- Vérifier que RLS est bien activé
ALTER TABLE public.song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- S'assurer que comment_likes est aussi lisible publiquement
DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.comment_likes;
CREATE POLICY "Anyone can view comment likes"
  ON public.comment_likes FOR SELECT USING (true);
