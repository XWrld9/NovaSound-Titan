-- ============================================================
-- NovaSound TITAN LUX -- Migration V200000
-- "Desktop Layout | Full Translation | Live UX | PWA Polish"
-- ============================================================
-- Prerequis : migration V110000 deja executee
-- ============================================================

-- ============================================================
-- 1. app_meta : version
-- ============================================================

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('schema_version', '200000', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('last_migration', 'V200000 - Desktop Layout / Full Translation / Live UX / PWA Polish', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================
-- 2. user_preferences : stocker la langue choisie par l'user
--    (optionnel - la langue est aussi dans localStorage)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_lang varchar(2) DEFAULT 'fr'
  CHECK (preferred_lang IN ('fr', 'en'));

COMMENT ON COLUMN public.users.preferred_lang
  IS 'Langue de l interface choisie par l utilisateur - V200000';

-- ============================================================
-- FIN DE MIGRATION V200000
-- ============================================================
