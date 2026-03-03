-- ═══════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Fix RLS push_subscriptions (UUID vs TEXT)
-- Correction du type mismatch: auth.uid() = user_id
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Activer RLS sur push_subscriptions ───────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── 2. Supprimer anciennes policies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "push_sub_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_select" ON push_subscriptions;

-- ── 3. Créer policies avec cast explicite ───────────────────────────────────────
CREATE POLICY "push_sub_select" ON push_subscriptions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "push_sub_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "push_sub_update" ON push_subscriptions
  FOR UPDATE USING (auth.uid()::text = user_id);

-- ── 4. Grant permissions ───────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON push_subscriptions TO authenticated;
GRANT SELECT ON push_subscriptions TO anon;
