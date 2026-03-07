# NovaSound TITAN LUX — v500000

> **La plateforme musicale nouvelle génération.** Streamez, uploadez et connectez-vous avec des artistes du monde entier.  
> © 2026 NovaSound TITAN LUX — ELOADXFAMILY · [eloadxfamily@gmail.com](mailto:eloadxfamily@gmail.com)

---

## ✨ Nouveautés v500000

### 🐛 Correctifs critiques
| Zone | Bug | Correction |
|------|-----|------------|
| **Offline** | La redirection vers `/local-player` échouait au chargement initial | `useLayoutEffect` synchrone + guard `navigator.onLine` avant le premier render |
| **Lecture musicale** | Toutes les SongCard clignotaient excessivement pendant la lecture | `audioCurrentTime`/`audioDuration` isolés dans un `PlayerTimeContext` dédié — les cartes ne souscrivent plus à ces états haute fréquence |
| **Live Room (mobile)** | Zone de saisie trop petite, trop basse, placeholder "typeMessage" brut | `<textarea>` auto-expandable, padding corrigé, placeholder traduit |
| **Chat (mobile)** | Zone de saisie masquée par la BottomNav + AudioPlayer | calcul `paddingBottom` conditionnel selon la largeur d'écran |
| **Push notifications** | Notifications push et in-app n'arrivaient pas | `notifUtils.js` envoyait `id` au lieu de `notif_id` — corrigé + DB Trigger automatique |
| **Responsivité** | Pages `Artistes`, `Notifications`, `Lecteur Local`, `Upload`, pied de page trop étroits | `max-w-4xl/3xl` → `max-w-6xl/5xl/7xl` selon la page |

### 🗄️ Base de données (migration v500000)
- **DB Trigger** automatique : chaque `INSERT` dans `notifications` déclenche l'Edge Function push via `pg_net`
- **15 index** ajoutés sur les tables les plus interrogées (`songs`, `likes`, `notifications`, `push_subscriptions`, `chat_messages`, `song_play_events`)
- **RLS** renforcé sur `notifications`, `push_subscriptions`, `app_meta`
- **Crons** de nettoyage automatique (logs push > 30j, notifications lues > 90j)
- **Déduplication DB** notifications identiques dans la même fenêtre de 30 secondes

### ⚡ Edge Function v500000
- Accepte `notif_id` **et** `id` (compatibilité DB trigger + appels client)
- Rate limit augmenté à **120 push/heure**
- Logs structurés JSON pour Supabase Log Explorer
- CORS headers sur toutes les réponses d'erreur
- Retry 429 borné à 10 secondes max

---

## 🏗️ Architecture

```
NovaSound TITAN LUX/
├── web/                          # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx               # Router, providers globaux, redirect offline
│   │   ├── contexts/
│   │   │   ├── PlayerContext.jsx      # État lecteur (chanson, playlist, file)
│   │   │   ├── PlayerTimeContext.jsx  # ✨ NEW v500000 — temps lecture isolé
│   │   │   ├── NotificationContext.jsx# Notifications + push Web
│   │   │   ├── OnlineContext.jsx      # Détection réseau temps réel
│   │   │   ├── AuthContext.jsx        # Session Supabase Auth
│   │   │   └── ChatContext.jsx        # Chat global + realtime
│   │   ├── components/
│   │   │   ├── AudioPlayer.jsx        # Lecteur audio global (persistant)
│   │   │   ├── SongCard.jsx           # Carte chanson (ne re-render plus pendant lecture)
│   │   │   ├── BottomNav.jsx          # Navigation mobile (masquée sur live/local-player)
│   │   │   └── Footer.jsx             # Pied de page (max-w-7xl)
│   │   ├── pages/
│   │   │   ├── LocalPlayerPage.jsx    # Lecteur hors-ligne IndexedDB + FSA
│   │   │   ├── LiveRoomPage.jsx       # Live room chat (textarea v500000)
│   │   │   ├── ChatPage.jsx           # Chat global (padding mobile corrigé)
│   │   │   ├── ArtistsPage.jsx        # Liste artistes (max-w-6xl)
│   │   │   └── NotificationsPage.jsx  # Notifications (max-w-5xl)
│   │   └── lib/
│   │       ├── notifUtils.js          # ✅ FIX: notif_id (était: id)
│   │       └── supabaseClient.js      # Client Supabase
│   └── public/
│       └── sw.js                      # Service Worker push + cache offline
├── supabase/
│   └── functions/
│       └── send-push-notification/
│           ├── index.ts               # Edge Function v410000 (ancienne)
│           └── index_v500000.ts       # ✨ Edge Function v500000 (nouvelle)
└── migration_v500000.sql              # ✨ Migration DB à exécuter dans Supabase
```

---

## 🚀 Déploiement

