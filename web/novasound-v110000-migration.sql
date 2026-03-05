-- ============================================================
-- NovaSound TITAN LUX — Migration V110000
-- "Live UX · Pause Host · Notifications · Leaderboard Fix"
-- ============================================================
-- Prérequis : migration V100000 déjà exécutée
-- ============================================================

-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. LIVE ROOMS — colonne is_paused                      ║
-- ╚══════════════════════════════════════════════════════════╝

ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.live_rooms.is_paused
  IS 'Indique si le live est actuellement mis en pause par l\'hôte — V110000';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. USER_STREAKS — index pour leaderboard Séries        ║
-- ╚══════════════════════════════════════════════════════════╝

-- Index trié par current_streak DESC (onglet "Séries" du leaderboard)
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak
  ON public.user_streaks(current_streak DESC);

-- Index trié par total_days DESC (onglet "Auditeurs" du leaderboard)
CREATE INDEX IF NOT EXISTS idx_user_streaks_total_days
  ON public.user_streaks(total_days DESC);

-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. NOTIFICATIONS — type live_started (idempotent)      ║
-- ╚══════════════════════════════════════════════════════════╝

-- Vérification de contrainte (idempotent, déjà fait en V100000)
DO $$ BEGIN
  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (
      type = ANY (ARRAY[
        'like','comment','follow','new_song','news','repost',
        'chat_reply','chat_mention','chat_mention_all','mood_vote',
        'live_started'
      ])
    );
END $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. INDEX CHAT MESSAGES — partage de lien live          ║
-- ╚══════════════════════════════════════════════════════════╝

-- Les messages de partage de live sont récents → index sur created_at
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages(created_at DESC)
  WHERE is_deleted = false;

-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. VUE leaderboard_listeners (Auditeurs)               ║
-- ╚══════════════════════════════════════════════════════════╝

-- Vue materialisée-like pour l'onglet Auditeurs du leaderboard
-- Utilise user_streaks + users → top auditeurs par jours d'écoute
CREATE OR REPLACE VIEW public.leaderboard_listeners AS
SELECT
  u.id,
  u.username,
  u.avatar_url,
  COALESCE(s.total_days,    0) AS total_days,
  COALESCE(s.current_streak,0) AS current_streak,
  COALESCE(s.longest_streak,0) AS longest_streak
FROM public.users u
JOIN public.user_streaks s ON s.user_id = u.id
ORDER BY s.total_days DESC;

COMMENT ON VIEW public.leaderboard_listeners
  IS 'Top auditeurs triés par jours d\'écoute cumulés — V110000';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. VUE leaderboard_streaks (Séries)                    ║
-- ╚══════════════════════════════════════════════════════════╝

-- Vue pour l'onglet Séries — triée par current_streak DESC
CREATE OR REPLACE VIEW public.leaderboard_streaks AS
SELECT
  u.id          AS user_id,
  u.username,
  u.avatar_url,
  s.current_streak,
  s.longest_streak,
  s.total_days
FROM public.users u
JOIN public.user_streaks s ON s.user_id = u.id
WHERE s.current_streak > 0
ORDER BY s.current_streak DESC;

COMMENT ON VIEW public.leaderboard_streaks
  IS 'Top séries d\'écoute consécutives — V110000';

-- ╔══════════════════════════════════════════════════════════╗
-- ║  7. FONCTION : reset is_paused sur live terminé         ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.reset_live_pause_on_close()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.is_paused := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_live_pause ON public.live_rooms;
CREATE TRIGGER trg_reset_live_pause
  BEFORE UPDATE ON public.live_rooms
  FOR EACH ROW EXECUTE FUNCTION public.reset_live_pause_on_close();

-- ╔══════════════════════════════════════════════════════════╗
-- ║  8. app_meta : version                                  ║
-- ╚══════════════════════════════════════════════════════════╝

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('schema_version', '110000', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

INSERT INTO public.app_meta (key, value, updated_at)
VALUES ('last_migration', 'V110000 — Live Pause·Push Notifs·Leaderboard Fix·Mobile UX', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

-- ============================================================
-- FIN DE MIGRATION V110000
-- ============================================================
