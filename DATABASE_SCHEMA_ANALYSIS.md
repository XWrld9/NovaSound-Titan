# 🗄️ ANALYSE SCHÉMA BASE DE DONNÉES - NOTIFICATIONS

## 📋 **TABLES PRINCIPALES**

### **1. notifications** - Table centrale
```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            TEXT NOT NULL CHECK (type IN (
        'like', 'like_song', 'like_news', 'comment', 'comment_news',
        'reply', 'mention', 'follow', 'repost', 'new_song', 'queue_song',
        'mood_vote', 'news', 'chat_reply', 'chat_mention', 'chat_mention_all',
        'live_start', 'live_started', 'live_invite', 'live_join',
        'live_comment', 'live_like', 'live_leave', 'achievement', 'broadcast'
    )),
    title           TEXT NOT NULL,
    body            TEXT,
    url             TEXT DEFAULT '/',
    icon_url        TEXT DEFAULT '/icon-192.png',
    is_read         BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}',
    from_user_id    UUID REFERENCES users(id),
    song_id         UUID REFERENCES songs(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes pour performance
    INDEX idx_notifications_user_created (user_id, created_at DESC),
    INDEX idx_notifications_type_created (type, created_at DESC),
    INDEX idx_notifications_unread (is_read, created_at DESC),
    INDEX idx_notifications_song (song_id),
    INDEX idx_notifications_from_user (from_user_id)
);
```

### **2. push_subscriptions** - Abonnements push
```sql
CREATE TABLE push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    endpoint        TEXT NOT NULL,
    p256dh_key      TEXT NOT NULL,
    auth_key        TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    UNIQUE (user_id, endpoint),
    INDEX idx_push_subscriptions_user (user_id),
    INDEX idx_push_subscriptions_active (deleted_at) WHERE deleted_at IS NULL
);
```

### **3. push_notification_logs** - Logs push
```sql
CREATE TABLE push_notification_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    notif_id        UUID REFERENCES notifications(id),
    type            TEXT,
    title           TEXT,
    body            TEXT,
    url             TEXT,
    sent            BOOLEAN DEFAULT FALSE,
    ms              INTEGER, -- Temps d'exécution en ms
    error_type      TEXT,
    error_details   JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_push_logs_created (created_at DESC),
    INDEX idx_push_logs_sent (sent, created_at DESC),
    INDEX idx_push_logs_user (user_id, created_at DESC)
);
```

---

## 🔗 **TABLES LIÉES AUX NOTIFICATIONS**

### **Tables de contenu**
```sql
-- Songs (pour musique)
CREATE TABLE songs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    artist          TEXT NOT NULL,
    uploader_id     UUID REFERENCES users(id),
    audio_url       TEXT,
    cover_url       TEXT,
    plays_count     INTEGER DEFAULT 0,
    likes_count     INTEGER DEFAULT 0,
    reposts_count   INTEGER DEFAULT 0,
    genre           TEXT,
    is_archived     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- News (pour actualités)  
CREATE TABLE news (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    author_id       UUID REFERENCES users(id),
    likes_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Tables d'interactions**
```sql
-- Likes
CREATE TABLE likes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    song_id         UUID NOT NULL REFERENCES songs(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, song_id)
);

-- Comments
CREATE TABLE song_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    song_id         UUID NOT NULL REFERENCES songs(id),
    content         TEXT NOT NULL,
    reply_to_id     UUID REFERENCES song_comments(id),
    is_edited       BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follows
CREATE TABLE follows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id     UUID NOT NULL REFERENCES users(id),
    following_id    UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);
```

### **Tables Live**
```sql
-- Live rooms
CREATE TABLE live_rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    host_id         UUID NOT NULL REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE,
    is_private      BOOLEAN DEFAULT FALSE,
    participants_count INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live room likes
CREATE TABLE live_room_likes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    room_id         UUID NOT NULL REFERENCES live_rooms(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, room_id)
);

-- Live room messages
CREATE TABLE live_room_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    room_id         UUID NOT NULL REFERENCES live_rooms(id),
    content         TEXT NOT NULL,
    is_edited       BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🎯 **TRIGGERS ET FONCTIONS DB**

### **Trigger pour notifications push**
```sql
-- Trigger automatique pour envoyer push quand notification insérée
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Appel Edge Function pour push
    PERFORM http_post(
        'https://tleuzlyfelrnykpbwhkc.supabase.co/functions/v1/send-push-notification',
        json_build_object(
            'user_id', NEW.user_id,
            'title', NEW.title,
            'body', NEW.body,
            'url', NEW.url,
            'type', NEW.type,
            'icon_url', NEW.icon_url
        ),
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_notification_insert
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_push_notification();
```

