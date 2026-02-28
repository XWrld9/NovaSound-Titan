-- ================================================================
-- v500-migration.sql — NovaSound TITAN LUX v500 FINAL
-- Corrections : chat notifications, playlists RLS, notifications sync
-- ⚠️  À exécuter UNE SEULE FOIS dans le SQL Editor Supabase
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- PARTIE A : PLAYLISTS — Seul le créateur peut supprimer
-- Renforcer la politique RLS DELETE sur les playlists publiques
-- ════════════════════════════════════════════════════════════════

-- A1. Supprimer les anciennes politiques DELETE si elles existent
DROP POLICY IF EXISTS "playlists_delete_owner" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete" ON public.playlists;
DROP POLICY IF EXISTS "Owners can delete their playlists" ON public.playlists;

-- A2. Recréer la politique DELETE stricte : UNIQUEMENT le créateur (owner_id)
CREATE POLICY "playlists_delete_owner_only"
  ON public.playlists
  FOR DELETE
  USING (owner_id = auth.uid()::text);

-- Vérification : les autres politiques CRUD restent inchangées
-- (SELECT = public pour is_public=true, UPDATE = owner seulement)

-- ════════════════════════════════════════════════════════════════
-- PARTIE B : NOTIFICATIONS — Amélioration anti-spam @tous
-- Index pour accélérer la vérification anti-doublons @tous
-- ════════════════════════════════════════════════════════════════

-- B1. Index sur (type, created_at) pour la requête anti-spam @tous
CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications(type, created_at DESC);

-- B2. Index sur metadata pour filtrer par senderId dans @tous
CREATE INDEX IF NOT EXISTS idx_notifications_metadata
  ON public.notifications USING gin(to_tsvector('simple', COALESCE(metadata, '')));

-- B3. S'assurer que le type chat_mention_all est bien dans les contraintes
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like', 'comment', 'follow', 'new_song', 'news',
    'chat_reply', 'chat_mention', 'chat_mention_all'
  ));

-- ════════════════════════════════════════════════════════════════
-- PARTIE C : NOTIFICATIONS — Activer Realtime sur UPDATE
-- Pour que le badge rouge se mette à jour en temps réel quand
-- une notification est marquée comme lue depuis un autre onglet
-- ════════════════════════════════════════════════════════════════

-- C1. S'assurer que la table notifications est dans la publication realtime
-- (Supabase active realtime via le Dashboard, mais on le force ici)
DO $$
BEGIN
  -- Ajouter la table à la publication si elle n'y est pas
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- PARTIE D : CHAT MESSAGES — Contrainte d'édition (20 min)
-- S'assurer que is_edited est bien géré
-- ════════════════════════════════════════════════════════════════

-- D1. Colonne is_edited (ajoutée en v333, idempotent ici)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

-- D2. Trigger pour mettre à jour is_edited automatiquement à l'UPDATE
CREATE OR REPLACE FUNCTION public.set_chat_message_edited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.is_edited := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_message_edited ON public.chat_messages;
CREATE TRIGGER trg_chat_message_edited
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_chat_message_edited();

-- ════════════════════════════════════════════════════════════════
-- PARTIE E : PLAYLIST_SONGS — RLS protection
-- Un utilisateur ne peut ajouter des sons qu'à ses propres playlists
-- ════════════════════════════════════════════════════════════════

-- E1. Vérifier/recréer les politiques pour playlist_songs
DROP POLICY IF EXISTS "playlist_songs_insert_owner" ON public.playlist_songs;
CREATE POLICY "playlist_songs_insert_owner"
  ON public.playlist_songs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE id = playlist_id
      AND owner_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "playlist_songs_delete_owner" ON public.playlist_songs;
CREATE POLICY "playlist_songs_delete_owner"
  ON public.playlist_songs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      WHERE id = playlist_id
      AND owner_id = auth.uid()::text
    )
  );

-- ════════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ════════════════════════════════════════════════════════════════
-- ✅ Playlists : DELETE strictement limité au owner_id (créateur)
-- ✅ Notifications : index anti-spam @tous, Realtime UPDATE activé
-- ✅ Chat : trigger is_edited automatique
-- ✅ playlist_songs : RLS INSERT/DELETE vérifiée côté propriétaire
-- Version : 333.0.0 → 500.0.0 | SW cache : v25 → v26
