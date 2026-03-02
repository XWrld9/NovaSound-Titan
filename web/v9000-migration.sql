-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v9000 (FINALE — en accord avec le projet)
-- Basé sur le schéma réel : users.id TEXT, user_roles.id TEXT (déjà existant)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne is_banned sur users (TEXT id) ──────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned      BOOLEAN                  NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ban_reason     TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON public.users (is_banned)
  WHERE is_banned = TRUE;

-- ── 2. Table user_roles — CREATE IF NOT EXISTS (correspond au schéma existant)
-- Si elle existe déjà (depuis moderation-system.sql), cette instruction est ignorée.
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id    TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  granted_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active  BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user   ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(role, is_active);

-- ── 3. Insérer l'admin eloadxfamily@gmail.com dans user_roles ────────────────
-- DO block : pas de comparaison TEXT = UUID, tout est TEXT
DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'eloadxfamily@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (v_user_id, 'admin', TRUE)
    ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE;
  END IF;
END;
$$;

-- ── 4. Fonction helper is_admin(TEXT) ─────────────────────────────────────────
-- Drop toutes les signatures précédentes (UUID depuis v9000 tentatives)
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.is_admin(TEXT);
-- Accepte TEXT (= type réel de users.id dans ce projet)
-- Utilisée dans les policies RLS avec auth.uid()::text
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id    = p_user_id
      AND email = 'eloadxfamily@gmail.com'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id   = p_user_id
      AND role      = 'admin'
      AND is_active = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO anon;

-- ── 5. RLS sur user_roles ─────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_read_own"  ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;

-- auth.uid() est UUID → cast ::text pour comparer avec user_id TEXT
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL
  USING (public.is_admin(auth.uid()::text));

-- ── 6. Policy RLS users : admin peut modifier is_banned ──────────────────────
DROP POLICY IF EXISTS "admin_update_users" ON public.users;

CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE
  USING (
    auth.uid()::text = id
    OR public.is_admin(auth.uid()::text)
  );

-- ── 7. Index de performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_live_rooms_active ON public.live_rooms (is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_songs_archived
  ON public.songs (is_archived, created_at DESC)
  WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted
  ON public.chat_messages (is_deleted, created_at DESC)
  WHERE is_deleted = FALSE;

-- ── 8. Fonction cleanup_inactive_rooms ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.cleanup_inactive_rooms();
CREATE OR REPLACE FUNCTION public.cleanup_inactive_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.live_rooms WHERE is_active = FALSE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_inactive_rooms() TO authenticated;

-- ── 9. Version tracking ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_meta'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'app_meta'
        AND column_name  = 'updated_at'
    ) THEN
      INSERT INTO public.app_meta (key, value) VALUES ('version', '9000')
      ON CONFLICT (key) DO UPDATE SET value = '9000', updated_at = NOW();
    ELSE
      INSERT INTO public.app_meta (key, value) VALUES ('version', '9000')
      ON CONFLICT (key) DO UPDATE SET value = '9000';
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;

-- ── FIN v9000 ─────────────────────────────────────────────────────────────────
-- ✅ users.is_banned (BOOLEAN DEFAULT FALSE)
-- ✅ user_roles id=TEXT (accord avec moderation-system.sql existant)
-- ✅ role CHECK ('admin','moderator') — sans 'vip' pour éviter conflit
-- ✅ admin inséré via DO block (TEXT partout, zero comparaison TEXT=UUID)
-- ✅ is_admin(TEXT) + auth.uid()::text dans toutes les policies
-- ✅ Index de performance
-- ✅ cleanup_inactive_rooms()
-- ✅ Version 9000 dans app_meta
