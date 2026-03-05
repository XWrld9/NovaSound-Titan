-- ============================================================
-- NovaSound TITAN LUX — Migration V60000
-- "Personnalisation & Communauté"
-- ============================================================
-- Prérequis : migration V40000 déjà exécutée
-- Cette migration ABSORBE V41000 (idempotente) + ajoute V60000
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOC V41000 (idempotent — safe à re-exécuter)          ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── V41 / 1. Table push_notification_logs ───────────────────
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id           uuid    NOT NULL DEFAULT gen_random_uuid(),
  notif_id     text,
  user_id      text,
  type         text    NOT NULL DEFAULT 'default',
  is_broadcast boolean NOT NULL DEFAULT false,
  total        integer NOT NULL DEFAULT 0,
  sent         integer NOT NULL DEFAULT 0,
  failed       integer NOT NULL DEFAULT 0,
  purged       integer NOT NULL DEFAULT 0,
  avg_ms       integer NOT NULL DEFAULT 0,
  status       text    NOT NULL DEFAULT 'sent'
                CHECK (status = ANY (ARRAY['sent','failed','skipped'])),
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_notification_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_push_logs_notif_id
  ON public.push_notification_logs(notif_id) WHERE notif_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_logs_user_created
  ON public.push_notification_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_logs_status
  ON public.push_notification_logs(status, created_at DESC);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_notification_logs' AND policyname='push_logs_service_only') THEN
    CREATE POLICY "push_logs_service_only" ON public.push_notification_logs FOR ALL USING (false);
  END IF;
END $$;

-- ── V41 / 2. Colonnes push_sent sur notifications ────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_sent_at  timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications(user_id, push_sent, created_at DESC)
  WHERE push_sent = false;

-- ── V41 / 3. Vues stats push ─────────────────────────────────
CREATE OR REPLACE VIEW public.push_stats_7d AS
SELECT
  date_trunc('day', created_at) AS day,
  type,
  COUNT(*)                      AS requests,
  SUM(sent)                     AS total_sent,
  SUM(failed)                   AS total_failed,
  SUM(purged)                   AS total_purged,
  ROUND(AVG(avg_ms))            AS avg_latency_ms
FROM public.push_notification_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW public.push_delivery_rates AS
SELECT
  type,
  SUM(total)  AS total_attempts,
  SUM(sent)   AS delivered,
  SUM(failed) AS failed,
  CASE WHEN SUM(total) > 0
    THEN ROUND(100.0 * SUM(sent) / NULLIF(SUM(total),0), 1)
    ELSE 0
  END AS delivery_rate_pct
FROM public.push_notification_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY type
ORDER BY total_attempts DESC;

-- ── V41 / 4. Fonction purge vieux logs ───────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_push_logs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.push_notification_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  BLOC V60000 — Nouvelles tables & colonnes              ║
-- ╚══════════════════════════════════════════════════════════╝

-- ── 1. Table chat_reactions ──────────────────────────────────
-- Reactions emoji sur les messages du chat public
CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id bigint NOT NULL,
  user_id    text   NOT NULL,
  emoji      text   NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_reactions_unique UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message
  ON public.chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user
  ON public.chat_reactions(user_id);

ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_reactions' AND policyname='chat_reactions_read') THEN
    CREATE POLICY "chat_reactions_read" ON public.chat_reactions FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_reactions' AND policyname='chat_reactions_insert') THEN
    CREATE POLICY "chat_reactions_insert" ON public.chat_reactions FOR INSERT
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_reactions' AND policyname='chat_reactions_delete') THEN
    CREATE POLICY "chat_reactions_delete" ON public.chat_reactions FOR DELETE
      USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- Activer realtime
DO $$
BEGIN
  -- Retirer chat_reactions si déjà dans la publication pour éviter l'erreur 42710
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_reactions;
  END IF;
  
  -- Ajouter la table à la publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
END $$;

-- ── 2. Table user_achievements ───────────────────────────────
-- Achievements débloqués par utilisateur
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  achievement text NOT NULL,   -- code de l'achievement (FK vers achievement_definitions.code)
  progress    integer NOT NULL DEFAULT 0,
  unlocked_at timestamp with time zone DEFAULT now(),
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements(user_id, unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='user_achievements_read') THEN
    CREATE POLICY "user_achievements_read" ON public.user_achievements FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='user_achievements_insert') THEN
    CREATE POLICY "user_achievements_insert" ON public.user_achievements FOR INSERT
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='user_achievements_update') THEN
    CREATE POLICY "user_achievements_update" ON public.user_achievements FOR UPDATE
      USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- ── 3. Plus d'achievements dans achievement_definitions ──────
