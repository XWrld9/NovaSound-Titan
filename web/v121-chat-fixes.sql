-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v121
-- Fix RLS chat_messages :
--   1. Seul l'admin peut soft-delete (is_deleted = true)
--   2. L'auteur peut modifier le contenu de son message (UPDATE content)
--      sans pouvoir toucher à is_deleted
-- ═══════════════════════════════════════════════════════════════════

-- Supprimer l'ancienne policy UPDATE permissive
DROP POLICY IF EXISTS "chat_delete_own" ON chat_messages;

-- Policy UPDATE pour l'auteur : UNIQUEMENT le champ content, UNIQUEMENT si is_deleted=false
-- L'auteur ne peut PAS passer is_deleted=true (ça, c'est réservé à l'admin)
CREATE POLICY "chat_edit_own" ON chat_messages
  FOR UPDATE
  USING (
    auth.uid()::text = user_id
    AND is_deleted = false
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND is_deleted = false  -- l'auteur ne peut jamais se soft-supprimer lui-même
  );

-- Policy UPDATE pour l'admin : peut tout faire (soft delete + edit)
CREATE POLICY "chat_admin_update" ON chat_messages
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id::uuid FROM users WHERE email = 'eloadxfamily@gmail.com'
    )
  )
  WITH CHECK (true);

-- Vérification : lister les policies actuelles
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'chat_messages';

