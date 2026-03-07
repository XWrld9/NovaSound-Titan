-- ============================================================
-- VÉRIFIER LA TABLE LIKES
-- ============================================================

-- 1. Vérifier la structure de la table likes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'likes' 
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes sur likes
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.likes'::regclass;

-- 3. Vérifier les politiques RLS sur likes
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polqual, p.polrelid) as qualification,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_qualification
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'likes'
ORDER BY p.polcmd;

-- 4. Vérifier si RLS est activé sur likes
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'likes';

-- 5. Tester une insertion simple dans likes
INSERT INTO public.likes (user_id, song_id)
VALUES ('df6407a8-7e12-46a1-86f0-bdf505b8b8bb', 'test-song-id')
ON CONFLICT DO NOTHING;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Vérification de la table likes...';
  RAISE NOTICE '✅ Si l''insertion fonctionne = problème dans l''application';
  RAISE NOTICE '❌ Si l''insertion échoue = problème de contrainte ou RLS';
END $$;
