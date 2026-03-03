# NovaSound TITAN LUX

> *Ici chaque écoute compte. Bienvenue dans la nouvelle ère de la musique digitale.*  
> **NovaSound-TITAN LUX — Votre scène, votre musique, votre communauté.**

Plateforme musicale nouvelle génération conçue pour connecter les créateurs et les passionnés de musique.

---

## 👨‍💻 Développeur & Fondateur

**Développeur Principal** : M. Tetang Tanekou M.N (EL_AX)  
**Fondateur & Vision** : M. Arthur Tidoh (XWrld)

---

## 🛠️ Stack Technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, Lucide React, Lottie React |
| Backend | Supabase (PostgreSQL + Auth + RLS + Storage + Realtime) |
| Email | Gmail SMTP (smtp.gmail.com:587 + App Password) |
| Déploiement | Vercel (frontend) + Supabase Cloud (backend) |

---

## 📦 Installation locale

### Prérequis
- **Node.js 20.x**
- **npm 9.x** ou supérieur
- Un projet [Supabase](https://supabase.com)

```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan/web
npm install
cp .env.example .env
# Remplir .env avec vos vraies clés
npm run dev
```

---

## ⚙️ Configuration Supabase

> Tous les scripts SQL se trouvent dans le dossier `web/`.  
> **⚠️ À partir de la v10000, utiliser uniquement `novasound-v10000-migration.sql` — il est idempotent et couvre tout.**

| Étape | Fichier | Ce que ça fait |
|-------|---------|----------------|
| 1–16 | *(anciens scripts)* | Base initiale — déjà appliqués si vous avez suivi les versions précédentes |
| **17** | **`novasound-v10000-migration.sql`** | **⚠️ Migration MASTER v10000 — à run impérativement** |

### Ce que fait `novasound-v10000-migration.sql` (idempotent)

- ✅ Colonnes `total_plays`, `total_likes`, `xp_points`, `last_seen`, `bio_url` sur `users`
- ✅ Colonne `is_deleted` (soft delete) + `description` sur `songs`
- ✅ Colonne `replies_count` sur `song_comments`
- ✅ Triggers sync automatique `total_plays` / `total_likes` / `followers_count`
- ✅ Recalcul initial de tous les compteurs existants
- ✅ Vues `trending_24h`, `trending_7d`, `trending_30d`, `spotlight_songs` (corrigées)
- ✅ Tables `user_streaks`, `song_moods`, `live_room_participants` + RLS
- ✅ RLS `user_roles`, `live_rooms`, `songs` harmonisés
- ✅ RPC `increment_plays()` sécurisée
- ✅ Realtime activé sur toutes les tables clés
- ✅ Indexes de performance ajoutés
- ✅ **Fix CRITIQUE** : contrainte `notifications.type` élargie à 10 types (`repost`, `chat_reply`, `chat_mention`, `chat_mention_all`, `mood_vote` n'étaient jamais enregistrés)
- ✅ Colonne `metadata` ajoutée sur `notifications`

### Buckets Storage (créer manuellement si pas encore fait)

| Bucket | Usage | Taille max | Accès |
|--------|-------|-----------|-------|
| `avatars` | Photos de profil | 5 MB | Public |
| `audio` | Fichiers audio | 50 MB | Public |
| `covers` | Pochettes d'albums | 10 MB | Public |

```bash
# Après avoir renseigné SUPABASE_SERVICE_KEY dans .env :
npm run setup:buckets
```

---

## 📧 Configuration Email (Gmail SMTP)

> Voir le guide complet : **`GMAIL_SMTP_SETUP.md`**

| Champ | Valeur |
|-------|--------|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `votre@gmail.com` |
| Password | Mot de passe d'application (16 caractères) |
| Sender name | `NovaSound TITAN LUX` |

Dans **Supabase → Authentication → URL Configuration** :
- Site URL : `https://votre-projet.vercel.app`
- Redirect URLs : `https://votre-projet.vercel.app/**` et `https://votre-projet.vercel.app/#/reset-password`

---

## 🚀 Déploiement Vercel

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node Version | `20.x` |

**Variables d'environnement Vercel :**
```
VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon
```

> ⚠️ Ne **jamais** mettre `SUPABASE_SERVICE_KEY` dans Vercel.

---

## 🧭 Routes

| URL | Page |
|-----|------|
| `/#/` | Accueil |
| `/#/explorer` | Explorer tous les sons |
| `/#/trending` | Tendances (24h / 7j / 30j) |
| `/#/artists` | Liste des artistes |
| `/#/leaderboard` | Classement artistes & sons |
| `/#/news` | Actualités communautaires |
| `/#/chat` | Chat global |
| `/#/live` | Live Rooms |
| `/#/profile` | Mon profil |
| `/#/artist/:id` | Profil public d'un artiste |
| `/#/upload` | Uploader un son |
| `/#/song/:id` | Page dédiée d'un morceau |
| `/#/local-player` | Lecteur fichiers locaux |
| `/#/login` | Connexion |
| `/#/signup` | Inscription |
| `/#/reset-password` | Réinitialisation mot de passe |
| `/#/admin` | Panneau admin (admin uniquement) |

> L'application utilise **HashRouter** pour éviter les erreurs 404 sur Vercel.

---

## 📁 Architecture

```
NovaSound-Titan/
├── GMAIL_SMTP_SETUP.md
├── CHROME_EXTENSION_FIX.md
├── PUSH_SETUP.md
└── web/
    ├── src/
    │   ├── components/
    │   │   ├── AudioPlayer.jsx          # Lecteur complet + raccourcis clavier
    │   │   ├── NotificationBell.jsx     # Panel notifs par catégorie + push
    │   │   ├── MoodVote.jsx             # Votes vibe crowd-sourcés
    │   │   ├── SpotlightCarousel.jsx    # Carrousel HomePage
    │   │   ├── SongCard.jsx             # Carte son avec animation lecture
    │   │   ├── Header.jsx               # Nav desktop + mobile
    │   │   ├── BottomNav.jsx            # Navigation mobile bas
    │   │   └── ...
    │   ├── contexts/
    │   │   ├── PlayerContext.jsx        # Lecteur global + queue + sleep timer
    │   │   ├── NotificationContext.jsx  # Notifs + push VAPID
    │   │   ├── AuthContext.jsx          # Auth + signup robuste
    │   │   └── ChatContext.jsx          # Chat global realtime
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── ExplorerPage.jsx
    │   │   ├── TrendingPage.jsx
    │   │   ├── ArtistsPage.jsx          # Recherche pleine largeur + tri
    │   │   ├── LeaderboardPage.jsx
    │   │   ├── MusicUploadPage.jsx      # Upload avec description
    │   │   ├── AdminPanel.jsx           # 5 onglets admin
    │   │   └── ...
    │   └── lib/
    │       ├── notifUtils.js            # notifyUser / notifyOwner / notifyAll
    │       └── supabaseClient.js
    └── novasound-v10000-migration.sql   # ⚠️ Migration MASTER — à run en Supabase
```

---

## 🗄️ Base de données — Tables principales

| Table | Description | Triggers |
|-------|-------------|---------|
| `users` | Profils + stats totales | `handle_new_user`, `sync_user_total_plays` |
| `songs` | Morceaux + soft delete + description | `update_likes_count`, `sync_user_total_plays` |
| `likes` | Likes chansons | → `songs.likes_count` + `users.total_likes` |
| `follows` | Relations | → `users.followers_count` |
| `notifications` | Notifs in-app (10 types) | — |
| `push_subscriptions` | Abonnements push VAPID | — |
| `user_streaks` | Streaks quotidiens (leaderboard) | — |
| `song_moods` | Votes vibe crowd-sourcés | — |
| `song_comments` | Commentaires avec likes | `notify_on_comment` |
| `chat_messages` | Chat global | — |
| `live_rooms` | Salles live | — |
| `live_room_participants` | Participants (présence) | — |
| `news` | Actualités | — |
| `playlists` / `playlist_songs` | Playlists utilisateur | — |

---

## 🔔 Système de Notifications — 10 types supportés

| Type | Déclenché par | Panel |
|------|--------------|-------|
| `like` | Like sur un son | ❤️ |
| `comment` | Commentaire sur un son | 💬 |
| `follow` | Nouvel abonné | 👤 |
| `new_song` | Nouveau son d'un artiste suivi | 🎵 |
| `repost` | Repartage d'un son | 🔁 |
| `chat_reply` | Réponse dans le chat | ↩️ |
| `chat_mention` | @mention dans le chat | @ |
| `chat_mention_all` | @tous dans le chat | ⚡ |
| `mood_vote` | Vote de vibe sur un son | 🎭 |
| `news` | Nouvelle actualité publiée | 📰 |

---

## 🔐 Sécurité

- **RLS** activé sur toutes les tables
- **SECURITY DEFINER** sur les fonctions critiques
- **GREATEST(0, ...)** sur tous les décrements
- Auth Supabase `flowType: implicit` (iOS Safari + Android)
- LockManager custom anti-timeout multi-onglets
- `.env` jamais commité

---

## ⚡ Performance

- Lazy loading des pages (React.lazy + Suspense)
- Code splitting Vite
- React.memo sur SongCard
- Realtime via WebSocket Supabase
- Indexes DB composites sur `plays_count`, `likes_count`, `genre`, `type`

---

## 🧪 Dépannage

| Problème | Solution |
|----------|---------|
| Build : `Expected "}" but found "un"` | Apostrophe non échappée dans template literal — corrigé v10000 |
| Build : `Duplicate "style" attribute` | Deux props `style` sur le même élément — corrigé v10000 |
| SQL `42P16: cannot drop columns from view` | `DROP VIEW IF EXISTS CASCADE` avant `CREATE VIEW` — inclus v10000 |
| Notifications `repost`/`chat_reply`/`mood_vote` jamais reçues | Contrainte CHECK trop restrictive — corrigé v10000 Partie 12 |
| `description` d'upload jamais sauvegardée | Champ manquant dans l'INSERT — corrigé v10000 |
| Erreur 404 au refresh | Normal avec HashRouter — URLs en `/#/` |
| Session perdue après refresh | Vérifier `VITE_SUPABASE_ANON_KEY` dans Vercel |
| Upload avatar : "row-level security" | Ré-exécuter `fix-rls-avatars.sql` |
| Email de confirmation non reçu | Vérifier spams — voir `GMAIL_SMTP_SETUP.md` |
| Plein écran ne fonctionne pas iOS | Normal — mode immersif CSS en fallback |

---

## 📝 Changelog

### v10000 (2026-03-03) — Migration MASTER · Notifications · Search · Build Fixes

#### 🔴 Fix CRITIQUE — Notifications rejetées silencieusement (6 types sur 10)
La table `notifications` avait une contrainte `CHECK` héritée de la v10 initiale limitée à 5 types. Les types `repost`, `chat_reply`, `chat_mention`, `chat_mention_all`, `mood_vote` étaient **rejetés silencieusement** par PostgreSQL depuis leur introduction. Ces notifications n'ont jamais été enregistrées en base.  
**Fix** : contrainte élargie à 10 types + colonne `metadata` ajoutée + index sur `type`.

#### 🔴 Fix Build — `MoodVote.jsx` — apostrophe non échappée
`'Quelqu'un'` dans un template literal cassait esbuild. **Fix** : `"Quelqu'un"` en double quotes.

#### 🔴 Fix Build — `NotificationBell.jsx` — prop `style` dupliquée
Le `<motion.div>` du ToastItem avait deux props `style` séparées. **Fix** : fusionné en un seul objet `style={{ x, opacity, background, ... }}`.

#### 🔴 Fix SQL — `ERROR 42P16: cannot drop columns from view`
`CREATE OR REPLACE VIEW` interdit la suppression de colonnes existantes. **Fix** : `DROP VIEW IF EXISTS ... CASCADE` avant chaque vue dans la migration.

#### 🐛 Fix — `description` non sauvegardée à l'upload
Le champ description s'affichait dans le formulaire mais n'était pas envoyé en base. **Fix** : `description: formData.description?.trim() || null` ajouté dans l'`insert()`.

#### ✨ Notifications — Panel par catégories réellement fonctionnel
- Filtres avec emoji + compteur coloré par type (seules les catégories peuplées s'affichent)
- État vide contextuel avec lien "Voir toutes"
- 10 types couverts dans l'UI

#### ✨ ArtistsPage — Barre de recherche pleine largeur
- Input `w-full` sur toute la largeur disponible
- Bouton ✕ pour effacer, focus transitions fluides
- Boutons de tri sur une ligne séparée en dessous

#### 🗄️ SQL : `novasound-v10000-migration.sql`
Migration MASTER idempotente en 12 parties — safe à run plusieurs fois.

---

### v9000 — TITAN LUX
- ▶ Bouton Écouter synchronisé, offline-first, iOS MP3, reset password
- AdminPanel 5 onglets, Stop Live admin, NowPlayingScreen

### v8500
- Fix NotificationToast hors Router, route /admin manquante, requêtes auth.users

### v8000–v8200
- Live Rooms + présence Supabase, sessions audio, cache avancé

### v7000
- Notifications push VAPID multi-appareils complet

### v1000–v5000
- ArtistsPage, AdminPanel, Leaderboard, streaks, moods, SearchPage, LocalPlayer

### v100–v900
- Chat global communautaire, @mention, @tous, reply, notifications chat

### v10–v95
- Player complet (queue, sleep timer, thème genre, waveform, modes)
- Upload robuste mobile, profils artiste, commentaires, favoris

---

## 📞 Contact

- **Développeur** : M. Tetang Tanekou M.N (EL-AX)
- **Email** : eloadxfamily@gmail.com
- **GitHub** : [@EL-AX](https://github.com/EL-AX)
- **Issues** : [Signaler un bug](https://github.com/XWrld9/NovaSound-Titan/issues)

## 📄 Licence

MIT License — voir [LICENSE](LICENSE)
