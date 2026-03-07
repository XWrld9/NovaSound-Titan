-- ========================================
-- VÉRIFICATION ADMIN SUPABASE
-- Pour vérifier si l'utilisateur est admin
-- ========================================

-- 1. Vérifier si ton email existe dans users
SELECT id, username, email 
FROM public.users 
WHERE email = 'eloadxfamily@gmail.com';

-- 2. Vérifier si tu as un rôle admin
SELECT ur.user_id, ur.role, ur.is_active, u.username, u.email
FROM public.user_roles ur
JOIN public.users u ON ur.user_id = u.id
WHERE ur.role = 'admin' AND ur.is_active = true;

-- 3. Ajouter ton rôle admin si nécessaire
INSERT INTO public.user_roles (id, user_id, role, granted_by, granted_at, is_active)
SELECT 
    gen_random_uuid()::text,
    u.id,
    'admin',
    u.id,
    NOW(),
    true
FROM public.users u
WHERE u.email = 'eloadxfamily@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.id AND ur.role = 'admin'
);

-- 4. Créer la fonction admin simplifiée
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
BEGIN
  -- Récupérer l'email de l'utilisateur
  SELECT email INTO user_email
  FROM auth.users
  WHERE id::text = user_id_param;
  
  -- Vérifier si c'est l'admin principal
  IF user_email = 'eloadxfamily@gmail.com' THEN
    RETURN true;
  END IF;
  
  -- Vérifier si l'utilisateur a un rôle admin actif
  RETURN EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_id_param
    AND role = 'admin'
    AND is_active = true
  );
END;
$$;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Vérification admin configurée !';
  RAISE NOTICE '📧 Email admin: eloadxfamily@gmail.com';
  RAISE NOTICE '🔐 Fonction is_user_admin() créée';
END $$;
