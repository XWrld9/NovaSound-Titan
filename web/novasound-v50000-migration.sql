-- ============================================================
-- NovaSound TITAN LUX — Migration V50000
-- ============================================================
-- Prérequis : V40000 + V41000 déjà exécutés
-- ============================================================

-- ── 1. user_achievements — trophées gagnés par chaque user ──
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id             uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id        text    NOT NULL,
  achievement_id text    NOT NULL,           -- code FK → achievement_definitions.code
  earned_at      timestamp with time zone NOT NULL DEFAULT now(),
  metadata       jsonb,
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON public.user_achievements(user_id, earned_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='ua_read') THEN
    CREATE POLICY "ua_read" ON public.user_achievements FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_achievements' AND policyname='ua_insert_own') THEN
    CREATE POLICY "ua_insert_own" ON public.user_achievements FOR INSERT
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- ── 2. song_plays_history — historique réel des écoutes ──────
CREATE TABLE IF NOT EXISTS public.song_plays_history (
  id         bigint  NOT NULL GENERATED ALWAYS AS IDENTITY,
  song_id    text    NOT NULL,
  user_id    text,
  listened_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT song_plays_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sph_song_date
  ON public.song_plays_history(song_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS idx_sph_user_date
  ON public.song_plays_history(user_id, listened_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.song_plays_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_plays_history' AND policyname='sph_insert') THEN
    CREATE POLICY "sph_insert" ON public.song_plays_history FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_plays_history' AND policyname='sph_select') THEN
    CREATE POLICY "sph_select" ON public.song_plays_history FOR SELECT USING (true);
  END IF;
END $$;

-- ── 3. user_streaks — suivi des séries d'écoute ──────────────
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id         text    NOT NULL,
  current_streak  integer NOT NULL DEFAULT 0,
  longest_streak  integer NOT NULL DEFAULT 0,
  last_listen_date date,
  total_days      integer NOT NULL DEFAULT 0,
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_streak
  ON public.user_streaks(current_streak DESC);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_streaks' AND policyname='streaks_read') THEN
    CREATE POLICY "streaks_read" ON public.user_streaks FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_streaks' AND policyname='streaks_upsert') THEN
    CREATE POLICY "streaks_upsert" ON public.user_streaks
      FOR ALL USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- ── 4. achievement_definitions — définitions complètes ───────
-- Ajouter les achievements manquants (ignorer si déjà présents)
INSERT INTO public.achievement_definitions (code, label, description, icon, points, rarity)
VALUES
  -- Upload milestones
  ('uploader_1',    'Premier son',      'Upload ton premier morceau',               '🎵', 10,  'common'),
  ('uploader_5',    'Producteur',       'Uploader 5 morceaux',                      '🎼', 30,  'common'),
  ('uploader_10',   'Artiste confirmé', 'Uploader 10 morceaux',                     '🎤', 60,  'rare'),
  ('uploader_25',   'Discographie',     'Uploader 25 morceaux',                     '💿', 150, 'epic'),
  -- Listen milestones
  ('listener_1',    'Première écoute',  'Écouter un son pour la première fois',     '🎧', 5,   'common'),
  ('listener_100',  'Mélomane',         '100 écoutes totales',                      '🎶', 25,  'common'),
  ('listener_1000', 'Passionné',        '1000 écoutes cumulées',                    '🔥', 75,  'rare'),
  -- Streak milestones
  ('streak_3',      '3 jours de suite', 'Écouter 3 jours consécutifs',              '📅', 15,  'common'),
  ('streak_7',      'Semaine parfaite', 'Écouter 7 jours consécutifs',              '⚡', 50,  'rare'),
  ('streak_30',     'Mois de feu',      'Écouter 30 jours consécutifs',             '🏆', 200, 'legendary'),
  -- Social milestones
  ('follower_1',    'Premier fan',      'Avoir ton premier abonné',                 '👤', 10,  'common'),
  ('follower_50',   'Populaire',        'Avoir 50 abonnés',                         '🌟', 50,  'rare'),
  ('follower_100',  'Influenceur',      'Avoir 100 abonnés',                        '⭐', 100, 'epic'),
  -- Like milestones
  ('like_10',       'Apprécié',         'Recevoir 10 likes sur tes sons',           '❤️', 20,  'common'),
  ('like_100',      'Adoré',            'Recevoir 100 likes cumulés',               '💖', 80,  'rare'),
  -- Chat
  ('chat_first',    'Premier message',  'Envoyer ton premier message dans le chat', '💬', 5,   'common'),
  ('chat_100',      'Bavard',           'Envoyer 100 messages dans le chat',        '🗣️', 40,  'rare')
ON CONFLICT (code) DO NOTHING;

-- ── 5. Fonction record_listen — track play + streak ──────────
CREATE OR REPLACE FUNCTION public.record_listen(
  p_song_id text,
  p_user_id text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  today date := CURRENT_DATE;
  last_date date;
  cur_streak integer;
BEGIN
  -- Incrémenter plays_count sur le son
  UPDATE public.songs SET plays_count = COALESCE(plays_count, 0) + 1 WHERE id = p_song_id;

  -- Enregistrer dans l'historique
  INSERT INTO public.song_plays_history (song_id, user_id, listened_at)
  VALUES (p_song_id, p_user_id, now());

  -- Mettre à jour le streak si user connu
  IF p_user_id IS NOT NULL THEN
    SELECT last_listen_date, current_streak
      INTO last_date, cur_streak
      FROM public.user_streaks
     WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_listen_date, total_days)
      VALUES (p_user_id, 1, 1, today, 1);
    ELSIF last_date = today THEN
      NULL; -- Déjà compté aujourd'hui
    ELSIF last_date = today - 1 THEN
      -- Jour consécutif
      UPDATE public.user_streaks SET
        current_streak  = current_streak + 1,
        longest_streak  = GREATEST(longest_streak, current_streak + 1),
        last_listen_date = today,
        total_days      = total_days + 1,
        updated_at      = now()
      WHERE user_id = p_user_id;
    ELSE
      -- Série cassée
      UPDATE public.user_streaks SET
        current_streak   = 1,
        last_listen_date = today,
        total_days       = total_days + 1,
        updated_at       = now()
      WHERE user_id = p_user_id;
    END IF;
  END IF;
END;
$$;

-- ── 6. Fonction award_achievement ────────────────────────────
CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id text,
  p_code    text,
  p_meta    jsonb DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id, metadata)
  VALUES (p_user_id, p_code, p_meta)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- ── 7. Vue classement streaks ─────────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard_streaks AS
SELECT
  us.user_id,
  u.username,
  u.avatar_url,
  us.current_streak,
  us.longest_streak,
  us.total_days,
  us.last_listen_date
FROM public.user_streaks us
JOIN public.users u ON u.id = us.user_id
ORDER BY us.current_streak DESC
LIMIT 50;

-- ── 8. Vue stats artiste avec historique réel ─────────────────
CREATE OR REPLACE VIEW public.artist_plays_7d AS
SELECT
  s.uploader_id,
  DATE(sph.listened_at) AS listen_date,
  COUNT(*)              AS plays
FROM public.song_plays_history sph
JOIN public.songs s ON s.id = sph.song_id
WHERE sph.listened_at >= now() - interval '7 days'
GROUP BY s.uploader_id, DATE(sph.listened_at)
ORDER BY s.uploader_id, listen_date;

CREATE OR REPLACE VIEW public.artist_plays_30d AS
SELECT
  s.uploader_id,
  DATE(sph.listened_at) AS listen_date,
  COUNT(*)              AS plays
FROM public.song_plays_history sph
JOIN public.songs s ON s.id = sph.song_id
WHERE sph.listened_at >= now() - interval '30 days'
GROUP BY s.uploader_id, DATE(sph.listened_at)
ORDER BY s.uploader_id, listen_date;

-- ── 9. app_meta — version ────────────────────────────────────
INSERT INTO public.app_meta (key, value)
VALUES ('schema_version', 'v50000')
ON CONFLICT (key) DO UPDATE SET value = 'v50000', updated_at = now();

SELECT 'NovaSound V50000 migration completed ✅' AS status;