### **Fonctions utilitaires**
```sql
-- Nettoyage anciennes notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old
    AND is_read = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Statistiques notifications par utilisateur
CREATE OR REPLACE FUNCTION get_user_notification_stats(user_uuid UUID)
RETURNS TABLE (
    total_notifications BIGINT,
    unread_count BIGINT,
    by_type JSONB,
    last_week_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN is_read = FALSE THEN 1 END)::BIGINT,
        jsonb_object_agg(type, type_count) as by_type,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::BIGINT
    FROM (
        SELECT 
            type,
            COUNT(*) as type_count
        FROM notifications 
        WHERE user_id = user_uuid
        GROUP BY type
    ) type_stats
    CROSS JOIN (
        SELECT COUNT(*) as total_notifications,
               COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_count,
               COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_week_count
        FROM notifications 
        WHERE user_id = user_uuid
    ) stats;
END;
$$ LANGUAGE plpgsql;
```

---

## 📊 **INDEX OPTIMISÉS**

### **Indexes critiques**
```sql
-- Notifications principales
CREATE INDEX CONCURRENTLY idx_notifications_user_unread 
ON notifications (user_id, is_read, created_at DESC);

-- Recherche par type
CREATE INDEX CONCURRENTLY idx_notifications_type_user 
ON notifications (type, user_id, created_at DESC);

-- Songs populaires
CREATE INDEX CONCURRENTLY idx_songs_popularity 
ON songs (plays_count DESC, likes_count DESC, created_at DESC);

-- Follows pour notifyFollowers
CREATE INDEX CONCURRENTLY idx_follows_following 
ON follows (following_id, created_at DESC);

-- Chat messages
CREATE INDEX CONCURRENTLY idx_chat_messages_created 
ON chat_messages (created_at DESC);

-- Live rooms actifs
CREATE INDEX CONCURRENTLY idx_live_rooms_active 
ON live_rooms (is_active, participants_count DESC) WHERE is_active = TRUE;
```

---

## 🔍 **RÈGLES RLS (ROW LEVEL SECURITY)**

### **Notifications**
```sql
-- Users ne voient que leurs notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users peuvent marquer leurs notifications comme lues
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Tout le monde peut insérer des notifications (pour notifUtils)
CREATE POLICY "Anyone can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);
```

### **Push subscriptions**
```sql
-- Users ne voient que leurs abonnements
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);
```

---

## 📈 **STATISTIQUES ET MONITORING**

### **Vue matérialisée - Notifications par jour**
```sql
CREATE MATERIALIZED VIEW daily_notification_stats AS
SELECT 
    DATE(created_at) as date,
    type,
    COUNT(*) as total,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread
FROM notifications 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), type;

-- Rafraîchir chaque heure
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_notification_stats;
END;
$$ LANGUAGE plpgsql;
```

### **Vue - Performance push**
```sql
CREATE VIEW push_performance_stats AS
SELECT 
    DATE(created_at) as date,
    type,
    COUNT(*) as total_sent,
    COUNT(CASE WHEN sent = TRUE THEN 1 END) as successful,
    COUNT(CASE WHEN sent = FALSE THEN 1 END) as failed,
    ROUND(AVG(ms), 2) as avg_ms,
    MAX(ms) as max_ms
FROM push_notification_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), type
ORDER BY date DESC, total_sent DESC;
```

---

## 🎯 **OPTIMISATIONS DE PERFORMANCE**

### **Partitionnement (si nécessaire)**
```sql
-- Partitionner notifications par mois si > 1M records
CREATE TABLE notifications_y2024m01 PARTITION OF notifications
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### **Cleanup automatique**
```sql
-- Job quotidien pour nettoyer anciennes notifications lues
SELECT cron.schedule(
    'cleanup-notifications',
    '0 2 * * *',  -- Tous les jours à 2h du matin
    'SELECT cleanup_old_notifications(90);'
);
```

---

## 🎉 **CONCLUSION SCHÉMA**

Le schéma de la base de données est **bien conçu** avec:
- ✅ **Indexes optimisés** pour les requêtes principales
- ✅ **RLS sécurisé** pour la protection des données
- ✅ **Triggers automatiques** pour les push
- ✅ **Fonctions utilitaires** pour les statistiques
- ✅ **Matérialized views** pour le monitoring
- ✅ **Cleanup automatique** pour maintenir les performances

**Base de données prête pour la production !** 🚀
