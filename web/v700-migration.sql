-- ════════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v700
-- © 2026 NovaSound TITAN LUX — ELOADXFAMILY
-- Exécuter dans Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════
--
-- Nouveautés v700 :
--   A. Chat — is_edited correctement sélectionné + update explicite
--   B. Présence Realtime — tracking enrichi (username, email, avatar)
--   C. Contrainte username sans espaces (idempotent depuis v600)
--   D. Version bump 600.0.0 → 700.0.0
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- PARTIE A : CHAT — S'assurer que is_edited est bien dans la table
--            et que le trigger fonctionne correctement
-- ════════════════════════════════════════════════════════════════════

-- A1. Colonne is_edited (idempotent)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;

-- A2. Trigger pour setter is_edited=TRUE automatiquement sur UPDATE du content
CREATE OR REPLACE FUNCTION public.fn_set_chat_message_edited()
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

DROP TRIGGER IF EXISTS trg_set_chat_message_edited ON public.chat_messages;
CREATE TRIGGER trg_set_chat_message_edited
  BEFORE UPDATE OF content
  ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_chat_message_edited();

-- A3. RLS UPDATE — auteur peut modifier son propre message
--     (is_edited sera mis à TRUE par le trigger automatiquement)
DROP POLICY IF EXISTS "chat_update_own"   ON public.chat_messages;
DROP POLICY IF EXISTS "chat_delete_own"   ON public.chat_messages;
DROP POLICY IF EXISTS "chat_edit_own"     ON public.chat_messages;

CREATE POLICY "chat_update_own"
  ON public.chat_messages
  FOR UPDATE
  USING (
    auth.uid()::text = user_id
    OR auth.uid() IN (
      SELECT id::uuid FROM public.users WHERE email = 'eloadxfamily@gmail.com'
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id
    OR auth.uid() IN (
      SELECT id::uuid FROM public.users WHERE email = 'eloadxfamily@gmail.com'
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- PARTIE B : PRÉSENCE — Activer Realtime avec présence complète
-- ════════════════════════════════════════════════════════════════════

-- B1. S'assurer que chat_messages est dans la publication Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- B2. S'assurer que chat_reactions est dans la publication Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- PARTIE C : UTILISATEURS — Contrainte username sans espaces
-- ════════════════════════════════════════════════════════════════════

-- C1. Nettoyer les usernames existants avec espaces
UPDATE public.users
  SET username = REPLACE(username, ' ', '-')
  WHERE username LIKE '% %';

-- C2. Contrainte CHECK (idempotent)
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
-- RÉSUMÉ
-- ════════════════════════════════════════════════════════════════════
-- ✅ A. is_edited : colonne + trigger BEFORE UPDATE OF content + RLS UPDATE
-- ✅ B. Realtime : chat_messages + chat_reactions dans la publication
-- ✅ C. Usernames sans espaces : nettoyage + contrainte CHECK
--
-- Ordre d'exécution recommandé si première installation :
--   1. setup-supabase.sql
--   2. v100-chat-public.sql ... v600-migration.sql (dans l'ordre)
--   3. v700-migration.sql  ← ce fichier
--
-- Version : 600.0.0 → 700.0.0
-- SW cache : novasound-titan-v30 → novasound-titan-v35
-- ════════════════════════════════════════════════════════════════════
