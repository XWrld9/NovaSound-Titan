# 🎵 NovaSound TITAN LUX — V100000

> Plateforme de streaming musical sociale, propulsée par Supabase & React.  
> Version **V100000** — *Live Rooms 2.0 · Sync Audio Précise · Mobile UX*

---

## ✨ Nouveautés V100000 — "Live Rooms 2.0 · Sync Audio · Mobile UX"

### 🎙️ Live Rooms — Refonte totale

| Fonctionnalité | Détail |
|---|---|
| **Sync audio précise** | Seuil de recalibration à 2s, lag réseau compensé automatiquement |
| **Indicateur qualité sync** | Jauge 0–100 % visible par les invités (vert / orange / rouge) |
| **Auto-advance queue** | Passage automatique au son suivant quand le morceau se termine |
| **Import playlists perso** | L'hôte peut injecter toute une playlist dans la file d'attente |
| **Capacité portée à 50** | MAX_PARTICIPANTS passe de 12 → 50 |
| **Chrono du live** | Durée de la session affichée en temps réel (hh:mm:ss) |
| **Screen Wake Lock** | Écran mobile ne s'éteint plus quand on est hôte |
| **Upload fichier 80 Mo** | Limite augmentée + types MIME audio complets |
| **Bottom sheet mobile** | Panneau invités/file/contrôles glisse depuis le bas (plus de plein écran) |
| **BottomNav masqué** | Menu mobile masqué sur `/live/:roomId` pour une immersion totale |
| **Voyant VERT en live** | Indicateur dynamique : vert si live actif, rouge si aucun |
| **16 réactions emoji** | Palette élargie de 12 → 16 emojis flottants |
| **Historique lives** | Table `live_room_history` — archive chaque session terminée |

### 📱 ArtistProfilePage — Responsive Mobile

| Fix | Détail |
|---|---|
| **Padding bottom corrigé** | `pb-40` mobile = AudioPlayer + BottomNav, plus aucun contenu masqué |
| **Banner adaptative** | `h-36` sur mobile, `h-48` tablette, `h-64` desktop |
| **Avatar redimensionné** | `w-20` mobile → `w-28` sm → `w-32` md |
| **Onglets scrollables** | `overflow-x-auto` + `scrollbar-hide` — aucun onglet rogné |
| **Boutons flex-wrap** | Actions empilées proprement sur petit écran |
| **Textes responsifs** | Toutes les tailles `text-xs sm:text-sm`, icônes `w-3 sm:w-3.5` |
| **Badge live VERT** | Voyant vert si l'artiste a un live actif (plus de rouge) |
| **Bug setSongs supprimé** | Hook appelé hors scope dans `ArtistShareModal` — corrigé |
| **useEffect dupliqué** | Les deux `useEffect([id])` fusionnés en un seul |

### BottomNav — Voyant dynamique

| Fonctionnalité | Détail |
|---|---|
| **Polling Supabase** | Vérifie les lives actifs toutes les 30 secondes |
| **Realtime Postgres** | Réagit immédiatement à tout changement dans `live_rooms` |
| **Voyant vert animé** | Au moins un live public actif → `bg-green-400 animate-pulse` |
| **Voyant rouge fixe** | Aucun live → `bg-red-500` |

### Edge Function `send-push-notification`

| Fix | Détail |
|---|---|
| **`live_started` supporté** | Alias ajouté dans `URGENCY_MAP` et `TTL_MAP` (urgency `high`, TTL `1h`) |

---

## ✨ Historique des versions précédentes

<details>
<summary><strong>V60000 — Personnalisation & Communauté</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs dédié avec filtres par type, groupes date, actions rapides |
| **Badge notifications** | BottomNav affiche le compteur de notifs non lues |
| **Badge Live artiste** | ArtistProfilePage affiche "🔴 EN LIVE" si l'artiste a une salle active |
| **Trending searches** | SearchPage affiche les 8 recherches populaires des 24h |
| **Log recherches** | `search_logs` table + vue `trending_searches` |
| **notifyAll broadcast** | 1 seul appel edge function si pas d'exclusions (N→1) |
| **chat_reactions** | Table + RLS + realtime |
| **user_achievements** | Table + RLS |
| **songs.mood** | Colonne humeur sur les sons |
| **10 achievements** | first_upload, hundred_plays, chart_topper, etc. |
| **grant_achievement()** | Fonction SQL idempotente |
| **purge_old_search_logs()** | Auto-nettoyage search_logs > 7j |

</details>

