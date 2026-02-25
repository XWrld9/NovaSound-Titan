# 📧 Configuration SMTP Gmail — NovaSound TITAN LUX
## Solution définitive — Sans domaine, gratuit, 500 emails/jour

---

## ÉTAPE 1 — Générer un mot de passe d'application Google

> ⚠️ Tu dois avoir la **validation en 2 étapes activée** sur ton compte Google.
> Si ce n'est pas le cas : myaccount.google.com → Sécurité → Validation en 2 étapes → Activer

1. Va sur : **https://myaccount.google.com/apppasswords**
2. Connecte-toi avec le compte Gmail qui enverra les emails
3. Dans le champ **"Nom de l'application"**, tape : `NovaSound Supabase`
4. Clique **Créer**
5. Google génère un mot de passe de 16 caractères type `xxxx xxxx xxxx xxxx`
6. **Copie-le immédiatement** — il ne sera plus jamais affiché

---

## ÉTAPE 2 — Configurer le SMTP dans Supabase

1. Va dans **Supabase Dashboard → Authentication → Email (sous Notifications)**
2. Active **"Enable Custom SMTP"**
3. Remplis exactement comme ceci :

| Champ | Valeur |
|-------|--------|
| **Sender email** | `toncompte@gmail.com` |
| **Sender name** | `NovaSound TITAN LUX` |
| **Host** | `smtp.gmail.com` |
| **Port number** | `587` |
| **Username** | `toncompte@gmail.com` |
| **Password** | `xxxx xxxx xxxx xxxx` ← le mot de passe d'application (avec ou sans espaces) |
| **Minimum interval** | `60` |

4. Clique **Save**

---

## ÉTAPE 3 — Configurer les URL de redirection dans Supabase

1. **Supabase Dashboard → Authentication → URL Configuration**
2. **Site URL** : `https://TON-PROJET.vercel.app`
3. Dans **Redirect URLs**, ajouter :
   - `https://TON-PROJET.vercel.app/#/login`
   - `https://TON-PROJET.vercel.app/**`
4. Clique **Save**

---

## ÉTAPE 4 — Tester

1. Va sur ton site → **S'inscrire** avec une adresse email réelle
2. Vérifie la boîte mail → un email de `toncompte@gmail.com` doit arriver
3. Clique le lien de confirmation → tu es redirigé vers `/#/login`
4. Connecte-toi → ✅

---

## En cas de problème

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `535 Authentication failed` | Mauvais mot de passe | Utilise le mot de passe d'**application**, pas ton vrai mdp Gmail |
| `534 Please log in via your web browser` | 2FA non activée | Activer la validation en 2 étapes sur le compte Google |
| `Username and Password not accepted` | App password pas généré | Aller sur myaccount.google.com/apppasswords |
| Email reçu mais lien ne marche pas | Redirect URL manquante | Ajouter `https://site.app/**` dans Supabase Redirect URLs |
| Email dans les spams | Normal au départ | Demander aux utilisateurs de marquer "Pas spam" |

---

## Limites Gmail SMTP

- **500 emails/jour** — largement suffisant pour le lancement
- Le "From" affiche `toncompte@gmail.com` — ajoute un sender name "NovaSound TITAN LUX" pour compenser
- Si tu dépasses 500/jour → passer sur Resend avec un domaine eu.org (gratuit)

---

> Solution mise en place dans NovaSound-Titan **v5.4**
