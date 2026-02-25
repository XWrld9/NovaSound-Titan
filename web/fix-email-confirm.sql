-- ============================================================
-- FIX : Problèmes d'inscription (database error / email error)
-- NovaSound-Titan v5.1
-- ============================================================
-- QUAND L'UTILISER :
--   1. Si vous obtenez "database error saving new user"
--   2. Si vous obtenez "error sending confirmation email"
--   3. Si les nouveaux comptes ne peuvent pas se connecter
-- ============================================================

-- ── ÉTAPE 1 : Corriger le trigger handle_new_user ──────────────
-- (Robuste : gère les conflits username, ne plante jamais)

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

-- ── ÉTAPE 2 : Politique RLS pour permettre la lecture sans auth ─
-- (Nécessaire pour que ensureProfile() fonctionne)
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
CREATE POLICY "Service role can insert users" ON public.users
  FOR INSERT WITH CHECK (true);

-- ── ÉTAPE 3 [OPTIONNEL] : Désactiver la confirmation email ─────
-- ⚠️  À N'ACTIVER QUE si votre SMTP Supabase est mal configuré
--     ou si vous êtes sur le plan free avec quota d'emails dépassé.
--     RISQUE : n'importe qui peut créer un compte sans vrai email.
--
-- Pour désactiver la confirmation email :
-- → Supabase Dashboard > Authentication > Settings
-- → "Enable email confirmations" → désactiver
-- → OU exécuter cette requête (plan Pro uniquement) :
--
-- UPDATE auth.config SET confirm_email_change_email_address = false;
--
-- ── ÉTAPE 4 : Nettoyer les users bloqués ──────────────────────
-- Si des users ont été créés dans auth.users mais pas dans public.users,
-- cette requête les répare :

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
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id::text)
ON CONFLICT (id) DO NOTHING;

-- Vérification finale
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users_total,
  (SELECT COUNT(*) FROM public.users) AS public_users_total,
  (SELECT COUNT(*) FROM auth.users au WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id::text)) AS users_sans_profil;
