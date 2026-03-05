# 🎵 NovaSound TITAN LUX — V200000

> Plateforme de streaming musical sociale, propulsée par Supabase & React.  
> Version **V200000** — *Desktop Sidebar · Full FR/EN Translation · Responsive · Live UX · PWA Polish*

---


## ✨ Nouveautés V200000 — "Desktop Sidebar · Full Translation · Responsive · Live UX · PWA Polish"

### 🖥️ Layout Desktop (style Spotify)

| Amélioration | Détail |
|---|---|
| **Sidebar gauche permanente** | `DesktopSidebar` fixe sur `md+` — nav complète, voyant live, badge notifications, user/logout |
| **Contenu plein écran** | `ns-layout` flex — sidebar 224px + `ns-content` qui occupe tout l'espace restant |
| **Suppression des max-w restrictifs** | `.container` → `max-w: 100%` sur desktop, plus de marges vides |
| **AudioPlayer offset sidebar** | Barre fixe : `md:left-56` — ne passe plus sous la sidebar |
| **LocalPlayer responsive** | `max-w-4xl` centré + `px-8` sur desktop, fin du `max-w-xl` étriqué |
| **Grille cards dense** | `auto-fill minmax(170→210px)` selon largeur d'écran |

### 🌐 Traduction FR / EN complète (tout le site + PWA)

| Élément | Détail |
|---|---|
| **LangContext** | 200+ clés couvrant nav, player, live rooms, leaderboard, chat, playlists, profil, lecteur local, notifications, auth |
| **Toggle discret** | Globe dans la sidebar desktop, dans le menu mobile Header, et `LangToggle` flottant sur Login/Signup |
| **Pages traduites** | Header, BottomNav, DesktopSidebar, LiveRoomPage, LeaderboardPage, ChatPage, LocalPlayerPage, NotificationsPage, HomePage, SearchPage, ArtistsPage, TrendingPage, NewsPage |
| **Persistance** | Choix sauvegardé dans `localStorage` + colonne `users.preferred_lang` en base |

### 📱 Live Room — Zone de saisie corrigée

| Fix | Détail |
|---|---|
| **Input zone safe** | Classe `ns-live-input` : `padding-bottom: env(safe-area-inset-bottom)` — plus de superposition player/clavier |
| **Desktop** | Padding minimal sur `md+`, aucune interférence avec le player |

### 🔧 Bouton Installer — PC supprimé

| Fix | Détail |
|---|---|
| **InstallBanner** | Desktop banner entièrement supprimé |
| **Header** | Bouton install limité à `md:block lg:hidden` (tablette uniquement) |
| **CSS** | `.ns-install-btn` caché à `≥1024px` |

---

## ✨ Historique — V110000

### 🎙️ Live Rooms — Corrections & nouvelles fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| **Zone de saisie visible sur mobile** | `BottomNav` retourne `null` sur `/live/:roomId` — la zone de saisie n'est plus masquée par le menu du bas |
| **Notifications join/leave discrètes** | Floating toast pill (3s auto-disparition) en haut du chat — le fil de messages n'est plus pollué |
| **Réactions sans auto-fermeture** | Le panneau emoji reste ouvert après chaque réaction — fermeture manuelle via le bouton ✕ intégré |
| **Pause / Resume par l'hôte** | Bouton Pause dans la barre supérieure. L'audio est mis en pause côté hôte, broadcast `live_pause` aux auditeurs, indicateur "En pause" visible par tous |
| **Partage lien dans le chat global** | Bouton "Partager dans le chat global" — insère un message `🔴 LIVE • [Nom]` avec lien cliquable dans `chat_messages` |
| **Notification push au démarrage** | `notifyFollowers()` déclenché à la création de la salle — tous les abonnés reçoivent une push `live_started` avec lien direct |

### 🏆 Hall of Fame — Refonte structurelle

| Onglet | Correction |
|---|---|
| **Auditeurs** | Source : `user_streaks.total_days`. ScoreKey correct, label "j écoutés", secondLabel "🔥 Xj de suite" per-row, lien profil `/artist/:id` |
| **Séries** | Source : `user_streaks` trié par `current_streak DESC`. ScoreKey correct, secondLabel "record : Xj · total : Xj", `myStreakRank` calculé |
| **Podium** | Unifié sur tous les onglets — fonctionne pour Auditeurs et Séries |
| **Ma position** | Étendu aux onglets Auditeurs et Séries avec message contextuel correct |

### 💬 Chat Global

| Fix | Détail |
|---|---|
| **Liens live cliquables** | `renderContent` détecte les URLs `https://...` et `#/live/...` et les rend en `<a>` cliquables avec label "🔴 Rejoindre le live" |

### 🗄️ Migration SQL V110000

| Objet | Description |
|---|---|
| `live_rooms.is_paused` | Nouvelle colonne boolean — état pause de la session |
| `trg_reset_live_pause` | Trigger : remet `is_paused = false` quand le live se termine |
| `idx_user_streaks_current_streak` | Index tri Séries |
| `idx_user_streaks_total_days` | Index tri Auditeurs |
| `idx_chat_messages_created_at` | Index pour messages de partage live |
| `leaderboard_listeners` | Vue Auditeurs depuis `user_streaks JOIN users` triée par `total_days` |
| `leaderboard_streaks` | Vue Séries depuis `user_streaks JOIN users` triée par `current_streak` |

---

## ✨ Historique des versions

<details>
<summary><strong>V100000 — Live Rooms 2.0 · Sync Audio · Mobile UX</strong></summary>

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
| **Bottom sheet mobile** | Panneau invités/file/contrôles glisse depuis le bas |
| **Voyant VERT en live** | Indicateur dynamique : vert si live actif, rouge si aucun |
| **16 réactions emoji** | Palette élargie de 12 → 16 emojis flottants |
| **Historique lives** | Table `live_room_history` — archive chaque session terminée |
| **Edge Function `live_started`** | Alias dans `URGENCY_MAP` et `TTL_MAP` (urgency `high`, TTL `1h`) |

</details>

<details>
<summary><strong>V60000 — Personnalisation & Communauté</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs dédié avec filtres par type, groupes date, actions rapides |
| **Badge notifications** | BottomNav affiche le compteur de notifs non lues |
| **Badge Live artiste** | ArtistProfilePage affiche "🔴 EN LIVE" si l'artiste a une salle active |
| **Trending searches** | SearchPage affiche les 8 recherches populaires des 24h |
| **notifyAll broadcast** | 1 seul appel edge function si pas d'exclusions (N→1) |
| **chat_reactions** | Table + RLS + realtime |
| **user_achievements** | Table + RLS |
| **songs.mood** | Colonne humeur sur les sons |
| **10 achievements** | first_upload, hundred_plays, chart_topper, etc. |

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
| `user_achievements` | Badges débloqués par utilisateur |
| `chat_messages` | Chat global |
| `search_logs` | Historique des recherches |

### Nouvelles colonnes V110000

| Table | Colonne | Type | Description |
|---|---|---|---|
| `live_rooms` | `is_paused` | boolean | Live mis en pause par l'hôte |

### Vues V110000

| Vue | Description |
|---|---|
| `leaderboard_listeners` | Top auditeurs par `total_days` (join `users` + `user_streaks`) |
| `leaderboard_streaks` | Top séries par `current_streak` (join `users` + `user_streaks`) |

---

## 📡 Edge Functions Supabase

### `send-push-notification` — V110000

Envoie une notification Web Push (VAPID) à un utilisateur ou en broadcast.

**Variables d'env Supabase :**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ton@email.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
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