<details>
<summary><strong>V41000 — Edge Function Push & Live Rooms V1</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Retry logic push** | 3 tentatives, backoff exponentiel 300ms/600ms |
| **Concurrence limitée** | Max 10 envois parallèles |
| **Mode broadcast** | `broadcast: true` → notifie tous les abonnés |
| **Urgency / TTL dynamiques** | high pour mentions/live, low pour likes/news |
| **Idempotency guard** | Guard via `notif_id` → pas de double envoi |
| **Delivery tracking** | Logs dans `push_notification_logs` |
| **File d'attente Live** | L'hôte ajoute des sons, diffusion automatique |
| **Indicateur de frappe** | Realtime dans le chat |
| **Panneau mobile** | Drawer accessible sur mobile |
| **12 réactions emoji** | Emoji flottants dans la salle |

</details>

---

## 🏗️ Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Animation | Framer Motion |
| Backend | Supabase (Postgres + Realtime + Storage + Auth) |
| Notifications Push | Edge Function Deno (VAPID + Web Push) |
| Déploiement | Vercel |

---

## 🚀 Installation

```bash
cd web
npm install
cp .env.example .env   # renseigne tes clés Supabase
npm run dev
```

### Variables d'environnement

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Base de données

### Migrations — ordre d'exécution

Lance **dans l'ordre** dans le SQL Editor de Supabase :

```
1. novasound-v40000-migration.sql   ← base initiale
2. novasound-v41000-migration.sql   ← push notifications
3. novasound-v50000-migration.sql   ← live rooms V1
4. novasound-v60000-migration.sql   ← communauté & achievements
5. novasound-v100000-migration.sql  ← live rooms 2.0 ← DERNIÈRE
```

> Chaque migration est **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).

### Tables principales

| Table | Rôle |
|---|---|
| `users` | Profils utilisateurs |
| `songs` | Catalogue musical |
| `playlists` / `playlist_songs` | Playlists personnelles |
| `live_rooms` | Salles live actives |
| `live_room_messages` | Chat en salle |
| `live_room_queue` | File d'attente de sons |
| `live_room_history` | **[V100000]** Archive des sessions terminées |
| `push_subscriptions` | Abonnements notifications push |
| `push_notification_logs` | Historique livraisons push |
| `notifications` | Centre de notifications |
| `user_achievements` | Badges débloqués par utilisateur |
| `achievement_definitions` | Catalogue des badges |
| `search_logs` | Historique des recherches |

### Nouvelles colonnes V100000 sur `live_rooms`

| Colonne | Type | Description |
|---|---|---|
| `current_audio_url` | text | URL du son en cours (fichiers locaux compris) |
| `peak_participants` | integer | Record de participants simultanés |
| `total_songs_played` | integer | Nombre de sons diffusés dans la session |
| `started_at` | timestamptz | Début de la session live |

---

## 📡 Edge Functions Supabase

### `send-push-notification`

Envoie une notification Web Push (VAPID) à un utilisateur ou en broadcast.

**Variables d'env Supabase :**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ton@email.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Types de notification supportés et leur urgence :**

| Type | Urgence | TTL |
|---|---|---|
| `live_started` / `live_start` | high | 1h |
| `chat_reply` / `chat_mention` | high | 24h |
| `comment` / `follow` / `new_song` | normal | 7j |
| `like` / `repost` / `mood_vote` | low | 7j |
| `news` | low | 30j |

**Déploiement :**
```bash
supabase functions deploy send-push-notification
```

---

## 📱 PWA

L'application est installable sur Android et iOS (via Safari).  
L'APK Android est disponible dans `web/public/`.

---

## 🔐 Sécurité

- Row Level Security (RLS) activée sur toutes les tables
- Authentification Supabase Auth (email + OAuth)
- Push notifications chiffrées (AES-128-GCM + ECDH P-256)
- Edge Function protégée par `Authorization: Bearer <service_role_key>`
- Bucket `live-room-audio` : lecture publique, écriture authentifiée uniquement

---

## 🏆 Système de succès (Achievements)

| Code | Label | Points | Rareté |
|---|---|---|---|
| `first_upload` | Premier son | 10 | Commun |
| `hundred_plays` | 100 écoutes | 25 | Commun |
| `chart_topper` | Top tendances | 75 | Épique |
| `first_live` | Premier Live | 15 | Commun |
| `live_host` | Hôte confirmé | 50 | Rare |
| `live_marathon` | Marathon Live | 75 | Épique |
| `live_social` | Rassembleur | 100 | Légendaire |

---

## 📄 Licence

MIT — © EloadX Family
