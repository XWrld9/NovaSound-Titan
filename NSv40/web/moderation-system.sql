-- ========================================
-- MODÉRATION ET SÉCURITÉ RÉELLE
-- ========================================

-- Table pour les reports de contenu
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  reporter_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('song', 'news', 'user', 'comment')),
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'copyright', 'harassment', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(reporter_id, content_type, content_id)
);

-- Table pour les rôles utilisateurs (admin/moderator)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  granted_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, role)
);

-- Table pour les logs de modération
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  admin_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('delete_song', 'delete_news', 'ban_user', 'unban_user', 'resolve_report')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les utilisateurs bannis
CREATE TABLE IF NOT EXISTS public.banned_users (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  banned_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  ban_type TEXT DEFAULT 'temporary' CHECK (ban_type IN ('temporary', 'permanent')),
  ban_duration INTERVAL, -- Pour les bans temporaires
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Améliorer la table news avec modération
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden', 'reported'));
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS moderated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- Améliorer la table songs avec modération
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden', 'reported', 'removed'));
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS moderated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- Améliorer la table users avec modération
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;

-- ========================================
-- INDEX POUR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_reports_content ON public.reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_admin ON public.moderation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON public.moderation_logs(action);
CREATE INDEX IF NOT EXISTS idx_banned_users_active ON public.banned_users(is_active);
CREATE INDEX IF NOT EXISTS idx_banned_users_expires ON public.banned_users(expires_at);

-- ========================================
-- POLITIQUES RLS POUR LA MODÉRATION
-- ========================================

-- Politiques pour reports
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK ((auth.uid())::text = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING ((auth.uid())::text = reporter_id);

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (auth.uid())::text AND role IN ('admin', 'moderator') AND is_active = true
  )
);

-- Politiques pour user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (auth.uid())::text AND role = 'admin' AND is_active = true
  )
);

DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT USING (true);

-- Politiques pour moderation_logs
DROP POLICY IF EXISTS "Admins can manage logs" ON public.moderation_logs;
CREATE POLICY "Admins can manage logs" ON public.moderation_logs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = (auth.uid())::text AND role IN ('admin', 'moderator') AND is_active = true
  )
);

-- ========================================
-- FONCTIONS UTILITAIRES POUR MODÉRATION
-- ========================================

-- Fonction pour vérifier si un utilisateur est admin/moderator
CREATE OR REPLACE FUNCTION is_moderator(user_uuid TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role IN ('admin', 'moderator') AND is_active = true
  );
END;
$$;

-- Fonction pour vérifier si un utilisateur est banni
CREATE OR REPLACE FUNCTION is_user_banned(user_uuid TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT is_banned FROM public.users 
    WHERE id = user_uuid AND (ban_expires_at IS NULL OR ban_expires_at > NOW())
  );
END;
$$;

-- Fonction pour signaler automatiquement un contenu
CREATE OR REPLACE FUNCTION report_content(
  content_type_param TEXT,
  content_id_param TEXT,
  reporter_id_param TEXT,
  reason_param TEXT,
  description_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insérer le report
  INSERT INTO public.reports (reporter_id, content_type, content_id, reason, description)
  VALUES (reporter_id_param, content_type_param, content_id_param, reason_param, description_param);
  
  -- Incrémenter le compteur de reports sur le contenu
  IF content_type_param = 'news' THEN
    UPDATE public.news SET report_count = report_count + 1 WHERE id = content_id_param;
  ELSIF content_type_param = 'song' THEN
    UPDATE public.songs SET report_count = report_count + 1 WHERE id = content_id_param;
  ELSIF content_type_param = 'user' THEN
    UPDATE public.users SET report_count = report_count + 1 WHERE id = content_id_param;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ========================================
-- TRIGGERS AUTOMATIQUES
-- ========================================

-- Trigger pour vérifier les bans avant les opérations
CREATE OR REPLACE FUNCTION check_user_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF is_user_banned((auth.uid())::text) THEN
    RAISE EXCEPTION 'User is banned and cannot perform this action';
  END IF;
  RETURN NEW;
END;
$$;

-- Appliquer le trigger sur les tables sensibles
DROP TRIGGER IF EXISTS check_ban_before_song_insert ON public.songs;
CREATE TRIGGER check_ban_before_song_insert
  BEFORE INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION check_user_ban();

DROP TRIGGER IF EXISTS check_ban_before_news_insert ON public.news;
CREATE TRIGGER check_ban_before_news_insert
  BEFORE INSERT ON public.news
  FOR EACH ROW EXECUTE FUNCTION check_user_ban();

DROP TRIGGER IF EXISTS check_ban_before_follow_insert ON public.follows;
CREATE TRIGGER check_ban_before_follow_insert
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION check_user_ban();

-- Trigger pour nettoyer les bans expirés
CREATE OR REPLACE FUNCTION cleanup_expired_bans()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users 
  SET is_banned = FALSE, ban_reason = NULL, ban_expires_at = NULL 
  WHERE is_banned = TRUE AND ban_expires_at IS NOT NULL AND ban_expires_at <= NOW();
  
  UPDATE public.banned_users 
  SET is_active = FALSE 
  WHERE is_active = TRUE AND expires_at IS NOT NULL AND expires_at <= NOW();
END;
$$;

-- Nettoyer les bans expirés toutes les heures
CREATE OR REPLACE FUNCTION auto_cleanup_bans()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM cleanup_expired_bans();
  RETURN NULL;
END;
$$;
