-- ══════════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v2.0.1
-- Correctifs schéma DB pour aligner avec le code applicatif
-- À exécuter dans Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1 — Contrainte UNIQUE sur user_roles(user_id, role)
-- Sans elle, le check-then-insert/update côté AdminPanel ne garantit pas
-- l'unicité au niveau DB en cas de race condition (double-clic, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Dédupliquer d'abord les éventuels doublons existants
-- (garde le plus récent pour chaque couple user_id + role)
DELETE FROM public.user_roles ur1
USING public.user_roles ur2
WHERE ur1.id < ur2.id
  AND ur1.user_id = ur2.user_id
  AND ur1.role    = ur2.role;

-- Ajouter la contrainte UNIQUE
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2 — Aligner song_plays_history.user_id de uuid → text
-- public.users.id est de type text, mais song_plays_history.user_id est uuid.
-- Ce mismatch empêche les JOIN directs et peut causer des erreurs
-- dans achievementUtils lors du filtre .eq('user_id', userId).
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprimer la FK existante vers auth.users (référence uuid)
ALTER TABLE public.song_plays_history
  DROP CONSTRAINT IF EXISTS song_plays_history_user_id_fkey;

-- Changer le type de la colonne uuid → text
ALTER TABLE public.song_plays_history
  ALTER COLUMN user_id TYPE text USING user_id::text;

-- Recréer la FK vers public.users (type text)
-- ON DELETE SET NULL : préserve l'historique si un compte est supprimé
ALTER TABLE public.song_plays_history
  ADD CONSTRAINT song_plays_history_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3 — Étendre le CHECK de moderation_logs.action
-- Ajoute 'broadcast' et 'targeted_broadcast' comme valeurs autorisées
-- pour que les logs de broadcast soient sémantiquement corrects
-- (au lieu du workaround 'resolve_report' du code)
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprimer l'ancien CHECK constraint
ALTER TABLE public.moderation_logs
  DROP CONSTRAINT IF EXISTS moderation_logs_action_check;

-- Recréer avec les nouvelles valeurs
ALTER TABLE public.moderation_logs
  ADD CONSTRAINT moderation_logs_action_check
  CHECK (action = ANY (ARRAY[
    'delete_song'::text,
    'delete_news'::text,
    'ban_user'::text,
    'unban_user'::text,
    'resolve_report'::text,
    'broadcast'::text,
    'targeted_broadcast'::text
  ]));


-- ══════════════════════════════════════════════════════════════════════════════
-- Vérifications post-migration (optionnel — copier/coller séparément)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'user_roles'
--   AND constraint_name = 'user_roles_user_id_role_unique';
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'song_plays_history' AND column_name = 'user_id';
--
-- SELECT constraint_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'moderation_logs' AND constraint_type = 'CHECK';
