# NovaSound-TITAN LUX

> *Ici chaque écoute compte. Bienvenue dans la nouvelle ère. À toi, artiste qui cherche à t'exprimer aux yeux du monde entier — ICI C'EST TA SCÈNE !*

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

## ⚙️ Configuration Supabase (ordre impératif)

> Tous les scripts SQL se trouvent à la racine du dossier `web/`.  
> Les exécuter **dans cet ordre exact** depuis **Supabase Dashboard → SQL Editor**.

| Étape | Fichier | Ce que ça fait |
|-------|---------|----------------|
| 1 | `setup-supabase.sql` | Tables principales, RLS, triggers likes/follows, création auto profil à l'inscription |
| 2 | `news-likes.sql` | Table `news_likes` + trigger automatique `likes_count` (SECURITY DEFINER) |
| 3 | `increment-plays.sql` | Fonction RPC atomique pour comptabiliser les écoutes sans race condition |
| 4 | `fix-rls-avatars.sql` | Politiques RLS sur le bucket Storage `avatars` |
| 5 | `moderation-system.sql` | Table `reports` + système de rôles modérateur/admin |
| 6 | `enable-realtime.sql` | Active Supabase Realtime sur `likes` et `news_likes` — **obligatoire pour les mises à jour en temps réel** |

> ⚠️ **Ne pas exécuter d'autres fichiers SQL que ceux listés ci-dessus.** Tous les anciens scripts intermédiaires ont été fusionnés ou supprimés.

### Buckets Storage à créer manuellement

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

## 🚀 Déploiement Vercel

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node Version | `20.x` |

**Variables d'environnement à configurer dans Vercel :**
```
VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon
```

> ⚠️ Ne **jamais** mettre `SUPABASE_SERVICE_KEY` dans Vercel — uniquement pour les scripts locaux.

---

## 🧭 Routes

| URL | Page |
|-----|------|
| `/#/` | Accueil |
| `/#/explorer` | Explorer tous les sons |
| `/#/news` | Actualités communautaires |
| `/#/profile` | Mon profil |
| `/#/artist/:id` | Profil public d'un artiste |
| `/#/upload` | Uploader un son |
| `/#/song/:id` | Page dédiée d'un morceau (avec Open Graph cover) |
| `/#/login` | Connexion |
| `/#/signup` | Inscription |

> L'application utilise **HashRouter** pour éviter les erreurs 404 sur Vercel.

---

## 📁 Architecture

```
NovaSound-Titan/
└── web/
    ├── src/
    │   ├── components/
    │   │   ├── ui/
    │   │   │   ├── Dialog.jsx           # Dialogues modaux (Context)
    │   │   │   ├── Toast.jsx            # Notifications (Context)
    │   │   │   ├── button.jsx
    │   │   │   └── slider.jsx
    │   │   ├── AudioPlayer.jsx          # Player + équalizer Lottie + RPC plays atomique
    │   │   ├── EditProfileModal.jsx     # Chargement bio/username depuis DB
    │   │   ├── FollowButton.jsx         # Resync DB + callback parent + Math.max(0)
    │   │   ├── Footer.jsx               # Entièrement en français
    │   │   ├── Header.jsx
    │   │   ├── LikeButton.jsx           # Likes chansons + Realtime + animation cœur
    │   │   ├── NewsLikeButton.jsx       # Likes news + Realtime + trigger SQL
    │   │   ├── ReportButton.jsx         # Signalement 3 étapes + tooltip avertissement
    │   │   ├── SongCard.jsx             # Plays réels + lien profil artiste cliquable
    │   │   └── ...
    │   ├── contexts/
    │   │   └── AuthContext.jsx          # Auth + supabase exposé dans le context
    │   ├── lib/
    │   │   ├── supabaseClient.js        # LockManager custom + Supabase 2.49
    │   │   ├── utils.js                 # cn() + formatPlays()
    │   │   └── networkDetector.js
    │   ├── pages/
    │   │   ├── HomePage.jsx             # Cards avec plays + lien artiste + modal news
    │   │   ├── ExplorerPage.jsx         # Tri français, scroll infini
    │   │   ├── UserProfilePage.jsx      # Email tronqué sur mobile
    │   │   ├── ArtistProfilePage.jsx    # Profil public + follow/unfollow + stats
    │   │   ├── LoginPage.jsx            # Logo réel + 100% français
    │   │   ├── SignupPage.jsx           # Logo réel + 100% français
    │   │   ├── NewsPage.jsx             # Modal lire la suite + likes Realtime
    │   │   ├── ModerationPanel.jsx      # Entièrement traduit en français
    │   │   ├── SongPage.jsx             # Page morceau + meta OG:image (cover) pour partage riche
│   │   ├── MusicUploadPage.jsx
    │   │   └── ...
    │   ├── animations/
    │   │   ├── heart-animation.json     # Explosion cœurs au like
    │   │   └── play-animation.json      # Équalizer 3 barres
    │   └── App.jsx                      # Lazy loading + Suspense
    ├── public/
    │   ├── background.png
    │   └── profil par defaut.png
    ├── setup-supabase.sql               # ⚠️ Exécuter en 1er
    ├── news-likes.sql                   # ⚠️ Exécuter en 2e
    ├── increment-plays.sql              # ⚠️ Exécuter en 3e
    ├── fix-rls-avatars.sql              # ⚠️ Exécuter en 4e
    ├── moderation-system.sql            # ⚠️ Exécuter en 5e
    ├── enable-realtime.sql              # ⚠️ Exécuter en 6e — obligatoire pour le temps réel
    ├── setup-buckets.js
    ├── .env.example
    └── package.json
```

