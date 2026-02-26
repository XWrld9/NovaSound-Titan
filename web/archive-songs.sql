-- ============================================================
-- archive-songs.sql — NovaSound TITAN LUX v8.0
-- Ajoute la colonne is_archived + is_deleted à la table songs
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Ajouter les colonnes
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Index pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_songs_is_archived ON songs (is_archived);
CREATE INDEX IF NOT EXISTS idx_songs_is_deleted  ON songs (is_deleted);

-- 3. RLS — l'uploader peut archiver/désarchiver/supprimer ses propres sons
--    L'admin (eloadxfamily@gmail.com) peut tout faire via son UUID

-- Politique UPDATE étendue : uploader OU admin peut modifier is_archived / is_deleted
-- (Si une politique UPDATE existe déjà, la supprimer d'abord)
DROP POLICY IF EXISTS "Users can update own songs" ON songs;
DROP POLICY IF EXISTS "Owner or admin can update songs" ON songs;

CREATE POLICY "Owner or admin can update songs"
  ON songs FOR UPDATE
  USING (
    auth.uid() = uploader_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  )
  WITH CHECK (
    auth.uid() = uploader_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- Politique DELETE : uploader OU admin peut supprimer définitivement
DROP POLICY IF EXISTS "Users can delete own songs" ON songs;
DROP POLICY IF EXISTS "Owner or admin can delete songs" ON songs;

CREATE POLICY "Owner or admin can delete songs"
  ON songs FOR DELETE
  USING (
    auth.uid() = uploader_id
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );

-- 4. Les sons archivés / supprimés ne doivent plus apparaître en public
-- Politique SELECT publique : exclure archivés et supprimés
DROP POLICY IF EXISTS "Songs are publicly visible" ON songs;
DROP POLICY IF EXISTS "Public can view active songs" ON songs;

CREATE POLICY "Public can view active songs"
  ON songs FOR SELECT
  USING (
    -- Son actif visible par tout le monde
    (is_archived = FALSE AND is_deleted = FALSE)
    -- OU l'uploader voit aussi ses propres sons archivés
    OR auth.uid() = uploader_id
    -- OU l'admin voit tout
    OR auth.jwt() ->> 'email' = 'eloadxfamily@gmail.com'
  );
