# 🎵 NovaSound TITAN LUX — V200000

> Plateforme de streaming musical sociale, propulsée par Supabase & React.  
> Version **V200000** — *Desktop Sidebar · Traduction FR/EN · Responsive · Live UX · PWA Polish*

---

## ✨ Nouveautés V200000

### 🖥️ Layout Desktop (style Spotify)

| Amélioration | Détail |
|---|---|
| **Sidebar gauche permanente** | `DesktopSidebar` fixe sur `md+` — nav complète, voyant live, badge notifications, user/logout |
| **Contenu plein écran** | `ns-layout` flex — sidebar 224px + `ns-content` occupe tout l'espace restant |
| **Suppression des max-w restrictifs** | `.container` → `max-width: 100%` sur desktop, plus de marges vides |
| **AudioPlayer offset sidebar** | Barre fixe : `md:left-56` — ne passe plus sous la sidebar |
| **LocalPlayer responsive** | `max-w-4xl` centré + `px-8` sur desktop, fin du `max-w-xl` étriqué |
| **Grille cards dense** | `auto-fill minmax(170→210px)` selon largeur d'écran (lg/xl/2xl) |

### 🌐 Traduction FR / EN — tout le site + PWA

| Élément | Détail |
|---|---|
| **LangContext** | 200+ clés : nav, player, live rooms, leaderboard, chat, playlists, profil, lecteur local, notifications, auth |
| **Toggle globe discret** | Sidebar desktop · menu mobile Header · `LangToggle` flottant sur Login/Signup |
| **Pages couvertes** | Header, BottomNav, DesktopSidebar, LiveRoomPage, LeaderboardPage, ChatPage, LocalPlayerPage, NotificationsPage, HomePage, SearchPage, ArtistsPage, TrendingPage, NewsPage |
| **Persistance** | Choix sauvegardé dans `localStorage` + colonne `users.preferred_lang` en base |

### 📱 Live Room — Zone de saisie corrigée

| Fix | Détail |
|---|---|
| **Input safe area** | Classe `ns-live-input` — `padding-bottom: env(safe-area-inset-bottom)`, plus de superposition clavier/player |
| **Desktop** | Padding minimal sur `md+`, aucune interférence avec le player |

### 🔧 Bouton Installer — supprimé sur PC

| Fix | Détail |
|---|---|
| **InstallBanner** | Desktop banner entièrement supprimé |
| **Header** | Bouton install limité à `md:block lg:hidden` (tablette uniquement) |
| **CSS** | `.ns-install-btn` masqué à `≥1024px` |

### 🔔 Edge Function — Auth guard corrigé (401 fix)

| Fix | Détail |
|---|---|
| **Guard ANON_KEY** | Accepte désormais `service_role_key` ET `anon_key` — fin des 401 sur les push notifications |
| **ANON_KEY hardcodée** | Fallback intégré dans la fonction si la variable d'env n'est pas définie |

### 🗄️ Migration SQL V200000

| Objet | Description |
|---|---|
| `users.preferred_lang` | Nouvelle colonne `varchar(2)` — langue préférée de l'utilisateur (`fr` / `en`) |
| `app_meta` | Version mise à jour → `200000` |

---

## ✨ Historique — V110000

### 🎙️ Live Rooms

| Fonctionnalité | Détail |
|---|---|
| **Zone de saisie mobile** | `BottomNav` masqué sur `/live/:roomId` — input toujours visible |
| **Toast join/leave** | Pill flottant 3s, non-intrusif, ne pollue plus le chat |
| **Réactions manuelles** | Panneau emoji reste ouvert — fermeture via ✕ |
| **Pause / Resume hôte** | Bouton pause · broadcast `live_pause` · indicateur "En pause" |
| **Partage dans le chat global** | Lien live cliquable inséré dans `chat_messages` |
| **Push au démarrage** | `notifyFollowers()` → push `live_started` à tous les abonnés |

### 🏆 Hall of Fame

| Onglet | Correction |
|---|---|
| **Auditeurs** | Source `user_streaks.total_days`, label correct, secondLabel per-row |
| **Séries** | Source `user_streaks` trié par `current_streak DESC`, `myStreakRank` calculé |

### 💬 Chat Global

| Fix | Détail |
|---|---|
| **Liens live cliquables** | `renderContent` linkifie `https://...` et `#/live/...` → "🔴 Rejoindre le live" |

### 🗄️ Migration SQL V110000

| Objet | Description |
|---|---|
| `live_rooms.is_paused` | Boolean — état pause |
| `trg_reset_live_pause` | Trigger reset à la fermeture du live |
| `leaderboard_listeners` | Vue Auditeurs |
| `leaderboard_streaks` | Vue Séries |

