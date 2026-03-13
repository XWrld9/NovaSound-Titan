-- Script SQL pour vérifier les notifications et abonnements push
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier les notifications récentes
SELECT 
    id,
    type,
    title,
    body,
    url,
    is_read,
    push_sent,
    push_sent_at,
    created_at,
    user_id
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Vérifier les abonnements push actifs
SELECT 
    endpoint,
    user_id,
    created_at,
    updated_at
FROM push_subscriptions 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 3. Vérifier les logs d'envoi push récents
SELECT 
    notif_id,
    user_id,
    type,
    is_broadcast,
    total,
    sent,
    failed,
    purged,
    avg_ms,
    status,
    created_at
FROM push_notification_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Compter par type de notification
SELECT 
    type,
    COUNT(*) as total,
    COUNT(CASE WHEN push_sent = true THEN 1 END) as push_sent_count,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY total DESC;

-- 5. Vérifier les utilisateurs avec des abonnements push
SELECT 
    u.id,
    u.username,
    u.email,
    COUNT(ps.id) as subscription_count,
    MAX(ps.created_at) as last_subscription
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
WHERE ps.created_at >= NOW() - INTERVAL '7 days' OR ps.user_id IS NULL
GROUP BY u.id, u.username, u.email
ORDER BY subscription_count DESC, last_subscription DESC NULLS LAST
LIMIT 20;

-- 6. Vérifier s'il y a des erreurs récurrentes
SELECT 
    type,
    status,
    COUNT(*) as error_count,
    AVG(avg_ms) as avg_ms
FROM push_notification_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
AND status = 'failed'
GROUP BY type, status
ORDER BY error_count DESC;
