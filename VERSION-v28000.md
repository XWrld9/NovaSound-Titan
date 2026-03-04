# NovaSound TITAN LUX — V28000

## Résumé des changements

### 🎵 Live Room — Refonte complète
- ✅ **Synchronisation audio précise** : l'hôte broadcast sa position toutes les 2 secondes → les participants se resynchronisent automatiquement (tolérance 1.5s de dérive)
- ✅ **Fichier audio local** : l'hôte peut uploader un fichier MP3/WAV/M4A depuis son appareil → uploadé dans le bucket `live-room-audio` → broadcast à tous les participants en temps réel
- ✅ **Messages persistés en DB** : les messages passent maintenant par Supabase → `postgres_changes` sur `live_room_messages` → l'hôte reçoit TOUS les messages des participants sans exception
- ✅ **Double canal fiable** : broadcast instantané (Realtime broadcast) + postgres_changes en fallback de sécurité
- ✅ **Messages éditables** : hover sur son propre message → icône ✏️ → édition inline avec Entrée pour valider / Échap pour annuler
- ✅ **Messages supprimables** : hover → icône 🗑️ → soft delete (`is_deleted = true`) → disparaît pour tous en temps réel
- ✅ Badge "🔄 Synchro" chez les participants pour confirmer que l'audio est synchronisé

### 🔔 Notifications — 4 bugs critiques corrigés

#### Bug 1 — `sw.js` : NAVIGATE vs PUSH_NAVIGATE (navigation depuis push impossible)
Le Service Worker envoyait `type:'NAVIGATE'` mais `NotificationContext` écoutait `type:'PUSH_NAVIGATE'` → **aucun clic sur une notification ne naviguait jamais vers la bonne page**.
**Fix** : `NAVIGATE` → `PUSH_NAVIGATE` dans `sw.js`.

#### Bug 2 — `sw.js` : PUSH_RESUBSCRIBED vs PUSH_SUBSCRIPTION_RENEWED
Le renouvellement automatique de subscription ne se re-enregistrait jamais en base.
**Fix** : aligné sur le nom attendu par `NotificationContext`.

#### Bug 3 — `sw.js` : BG_SYNC_MESSAGES vs SYNC_PENDING_MESSAGES
Les messages hors-ligne ne se synchronisaient jamais.
**Fix** : aligné sur le nom attendu par `NotificationContext`.

#### Bug 4 — `notifyAll` silencieux (0 push natif)
`notifyAll()` insérait bien les notifications en base mais **n'appelait jamais l'Edge Function** pour envoyer le push natif → les utilisateurs recevaient les notifs uniquement en ouvrant l'app, jamais dans la barre système.
**Fix** : après insertion batch, chaque utilisateur reçoit un appel push via l'Edge Function.

### 🔑 Edge Function `send-push-notification` — Fix VAPID
Les coordonnées `x` et `y` de la clé EC VAPID étaient **hardcodées** en dur → la fonction crashait silencieusement si les clés VAPID changeaient.
**Fix** : `extractXY()` extrait dynamiquement `x` et `y` depuis `VAPID_PUBLIC_KEY` (clé non compressée 65 bytes, format `0x04 | x | y`).

### 🔐 Flow "Mot de passe oublié" — Refonte complète
**Problème** : `AuthCallbackPage` redirigeait vers `/` même pour les liens de récupération → l'utilisateur était connecté mais ne pouvait jamais changer son mot de passe.

**Nouveau flux :**
1. Clic sur le lien email de réinitialisation
2. `AuthCallbackPage` détecte `type=recovery` → redirige vers `/reset-password`
3. Saisie + confirmation du nouveau mot de passe (avec indicateur de force)
4. Après validation → déconnexion automatique → redirection vers `/login`
5. `LoginPage` affiche un bandeau ✅ "Mot de passe modifié ! Connecte-toi avec ton nouveau mot de passe."
6. L'utilisateur se reconnecte avec le nouveau mot de passe → confirmé fonctionnel

### 📦 Cache Service Worker
- Nom du cache mis à jour : `novasound-titan-v28000`
- Force le rafraîchissement chez tous les utilisateurs au déploiement

## Migration SQL
Lancer `web/novasound-v28000-migration.sql` dans Supabase SQL Editor.

## Déploiement Edge Function
```bash
supabase functions deploy send-push-notification
```

## Commit Git
```
feat(v28000): sync live audio, local file broadcast, DB messages host fix, all push notifications fixed, password reset flow
```