---

## ✨ Historique des versions

<details>
<summary><strong>V100000 — Live Rooms 2.0 · Sync Audio · Mobile UX</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Sync audio précise** | Seuil de recalibration 2s, lag réseau compensé |
| **Indicateur qualité sync** | Jauge 0–100 % (vert / orange / rouge) |
| **Auto-advance queue** | Passage automatique au son suivant |
| **Import playlists perso** | L'hôte injecte une playlist dans la file |
| **Capacité portée à 50** | MAX_PARTICIPANTS 12 → 50 |
| **Chrono du live** | Durée hh:mm:ss en temps réel |
| **Screen Wake Lock** | Écran mobile ne s'éteint plus |
| **Upload 80 Mo** | Limite augmentée + MIME audio complets |
| **Bottom sheet mobile** | Drawer depuis le bas |
| **Voyant VERT live** | Vert si live actif, rouge sinon |
| **16 réactions emoji** | Palette 12 → 16 |
| **Historique lives** | Table `live_room_history` |

</details>

<details>
<summary><strong>V60000 — Personnalisation & Communauté</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs avec filtres et actions rapides |
| **Badge notifications** | BottomNav affiche le compteur |
| **Trending searches** | 8 recherches populaires des 24h |
| **notifyAll broadcast** | 1 seul appel edge si pas d'exclusions |
| **chat_reactions** | Table + RLS + realtime |
| **user_achievements** | Table + RLS + 10 achievements |
| **songs.mood** | Colonne humeur |

</details>

<details>
<summary><strong>V41000 — Edge Function Push & Live Rooms V1</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Retry logic push** | 3 tentatives, backoff 300ms/600ms |
| **Concurrence limitée** | Max 10 envois parallèles |
| **Mode broadcast** | 1 appel pour tous les abonnés |
| **Urgency / TTL dynamiques** | high / normal / low selon type |
| **Idempotency guard** | Pas de double envoi via `notif_id` |
| **Delivery tracking** | Logs dans `push_notification_logs` |

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
1. novasound-v40000-migration.sql    ← base initiale
2. novasound-v41000-migration.sql    ← push notifications
3. novasound-v50000-migration.sql    ← live rooms V1
4. novasound-v60000-migration.sql    ← communauté & achievements
5. novasound-v100000-migration.sql   ← live rooms 2.0
6. novasound-v110000-migration.sql   ← live pause / leaderboard / push
7. novasound-v200000-migration.sql   ← desktop layout / i18n / responsive   ← DERNIERE
```

> Chaque migration est **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE`, `DROP VIEW IF EXISTS`).

### Tables principales

| Table | Rôle |
|---|---|
| `users` | Profils utilisateurs |
| `songs` | Catalogue musical |
| `playlists` / `playlist_songs` | Playlists personnelles |
| `live_rooms` | Salles live actives |
| `live_room_messages` | Chat en salle |
| `live_room_queue` | File d'attente de sons |
| `live_room_history` | Archive des sessions terminées |
| `user_streaks` | Séries d'écoute quotidiennes |
| `push_subscriptions` | Abonnements notifications push |
| `push_notification_logs` | Historique livraisons push |
| `notifications` | Centre de notifications |
| `user_achievements` | Badges débloqués |
| `chat_messages` | Chat global |
| `search_logs` | Historique des recherches |

### Nouvelles colonnes

| Version | Table | Colonne | Type | Description |
|---|---|---|---|---|
| V110000 | `live_rooms` | `is_paused` | boolean | Live en pause |
| V200000 | `users` | `preferred_lang` | varchar(2) | Langue préférée (`fr` / `en`) |

### Vues V110000

| Vue | Description |
|---|---|
| `leaderboard_listeners` | Top auditeurs par `total_days` |
| `leaderboard_streaks` | Top séries par `current_streak` |

---

## 📡 Edge Functions Supabase

### `send-push-notification` — V200000

Envoie une notification Web Push (VAPID) à un utilisateur ou en broadcast.

**Variables d'env Supabase :**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ton@email.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

**Types de notification supportés :**

| Type | Urgence | TTL |
|---|---|---|
| `live_started` / `live_start` | high | 1h |
| `chat_reply` / `chat_mention` / `chat_mention_all` | high | 24h |
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
Le bouton d'installation est masqué sur PC (desktop ≥ 1024px).

---

## 🔐 Sécurité

- Row Level Security (RLS) activée sur toutes les tables
- Authentification Supabase Auth (email + OAuth)
- Push notifications chiffrées (AES-128-GCM + ECDH P-256)
- Edge Function : accepte `service_role_key` ET `anon_key`
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
