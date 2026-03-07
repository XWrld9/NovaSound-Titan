-- ============================================================
-- VÉRIFICATION DES POLITIQUES NOTIFICATIONS
-- ============================================================

-- 1. Vérifier les politiques actuelles de la table notifications
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polqual, p.polrelid) as qualification,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_qualification,
  CASE 
    WHEN p.polwithcheck IS NOT NULL THEN '✅ WITH CHECK: ' || pg_get_expr(p.polwithcheck, p.polrelid)
    WHEN p.polqual IS NOT NULL THEN '✅ USING: ' || pg_get_expr(p.polqual, p.polrelid)
    ELSE '❌ SANS RESTRICTION'
  END as restriction
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'notifications'
ORDER BY p.polcmd;

-- 2. Vérifier si RLS est activé sur notifications
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'notifications';

-- 3. Vérifier les permissions sur notifications
SELECT 
  table_schema,
  table_name,
  privilege_type,
  grantee
FROM information_schema.role_table_grants 
WHERE table_name = 'notifications'
ORDER BY privilege_type, grantee;
