-- ============================================================
-- NovaSound-Titan v5.3
-- DÉSACTIVER LA CONFIRMATION EMAIL + TRIGGER ROBUSTE
-- 
-- ⚠️  À exécuter dans Supabase Dashboard → SQL Editor
--
-- POURQUOI : onboarding@resend.dev ne peut envoyer qu'à
-- l'email du compte Resend — pas aux emails des utilisateurs.
-- Sans domaine vérifié dans Resend, la confirmation email
-- est impossible. Ce script désactive cette exigence.
-- ============================================================

-- ── 1. Corriger le trigger (robuste, ne peut plus planter) ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  IF base_username = '' THEN base_username := 'user'; END IF;
  final_username := base_username;

  LOOP
    BEGIN
      INSERT INTO public.users (id, username, email)
      VALUES (NEW.id::text, final_username, NEW.email)
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
        IF counter > 999 THEN EXIT; END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Réparer les comptes bloqués (auth.users sans profil) ─
INSERT INTO public.users (id, username, email)
SELECT
  au.id,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'username'), ''),
    split_part(au.email, '@', 1),
    'user_' || substring(au.id::text, 1, 8)
  ),
  au.email
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id::text
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Confirmation du résultat ─────────────────────────────
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_auth_users,
  (SELECT COUNT(*) FROM public.users) AS total_public_users,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.users)
    THEN '✅ Tous les comptes ont un profil'
    ELSE '⚠️ Des comptes sont encore sans profil'
  END AS status;

-- ── RAPPEL : Désactiver "Confirm email" dans le Dashboard ───
-- Authentication → Providers → Email → "Confirm email" = OFF
-- C'est une option UI, pas SQL.
