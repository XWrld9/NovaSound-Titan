# 🔔 NovaSound TITAN LUX — Guide Push Natifs v800

Notifications **Android · PC · iOS 16.4+ PWA** comme WhatsApp et Facebook.

---

## 1. Générer tes clés VAPID (une seule fois pour toujours)

```bash
# Installer web-push si pas déjà fait
npm install -g web-push

# Générer la paire de clés
web-push generate-vapid-keys
```

Tu obtiens quelque chose comme :

```
Public Key:  BNyTAf5wmou_w-d62...  ← déjà dans le code (VAPID_PUBLIC_KEY)
Private Key: abc123xyz...           ← à garder SECRÈTE, jamais dans le code
```

> ⚠️ La clé publique **BNyTAf5wmou_w-d62...** est déjà configurée dans le SW et le contexte.
> Si tu génères une nouvelle paire, tu dois la mettre à jour dans :
> - `web/public/sw.js` → ligne `const VAPID_PUBLIC_KEY = ...`
> - `web/src/contexts/NotificationContext.jsx` → ligne `const VAPID_PUBLIC_KEY = ...`

---

## 2. Configurer les secrets dans Supabase

**Supabase Dashboard → Settings → Edge Functions → Add new secret**

| Nom                         | Valeur                              |
|-----------------------------|-------------------------------------|
| `VAPID_PUBLIC_KEY`          | `BNyTAf5wmou_w-d62...` (ta clé pub)|
| `VAPID_PRIVATE_KEY`         | `abc123xyz...` (ta clé PRIVÉE)      |
| `VAPID_SUBJECT`             | `mailto:eloadxfamily@gmail.com`     |

> `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.

---

## 3. Déployer l'Edge Function

```bash
# Installer Supabase CLI si pas déjà fait
npm install -g supabase

# Se connecter
supabase login

# Lier ton projet
supabase link --project-ref TON_PROJECT_REF

# Déployer la fonction
supabase functions deploy send-push-notification --no-verify-jwt
```

> `TON_PROJECT_REF` = l'ID de ton projet (Settings → General → Reference ID)

---

## 4. Exécuter la migration SQL

**Supabase Dashboard → SQL Editor → New query**

```sql
-- Étape 4a : Copier-coller le contenu de v800-migration.sql
-- ⚠️ IMPORTANT : Remplacer 'https://TON-PROJET.supabase.co' par l'URL réelle

-- Étape 4b : Configurer la clé service role dans les settings DB
-- (Supabase Dashboard → Settings → API → service_role key)
ALTER DATABASE postgres
  SET app.service_role_key = 'COLLER_ICI_LA_SERVICE_ROLE_KEY';
```

---

## 5. Configurer le Database Webhook (méthode alternative sans pg_net)

Si tu préfères éviter le trigger SQL, tu peux utiliser un **Database Webhook** :

**Supabase Dashboard → Database → Webhooks → Create a new hook**

| Champ           | Valeur                                                              |
|-----------------|---------------------------------------------------------------------|
| Name            | `push_on_new_notification`                                          |
| Table           | `notifications`                                                     |
| Events          | ✅ Insert                                                           |
| Type            | HTTP Request                                                        |
| Method          | POST                                                                |
| URL             | `https://TON-PROJET.supabase.co/functions/v1/send-push-notification`|
| HTTP Headers    | `Authorization: Bearer <service_role_key>`                          |
|                 | `Content-Type: application/json`                                    |

> Les deux méthodes (trigger SQL ou webhook) fonctionnent. Le webhook est plus simple à configurer.
> **Utiliser l'une OU l'autre, pas les deux.**

---

## 6. Vérifier le déploiement

```bash
# Tester l'Edge Function manuellement
curl -X POST \
  'https://TON-PROJET.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer <service_role_key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "ID_UTILISATEUR_TEST",
    "title": "🎵 Test NovaSound",
    "body": "Les notifications push fonctionnent !",
    "url": "/"
  }'
```

Résultat attendu : `{"sent":1,"failed":0,"total":1,"purged":0}`

---

## 7. Compatibilité par plateforme

| Plateforme          | Push natifs | Condition                              |
|---------------------|-------------|----------------------------------------|
| Android Chrome      | ✅ Parfait  | Aucune — fonctionne dans le navigateur |
| Android Firefox     | ✅ Parfait  | Aucune                                 |
| Android Samsung Internet | ✅    | Aucune                                 |
| PC Chrome / Edge    | ✅ Parfait  | Aucune                                 |
| PC Firefox          | ✅ Parfait  | Aucune                                 |
| PC Safari (macOS)   | ✅ Parfait  | Safari 16+ sur macOS 13+               |
| **iOS Safari**      | ✅ Fonctionne | App **installée en PWA** obligatoire |
| iOS Chrome/Firefox  | ❌ Non      | iOS force WebKit même pour les autres  |

### iOS — Comment installer la PWA (obligatoire pour les pushs) :

1. Ouvrir **nova-sound-titan.vercel.app** dans **Safari**
2. Appuyer sur l'icône **Partager** (carré avec flèche ↑)
3. Sélectionner **Sur l'écran d'accueil**
4. Nommer l'app "NovaSound" et confirmer
5. Rouvrir l'app depuis l'écran d'accueil → l'app demande la permission de notifier

> Sur iOS, le bouton "Activer les notifications" dans l'app ne fonctionne que si l'app
> est ouverte en mode PWA (icône sur l'écran d'accueil), jamais depuis Safari directement.

---

## 8. Architecture du système

```
Événement (like, follow, commentaire, mention chat)
    │
    ▼
INSERT dans public.notifications (Supabase DB)
    │
    ├─ Realtime → NotificationContext (badge in-app + toast)
    │
    └─ Trigger SQL / Webhook → Edge Function send-push-notification
                                    │
                                    ├─ Récupère les push_subscriptions du user
                                    ├─ Chiffre le payload (RFC 8291 aes128gcm)
                                    ├─ Envoie au Push Service de chaque navigateur
                                    └─ Purge les subscriptions expirées (410/404)
                                                    │
                                                    ▼
                                    Service Push (Google FCM / Mozilla / Apple)
                                                    │
                                                    ▼
                                    Service Worker sw.js sur l'appareil
                                                    │
                                                    ▼
                                    🔔 Notification native dans la barre système
```

---

## 9. Dépannage fréquent

**Les pushs ne s'envoient pas**
- Vérifier que les secrets VAPID sont bien configurés dans Supabase
- Vérifier les logs : Supabase Dashboard → Edge Functions → send-push-notification → Logs

**iOS ne reçoit rien**
- L'app DOIT être installée en PWA depuis Safari
- iOS 16.4 minimum requis
- L'utilisateur doit avoir accordé la permission depuis l'app PWA

**Les subscriptions s'accumulent sans être purgées**
- Normal : la purge se fait automatiquement lors du prochain push (statut 410)
- Lancer manuellement : `SELECT public.cleanup_old_push_subscriptions();`

**Badge numérique ne s'affiche pas**
- Supporté sur Android Chrome + PC Chrome/Edge uniquement
- Safari macOS 15+ prend en charge navigator.setAppBadge en PWA

---

*Version 800 — © 2026 NovaSound TITAN LUX — ELOADXFAMILY*
