-- ============================================================
-- FIX v2 : Politiques RLS pour les buckets avatars / audio / covers
-- ⚠️  Exécuter dans Supabase Dashboard > SQL Editor
-- Supprime les anciennes politiques avant de les recréer
-- pour éviter les conflits de noms.
-- ============================================================

-- ── Nettoyage des anciennes politiques ──────────────────────
DROP POLICY IF EXISTS "Avatars publics lisibles"      ON storage.objects;
DROP POLICY IF EXISTS "Upload avatar authentifié"     ON storage.objects;
DROP POLICY IF EXISTS "Mise à jour avatar propriétaire" ON storage.objects;
DROP POLICY IF EXISTS "Suppression avatar propriétaire" ON storage.objects;
DROP POLICY IF EXISTS "Upload audio authentifié"      ON storage.objects;
DROP POLICY IF EXISTS "Audio public lisible"           ON storage.objects;
DROP POLICY IF EXISTS "Upload covers authentifié"     ON storage.objects;
DROP POLICY IF EXISTS "Covers publics lisibles"        ON storage.objects;
-- Anciennes politiques génériques
DROP POLICY IF EXISTS "Public read avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Auth insert avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Owner delete avatars"  ON storage.objects;

-- ── BUCKET avatars ───────────────────────────────────────────

-- 1. Lecture publique
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 2. Upload par utilisateur authentifié
--    Le fichier se nomme avatar-{uuid}.ext → pas de sous-dossier
--    On autorise tout utilisateur authentifié à insérer dans ce bucket.
CREATE POLICY "avatars_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- 3. Mise à jour — l'utilisateur peut écraser son propre fichier (upsert)
--    On vérifie que le nom du fichier contient l'UID de l'utilisateur.
CREATE POLICY "avatars_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    name LIKE ('%' || auth.uid()::text || '%')
    OR owner = auth.uid()
  )
)
WITH CHECK ( bucket_id = 'avatars' );

-- 4. Suppression
CREATE POLICY "avatars_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    name LIKE ('%' || auth.uid()::text || '%')
    OR owner = auth.uid()
  )
);

-- ── BUCKET audio ─────────────────────────────────────────────

DROP POLICY IF EXISTS "audio_select_public"  ON storage.objects;
DROP POLICY IF EXISTS "audio_insert_auth"    ON storage.objects;
DROP POLICY IF EXISTS "audio_update_owner"   ON storage.objects;
DROP POLICY IF EXISTS "audio_delete_owner"   ON storage.objects;

CREATE POLICY "audio_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'audio' );

CREATE POLICY "audio_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'audio' );

CREATE POLICY "audio_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING  ( bucket_id = 'audio' AND owner = auth.uid() )
WITH CHECK ( bucket_id = 'audio' );

CREATE POLICY "audio_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'audio' AND owner = auth.uid() );

-- ── BUCKET covers ─────────────────────────────────────────────

DROP POLICY IF EXISTS "covers_select_public" ON storage.objects;
DROP POLICY IF EXISTS "covers_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "covers_update_owner"  ON storage.objects;
DROP POLICY IF EXISTS "covers_delete_owner"  ON storage.objects;

CREATE POLICY "covers_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'covers' );

CREATE POLICY "covers_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'covers' );

CREATE POLICY "covers_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING  ( bucket_id = 'covers' AND owner = auth.uid() )
WITH CHECK ( bucket_id = 'covers' );

CREATE POLICY "covers_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'covers' AND owner = auth.uid() );
