-- ============================================================
-- FIX : Politiques RLS pour le bucket "avatars"
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Lecture publique (afficher les avatars)
CREATE POLICY "Avatars publics lisibles"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 2. Upload par utilisateur authentifié (son propre avatar)
CREATE POLICY "Upload avatar authentifié"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- 3. Mise à jour par l'utilisateur lui-même
CREATE POLICY "Mise à jour avatar propriétaire"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] )
WITH CHECK ( bucket_id = 'avatars' );

-- 4. Suppression par l'utilisateur lui-même
CREATE POLICY "Suppression avatar propriétaire"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- ============================================================
-- Faire pareil pour les buckets "audio" et "covers"
-- ============================================================

-- Audio : upload par authentifié
CREATE POLICY "Upload audio authentifié"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'audio' );

CREATE POLICY "Audio public lisible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'audio' );

-- Covers : upload par authentifié
CREATE POLICY "Upload covers authentifié"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'covers' );

CREATE POLICY "Covers publics lisibles"
ON storage.objects FOR SELECT
USING ( bucket_id = 'covers' );
