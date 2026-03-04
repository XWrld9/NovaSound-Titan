-- ============================================================
-- NovaSound TITAN LUX — Migration v20000
-- À exécuter dans Supabase → SQL Editor
-- Script idempotent (safe à relancer)
-- ============================================================

-- ── 1. Fix RLS user_roles (500 → cast uuid::text) ────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select"        ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert"        ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all"     ON user_roles;

-- Lecture : chaque user voit ses propres rôles
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (auth.uid()::text = user_id);

-- Admin peut tout faire (service_role bypass RLS de toute façon)
CREATE POLICY "user_roles_admin_all" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()::text
        AND ur2.role = 'admin'
        AND ur2.is_active = true
    )
  );

-- ── 2. Fix RLS push_subscriptions (403 → policies manquantes) ────────────────
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_delete" ON push_subscriptions;

CREATE POLICY "push_sub_select" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_sub_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_sub_update" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_sub_delete" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3. Colonnes manquantes sur users (sécurité) ───────────────────────────────
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- ── 4. Colonnes manquantes sur songs ─────────────────────────────────────────
ALTER TABLE IF EXISTS songs ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- ── 5. ADMIN PRIVILEGES — eloadxfamily@gmail.com ─────────────────────────────
-- Insère le rôle admin pour eloadxfamily@gmail.com (idempotent via ON CONFLICT)
DO $$
DECLARE
  v_user_id text;
BEGIN
  -- Cherche l'utilisateur dans auth.users par email
  SELECT id::text INTO v_user_id
  FROM auth.users
  WHERE email = 'eloadxfamily@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Insère dans users si pas déjà présent
    INSERT INTO users (id, email)
    VALUES (v_user_id::uuid, 'eloadxfamily@gmail.com')
    ON CONFLICT (id) DO NOTHING;

    -- Supprime l'ancien rôle s'il existe pour éviter les doublons
    DELETE FROM user_roles
    WHERE user_id = v_user_id AND role = 'admin';

    -- Insère le rôle admin proprement
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (v_user_id, 'admin', true);

    RAISE NOTICE 'Admin role granted to eloadxfamily@gmail.com (user_id: %)', v_user_id;
  ELSE
    RAISE WARNING 'User eloadxfamily@gmail.com not found in auth.users. Create the account first, then rerun this migration.';
  END IF;
END $$;

-- ── 6. Index utiles pour les performances ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id   ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role       ON user_roles (role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_songs_archived        ON songs (is_archived);
CREATE INDEX IF NOT EXISTS idx_users_banned          ON users (is_banned) WHERE is_banned = true;

-- ── 7. Vérification finale ────────────────────────────────────────────────────
SELECT
  ur.user_id,
  ur.role,
  ur.is_active,
  au.email,
  ur.created_at
FROM user_roles ur
LEFT JOIN auth.users au ON au.id::text = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at DESC;

-- ============================================================
-- FIN DE LA MIGRATION v20000
-- ============================================================
