-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v1000
-- FIX CRITIQUE : Récursion infinie RLS user_roles → 500 Internal Server Error
-- is_admin() lisait user_roles → policy appelait is_admin() → boucle → 500
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Drop toutes les versions de is_admin ───────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.is_admin(TEXT);

-- ── 2. is_admin(TEXT) sans référence à user_roles ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND email = 'eloadxfamily@gmail.com'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO authenticated, anon;

-- ── 3. Policies user_roles : auth.email() (JWT, zéro récursion) ──────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_read_own"              ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all"             ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_all"              ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_authenticated_read"    ON public.user_roles;

CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL USING (auth.email() = 'eloadxfamily@gmail.com');

CREATE POLICY "user_roles_authenticated_read" ON public.user_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 4. admin_update_users : auth.email() ────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_users" ON public.users;
CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE USING (auth.uid()::text = id OR auth.email() = 'eloadxfamily@gmail.com');

-- ── 5. Version ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_meta') THEN
    BEGIN
      INSERT INTO public.app_meta (key,value) VALUES ('version','1000')
      ON CONFLICT (key) DO UPDATE SET value='1000';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END; $$;

-- ✅ Récursion RLS éliminée — is_admin(TEXT) ne touche plus user_roles
-- ✅ auth.email() = lecture JWT directe, pas de table lookup, pas de RLS
