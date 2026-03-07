-- Vérifier la structure des tables pour les likes de live rooms
-- V600000 - Debug système de likes sur les lives

-- 1. Vérifier si la table live_room_likes existe
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'live_room_likes' 
ORDER BY ordinal_position;

-- 2. Vérifier la structure de live_rooms pour voir s'il y a un champ likes_count
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'live_rooms' 
ORDER BY ordinal_position;

-- 3. Vérifier les politiques RLS sur live_room_likes si la table existe
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'live_room_likes';

-- 4. Compter les likes existants par live room
SELECT 
    lr.id as room_id,
    lr.name as room_name,
    COUNT(lrl.id) as likes_count
FROM live_rooms lr
LEFT JOIN live_room_likes lrl ON lr.id = lrl.room_id
GROUP BY lr.id, lr.name
ORDER BY likes_count DESC
LIMIT 10;

-- 5. Vérifier les likes récents
SELECT 
    lrl.*,
    lr.name as room_name,
    u.username as liker_username
FROM live_room_likes lrl
JOIN live_rooms lr ON lrl.room_id = lr.id
JOIN users u ON lrl.user_id = u.id
ORDER BY lrl.created_at DESC
LIMIT 5;
