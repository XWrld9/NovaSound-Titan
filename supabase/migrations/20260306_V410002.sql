-- ============================================================
-- NovaSound TITAN LUX — Migration V410002
-- Suppression complète du système i18n
-- ============================================================
-- Objectif : Nettoyer la base de données de toutes les tables
--           et fonctions liées à l'i18n qui n'est plus utilisée

-- ── 1. Supprimer la table i18n_overrides ─────────────────────────
DROP TABLE IF EXISTS public.i18n_overrides CASCADE;

-- ── 2. Supprimer les vues liées à l'i18n ───────────────────────
DROP VIEW IF EXISTS public.v_i18n_overrides CASCADE;

-- ── 3. Supprimer les fonctions liées à l'i18n ────────────────────
DROP FUNCTION IF EXISTS public.get_translation(lang text, key text) CASCADE;
DROP FUNCTION IF EXISTS public.get_translations(lang text) CASCADE;
DROP FUNCTION IF EXISTS public.set_translation(lang text, key text, value text) CASCADE;

-- ── 4. Supprimer les triggers liés à l'i18n ────────────────────────────
DROP TRIGGER IF EXISTS i18n_overrides_updated_at ON public.i18n_overrides;

-- ── 6. Nettoyer les types liés à l'i18n ────────────────────────────
DROP TYPE IF EXISTS public.i18n_lang_type CASCADE;

-- ============================================================
-- Note : Cette migration est idempotente et sécurisée
-- Toutes les suppressions utilisent IF EXISTS et CASCADE
-- ============================================================
