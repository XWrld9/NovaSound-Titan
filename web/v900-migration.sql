-- ============================================================
-- NovaSound TITAN LUX — Migration v900
-- À exécuter dans Supabase Dashboard > SQL Editor (Étape 19)
-- ============================================================

-- ── 1. Colonne is_cleared pour audit admin (optionnel, tracabilité) ──
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

-- ── 2. Index performance sur is_deleted + created_at ─────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted
  ON chat_messages (created_at DESC)
  WHERE is_deleted = false;

-- ── 3. Fonction RPC admin : clear_chat_messages ────────────────────
-- Permet à l'admin de soft-delete tous les messages en une seule
-- opération atomique sécurisée côté serveur.
CREATE OR REPLACE FUNCTION clear_chat_messages(admin_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
  admin_email TEXT;
BEGIN
  -- Vérifier que l'appelant est bien l'admin
  SELECT email INTO admin_email
  FROM auth.users
  WHERE id = admin_user_id;

  IF admin_email IS DISTINCT FROM 'eloadxfamily@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: only admin can clear chat messages';
  END IF;

  -- Soft-delete tous les messages non encore supprimés
  UPDATE chat_messages
  SET
    is_deleted = true,
    cleared_by = admin_user_id,
    cleared_at = NOW()
  WHERE is_deleted = false;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Accorder l'exécution aux utilisateurs connectés (la fonction vérifie l'email en interne)
GRANT EXECUTE ON FUNCTION clear_chat_messages(UUID) TO authenticated;

-- ── 4. RLS update sur chat_messages (autoriser cleared_by/cleared_at) ─
-- S'assurer que les colonnes cleared_by et cleared_at sont bien
-- modifiables via les policies existantes (UPDATE par admin)
-- Les policies UPDATE existantes couvrent déjà ce cas via is_deleted.

-- ── 5. Version bump dans une meta table (optionnel) ──────────────────
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_meta (key, value, updated_at)
VALUES ('version', '900.0.0', NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

-- ── 6. Vérification finale ────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ NovaSound v900 migration completed successfully';
  RAISE NOTICE '   • chat_messages: cleared_by + cleared_at columns added';
  RAISE NOTICE '   • clear_chat_messages() RPC function created';
  RAISE NOTICE '   • Performance index on chat_messages(created_at) WHERE NOT deleted';
END $$;
