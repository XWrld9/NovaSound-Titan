# 🔧 Guide de résolution — Resend + Supabase SMTP
## NovaSound-Titan v5.1 — "error sending confirmation email"

---

## ÉTAPE 1 — Vérifier le domaine dans Resend (cause #1 la plus fréquente)

1. Connecte-toi sur **resend.com**
2. Va dans **Domains** (menu gauche)
3. Ton domaine doit afficher le badge **✅ Verified**
   - Si c'est **Pending** → tu dois ajouter les DNS records chez ton registrar (Namecheap, OVH, Cloudflare...)
   - Resend fournit 3 enregistrements à copier : **SPF**, **DKIM** et **DMARC**
   - Délai de propagation DNS : 5 min à 48h

> ⚠️ **Si tu n'as pas de domaine personnalisé** : Resend ne te laisse pas envoyer depuis Gmail/Hotmail/etc.
> → Utilise le domaine de test Resend : `onboarding@resend.dev` (limité à ton propre email uniquement)
> → OU utilise l'**intégration native Supabase-Resend** (voir Étape 5)

---

## ÉTAPE 2 — Vérifier la config SMTP dans Supabase

Supabase Dashboard → **Authentication** → **Email** → **SMTP Settings**

Les valeurs EXACTES à entrer :

| Champ | Valeur |
|-------|--------|
| **Enable Custom SMTP** | ✅ ON |
| **Sender email** | `noreply@TON-DOMAINE-VERIFIE.com` |
| **Sender name** | `NovaSound TITAN LUX` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` ← (le mot "resend" littéralement, pas ton email) |
| **Password** | `re_XXXXXXXXXXXX` ← ta clé API Resend (commence par `re_`) |
| **Minimum interval** | `60` |

> ⚠️ Erreurs communes :
> - Mettre son email Resend comme Username → FAUX, le username est toujours `resend`
> - Mettre le mot de passe compte Resend → FAUX, c'est la clé API (re_...)
> - Sender email avec un domaine non vérifié → bloqué par Resend

---

## ÉTAPE 3 — Vérifier le SITE_URL et les Redirect URLs

Supabase Dashboard → **Authentication** → **URL Configuration**

| Champ | Valeur |
|-------|--------|
| **Site URL** | `https://TON-SITE.vercel.app` |
| **Redirect URLs** | Ajouter : `https://TON-SITE.vercel.app/#/login` |
|  | Ajouter : `https://TON-SITE.vercel.app/**` |

> Sans ça, Supabase refuse d'envoyer l'email car l'URL de redirection est considérée non autorisée.

---

## ÉTAPE 4 — Tester l'envoi depuis Resend directement

Avant de tester via l'app, teste que Resend fonctionne :

1. Resend Dashboard → **Emails** → **Send Test Email**
2. Si ça échoue ici → problème de domaine/clé API
3. Si ça réussit ici mais pas via Supabase → problème de config SMTP dans Supabase

---

## ÉTAPE 5 — Alternative : Intégration native Resend-Supabase (RECOMMANDÉE)

Resend propose une intégration officielle qui configure tout automatiquement :

1. **resend.com** → **Integrations** → **Supabase**
2. Connecte ton compte Supabase
3. Resend configure le SMTP automatiquement
4. Plus fiable que la config manuelle

URL : https://resend.com/supabase

---

## ÉTAPE 6 — Solution de secours : désactiver la confirmation email

Si tu veux débloquer les inscriptions MAINTENANT en attendant de régler Resend :

Supabase Dashboard → **Authentication** → **Providers** → **Email**
→ Désactiver **"Confirm email"**

⚠️ Les utilisateurs pourront se connecter sans confirmer leur email.
⚠️ À réactiver une fois Resend fonctionnel.

---

## ÉTAPE 7 — Vérifier les logs Supabase Auth en temps réel

Pour voir l'erreur exacte :

Supabase Dashboard → **Logs** → **Auth Logs**
→ Filtre : `500` ou `error`
→ L'erreur exacte apparaît, ex: `"dial tcp: lookup smtp.resend.com: no such host"`
   ou `"535: Authentication failed"` ou `"550: Domain not verified"`

---

## Récapitulatif des erreurs et solutions

| Erreur dans les logs | Cause | Solution |
|---------------------|-------|----------|
| `Authentication failed` | Mauvaise clé API ou username incorrect | Username = `resend`, Password = clé API `re_...` |
| `Domain not verified` | Domaine non vérifié dans Resend | Ajouter SPF/DKIM/DMARC dans tes DNS |
| `no such host` | Mauvais host SMTP | Host doit être exactement `smtp.resend.com` |
| `connection timeout` | Mauvais port | Port doit être `465` |
| `redirect_uri_mismatch` | URL non whitelistée | Ajouter `https://site.app/#/login` dans Redirect URLs |
| `database error saving new user` | Trigger SQL planté | Exécuter `fix-email-confirm.sql` dans SQL Editor |