-- ⚠️ Valeurs rarity autorisées UNIQUEMENT : 'common','rare','epic','legendary'
-- 'uncommon' n'existe PAS dans le CHECK constraint réel → utiliser 'common' ou 'rare'
INSERT INTO public.achievement_definitions (code, label, description, icon, points, rarity)
VALUES
  ('first_upload',    'Premier Son',         'Uploader ton premier son',                 '🎵', 10,  'common'),
  ('five_uploads',    'Créateur',            'Uploader 5 sons',                          '🎤', 30,  'rare'),
  ('first_like',      'Premier Like',        'Liker un son pour la première fois',       '❤️', 5,   'common'),
  ('first_comment',   'Premier Commentaire', 'Commenter un son pour la première fois',   '💬', 5,   'common'),
  ('first_follow',    'Premier Abonnement',  'Suivre un artiste',                        '👤', 5,   'common'),
  ('hundred_plays',   'Cent Écoutes',        'Recevoir 100 écoutes sur tes sons',        '🎧', 50,  'rare'),
  ('ten_followers',   'Communauté',          'Avoir 10 abonnés',                         '🌟', 40,  'rare'),
  ('chart_topper',    'Chart Topper',        'Avoir un son dans le Top 3',               '🏅', 150, 'legendary'),
  ('night_owl',       'Hibou de Nuit',       'Écouter de la musique après minuit',       '🦉', 10,  'common'),
  ('social_butterfly','Papillon Social',     'Envoyer 50 messages dans le chat',         '🦋', 25,  'common')
ON CONFLICT (code) DO NOTHING;

-- ── 4. Colonne mood sur songs ─────────────────────────────────
-- Humeur / vibe associée à un son
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS mood text
    CHECK (mood IS NULL OR mood = ANY(ARRAY[
      'energique','melancolique','romantique','festif',
      'relaxant','motivant','nostalgique','sombre'
    ]));

CREATE INDEX IF NOT EXISTS idx_songs_mood
  ON public.songs(mood) WHERE mood IS NOT NULL;

-- ── 5. Table search_logs ─────────────────────────────────────
-- Pour afficher les recherches tendance dans SearchPage
CREATE TABLE IF NOT EXISTS public.search_logs (
  id         uuid  NOT NULL DEFAULT gen_random_uuid(),
  query      text  NOT NULL,
  user_id    text,
  results    integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT search_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_search_logs_query_recent
  ON public.search_logs(query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created
  ON public.search_logs(created_at DESC);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='search_logs' AND policyname='search_logs_insert') THEN
    CREATE POLICY "search_logs_insert" ON public.search_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='search_logs' AND policyname='search_logs_read') THEN
    CREATE POLICY "search_logs_read" ON public.search_logs FOR SELECT USING (true);
  END IF;
END $$;

-- ── 6. Vue trending_searches ─────────────────────────────────
CREATE OR REPLACE VIEW public.trending_searches AS
SELECT
  query,
  COUNT(*)              AS search_count,
  MAX(created_at)       AS last_searched,
  AVG(results)::integer AS avg_results
FROM public.search_logs
WHERE created_at >= now() - interval '24 hours'
  AND LENGTH(query) >= 2
GROUP BY query
ORDER BY search_count DESC, last_searched DESC
LIMIT 10;

-- ── 7. Fonction grant_achievement ────────────────────────────
-- Débloquer un achievement pour un user (idempotent)
-- ⚠️ user_achievements n'a PAS de colonne 'progress' dans le schéma réel
-- ⚠️ Utilise ON CONFLICT sur la contrainte UNIQUE (user_id, achievement)
CREATE OR REPLACE FUNCTION public.grant_achievement(
  p_user_id   text,
  p_code      text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement, unlocked_at)
  VALUES (p_user_id, p_code, now())
  ON CONFLICT (user_id, achievement) DO NOTHING;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- ── 7b. Contrainte UNIQUE sur song_moods(song_id, user_id) ───
