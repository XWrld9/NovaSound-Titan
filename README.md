# 🎵 NovaSound TITAN LUX — V300000

> Plateforme de streaming musical sociale, PWA-first, propulsée par **Supabase & React**.  
> **V300000** — *Internationalisation complète (5 langues) · Responsivité PC totale · Lecteur local Spotify-like · Auth split-layout · Scrollbars globales supprimées*

[![Version](https://img.shields.io/badge/version-300.0.0-cyan)](https://github.com) [![React](https://img.shields.io/badge/React-18-blue)](https://react.dev) [![Supabase](https://img.shields.io/badge/Supabase-2.49-green)](https://supabase.com) [![i18n](https://img.shields.io/badge/i18n-5%20langues-purple)](https://www.i18next.com)

---

## ✨ Nouveautés V300000

### 🌍 Internationalisation complète — i18next (5 langues)

Le système de traduction couvre désormais **100% de l'interface**. Plus un seul texte visible en dur dans le code.

| Langue | Code | Statut |
|--------|------|--------|
| 🇫🇷 Français | `fr` | ✅ Complet — langue par défaut |
| 🇬🇧 Anglais | `en` | ✅ Complet |
| 🇮🇹 Italien | `it` | ✅ Complet |
| 🇪🇸 Espagnol | `es` | ✅ Complet |
| 🇵🇹 Portugais | `pt` | ✅ Complet |

**Clés de traduction — couverture V300000 :**

| Namespace | Clés | Couverture |
|-----------|------|------------|
| `nav.*` | 20 | Navigation (Header + BottomNav) |
| `auth.*` | 29 | Login, Signup, Reset Password |
| `nowplaying.*` | 17 | NowPlayingScreen |
| `home.*` | 16 | HomePage (hero, sections, états vides) |
| `explorer.*` | 11 | ExplorerPage (filtres, tri, résultats) |
| `trending.*` | 10 | TrendingPage |
| `search.*` | 10 | SearchPage |
| `song.*` | 8 | SongPage |
| `live.*` | 11 | LiveRoomPage |
| `chat.*` | 6 | ChatPage |
| `upload.*` | 11 | MusicUploadPage |
| `playlists.*` | 9 | MyPlaylistsPage |
| `leaderboard.*` | 8 | LeaderboardPage |
| `notifications.*` | 9 | NotificationsPage |
| `artist.*` | 11 | ArtistProfilePage |
| `comments.*` | 10 | CommentSection |
| `songCard.*` | 6 | SongCard |
| `footer.*` | 7 | Footer |
| `offline.*` | 3 | OfflineBanner |
| `common.*` | 20 | Éléments partagés |

**Détection automatique :** La langue est détectée depuis le navigateur au premier lancement.  
**Sélecteur :** `LanguageSwitcher` disponible partout — dropdown sur desktop, mode inline dans le menu mobile.

---

### 🖥️ Responsivité PC — Refonte totale

Chaque page utilise désormais **tout l'espace disponible** sur grand écran. Fini le look "application mobile centrée".

#### Layout global
- Tous les conteneurs : `max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12` (remplace `container mx-auto`)
- Suppression de toutes les contraintes `max-w-md`, `max-w-xl`, `max-w-3xl` qui tronquaient l'affichage

#### Pages avec layout 2 colonnes (desktop `lg:`)

| Page | Layout desktop |
|------|----------------|
| **LoginPage** | Colonne gauche : brand animé (dégradé + dots + feature badges) / Colonne droite : formulaire |
| **SignupPage** | Colonne gauche : brand fuchsia + liste des features / Colonne droite : formulaire d'inscription |
| **ResetPasswordPage** | Colonne gauche : brand décoratif / Colonne droite : formulaire reset |

#### NowPlayingScreen — Layout Spotify
- **Mobile :** Inchangé — colonne verticale plein écran
- **Desktop (`md:`) :** 2 colonnes — pochette à gauche (`md:w-1/2`), tous les contrôles à droite
- Pochette : `max-w-[360px] lg:max-w-[420px] xl:max-w-[460px]`
- Boutons transport élargis : `md:w-11 md:h-11`
- Bouton play : `md:w-24 md:h-24`

#### LocalPlayerPage — Layout Sidebar Spotify
- **Mobile :** Onglets (Lecteur / Fichiers / Playlists) — inchangé
- **Desktop (`md:`) :** Sidebar gauche fixe (`md:w-72 lg:w-80 xl:w-96`) + Panneau droit scrollable
  - Sidebar : pochette grand format, info, SeekBar, transport complet, volume slider — toujours visible
  - Panneau droit : liste des fichiers, gestion des playlists
  - Le player mobile (carte) est masqué sur desktop (`md:hidden`)

#### AudioPlayer (lecteur online)
- Expanded view : colonne contrôles `max-w-xl lg:max-w-2xl xl:max-w-3xl` (était `max-w-sm`)
- Padding élargis : `xl:px-32`
- Barre desktop : `max-w-screen-2xl mx-auto` — occupe toute la largeur

---

### 📜 Scrollbars — Suppression globale

CSS global dans `index.css` :
```css
::-webkit-scrollbar { width: 0; height: 0; background: transparent; }
* { scrollbar-width: none; -ms-overflow-style: none; }
```
Plus aucune scrollbar visible sur toute la plateforme. Le scroll reste fonctionnel.

---

### 🔐 Pages Auth — Redesign complet

**LoginPage :**
- Split layout 2 panneaux sur `lg:` (colonne gauche 50/60% brand, droite formulaire)
- Mode "Mot de passe oublié" intégré directement dans la page (pas de redirection)
- Renvoi email de confirmation si compte non vérifié
- `LanguageSwitcher` intégré (desktop : panneau gauche / mobile : coin haut-droit)
- 100% traduit

**SignupPage :**
- Split layout 2 panneaux (colonne gauche : brand fuchsia + feature list)
- Anti double-submit (iOS Safari fix)
- Cooldown 60s sur rate limit avec compte à rebours visuel
- Username auto-sanitization (espaces supprimés en temps réel)
- 100% traduit

**ResetPasswordPage :**
- Split layout ajouté sur `lg:`
- Indicateur de force du mot de passe (5 niveaux : Très faible → Très fort)

---

## ✨ Historique des versions

<details>
<summary><strong>V200000 — i18next · PWA Install · PC Responsivité V1</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **i18next setup** | Fichiers `fr/en/it/es/pt.json`, auto-détection navigateur, namespace `translation` |
| **LanguageSwitcher** | Composant dropdown + mode inline mobile |
| **Install PWA** | Bouton d'installation visible uniquement sur mobile (masqué sur desktop) |
| **PC Responsivité V1** | AudioPlayer desktop bar 3 colonnes, SearchPage élargie |
| **LiveRoomPage input fix** | Zone de saisie mobile non masquée par BottomNav |
| **Version** | 200.0.0 |

</details>

<details>
<summary><strong>V110000 — Live Pause · Push Notifs · Leaderboard Fix · Mobile UX</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Zone de saisie visible mobile** | `BottomNav` retourne `null` sur `/live/:roomId` |
| **Notifications join/leave discrètes** | Floating toast pill (3s) — fil de messages propre |
| **Réactions sans auto-fermeture** | Panneau emoji reste ouvert après chaque réaction |
| **Pause / Resume par l'hôte** | Broadcast `live_pause` aux auditeurs, indicateur "En pause" |
| **Partage lien dans le chat global** | Bouton "Partager dans le chat global" → message `🔴 LIVE` cliquable |
| **Notification push au démarrage** | `notifyFollowers()` à la création de salle |
| **Hall of Fame — Refonte** | Sources correctes pour Auditeurs (`total_days`) et Séries (`current_streak`) |
| **Chat — Liens live cliquables** | `renderContent` détecte URLs et `#/live/...` |
| **SQL** | `live_rooms.is_paused`, trigger reset, vues `leaderboard_listeners/streaks`, index |

</details>

<details>
<summary><strong>V100000 — Live Rooms 2.0 · Sync Audio · Mobile UX</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Sync audio précise** | Seuil recalibration 2s, lag réseau compensé |
| **Indicateur qualité sync** | Jauge 0–100 % (vert/orange/rouge) |
| **Auto-advance queue** | Passage automatique au son suivant |
| **Import playlists perso** | L'hôte injecte une playlist dans la file |
| **Capacité 50 participants** | MAX_PARTICIPANTS 12 → 50 |
| **Chrono du live** | Durée session temps réel (hh:mm:ss) |
| **Screen Wake Lock** | Écran mobile allumé côté hôte |
| **Upload 80 Mo** | Limite augmentée + MIME audio complets |
| **Bottom sheet mobile** | Panneau glisse depuis le bas |
| **Voyant VERT live** | Indicateur dynamique BottomNav |
| **16 réactions emoji** | Palette 12 → 16 |
| **Historique lives** | Table `live_room_history` |
| **SQL** | `live_room_history`, fonctions cleanup, index optimisés |

</details>

<details>
<summary><strong>V60000 — Personnalisation & Communauté</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs avec filtres, groupes date, actions rapides |
| **Badge notifications** | BottomNav — compteur temps réel |
| **Badge Live artiste** | ArtistProfilePage affiche "🔴 EN LIVE" |
| **Trending searches** | SearchPage — 8 recherches populaires 24h |
| **notifyAll broadcast** | 1 appel edge function (optimisation N→1) |
| **10 achievements** | `first_upload`, `hundred_plays`, `chart_topper`, etc. |
| **SQL** | `chat_reactions`, `user_achievements`, `song_moods`, `search_logs` |

</details>

<details>
<summary><strong>V41000 — Edge Function Push & Live Rooms V1</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Retry logic push** | 3 tentatives, backoff 300ms/600ms |
| **Concurrence limitée** | Max 10 envois parallèles |
| **Urgency / TTL dynamiques** | `high` pour mentions/live, `low` pour likes |
| **Idempotency guard** | `notif_id` → pas de double envoi |
| **Delivery tracking** | Logs dans `push_notification_logs` |
| **File d'attente Live** | Hôte ajoute des sons, diffusion auto |
| **SQL** | `push_notification_logs`, index push, fonctions push |

</details>

<details>
<summary><strong>V40000 — Base initiale · PWA · Auth · Upload · Streaming</strong></summary>

| Fonctionnalité | Détail |
|---|---|
| **Auth complète** | Supabase Auth (email/password + reset), profil utilisateur |
| **Upload audio** | Fichiers jusqu'à 80 Mo, metadata automatique |
| **Streaming** | Lecture en ligne avec AudioPlayer complet |
| **Live Rooms V1** | Salles publiques/privées, chat, réactions emoji |
| **PWA** | Manifest, Service Worker, installation Android/iOS |
| **Push Notifications** | VAPID, Web Push API |
| **RLS complet** | Row Level Security sur toutes les tables |
| **SQL** | Schéma initial complet — 15+ tables, RLS, index |

</details>

---

## 🏗️ Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React | 18.2 |
| Bundler | Vite | 4.4 |
| CSS | Tailwind CSS | 3.3 |
| Animation | Framer Motion | 10.16 |
| Routing | React Router | 6.8 |
| Internationalisation | i18next + react-i18next | 23.7 / 14.0 |
| UI Composants | Radix UI (Slider, Toast, Slot) | 1.x |
| Icônes | Lucide React | 0.294 |
| Animations Lottie | lottie-react | 2.4 |
| Export image | html-to-image | 1.11 |
| Backend | Supabase (Postgres + Realtime + Storage + Auth) | 2.49 |
| Push Notifications | Edge Function Deno (VAPID + Web Push) | — |
| Déploiement | Vercel | — |

---

## 🧩 Architecture Composants

```
src/
├── pages/                    # 28 pages (toutes routées dans App.jsx)
│   ├── HomePage.jsx          # Accueil : sorties récentes, live, news, tendances
│   ├── ExplorerPage.jsx      # Exploration avec filtres genre/tri/recherche
│   ├── TrendingPage.jsx      # Sons + artistes tendances (24h/7j/30j)
│   ├── SearchPage.jsx        # Recherche sons, artistes, playlists
│   ├── ArtistProfilePage.jsx # Profil artiste : sons, reposts, stats, bio
│   ├── SongPage.jsx          # Page son individuelle : lecteur, commentaires, partage
│   ├── LiveRoomPage.jsx      # Live Rooms : hôte + auditeur, chat, réactions, sync
│   ├── ChatPage.jsx          # Chat global temps réel + DMs
│   ├── MusicUploadPage.jsx   # Upload son : metadata, cover, genre, mood
│   ├── UserProfilePage.jsx   # Profil utilisateur : sons, reposts, achievements
│   ├── LocalPlayerPage.jsx   # Lecteur local : FileSystem API, playlists IDB
│   ├── MyPlaylistsPage.jsx   # Gestion playlists personnelles
│   ├── LeaderboardPage.jsx   # Hall of Fame : sons, auditeurs, séries
│   ├── NotificationsPage.jsx # Centre de notifications avec filtres
│   ├── LoginPage.jsx         # Auth : login + mot de passe oublié (split layout PC)
│   ├── SignupPage.jsx        # Auth : inscription (split layout PC)
│   ├── ResetPasswordPage.jsx # Reset mot de passe (split layout PC)
│   ├── NewsPage.jsx          # Actualités de la plateforme
│   ├── ArtistStatsPage.jsx   # Dashboard statistiques artiste
│   ├── ArtistsPage.jsx       # Annuaire des artistes
│   ├── MessagesPage.jsx      # Messagerie privée
│   ├── PlaylistPage.jsx      # Page playlist publique
│   ├── AdminPanel.jsx        # Panneau admin (modération, stats)
│   └── ...                   # + pages légales, callback auth
│
├── components/               # 44 composants
│   ├── AudioPlayer.jsx       # Lecteur online : mini-bar + expanded + desktop bar
│   ├── NowPlayingScreen.jsx  # Plein écran local (layout 2 col PC)
│   ├── Header.jsx            # Navigation principale + recherche + auth
│   ├── BottomNav.jsx         # Navigation mobile fixe
│   ├── LanguageSwitcher.jsx  # Sélecteur de langue (dropdown + inline)
│   ├── SongCard.jsx          # Carte son réutilisable
│   ├── CommentSection.jsx    # Commentaires temps réel
│   ├── LiveRoomsWidget.jsx   # Widget lives actifs (HomePage)
│   ├── SpotlightCarousel.jsx # Carousel sons mis en avant
│   ├── NotificationBell.jsx  # Cloche + badge + dropdown notifs
│   ├── InstallBanner.jsx     # Bannière installation PWA (mobile only)
│   ├── OfflineBanner.jsx     # Bannière hors-ligne
│   ├── Footer.jsx            # Pied de page + liens + don
│   └── ...                   # + 30 composants utilitaires
│
├── contexts/                 # 7 contextes React
│   ├── AuthContext.jsx       # Auth Supabase : login/signup/logout/reset
│   ├── PlayerContext.jsx     # État global du lecteur : queue, shuffle, repeat
│   ├── NotificationContext.jsx # Compteur notifs non lues temps réel
│   ├── ChatContext.jsx       # État chat global
│   ├── MessageContext.jsx    # Messagerie privée
│   ├── OnlineContext.jsx     # Détection connexion réseau
│   └── PlaylistContext.jsx   # Playlists utilisateur
│
├── locales/                  # i18n — 5 langues × 25 namespaces
│   ├── fr.json  (🇫🇷 défaut)
│   ├── en.json  (🇬🇧)
│   ├── it.json  (🇮🇹)
│   ├── es.json  (🇪🇸)
│   └── pt.json  (🇵🇹)
│
└── hooks/
    ├── useGenreTheme.js      # Thème couleur selon le genre musical
    └── usePWAInstall.js      # Hook installation PWA (beforeinstallprompt)
```

---

## 🚀 Installation

```bash
git clone <repo>
cd NovaSound_V300000/web
npm install
cp .env.example .env   # renseigne tes clés Supabase
npm run dev
```

### Variables d'environnement

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Build production

```bash
npm run build
# → dist/ prêt pour Vercel, Netlify, ou tout hébergeur statique
```

---

## 🗄️ Base de données

### Migrations — ordre d'exécution strict

Lance **dans l'ordre** dans le SQL Editor de Supabase :

```
1. novasound-v40000-migration.sql    ← schéma base : users, songs, likes, comments, follows, live rooms V1, push notifs
2. novasound-v41000-migration.sql    ← push notification logs, retry logic, Edge Function support
3. novasound-v50000-migration.sql    ← streaks quotidiens, historique écoutes, achievements
4. novasound-v60000-migration.sql    ← chat reactions, song moods, search logs, achievements V2
5. novasound-v100000-migration.sql   ← live rooms 2.0 : historique, cleanup, index perf
6. novasound-v110000-migration.sql   ← live pause, vues leaderboard, index streaks   ← DERNIÈRE
```

> ✅ Chaque migration est **idempotente** — `IF NOT EXISTS`, `ON CONFLICT DO UPDATE`, `DROP VIEW IF EXISTS`.

### Tables principales

| Table | Rôle | Introduite |
|-------|------|-----------|
| `users` | Profils utilisateurs | V40000 |
| `songs` | Catalogue musical (titre, artiste, genre, mood, plays) | V40000 |
| `likes` | J'aime sur les sons | V40000 |
| `song_comments` | Commentaires sur les sons | V40000 |
| `song_reposts` | Repartages de sons | V40000 |
| `follows` | Abonnements artiste→artiste | V40000 |
| `playlists` / `playlist_songs` | Playlists personnelles | V40000 |
| `notifications` | Centre de notifications | V40000 |
| `push_subscriptions` | Abonnements push (VAPID) | V40000 |
| `live_rooms` | Salles live actives | V40000 |
| `live_room_messages` | Chat en salle live | V40000 |
| `live_room_queue` | File d'attente de sons en live | V40000 |
| `push_notification_logs` | Logs de livraison push | V41000 |
| `song_plays_history` | Historique d'écoutes (pour séries) | V50000 |
| `user_streaks` | Séries d'écoute quotidiennes | V50000 |
| `user_achievements` | Badges débloqués | V50000 |
| `chat_reactions` | Réactions sur messages chat | V60000 |
| `song_moods` | Votes humeur sur les sons | V60000 |
| `search_logs` | Recherches populaires | V60000 |
| `live_room_history` | Archive des sessions terminées | V100000 |

### Colonnes notables

| Table | Colonne | Type | Ajouté en |
|-------|---------|------|-----------|
| `live_rooms` | `is_paused` | boolean | V110000 |
| `songs` | `mood` | text | V60000 |
| `users` | `avatar_url`, `bio`, `website` | text | V40000 |

### Vues

| Vue | Source | Tri | Ajoutée en |
|-----|--------|-----|-----------|
| `leaderboard_listeners` | `users JOIN user_streaks` | `total_days DESC` | V110000 |
| `leaderboard_streaks` | `users JOIN user_streaks` | `current_streak DESC` | V110000 |

### Fonctions PostgreSQL

| Fonction | Description |
|----------|-------------|
| `record_play_event(song_id, user_id)` | Incrémente plays + met à jour les streaks |
| `award_achievement(user_id, type)` | Attribue un achievement si non déjà obtenu |
| `get_live_queue(room_id)` | Retourne la file triée d'une salle |
| `purge_inactive_live_rooms()` | Nettoie les salles expirées |
| `cleanup_expired_live_rooms()` | Version V100000 du nettoyage |
| `mark_notification_pushed(notif_id)` | Marque une notif comme envoyée en push |
| `purge_old_push_logs()` | Purge les logs push > 30j |
| `reset_live_pause_on_close()` | Trigger : remet `is_paused=false` à la fermeture |

---

## 📡 Edge Functions Supabase

### `send-push-notification`

Envoie une notification Web Push (VAPID) à un ou plusieurs utilisateurs.

**Variables d'env Supabase (à configurer dans le dashboard) :**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@novasound.app
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Types de notification et paramètres :**

| Type | Urgence | TTL | Déclencheur |
|------|---------|-----|-------------|
| `live_started` | high | 1h | Création d'une salle live |
| `chat_mention` / `chat_mention_all` | high | 24h | Mention dans le chat |
| `chat_reply` | high | 24h | Réponse à un message |
| `comment` | normal | 7j | Commentaire sur un son |
| `follow` | normal | 7j | Nouvel abonné |
| `new_song` | normal | 7j | Nouveau son d'un artiste suivi |
| `like` / `repost` | low | 7j | Interaction sur un son |
| `mood_vote` | low | 7j | Vote humeur |
| `news` | low | 30j | Actualité publiée |

**Déploiement :**
```bash
supabase functions deploy send-push-notification
```

---

## 📱 PWA

| Fonctionnalité | Détail |
|----------------|--------|
| **Installable Android** | `beforeinstallprompt` + bannière `InstallBanner` (mobile only) |
| **Installable iOS** | Instructions Safari via `AndroidInstallGuide` (détection UA) |
| **APK Android** | Fichier `web/public/NovaSound-TITAN-LUX.apk` fourni |
| **Service Worker** | `sw.js` — cache stratégie network-first |
| **Manifest** | `manifest.json` — icônes 192/512, `display: standalone` |
| **Offline** | Banner `OfflineBanner` détecte la déconnexion réseau |
| **Wake Lock** | Écran mobile reste allumé pendant un live (hôte) |

---

## 🎵 Lecteur Audio — Fonctionnalités complètes

### AudioPlayer (sons en ligne)

| Fonctionnalité | Détail |
|----------------|--------|
| **Mini-bar mobile** | Persistante, swipe-to-close, tap pour agrandir |
| **Expanded view** | Plein écran animé avec pochette, actions, queue |
| **Desktop bar** | 3 colonnes : info / contrôles / volume + actions |
| **Shuffle / Repeat** | Off / One / All avec indicateur visuel |
| **Vitesse de lecture** | 0.5× / 0.75× / 1× / 1.25× / 1.5× / 2× |
| **Sleep Timer** | 5 / 10 / 15 / 30 / 60 min |
| **Mode Radio** | Lecture infinie sans fin de queue |
| **File d'attente** | Ajout/suppression en temps réel |
| **Sons du mois** | Chargement automatique de la sélection mensuelle |
| **Media Session API** | Contrôles OS (lock screen, écouteurs) |
| **Raccourcis clavier** | `←` / `→` pour naviguer en expanded mode |
| **Persistance volume** | Sauvegardé dans `localStorage` |
| **Android/iOS unlock** | Déverrouillage AudioContext sur interaction |
| **Like / Repost / Follow** | Actions réseau directement depuis le player |
| **Partage** | `SongShareModal` intégré |
| **Playlist** | Ajout depuis `AddToPlaylistModal` |

### NowPlayingScreen (local + online, layout PC)

| Fonctionnalité | Détail |
|----------------|--------|
| **Layout desktop** | 2 colonnes : pochette gauche, contrôles droite |
| **IdleWave** | Animation canvas ondulation synchronisée à la lecture |
| **Seek bar** | currentTime / duration avec drag |
| **Volume slider** | Animé (AnimatePresence) |
| **Queue** | Liste déroulante en overlay |
| **Paroles** | Overlay défilant si disponibles |
| **Export** | Bouton export (html-to-image) |
| **Like / Repost / Share / Follow** | Masqués pour fichiers locaux |

### LocalPlayerPage (fichiers locaux, layout Sidebar PC)

| Fonctionnalité | Détail |
|----------------|--------|
| **FileSystem Access API** | Persistance handles dans IndexedDB (Chrome/Edge PC) |
| **Extraction ID3** | Titre, artiste, album, pochette APIC automatiques |
| **Génération cover SVG** | Couverture générative si pas de pochette ID3 |
| **Playlists IDB** | Multi-playlists sauvegardées hors-ligne dans IndexedDB |
| **Restauration auto** | Handles rechargés au démarrage (PC) |
| **Export M3U** | Export de playlist au format standard |
| **Layout Sidebar PC** | Sidebar gauche fixe avec player, liste des sons à droite |
| **Compatibilité mobile** | Interface tabbed (Lecteur / Fichiers / Playlists) |

---

## 🔐 Sécurité

| Couche | Mécanisme |
|--------|-----------|
| **Auth** | Supabase Auth — email + password, reset par email |
| **RLS** | Row Level Security activée sur toutes les tables |
| **Push** | Chiffrement AES-128-GCM + ECDH P-256 (Web Push standard) |
| **Edge Function** | Protégée par `Authorization: Bearer <service_role_key>` |
| **Storage** | Bucket `live-room-audio` : lecture publique, écriture auth uniquement |
| **Admin** | Routes protégées par `user_roles` (vérification côté serveur) |
| **Extension guard** | `ExtensionSafeWrapper` détecte les conflits d'extensions navigateur |

---

## 🏆 Système d'Achievements

| Code | Label | Points | Rareté | Déclencheur |
|------|-------|--------|--------|-------------|
| `first_upload` | Premier son | 10 | Commun | 1er upload validé |
| `hundred_plays` | 100 écoutes | 25 | Commun | 100 plays cumulés |
| `chart_topper` | Top tendances | 75 | Épique | Apparition dans les tendances |
| `first_live` | Premier Live | 15 | Commun | 1ère salle live créée |
| `live_host` | Hôte confirmé | 50 | Rare | 10 lives animés |
| `live_marathon` | Marathon Live | 75 | Épique | Live > 2h |
| `live_social` | Rassembleur | 100 | Légendaire | 50+ participants dans un live |

---

## 🛠️ Commandes utiles

```bash
# Développement local
npm run dev

# Build production
npm run build

# Preview build
npm run preview

# Setup buckets Supabase (1 seule fois)
npm run setup:buckets

# Deploy Edge Function
supabase functions deploy send-push-notification

# Lint
npm run lint
```

---

## 📄 Licence

MIT — © 2026 ELOADXFAMILY

---

*NovaSound TITAN LUX — Construit avec ❤️ par ELOADXFAMILY*