---

## 🗄️ Base de données

| Table | Description | Trigger associé |
|-------|-------------|-----------------|
| `users` | Profils (avatar, bio, `followers_count`, `following_count`) | `handle_new_user` à l'inscription |
| `songs` | Morceaux (`plays_count`, `likes_count`) | `update_likes_count` auto |
| `likes` | Likes utilisateurs sur les chansons | → met à jour `songs.likes_count` |
| `follows` | Relations follower/following | → met à jour `users.followers_count` + `following_count` |
| `news` | Actualités communautaires (`likes_count`) | `update_news_likes_count` auto |
| `news_likes` | Likes sur les news | → met à jour `news.likes_count` |
| `reports` | Signalements de modération | — |

---

## 🔐 Sécurité

- **RLS** activé sur toutes les tables
- **SECURITY DEFINER** sur les fonctions critiques (`increment_plays`, `update_news_likes_count`)
- **GREATEST(0, ...)** sur tous les décrements — compteurs jamais négatifs
- Auth Supabase avec vérification email + flow PKCE
- LockManager custom anti-timeout multi-onglets
- `.env` jamais commité (`.gitignore` inclus)
- `SUPABASE_SERVICE_KEY` uniquement côté script local

---

## 🎵 Fonctionnalités v4.1

**Artistes**
- Upload audio (50 MB max) + pochette album
- Profil public consultable par tous (`/artist/:id`)
- Stats : morceaux, abonnés, écoutes totales
- Modifier avatar et bio

**Fans**
- Écoutes comptabilisées en temps réel (atomique, sans race condition)
- Compteur d'écoutes visible sur chaque card (`12.4k`)
- Likes chansons et news **en temps réel** — tous les utilisateurs voient le changement instantanément
- Follow/unfollow avec resynchronisation immédiate
- Lecteur audio complet (shuffle, repeat, volume, équalizer animé)
- Téléchargement et partage de liens

**Communauté**
- News avec modal "Lire la suite" (HomePage + NewsPage)
- Signalement en 3 étapes avec avertissement anti-abus + tooltip
- Panneau de modération (admin/modérateur)
- Profils artistes avec liste d'abonnés cliquables
- Noms d'artistes cliquables vers leur profil

---

## ⚡ Performance

- **Lazy loading** des pages (React.lazy + Suspense)
- **Code splitting** Vite (React, Supabase, Framer Motion, Lottie en chunks séparés)
- **React.memo** sur SongCard
- **Images lazy** sur toutes les pochettes
- **Scroll throttle** via `requestAnimationFrame`
- **Realtime** via WebSocket Supabase (un canal par card, cleanup au démontage)
- Bundle initial ~400KB

---

## 🧪 Dépannage

| Problème | Solution |
|----------|----------|
| Erreur 404 au refresh | Normal avec HashRouter — URLs en `/#/` |
| Session perdue après refresh | Vérifier `VITE_SUPABASE_ANON_KEY` dans Vercel |
| Upload avatar échoue | Vérifier bucket `avatars` + exécuter `fix-rls-avatars.sql` |
| Likes news ne s'enregistrent pas | Exécuter `news-likes.sql` dans Supabase |
| Plays ne s'incrémentent pas | Exécuter `increment-plays.sql` dans Supabase |
| Compteurs négatifs | Réexécuter `setup-supabase.sql` (triggers avec GREATEST) |
| Likes pas en temps réel | Exécuter `enable-realtime.sql` dans Supabase |
| Email de confirmation non reçu | Vérifier les spams — expéditeur `noreply@supabase.io` |
| Buckets introuvables | `SUPABASE_SERVICE_KEY` dans `.env` puis `npm run setup:buckets` |

---

## 📝 Changelog

