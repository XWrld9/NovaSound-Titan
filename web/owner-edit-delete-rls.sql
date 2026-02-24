-- ============================================================
-- Politiques RLS : Modification et suppression par l'auteur
-- À exécuter dans le SQL Editor de votre dashboard Supabase
-- ============================================================

-- ──────────────────────────────────────────
-- TABLE: news
-- ──────────────────────────────────────────

CREATE POLICY "Authors can update their own news"
  ON news
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = author_id)
  WITH CHECK (auth.uid()::text = author_id);

CREATE POLICY "Authors can delete their own news"
  ON news
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = author_id);

-- ──────────────────────────────────────────
-- TABLE: songs
-- ──────────────────────────────────────────

CREATE POLICY "Uploaders can update their own songs"
  ON songs
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = uploader_id)
  WITH CHECK (auth.uid()::text = uploader_id);

-- Décommenter si la politique de suppression n'existe pas encore :
-- CREATE POLICY "Uploaders can delete their own songs"
--   ON songs
--   FOR DELETE
--   TO authenticated
--   USING (auth.uid()::text = uploader_id);
