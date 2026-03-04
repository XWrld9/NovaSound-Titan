-- Vérifier qui a les droits admin
SELECT 
    u.id,
    u.username,
    u.email,
    ur.role,
    ur.is_active,
    ur.granted_at,
    ur.granted_by
FROM public.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin' AND ur.is_active = true
ORDER BY ur.granted_at DESC;

-- Vérifier s'il y a des admins non autorisés
SELECT 
    u.id,
    u.username,
    u.email,
    ur.role,
    ur.is_active,
    ur.granted_at,
    CASE 
        WHEN u.email = 'eloadxfamily@gmail.com' THEN 'ADMIN AUTORISÉ'
        ELSE 'ADMIN NON AUTORISÉ - À SUPPRIMER'
    END as status
FROM public.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin' 
AND ur.is_active = true
AND u.email != 'eloadxfamily@gmail.com';