### v4.4 (2026-02-24)
- 🐛 Fix **"email rate limit exceeded"** → message traduit en français avec conseil d'attente
- 🐛 Fix **"Fetch is aborted"** upload mobile → retry automatique (3 tentatives avec backoff), vérification taille fichier (max 50 MB), messages d'erreur réseau traduits
- ✨ **PWA complète** : `manifest.json`, `sw.js` (service worker), icônes 192×512px
- ✨ **Bouton "Installer l'app"** dans le header desktop et **"Télécharger NovaST LUX"** dans le menu mobile — apparaît automatiquement quand le navigateur le supporte (Chrome, Edge, Samsung Internet…)
- ✨ Support **Apple iOS** : `apple-mobile-web-app-capable`, `apple-touch-icon`, ajout via Safari → "Sur l'écran d'accueil"

### v4.3 (2026-02-24)
- 🐛 Fix **partage news** : suppression image logo externe (CORS bloquait `html-to-image`) → logo SVG inline
- 🐛 Fix **partage news** : avatar auteur remplacé par initiale inline (CORS Supabase Storage)
- 🐛 Fix **AudioPlayer** : `handleShare` rendu async + `clipboard.writeText` avec `await` + fallback `execCommand`
- 🌐 Traduction **NewsForm** : "Post News Update" → "Publier une actualité", "News Headline" → "Titre de l'actualité", "What's happening?" → "Quoi de neuf ?", "Post News" → "Publier", messages succès/erreur en français

### v4.2 (2026-02-24)
- ✨ `SongPage` : page dédiée par morceau (`/#/song/:id`) avec pochette grande format
- ✨ Meta Open Graph complètes (og:image, og:title, twitter:card) — la pochette s'affiche dans WhatsApp, Discord, Telegram, Twitter
- 🔧 Route `/song/:id` corrigée (redirigait vers Explorer au lieu d'une vraie page)
- 🔧 Bouton Partager dans SongCard et SongPage copie le lien direct vers la page avec cover

### v4.1 (2026-02-24)
- ✨ **Supabase Realtime** sur `likes` (chansons) et `news_likes` — compteur instantané pour tous les utilisateurs connectés
- ✨ `enable-realtime.sql` — script dédié pour activer la publication Realtime
- 🔧 `LikeButton` et `NewsLikeButton` : canal Realtime par ID, cleanup au démontage, `useCallback` pour éviter les re-abonnements

### v4.0 (2026-02-24)
- ✨ Écoutes réelles affichées sur chaque card (`12.4k`) via `formatPlays()`
- ✨ Noms d'artistes cliquables → profil public `/artist/:id`
- ✨ `ArtistProfilePage` : stats complètes, abonnés cliquables, 100% français
- ✨ `FollowButton` : resync DB après chaque action + callback parent
- ✨ `ReportButton` : 3 étapes (avertissement → formulaire → succès) + tooltip anti-abus
- ✨ Logo réel sur les pages Login et Signup + traduction complète FR
- 🐛 Fix `NewsLikeButton` : update `news.likes_count` bloqué par RLS → trigger SQL automatique
- 🐛 Fix compteurs négatifs : `GREATEST(0, ...)` sur tous les décrements SQL
- 🐛 Fix email trop long sur mobile (`truncate max-w-[260px]`)
- 🔧 `AudioPlayer` : incrémentation plays atomique via RPC `SECURITY DEFINER`
- 🔧 Traduction complète FR : Footer, Explorer, News, ModerationPanel, MusicUploadPage, Login, Signup
- 🔧 Suppression de `news-enhancements.sql` redondant (remplacé par `news-likes.sql`)

### v3.8 (2026-02-24)
- ✨ `ReportButton` redesigné avec modal expressif et catégories visuelles
- ✨ Section Featured Tracks : visibilité améliorée
- 🐛 Fix `NewsLikeButton` : closure stale → `useRef` + resync DB

### v3.6 (2026-02-24)
- ✨ Section Latest News : contraste et visibilité améliorés
- ✨ `NewsPage` : modal "Lire la suite" ajouté
- 🐛 Fix `news-likes.sql` : type UUID → TEXT (compatible schéma)

### v3.2 (2026-02-24)
- 🐛 Fix RLS upload avatar
- 🐛 Fix `EditProfileModal` : chargement username/bio depuis DB
- 🐛 Fix responsive mobile : onglets profil avec scroll horizontal
- 🔧 Node.js épinglé à `20.x`

---

## 📞 Contact

- **Développeur** : M. Tetang Tanekou M.N (EL-AX)
- **Email** : eloadxfamily@gmail.com
- **GitHub** : [@EL-AX](https://github.com/EL-AX)
- **Issues** : [Signaler un bug](https://github.com/XWrld9/NovaSound-Titan/issues)

## 📄 Licence

MIT License — voir [LICENSE](LICENSE)

---

> *"Ici chaque écoute compte. Bienvenue dans la nouvelle ère de la musique digitale."*  
> **NovaSound-TITAN LUX — Votre scène, votre musique, votre communauté.**
