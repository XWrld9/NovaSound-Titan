-- ================================================================
-- v160-migration.sql — NovaSound TITAN LUX v160 FINAL
-- Fusion titan_v160 + v160 — exécuter dans Supabase SQL Editor
-- ⚠️  Étape 18 — à exécuter UNE SEULE FOIS
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- PARTIE A : NOTIFICATIONS CHAT (@tous, reply, mention)
-- ════════════════════════════════════════════════════════════════

-- A1. Mettre à jour la contrainte CHECK pour accepter les types chat_*
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like', 'comment', 'follow', 'new_song', 'news',
    'chat_reply', 'chat_mention', 'chat_mention_all'
  ));

-- A2. Ajouter la colonne metadata (stockage JSON souple)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata TEXT;

-- A3. Index supplémentaire pour filtrer les notifs chat
CREATE INDEX IF NOT EXISTS idx_notif_user_type
  ON public.notifications(user_id, type, created_at DESC);

-- A4. Activer Realtime sur notifications (si pas encore fait)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- A5. Politique RLS : permettre à tout user connecté d'insérer
--     une notification pour n'importe quel user cible
--     (nécessaire pour les notifications inter-utilisateurs du chat)
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- A6. Suppression de message par l'AUTEUR lui-même dans le chat
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'eloadxfamily@gmail.com'
  );

-- A7. Index pour les messages chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);


-- ════════════════════════════════════════════════════════════════
-- PARTIE B : TABLES NEWS_COMMENTS + LIKES (créées si inexistantes)
-- ════════════════════════════════════════════════════════════════

-- B0a. S'assurer que la table news_comments existe
CREATE TABLE IF NOT EXISTS public.news_comments (
  id         TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  news_id    TEXT REFERENCES public.news(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B0b. Ajouter likes_count si la table existait déjà sans cette colonne
ALTER TABLE public.news_comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- B1. Table likes pour les commentaires news
CREATE TABLE IF NOT EXISTS public.news_comment_likes (
  id         TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  comment_id TEXT REFERENCES public.news_comments(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- B2. Trigger pour maintenir likes_count sur news_comments
CREATE OR REPLACE FUNCTION update_news_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_news_comment_likes ON public.news_comment_likes;
CREATE TRIGGER trg_news_comment_likes
  AFTER INSERT OR DELETE ON public.news_comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_news_comment_likes_count();

-- B3. RLS news_comments
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_comments_select" ON public.news_comments;
DROP POLICY IF EXISTS "news_comments_insert" ON public.news_comments;
DROP POLICY IF EXISTS "news_comments_update" ON public.news_comments;
DROP POLICY IF EXISTS "news_comments_delete" ON public.news_comments;
CREATE POLICY "news_comments_select" ON public.news_comments FOR SELECT USING (true);
CREATE POLICY "news_comments_insert" ON public.news_comments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "news_comments_update" ON public.news_comments FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "news_comments_delete" ON public.news_comments FOR DELETE USING (
  auth.uid()::text = user_id OR
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'eloadxfamily@gmail.com'
);

-- B4. RLS news_comment_likes
ALTER TABLE public.news_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_comment_likes_select" ON public.news_comment_likes;
DROP POLICY IF EXISTS "news_comment_likes_insert" ON public.news_comment_likes;
DROP POLICY IF EXISTS "news_comment_likes_delete" ON public.news_comment_likes;
CREATE POLICY "news_comment_likes_select" ON public.news_comment_likes FOR SELECT USING (true);
CREATE POLICY "news_comment_likes_insert" ON public.news_comment_likes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "news_comment_likes_delete" ON public.news_comment_likes FOR DELETE USING (auth.uid()::text = user_id);

-- B5. Index Realtime
CREATE INDEX IF NOT EXISTS idx_news_comments_news_id       ON public.news_comments(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_user_id       ON public.news_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_news_comment_likes_comment   ON public.news_comment_likes(comment_id);

-- B6. Activer Realtime sur news_comments et news_comment_likes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'news_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comments;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'news_comment_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comment_likes;
  END IF;
END $$;

-- ================================================================
-- ✅  Migration v160 FINAL terminée
-- ================================================================
