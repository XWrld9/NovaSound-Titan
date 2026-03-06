-- ============================================================
-- NovaSound TITAN LUX — Migration V410000
-- ============================================================
-- Objectif : i18n complète (tous les composants traduits),
--            refonte desktop Lecteur Local, raccourcis clavier,
--            drag & drop, filtre/tri bibliothèque locale.
-- ============================================================

-- ── 1. S'assurer que la table i18n_overrides existe (idempotent) ──────────────
CREATE TABLE IF NOT EXISTS public.i18n_overrides (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  lang        text        NOT NULL CHECK (lang IN ('fr','en','es','it','pt')),
  key         text        NOT NULL,
  value       text        NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i18n_overrides_pkey     PRIMARY KEY (id),
  CONSTRAINT i18n_overrides_lang_key UNIQUE (lang, key)
);

CREATE INDEX IF NOT EXISTS idx_i18n_overrides_lang ON public.i18n_overrides(lang);

-- RLS
ALTER TABLE public.i18n_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'i18n_overrides' AND policyname = 'i18n read all'
  ) THEN
    CREATE POLICY "i18n read all" ON public.i18n_overrides FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'i18n_overrides' AND policyname = 'i18n admin only'
  ) THEN
    CREATE POLICY "i18n admin only" ON public.i18n_overrides FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()::text
            AND role IN ('admin')
            AND is_active = true
        )
      );
  END IF;
END $$;

-- ── 2. Nouvelles clés localPlayer en base (référence) ─────────────────────────
-- Ces overrides peuvent être modifiés via l'Admin Panel sans redéploiement.
INSERT INTO public.i18n_overrides (lang, key, value, updated_by)
VALUES
  ('fr', 'localPlayer.dragDrop',     'Glisser-déposer',   'system'),
  ('fr', 'localPlayer.dropHere',     'Dépose ici',         'system'),
  ('fr', 'localPlayer.sortBy',       'Trier par',          'system'),
  ('fr', 'localPlayer.sortName',     'Nom',                'system'),
  ('fr', 'localPlayer.sortArtist',   'Artiste',            'system'),
  ('fr', 'localPlayer.sortDuration', 'Durée',              'system'),
  ('fr', 'localPlayer.searchFiles',  'Filtrer les fichiers…', 'system'),
  ('fr', 'localPlayer.noFilesMatch', 'Aucun fichier trouvé', 'system'),
  ('fr', 'localPlayer.restoring',    'Restauration…',      'system'),
  ('fr', 'localPlayer.selection',    'Sélection',          'system'),
  ('en', 'localPlayer.dragDrop',     'Drag & drop',        'system'),
  ('en', 'localPlayer.dropHere',     'Drop here',          'system'),
  ('en', 'localPlayer.sortBy',       'Sort by',            'system'),
  ('en', 'localPlayer.sortName',     'Name',               'system'),
  ('en', 'localPlayer.sortArtist',   'Artist',             'system'),
  ('en', 'localPlayer.sortDuration', 'Duration',           'system'),
  ('en', 'localPlayer.searchFiles',  'Filter files…',      'system'),
  ('en', 'localPlayer.noFilesMatch', 'No files found',     'system'),
  ('en', 'localPlayer.restoring',    'Restoring…',         'system'),
  ('en', 'localPlayer.selection',    'Select',             'system')
ON CONFLICT (lang, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ── 3. user_preferences — colonne preferred_lang ─────────────────────────────
-- Permet de sauvegarder la langue préférée côté serveur (sync multi-device)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_lang text
    CHECK (preferred_lang IN ('fr','en','es','it','pt'))
    DEFAULT NULL;

-- ── 4. Extend notifications table ─────────────────────────────────────────────
-- Colonnes déjà ajoutées en V400000 — idempotent
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS group_key    text,
  ADD COLUMN IF NOT EXISTS silent       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renotify     boolean NOT NULL DEFAULT false;

-- ── 5. local_player_sessions — tracking anonyme des sessions locales ──────────
-- Pour les stats internes sans stocker de fichiers sensibles
CREATE TABLE IF NOT EXISTS public.local_player_sessions (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       text,
  session_start timestamptz NOT NULL DEFAULT now(),
  session_end   timestamptz,
  files_count   int         NOT NULL DEFAULT 0,
  lang          text,
  is_pc         boolean     NOT NULL DEFAULT false,
  CONSTRAINT local_player_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_local_sessions_user ON public.local_player_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_local_sessions_date ON public.local_player_sessions(session_start DESC);

ALTER TABLE public.local_player_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'local_player_sessions' AND policyname = 'local sessions insert'
  ) THEN
    CREATE POLICY "local sessions insert" ON public.local_player_sessions
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'local_player_sessions' AND policyname = 'local sessions own'
  ) THEN
    CREATE POLICY "local sessions own" ON public.local_player_sessions
      FOR SELECT USING (user_id = auth.uid()::text OR user_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'local_player_sessions' AND policyname = 'local sessions admin'
  ) THEN
    CREATE POLICY "local sessions admin" ON public.local_player_sessions
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()::text
            AND role = 'admin' AND is_active = true
        )
      );
  END IF;
END $$;

-- ── 6. Fonction RPC — get_i18n_overrides(lang) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_i18n_overrides(p_lang text)
RETURNS TABLE(key text, value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT key, value
  FROM public.i18n_overrides
  WHERE lang = p_lang;
$$;

-- ── 7. Fonction RPC — upsert_preferred_lang ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_preferred_lang(p_lang text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET preferred_lang = p_lang
  WHERE id = auth.uid()::text;
END;
$$;

-- ── 8. Index supplémentaires pour performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_songs_created_at_desc ON public.songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_plays_count     ON public.songs(plays_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_songs_likes           ON public.songs(likes_count DESC NULLS LAST);

-- ── 9. Version tag ─────────────────────────────────────────────────────────────
-- Stocke la version courante pour diagnostic
INSERT INTO public.i18n_overrides (lang, key, value, updated_by)
VALUES ('fr', '_version', 'V410000', 'system')
ON CONFLICT (lang, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
