-- ════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v600
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════
--
-- Changements v600 :
--   A. Correction RLS UPDATE chat_messages (edit séparé du soft-delete)
--   B. Trigger is_edited automatique (idempotent)
--   C. Index chat_messages pour les messages édités
--   D. Contrainte username : pas d'espaces (nettoyage et enforcement)
--   E. Version bump 500.0.0 → 600.0.0
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- PARTIE A : CHAT — Fix RLS UPDATE pour l'édition de messages
-- ════════════════════════════════════════════════════════════════════

-- A1. Supprimer l'ancienne politique UPDATE (soft-delete + edit mélangés)
DROP POLICY IF EXISTS "chat_delete_own" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_update_own" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_edit_own" ON public.chat_messages;

-- A2. Politique UPDATE séparée et explicite :
--     L'auteur peut modifier son message (edit contenu) ou le soft-delete
--     L'admin peut aussi soft-delete les messages des autres
CREATE POLICY "chat_update_own"
  ON public.chat_messages
  FOR UPDATE
  USING (
    -- Auteur : peut modifier ses propres messages
    auth.uid()::text = user_id
    OR
    -- Admin : peut soft-delete n'importe quel message
    auth.uid() IN (
      SELECT id::uuid FROM public.users WHERE email = 'eloadxfamily@gmail.com'
    )
  )
  WITH CHECK (
    -- L'auteur ne peut modifier que SES messages
    auth.uid()::text = user_id
    OR
    -- L'admin peut setter is_deleted=true sur n'importe quel message
    auth.uid() IN (
      SELECT id::uuid FROM public.users WHERE email = 'eloadxfamily@gmail.com'
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- PARTIE B : CHAT — Colonne is_edited + trigger automatique
-- ════════════════════════════════════════════════════════════════════

-- B1. S'assurer que la colonne is_edited existe
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;

-- B2. Index sur is_edited pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_edited
  ON public.chat_messages(is_edited)
  WHERE is_edited = TRUE;

-- B3. Fonction trigger : marque is_edited=TRUE quand le contenu change
CREATE OR REPLACE FUNCTION public.fn_set_chat_message_edited()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Marquer comme édité seulement si le contenu a changé
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.is_edited := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- B4. Trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_set_chat_message_edited ON public.chat_messages;
CREATE TRIGGER trg_set_chat_message_edited
  BEFORE UPDATE OF content
  ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_chat_message_edited();

-- ════════════════════════════════════════════════════════════════════
-- PARTIE C : UTILISATEURS — Nettoyage et enforcement username sans espaces
-- ════════════════════════════════════════════════════════════════════

-- C1. Nettoyer les usernames existants qui auraient des espaces
--     (remplace les espaces par des tirets)
UPDATE public.users
  SET username = REPLACE(username, ' ', '-')
  WHERE username LIKE '% %';

-- C2. Contrainte CHECK pour interdire les espaces dans username
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'username_no_spaces'
    AND table_name = 'users'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT username_no_spaces
      CHECK (username NOT LIKE '% %');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- PARTIE D : REALTIME — S'assurer que chat_messages est bien activé
-- ════════════════════════════════════════════════════════════════════

-- D1. Activer Realtime sur chat_messages si pas déjà fait
DO $$
BEGIN
  -- Ajouter à la publication realtime si absent
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN
    -- Déjà présent, OK
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ════════════════════════════════════════════════════════════════════
-- ✅ A. RLS UPDATE chat_messages : édition (auteur) + soft-delete (auteur/admin) corrigés
-- ✅ B. Trigger is_edited automatique au BEFORE UPDATE OF content
-- ✅ C. Usernames sans espaces : nettoyage + contrainte CHECK
-- ✅ D. Realtime chat_messages actif
--
-- Version : 500.0.0 → 600.0.0
-- SW cache : novasound-titan-v26 → novasound-titan-v30
-- ════════════════════════════════════════════════════════════════════
