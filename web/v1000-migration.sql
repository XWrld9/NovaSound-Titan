-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v1000
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
--
-- Corrections :
--   1. RLS push_subscriptions — politique unique ALL (fix upsert 403)
--   2. RLS chat_messages UPDATE — suppression politique corrompue
--   3. GRANT UPDATE sur chat_messages pour authenticated
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. push_subscriptions : repartir sur une politique unique ──────
DROP POLICY IF EXISTS push_all      ON push_subscriptions;
DROP POLICY IF EXISTS push_insert   ON push_subscriptions;
DROP POLICY IF EXISTS push_update   ON push_subscriptions;
DROP POLICY IF EXISTS push_select   ON push_subscriptions;
DROP POLICY IF EXISTS push_delete   ON push_subscriptions;
DROP POLICY IF EXISTS push_upsert   ON push_subscriptions;

-- USING(true) = Supabase peut lire les lignes existantes pour résoudre
-- le ON CONFLICT endpoint ; WITH CHECK protège en écriture
CREATE POLICY push_all ON push_subscriptions
FOR ALL
USING (true)
WITH CHECK ((auth.uid())::text = user_id);

-- S'assurer que le rôle authenticated a bien les droits
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- ── 2. chat_messages : supprimer politique UPDATE corrompue ────────
-- chat_messages_delete_own référençait auth.users → permission denied
DROP POLICY IF EXISTS chat_messages_delete_own ON chat_messages;
DROP POLICY IF EXISTS chat_admin_update        ON chat_messages;
DROP POLICY IF EXISTS chat_messages_update_own ON chat_messages;
DROP POLICY IF EXISTS chat_update_own          ON chat_messages;

-- Politique UPDATE propre : seul l'auteur peut modifier son message
CREATE POLICY chat_update_own ON chat_messages
FOR UPDATE
USING  ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

-- S'assurer que authenticated peut faire UPDATE
GRANT UPDATE ON chat_messages TO authenticated;

-- ── 3. Vérification finale ─────────────────────────────────────────
-- Lance ces SELECT pour confirmer que tout est propre :
--
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'push_subscriptions';
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'chat_messages';
