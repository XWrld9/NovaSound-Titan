-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVASOUND TITAN LUX — Migration VNEXT — Admin Panel, Reports, User Roles
-- À exécuter EN UNE SEULE FOIS dans Supabase SQL Editor
-- Prérequis : migration_VFINAL_complete_fix.sql déjà exécutée avec succès
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne is_banned sur users (si absente) ───────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON public.users(is_banned) WHERE is_banned = true;


-- ── 2. Table user_roles — gestion des admins supplémentaires ─────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
  is_active   boolean     NOT NULL DEFAULT true,
  granted_by  text        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id  ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active   ON public.user_roles(role, is_active) WHERE is_active = true;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Lecture : admin email ou rôle admin actif peuvent voir tous les rôles
DROP POLICY IF EXISTS "user_roles_admin_read"   ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write"  ON public.user_roles;

CREATE POLICY "user_roles_admin_read" ON public.user_roles
  FOR SELECT USING (
    auth.email() = 'eloadxfamily@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles r2
      WHERE r2.user_id = auth.uid()::text
        AND r2.role = 'admin'
        AND r2.is_active = true
    )
  );

CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL USING (
    auth.email() = 'eloadxfamily@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles r2
      WHERE r2.user_id = auth.uid()::text
        AND r2.role = 'admin'
        AND r2.is_active = true
    )
  );


-- ── 3. Table reports — signalements de contenu ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id        text        REFERENCES public.users(id) ON DELETE SET NULL,
  reported_user_id   text        REFERENCES public.users(id) ON DELETE CASCADE,
  song_id            text        REFERENCES public.songs(id)  ON DELETE CASCADE,
  reason             text        NOT NULL DEFAULT 'Contenu inapproprié',
  description        text,
  status             text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by        text        REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status      ON public.reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reports_reporter    ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created     ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_auth"  ON public.reports;
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;

-- Tout utilisateur connecté peut créer un signalement
CREATE POLICY "reports_insert_auth" ON public.reports
  FOR INSERT WITH CHECK (auth.uid()::text = reporter_id);

-- Lecture et modification réservées aux admins
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT USING (
    auth.email() = 'eloadxfamily@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE USING (
    auth.email() = 'eloadxfamily@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
    )
  );


-- ── 4. RLS renforcée sur users — admin peut tout modifier ────────────────────
-- La plupart des projets Supabase ont déjà des policies sur users
-- On ajoute une policy admin-write si elle n'existe pas

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_admin_update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "users_admin_update" ON public.users
        FOR UPDATE USING (
          auth.uid()::text = id
          OR auth.email() = 'eloadxfamily@gmail.com'
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
          )
        )
    $pol$;
  END IF;
END $$;


-- ── 5. RLS renforcée sur songs — admin peut archiver/supprimer ───────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'songs' AND policyname = 'songs_admin_update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "songs_admin_update" ON public.songs
        FOR UPDATE USING (
          auth.uid()::text = uploader_id
          OR auth.email() = 'eloadxfamily@gmail.com'
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
          )
        )
    $pol$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'songs' AND policyname = 'songs_admin_delete'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "songs_admin_delete" ON public.songs
        FOR DELETE USING (
          auth.uid()::text = uploader_id
          OR auth.email() = 'eloadxfamily@gmail.com'
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
          )
        )
    $pol$;
  END IF;
END $$;


-- ── 6. RLS sur live_rooms — admin peut supprimer/modifier ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_rooms' AND policyname = 'live_rooms_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "live_rooms_admin_all" ON public.live_rooms
        FOR ALL USING (
          auth.uid()::text = host_id
          OR auth.email() = 'eloadxfamily@gmail.com'
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()::text AND role = 'admin' AND is_active = true
          )
        )
    $pol$;
  END IF;
END $$;


-- ── 7. Trigger updated_at automatique pour reports et user_roles ─────────────
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_reports_updated_at   ON public.reports;
DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ── Fin migration VNEXT ───────────────────────────────────────────────────────
-- ✅ users.is_banned ajouté (si absent)
-- ✅ user_roles créée : gestion multi-admins avec RLS
-- ✅ reports créée   : signalements avec statuts pending/resolved/dismissed
-- ✅ RLS admin sur users, songs, live_rooms
-- ✅ Triggers updated_at sur reports et user_roles
