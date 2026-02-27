-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v71.0 - Fix Upload RLS
-- Problème : Unauthorized lors de l'upload de fichiers
-- Solution : Politiques RLS plus permissives pour les buckets storage
-- ═══════════════════════════════════════════════════════════════════

-- ── Nettoyage anciennes politiques audio ───────────────────────────────
DROP POLICY IF EXISTS "audio_select_public"  ON storage.objects;
DROP POLICY IF EXISTS "audio_insert_auth"    ON storage.objects;
DROP POLICY IF EXISTS "audio_update_owner"   ON storage.objects;
DROP POLICY IF EXISTS "audio_delete_owner"   ON storage.objects;

-- ── Politiques audio corrigées (sans vérification owner) ───────────────
CREATE POLICY "audio_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'audio' );

CREATE POLICY "audio_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'audio' );

CREATE POLICY "audio_update_any"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'audio' )
WITH CHECK ( bucket_id = 'audio' );

CREATE POLICY "audio_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio'
  AND (
    name LIKE ('%' || auth.uid()::text || '%')
    OR owner = auth.uid()
  )
);

-- ── Nettoyage anciennes politiques covers ───────────────────────────────
DROP POLICY IF EXISTS "covers_select_public" ON storage.objects;
DROP POLICY IF EXISTS "covers_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "covers_update_owner"  ON storage.objects;
DROP POLICY IF EXISTS "covers_delete_owner"  ON storage.objects;

-- ── Politiques covers corrigées (sans vérification owner) ───────────────
CREATE POLICY "covers_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'covers' );

CREATE POLICY "covers_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'covers' );

CREATE POLICY "covers_update_any"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'covers' )
WITH CHECK ( bucket_id = 'covers' );

CREATE POLICY "covers_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers'
  AND (
    name LIKE ('%' || auth.uid()::text || '%')
    OR owner = auth.uid()
  )
);

-- ── Nettoyage anciennes politiques avatars ───────────────────────────────
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;

-- ── Politiques avatars corrigées (sans vérification owner) ───────────────
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "avatars_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "avatars_update_any"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    name LIKE ('%' || auth.uid()::text || '%')
    OR owner = auth.uid()
  )
);
