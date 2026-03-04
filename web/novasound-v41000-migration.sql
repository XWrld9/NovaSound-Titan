-- ============================================================
-- NovaSound TITAN LUX — Migration V41000
-- ============================================================
-- Prérequis : migration V40000 déjà exécutée
-- ============================================================

-- ── 1. Table push_notification_logs ─────────────────────────
-- Delivery tracking pour la edge function send-push-notification
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id           uuid    NOT NULL DEFAULT gen_random_uuid(),
  notif_id     text,                        -- id de la notif source (idempotency)
  user_id      text,                        -- null si broadcast
  type         text    NOT NULL DEFAULT 'default',
  is_broadcast boolean NOT NULL DEFAULT false,
  total        integer NOT NULL DEFAULT 0,  -- nombre de subscriptions ciblées
  sent         integer NOT NULL DEFAULT 0,  -- envois réussis
  failed       integer NOT NULL DEFAULT 0,
  purged       integer NOT NULL DEFAULT 0,  -- subscriptions expirées supprimées
  avg_ms       integer NOT NULL DEFAULT 0,  -- latence moyenne par envoi
  status       text    NOT NULL DEFAULT 'sent'
                CHECK (status = ANY (ARRAY['sent','failed','skipped'])),
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT push_notification_logs_pkey PRIMARY KEY (id)
);

-- Index pour la recherche d'idempotency (rapide)
CREATE INDEX IF NOT EXISTS idx_push_logs_notif_id
  ON public.push_notification_logs(notif_id)
  WHERE notif_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_logs_user_created
  ON public.push_notification_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_logs_status
  ON public.push_notification_logs(status, created_at DESC);

-- ── 2. RLS push_notification_logs ───────────────────────────
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire les logs (service role bypasse RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='push_notification_logs' AND policyname='push_logs_service_only'
  ) THEN
    CREATE POLICY "push_logs_service_only"
      ON public.push_notification_logs
      FOR ALL
      USING (false);   -- bloqué pour tout user normal ; la edge function utilise service_role
  END IF;
END $$;

-- ── 3. Vue admin : stats push des 7 derniers jours ──────────
CREATE OR REPLACE VIEW public.push_stats_7d AS
SELECT
  date_trunc('day', created_at) AS day,
  type,
  COUNT(*)                      AS requests,
  SUM(sent)                     AS total_sent,
  SUM(failed)                   AS total_failed,
  SUM(purged)                   AS total_purged,
  ROUND(AVG(avg_ms))            AS avg_latency_ms,
  SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS full_failures
FROM public.push_notification_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ── 4. Vue admin : taux de délivrabilité par type ───────────
CREATE OR REPLACE VIEW public.push_delivery_rates AS
SELECT
  type,
  SUM(total)  AS total_attempts,
  SUM(sent)   AS delivered,
  SUM(failed) AS failed,
  SUM(purged) AS purged,
  CASE WHEN SUM(total) > 0
    THEN ROUND(100.0 * SUM(sent) / NULLIF(SUM(total),0), 1)
    ELSE 0
  END AS delivery_rate_pct
FROM public.push_notification_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY type
ORDER BY total_attempts DESC;

-- ── 5. Fonction : nettoyer les vieux logs (>90 jours) ───────
CREATE OR REPLACE FUNCTION public.purge_old_push_logs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.push_notification_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── 6. Webhook Supabase → edge function ─────────────────────
-- Déclenche send-push-notification automatiquement
-- à chaque INSERT dans la table notifications
-- NB : à activer dans Dashboard > Database > Webhooks
--      (impossible via SQL pur sur Supabase Cloud)
--
-- Paramètres du webhook à saisir manuellement :
--   Name    : on_notification_insert
--   Table   : public.notifications
--   Events  : INSERT
--   URL     : https://<project>.supabase.co/functions/v1/send-push-notification
--   Headers : Authorization: Bearer <SUPABASE_ANON_KEY>
--
-- Le body envoyé sera automatiquement { type: "INSERT", record: {...} }
-- ce que la edge function sait déjà parser via rec = raw.record ?? raw

-- ── 7. Colonne delivered_push dans notifications ─────────────
-- Pour tracker si la notif a été poussée (évite les doublons)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_sent_at  timestamp with time zone;

-- ── 8. Index sur notifications non pushées ──────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications(user_id, push_sent, created_at DESC)
  WHERE push_sent = false;

-- ── 9. Fonction : marquer une notif comme pushée ────────────
CREATE OR REPLACE FUNCTION public.mark_notification_pushed(p_notif_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications
  SET push_sent = true, push_sent_at = now()
  WHERE id = p_notif_id;
END;
$$;

-- ── 10. app_meta : version ───────────────────────────────────
INSERT INTO public.app_meta (key, value)
VALUES ('schema_version', 'v41000')
ON CONFLICT (key) DO UPDATE SET value = 'v41000', updated_at = now();

-- ── DONE ─────────────────────────────────────────────────────
SELECT 'NovaSound V41000 migration completed ✅' AS status,
       'Remember to create the Supabase Webhook manually in Dashboard > Database > Webhooks' AS reminder;
