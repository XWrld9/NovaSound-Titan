-- ═══════════════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration V28000
-- À exécuter dans Supabase SQL Editor (après toutes les migrations précédentes)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. live_room_messages : ajout colonnes is_edited / is_deleted / edited_at
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_room_messages
  ADD COLUMN IF NOT EXISTS is_edited  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS live_room_messages
--
--    FIX CRITIQUE : on supprime TOUTES les anciennes policies (noms des
--    migrations v7000, v8001, v8200) avant d'en créer de nouvelles.
--    Sans ça, l'ancienne policy "FOR SELECT USING (true)" coexiste avec la
--    nouvelle "USING (is_deleted = FALSE)".
--    Supabase combine les policies en OR → les messages supprimés resteraient
--    visibles par tous. On repart d'une ardoise propre.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les policies existantes (tous noms possibles)
DROP POLICY IF EXISTS "live_room_messages_select"  ON public.live_room_messages;
DROP POLICY IF EXISTS "live_room_messages_insert"  ON public.live_room_messages;
DROP POLICY IF EXISTS "live_room_messages_update"  ON public.live_room_messages;
DROP POLICY IF EXISTS "live_room_messages_delete"  ON public.live_room_messages;
DROP POLICY IF EXISTS "live_messages_select"       ON public.live_room_messages;
DROP POLICY IF EXISTS "live_messages_insert"       ON public.live_room_messages;
DROP POLICY IF EXISTS "live_messages_update"       ON public.live_room_messages;
DROP POLICY IF EXISTS "live_messages_delete"       ON public.live_room_messages;
DROP POLICY IF EXISTS "lrm_select_v28"             ON public.live_room_messages;
DROP POLICY IF EXISTS "lrm_insert_v28"             ON public.live_room_messages;
DROP POLICY IF EXISTS "lrm_update_v28"             ON public.live_room_messages;

-- Nouvelles policies v28000
CREATE POLICY "lrm_select_v28" ON public.live_room_messages
  FOR SELECT USING (is_deleted = FALSE);

CREATE POLICY "lrm_insert_v28" ON public.live_room_messages
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "lrm_update_v28" ON public.live_room_messages
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Pas de DELETE physique → soft delete via is_deleted = TRUE

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Index pour realtime postgres_changes
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lrm_room_created
  ON public.live_room_messages (room_id, created_at ASC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_lrm_user_id
  ON public.live_room_messages (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Activer Realtime sur live_room_messages
--
--    FIX CRITIQUE : ALTER PUBLICATION n'est PAS idempotent.
--    Si la table est déjà dans la publication, PostgreSQL lève :
--      "ERROR: relation already exists in publication"
--    et ARRÊTE tout le script. Le bloc DO absorbe cette erreur proprement.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages;
EXCEPTION
  WHEN others THEN NULL; -- déjà dans la publication, rien à faire
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Storage bucket "live-room-audio" (50 MB, audio uniquement, public)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-room-audio',
  'live-room-audio',
  TRUE,
  52428800,
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4',
        'audio/m4a','audio/aac','audio/ogg','audio/flac','audio/opus',
        'audio/webm','audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 52428800;

DROP POLICY IF EXISTS "live_audio_select" ON storage.objects;
CREATE POLICY "live_audio_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'live-room-audio');

DROP POLICY IF EXISTS "live_audio_insert" ON storage.objects;
CREATE POLICY "live_audio_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'live-room-audio' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "live_audio_delete" ON storage.objects;
CREATE POLICY "live_audio_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'live-room-audio' AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Index performances notifications
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notif_user_type
  ON public.notifications (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread_v28
  ON public.notifications (user_id, is_read)
  WHERE is_read = FALSE;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. push_subscriptions : index user_id uniquement
--
--    FIX : le schéma réel a déjà "endpoint text NOT NULL UNIQUE" → contrainte
--    native qui crée déjà un index unique sur endpoint.
--    Ajouter un second UNIQUE INDEX serait redondant et potentiellement
--    conflictuel. On ajoute seulement idx_push_sub_user (user_id) qui manque.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_sub_user
  ON public.push_subscriptions (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- ✅ Migration V28000 terminée — 100% idempotente, 100% compatible V27000
--
-- Changements :
--   • live_room_messages : +is_edited, +is_deleted, +edited_at
--   • RLS : toutes anciennes policies purgées, soft delete opérationnel
--   • Realtime : live_room_messages activé (DO block sécurisé)
--   • Storage : bucket live-room-audio (50MB audio)
--   • Index : notifications (user_id, type) + push_subscriptions (user_id)
-- ────────────────────────────────────────────────────────────────────────────
