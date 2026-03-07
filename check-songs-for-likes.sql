-- ============================================================
-- VÉRIFIER LES CHANSONS POUR LES LIKES
-- ============================================================

-- 1. Vérifier s'il y a des chansons dans la table
SELECT 
  COUNT(*) as total_songs,
  'songs' as table_name
FROM public.songs;

-- 2. Voir quelques chansons existantes (pour tester)
SELECT 
  id,
  title,
  artist,
  created_at
FROM public.songs 
ORDER BY created_at DESC
LIMIT 5;

-- 3. Tester l'insertion avec une chanson réelle si elle existe
-- (Cette requête sera exécutée seulement s'il y a des chansons)
DO $$
DECLARE
    song_record RECORD;
BEGIN
    -- Chercher une chanson existante
    SELECT id INTO song_record FROM public.songs LIMIT 1;
    
    IF song_record IS NOT NULL THEN
        -- Tester l'insertion avec un vrai song_id
        EXECUTE format('INSERT INTO public.likes (user_id, song_id) VALUES (%L, %L) ON CONFLICT DO NOTHING', 
                      'df6407a8-7e12-46a1-86f0-bdf505b8b8bb', song_record.id);
        RAISE NOTICE '✅ Test d''insertion avec song_id réel: %', song_record.id;
    ELSE
        RAISE NOTICE '❌ Aucune chanson trouvée dans la table songs';
    END IF;
END $$;

-- 4. Vérifier les likes existants
SELECT 
  COUNT(*) as total_likes,
  user_id,
  song_id
FROM public.likes 
WHERE user_id = 'df6407a8-7e12-46a1-86f0-bdf505b8b8bb'
GROUP BY user_id, song_id
LIMIT 5;

-- Message de diagnostic
DO $$
BEGIN
  RAISE NOTICE '🔍 Vérification des chansons pour likes...';
  RAISE NOTICE '✅ Si pas de chansons = problème de contenu';
  RAISE NOTICE '🎯 L''application doit utiliser des song_id valides';
END $$;
