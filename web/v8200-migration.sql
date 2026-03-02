-- ══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v8200
-- Corrections admin, Live Room delete, sync lecture
-- Date: 2025-03-02
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Permettre la suppression des salons live par l'hôte et l'admin ──
ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_rooms_delete_host" ON live_rooms;
CREATE POLICY "live_rooms_delete_host"
  ON live_rooms FOR DELETE
  USING (
    auth.uid()::text = host_id::text
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id::text = auth.uid()::text
      AND u.email = 'eloadxfamily@gmail.com'
    )
  );

DROP POLICY IF EXISTS "live_rooms_select" ON live_rooms;
CREATE POLICY "live_rooms_select"
  ON live_rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "live_rooms_insert" ON live_rooms;
CREATE POLICY "live_rooms_insert"
  ON live_rooms FOR INSERT
  WITH CHECK (auth.uid()::text = host_id::text);

DROP POLICY IF EXISTS "live_rooms_update_host" ON live_rooms;
CREATE POLICY "live_rooms_update_host"
  ON live_rooms FOR UPDATE
  USING (
    auth.uid()::text = host_id::text
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id::text = auth.uid()::text
      AND u.email = 'eloadxfamily@gmail.com'
    )
  );

-- ── 2. Permettre la suppression des messages live par l'hôte et l'admin ──
ALTER TABLE live_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_messages_delete" ON live_room_messages;
CREATE POLICY "live_messages_delete"
  ON live_room_messages FOR DELETE
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1 FROM live_rooms r
      WHERE r.id = room_id AND r.host_id::text = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id::text = auth.uid()::text
      AND u.email = 'eloadxfamily@gmail.com'
    )
  );

DROP POLICY IF EXISTS "live_messages_select" ON live_room_messages;
CREATE POLICY "live_messages_select"
  ON live_room_messages FOR SELECT
  USING (true);

-- La politique live_room_messages_insert existe déjà, on ne la recrée pas

-- ── 3. user_roles — s'assurer que l'admin hardcodé a le rôle admin ──────
-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select"
  ON user_roles FOR SELECT
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id::text = auth.uid()::text AND u.email = 'eloadxfamily@gmail.com'
    )
  );

-- Insérer le rôle admin pour eloadxfamily@gmail.com si cet utilisateur existe
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'eloadxfamily@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (v_user_id, 'admin', true)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = true;
    RAISE NOTICE 'Admin role assigned to eloadxfamily@gmail.com (id: %)', v_user_id;
  ELSE
    RAISE NOTICE 'Admin user not found yet - will be set on first login via app logic';
  END IF;
END $$;

-- ── 4. Index performance pour live rooms ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_live_rooms_active
  ON live_rooms (is_active, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_live_messages_room
  ON live_room_messages (room_id, created_at ASC);

-- ── 5. Fonction pour nettoyer les salons inactifs (> 24h) ───────────────
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM live_rooms
  WHERE is_active = false
  AND updated_at < now() - INTERVAL '24 hours';
  
  -- Fermer les salons dont le dernier message date de > 6h sans activité
  UPDATE live_rooms
  SET is_active = false, participants_count = 0
  WHERE is_active = true
  AND id NOT IN (
    SELECT DISTINCT room_id FROM live_room_messages
    WHERE created_at > now() - INTERVAL '6 hours'
  )
  AND created_at < now() - INTERVAL '6 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Migration v8200 terminée
SELECT 'NovaSound TITAN LUX v8200 — Migration appliquée avec succès ✅' AS status;