-- Requise par MoodVote.jsx → upsert({ onConflict: 'song_id,user_id' })
-- La table existe déjà dans Supabase mais sans cette contrainte
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'song_moods_song_user_unique'
      AND conrelid = 'public.song_moods'::regclass
  ) THEN
    ALTER TABLE public.song_moods
      ADD CONSTRAINT song_moods_song_user_unique UNIQUE (song_id, user_id);
  END IF;
END $$;

-- ── 8. Fonction purge vieilles search_logs (>7j) ─────────────
CREATE OR REPLACE FUNCTION public.purge_old_search_logs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM public.search_logs WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── 9. Performance indexes supplémentaires ───────────────────
-- Optimise les requêtes courantes V60000
CREATE INDEX IF NOT EXISTS idx_songs_uploader_created
  ON public.songs(uploader_id, created_at DESC) WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON public.follows(follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- ── 10. app_meta : version ────────────────────────────────────
INSERT INTO public.app_meta (key, value)
VALUES ('schema_version', 'v60000')
ON CONFLICT (key) DO UPDATE SET value = 'v60000', updated_at = now();

-- ── 11. Table song_moods — votes de vibe crowd-sourcés ───────
-- Utilisée par MoodVote.jsx. Un vote par utilisateur par son.
CREATE TABLE IF NOT EXISTS public.song_moods (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  song_id    uuid NOT NULL,
  user_id    text NOT NULL,
  mood       text NOT NULL
    CHECK (mood = ANY(ARRAY[
      'hype','chill','motivant','sad','amour','focus','fête','nostalgique'
    ])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT song_moods_pkey     PRIMARY KEY (id),
  CONSTRAINT song_moods_unique   UNIQUE (song_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_song_moods_song
  ON public.song_moods(song_id);
CREATE INDEX IF NOT EXISTS idx_song_moods_user
  ON public.song_moods(user_id);

ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_moods' AND policyname='song_moods_select') THEN
    CREATE POLICY "song_moods_select" ON public.song_moods FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_moods' AND policyname='song_moods_insert') THEN
    CREATE POLICY "song_moods_insert" ON public.song_moods FOR INSERT
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_moods' AND policyname='song_moods_update') THEN
    CREATE POLICY "song_moods_update" ON public.song_moods FOR UPDATE
      USING (auth.uid()::text = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_moods' AND policyname='song_moods_delete') THEN
    CREATE POLICY "song_moods_delete" ON public.song_moods FOR DELETE
      USING (auth.uid()::text = user_id);
  END IF;
END $$;

-- ── 12. Fonction increment_plays — fallback compteur d'écoutes ──
-- Utilisée par AudioPlayer.jsx comme fallback si record_play_event manque.
-- ⚠️ songs.id est de type TEXT (pas uuid) → paramètre text obligatoire
CREATE OR REPLACE FUNCTION public.increment_plays(song_id_param text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs
  SET plays_count = COALESCE(plays_count, 0) + 1
  WHERE id = song_id_param;
END;
$$;

-- ── 13. Fonction record_play_event — tracking avancé des lectures ──
-- Appelée par AudioPlayer.jsx pour enregistrer une écoute.
-- ⚠️ songs.id est TEXT → p_song_id doit être text (pas uuid)
-- ⚠️ Table réelle = song_play_events (pas song_plays_history)
CREATE OR REPLACE FUNCTION public.record_play_event(
  p_song_id    text,
  p_user_id    text    DEFAULT NULL,
  p_duration_s integer DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Incrémenter le compteur de lectures sur songs
  UPDATE public.songs
  SET plays_count = COALESCE(plays_count, 0) + 1
  WHERE id = p_song_id;

  -- Insérer dans song_play_events (table réelle confirmée dans le schéma Supabase)
  INSERT INTO public.song_play_events (song_id, user_id, duration_s, played_at)
  VALUES (p_song_id, p_user_id, p_duration_s, now());

  -- Mettre à jour les streaks si l'utilisateur est connecté (optionnel V50000+)
  IF p_user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.record_listen(p_user_id, p_song_id);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_plays(text)              TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_play_event(text, text, integer) TO authenticated, anon;

-- ── DONE ──────────────────────────────────────────────────────
SELECT
  'NovaSound V60000 migration completed ✅' AS status,
  'V41000 content included (idempotent)'     AS note_v41,
  'New: chat_reactions, user_achievements, songs.mood, search_logs, song_moods, record_play_event, increment_plays' AS new_tables;
