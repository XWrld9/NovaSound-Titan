# NovaSound TITAN LUX — V400000 (Patch V400001)

**Plateforme musicale nouvelle génération** — Streaming, upload, live rooms, chat, notifications push WebRTC.

---

## 🚀 Déploiement Vercel

1. Push sur `main` → déploiement automatique via Vercel CI.
2. Node.js `20.x` requis (défini dans `package.json`).

---

## 🛠️ Corrections V400001 (Patch de Réparation)

### Bugs critiques résolus

| Fichier | Problème | Fix |
|---|---|---|
| `ExplorerPage.jsx` | Nom de composant `const {t(...)}Page` invalide (crash build) | Renommé `const ExplorerPage` + `export default ExplorerPage` |
| Tous les fichiers | `.select('...')` cassé en `.selec'...'` par le système i18n | 38 fichiers restaurés |
| `TrendingPage.jsx` | `PERIODS` défini comme fonction `(t) =>` puis appelé sans `t` | Converti en tableau statique |
| `BottomNav.jsx` | `labelKey` + `t(labelKey)` sans hook actif | Remplacé par `label` statique |
| `NotificationsPage.jsx` | `t(tab.labelKey)` dynamique sans hook | Remplacé par `tab.label` statique |
| `ArtistProfilePage.jsx` | `.select()` corrompu par substitution i18n | Restauré |
| `UserProfilePage.jsx` | `.select()` corrompu | Restauré |

### Système i18n supprimé intégralement

- **Supprimé** : `i18next`, `i18next-browser-languagedetector`, `react-i18next` (package.json)
- **Supprimé** : `LanguageSwitcher` composant et toutes ses occurrences (Header, LoginPage, SignupPage)
- **Supprimé** : Tous les imports `useTranslation` + hooks `const { t } = useTranslation()`
- **Remplacé** : Tous les appels `t('key')` par le texte français statique correspondant
- **Conservés** : Tous les fichiers `locales/*.json` et `i18n.js` (non importés, peuvent être supprimés manuellement)
- **Texte du site** : 100% français fixe, propre, sans dépendances

### Migration Supabase V400001

Fichier : `supabase/migrations/novasound-v400001-reparatrice.sql`

**Appliquer dans Supabase SQL Editor :**
1. Ouvre **Supabase Dashboard → SQL Editor**
2. Colle le contenu de `novasound-v400001-reparatrice.sql`
3. Exécute

**Ce que fait la migration :**
- ✅ Élargit la contrainte `CHECK` sur `notifications.type` pour inclure `live_start`, `live_invite`, `queue_song`, `achievement` (types utilisés par l'Edge Function mais manquants dans le schéma)
- ✅ Ajoute les colonnes `push_sent_at` et `image_url` si absentes
- ✅ Recrée le trigger `on_notification_insert_push` avec la liste complète des types
- ✅ Ajoute les index manquants sur `push_notification_logs` et `notifications`
- ✅ Met à jour la vue `v_notification_stats`

---

## 📦 Structure du projet

```
web/
├── src/
│   ├── pages/          # 23 pages React
│   ├── components/     # 40+ composants
│   ├── contexts/       # Auth, Player, Chat, Notifications…
│   ├── hooks/          # usePWAInstall, useGenreTheme
│   └── lib/            # supabaseClient, notifUtils, utils
├── public/             # Assets, SW, manifest PWA
└── package.json
supabase/
├── functions/
│   └── send-push-notification/index.ts   # Edge Function VAPID push
└── migrations/
    ├── 20260306_V400000.sql               # Migration principale
    └── novasound-v400001-reparatrice.sql  # Migration corrective
```

---

## ⚙️ Variables d'environnement

### Vercel / Frontend (`.env`)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Edge Function Secrets
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@novasound.app
PUSH_WEBHOOK_SECRET=...          # optionnel
PUSH_BATCH_SIZE=10               # optionnel (défaut: 10)
```

### Supabase Database Settings (pour le trigger auto-push)
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://xxxx.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## 🔔 Système de Push Notifications

L'Edge Function `send-push-notification` (Deno, Supabase Functions) gère :
- Chiffrement VAPID + AES-GCM (Web Push standard)
- Rate limiting : 60 push/heure/utilisateur
- Idempotence sur `notif_id`
- Retry x3 avec backoff exponentiel
- Auto-purge des subscriptions expirées (404/410)
- Broadcast mode pour notifications globales
- 14 types de notifications avec urgence et TTL configurables

---

## 📱 PWA

- Manifest : `/public/manifest.json`
- Service Worker : `/public/sw.js`
- APK Android natif : `/public/NovaSound-TITAN-LUX.apk`

---

*© 2026 NovaSound TITAN LUX — ELOADXFAMILY*
