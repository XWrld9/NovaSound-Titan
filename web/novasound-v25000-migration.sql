-- ============================================================
-- NovaSound — Migration FINALE (tous types confirmés)
-- user_id = TEXT dans user_roles ET push_subscriptions
-- → auth.uid()::text partout sans exception
-- ============================================================

-- ── 1. user_roles ─────────────────────────────────────────────
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select"    ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON user_roles;

CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "user_roles_admin_all" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()::text
        AND ur2.role = 'admin'
        AND ur2.is_active = true
    )
  );

-- ── 2. push_subscriptions (user_id = text aussi) ──────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_delete" ON push_subscriptions;

CREATE POLICY "push_sub_select" ON push_subscriptions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_sub_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_sub_update" ON push_subscriptions
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_sub_delete" ON push_subscriptions
  FOR DELETE USING (auth.uid()::text = user_id);

-- ── 3. Colonnes manquantes ─────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned   boolean DEFAULT false;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- ── 4. Admin eloadxfamily@gmail.com ───────────────────────────
DO $$
DECLARE v_user_id text;
BEGIN
  SELECT id::text INTO v_user_id
  FROM auth.users
  WHERE email = 'eloadxfamily@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO users (id, email)
    VALUES (v_user_id::uuid, 'eloadxfamily@gmail.com')
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM user_roles WHERE user_id = v_user_id AND role = 'admin';
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (v_user_id, 'admin', true);

    RAISE NOTICE '✅ Admin accordé à eloadxfamily@gmail.com (id: %)', v_user_id;
  ELSE
    RAISE WARNING '⚠️ Compte introuvable — crée le compte puis relance.';
  END IF;
END $$;

-- ── 5. Index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active   ON user_roles (role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_songs_archived      ON songs (is_archived);
CREATE INDEX IF NOT EXISTS idx_users_banned        ON users (is_banned) WHERE is_banned = true;

-- ── Vérification ───────────────────────────────────────────────
SELECT ur.user_id, ur.role, ur.is_active, au.email
FROM user_roles ur
LEFT JOIN auth.users au ON au.id::text = ur.user_id
WHERE ur.role = 'admin';