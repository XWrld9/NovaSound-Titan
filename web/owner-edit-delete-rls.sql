-- ============================================================
-- Politiques RLS : Modification et suppression par l'auteur
-- À exécuter dans le SQL Editor de votre dashboard Supabase
-- ============================================================

-- ──────────────────────────────────────────
-- TABLE: news
-- ──────────────────────────────────────────

-- Autoriser l'auteur à modifier sa propre news
CREATE POLICY "Authors can update their own news"
  ON news
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Autoriser l'auteur à supprimer sa propre news
CREATE POLICY "Authors can delete their own news"
  ON news
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- ──────────────────────────────────────────
-- TABLE: songs
-- ──────────────────────────────────────────

-- Autoriser l'uploader à modifier ses propres chansons
CREATE POLICY "Uploaders can update their own songs"
  ON songs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploader_id)
  WITH CHECK (auth.uid() = uploader_id);

-- Note: la politique de suppression des chansons existe déjà
-- Si elle n'existe pas encore, décommenter les lignes ci-dessous:
-- CREATE POLICY "Uploaders can delete their own songs"
--   ON songs
--   FOR DELETE
--   TO authenticated
--   USING (auth.uid() = uploader_id);