### 1. Migration SQL
```sql
-- Dans Supabase SQL Editor, exécuter migration_v500000.sql
-- Puis configurer les clés pour le DB Trigger :
INSERT INTO public.app_meta (key, value) VALUES
  ('supabase_url',      'https://VOTRE_REF.supabase.co'),
  ('service_role_key',  'VOTRE_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 2. Edge Function
```bash
# Remplacer l'ancienne Edge Function par la v500000
cp supabase/functions/send-push-notification/index_v500000.ts \
   supabase/functions/send-push-notification/index.ts

# Déployer
supabase functions deploy send-push-notification
```

### 3. Variables d'environnement Edge Function
```
SUPABASE_URL=https://VOTRE_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
VAPID_PUBLIC_KEY=BFCdXh1JM5vELnaw7GolQNKPEc-CJRafU2QC3r1lTdyCSSBl5QL6nJfU3HXbnhqm_krsVViGLJ8nf2VpYBjt38o
VAPID_PRIVATE_KEY=VOTRE_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:eloadxfamily@gmail.com
PUSH_WEBHOOK_SECRET=VOTRE_SECRET_WEBHOOK  (optionnel)
PUSH_BATCH_SIZE=10  (optionnel, défaut 10)
```

### 4. Frontend (Vercel)
```bash
cd web
npm install
npm run build
# Déployer le dossier dist/ sur Vercel
```

---

## 🔔 Système de Notifications

### Flux complet (v500000)
```
Action utilisateur (like, follow, commentaire…)
  → INSERT dans public.notifications (via notifUtils.js)
  → DB Trigger trg_push_on_notification (AFTER INSERT)
  → pg_net appel HTTP non-bloquant → Edge Function
  → Edge Function récupère les push_subscriptions de l'user
  → Envoie push VAPID chiffré (Web Push Protocol)
  → Service Worker reçoit l'event 'push'
  → Affiche notification système Android/iOS/PC
  → NotificationContext lit les nouvelles notifs via Realtime Supabase
  → Badge in-app mis à jour
```

### Types de notifications supportés
`like` · `comment` · `follow` · `new_song` · `repost` · `news` · `chat_reply` · `chat_mention` · `chat_mention_all` · `mood_vote` · `live_start` · `live_started` · `live_invite` · `queue_song` · `achievement`

---

## 📱 Lecteur Local (hors-ligne)

- **100% offline** — aucune connexion requise
- **FSA (File System Access API)** : persistance automatique des handles sur PC
- **IndexedDB** : sauvegarde playlists entre sessions
- **ID3v2** : lecture automatique des métadonnées (titre, artiste, album, couverture)
- **Formats** : MP3, M4A, WAV, FLAC, AAC, OGG, OPUS, WMA
- **Raccourcis clavier** : Space, ←→ ±10s, ↑↓ volume, M muet, N suivant, P précédent

---

## 🎵 Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| **Streaming** | Lecture en ligne de sons hébergés sur Supabase Storage |
| **Upload** | MP3/M4A/WAV/FLAC jusqu'à 50 MB, couverture optionnelle |
| **Live Rooms** | Salles de live avec chat temps réel, file d'attente, réactions |
| **Chat global** | Messagerie communautaire, mentions @tous, réponses, réactions |
| **Notifications** | Push Web (Android PWA, iOS 16.4+ Safari PWA, PC Chrome/Edge) |
| **Explorer** | Navigation par genre, artiste, tendances, playlists |
| **Leaderboard** | Classement artistes par écoutes, likes, abonnés |
| **Mode radio** | Lecture automatique de sons similaires |
| **Lecteur local** | Lecture fichiers locaux sans connexion |

---

## 🔧 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Edge Functions | Deno (TypeScript) |
| Push notifications | Web Push Protocol (VAPID), Service Worker |
| Offline | IndexedDB, File System Access API, Cache API |
| Déploiement | Vercel (frontend), Supabase Cloud (backend) |

---

## 📋 Changelog

### v500000 (2026-03-07)
- Fix : clignotement des SongCards pendant la lecture (`PlayerTimeContext`)
- Fix : redirection offline synchrone (`useLayoutEffect`)
- Fix : zone de saisie Live Room (textarea expandable, placeholder correct)
- Fix : zone de saisie Chat mobile (padding conditionnel)
- Fix : push notifications (`notif_id` au lieu de `id` dans notifUtils.js)
- Fix : responsivité des pages Artistes, Notifications, Pied de page
- Nouveau : DB Trigger automatique push sur chaque notification
- Nouveau : 15 index DB pour les performances
- Nouveau : RLS renforcé, crons nettoyage automatique
- Edge Function : support `notif_id` + `id`, rate limit 120/hr, logs JSON

### v410000
- Refonte complète LocalPlayerPage (layout 3 colonnes, FSA handles, ID3v2)
- Chat : support `@tous/@all/@everyone`, suppressions, éditions
- Live Room : réactions burst, file d'attente, historique
- Notifications : types achievement, live_started, queue_song

---

*NovaSound TITAN LUX — ELOADXFAMILY · v500000*
