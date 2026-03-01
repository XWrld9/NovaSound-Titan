-- ════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v800
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
-- ════════════════════════════════════════════════════════════════════
--
-- 🚀 NOUVEAU : Push natifs cross-platform (Android / PC / iOS PWA)
--
-- Prérequis :
--   1. Avoir exécuté setup-supabase.sql + notifications.sql + v700-migration.sql
--   2. Avoir déployé l'Edge Function "send-push-notification"
--      supabase functions deploy send-push-notification
--   3. Avoir configuré les secrets VAPID (voir PUSH_SETUP.md)
--
-- ════════════════════════════════════════════════════════════════════

-- ── A. TABLE push_subscriptions (idempotent) ─────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour trouver rapidement les subs d'un user
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);

-- RLS : un utilisateur peut seulement voir/gérer SES subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subs_delete" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subs_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subs_all"    ON public.push_subscriptions;

CREATE POLICY "push_subs_select" ON public.push_subscriptions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_subs_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_subs_update" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "push_subs_delete" ON public.push_subscriptions
  FOR DELETE USING (auth.uid()::text = user_id);

-- Autoriser le service role (Edge Function) à tout lire/supprimer
CREATE POLICY "push_subs_service" ON public.push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- ── B. Mise à jour updated_at automatique ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_push_sub_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_push_sub_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_sub_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_push_sub_updated_at();

-- ── C. Nettoyage auto des vieilles subscriptions (> 60 jours) ────
CREATE OR REPLACE FUNCTION public.cleanup_old_push_subscriptions()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.push_subscriptions
  WHERE updated_at < NOW() - INTERVAL '60 days';
$$;

-- ── D. Activer pg_net (requis pour appels HTTP depuis triggers) ───
-- pg_net est activé par défaut sur Supabase. Si besoin :
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── E. Trigger automatique : à chaque notification → push natif ──
--
-- ⚠️  REMPLACER 'https://TON-PROJET.supabase.co' par l'URL réelle  ⚠️
--     de ton projet Supabase (Settings → API → Project URL)
--
CREATE OR REPLACE FUNCTION public.fn_trigger_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url  TEXT := 'https://TON-PROJET.supabase.co';  -- ⚠️ À REMPLACER
  v_function_url  TEXT;
  v_payload       JSONB;
BEGIN
  -- Ne pas envoyer si l'utilisateur n'a pas de subscriptions
  -- (vérification rapide pour éviter les appels inutiles)
  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  v_function_url := v_supabase_url || '/functions/v1/send-push-notification';

  v_payload := jsonb_build_object(
    'user_id',  NEW.user_id,
    'title',    NEW.title,
    'body',     LEFT(COALESCE(NEW.body, ''), 200),
    'url',      COALESCE(NEW.url, '/'),
    'icon_url', COALESCE(NEW.icon_url, '/icon-192.png'),
    'id',       NEW.id::TEXT
  );

  -- Appel HTTP async via pg_net (non bloquant)
  PERFORM net.http_post(
    url     := v_function_url,
    body    := v_payload::TEXT,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'insertion d'une notification à cause du push
  RAISE WARNING '[Push Trigger] Error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_push_on_notification();

-- ── F. Clé service_role dans les settings (nécessaire pour le trigger) ─
-- Exécuter cette ligne séparément après avoir remplacé la valeur :
-- ALTER DATABASE postgres SET app.service_role_key = 'ta-cle-service-role-ici';

-- ── G. Activer Realtime sur notifications (idempotent) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END $$;

-- ── H. Types de notifications étendus ────────────────────────────
-- (chat_reply, chat_mention, chat_mention_all ajoutés depuis v160)
DO $$
BEGIN
  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like','comment','follow','new_song','news','chat_reply','chat_mention','chat_mention_all'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications_type_check: %', SQLERRM;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- RÉSUMÉ v800
-- ════════════════════════════════════════════════════════════════════
-- ✅ A-B-C : push_subscriptions table + RLS + updated_at + nettoyage
-- ✅ D-E   : Trigger automatique INSERT→notifications → push natif
-- ✅ F     : Service role key dans les settings DB
-- ✅ G     : Realtime notifications activé
-- ✅ H     : Types de notifications complets
--
-- 📋 Voir PUSH_SETUP.md pour le guide complet de déploiement
-- ════════════════════════════════════════════════════════════════════
