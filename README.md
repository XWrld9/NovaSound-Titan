# NovaSound-TITAN LUX

> *Ici chaque écoute compte. Bienvenue dans la nouvelle ère. À toi, artiste qui cherche à t'exprimer aux yeux du monde entier, ICI C'EST TA SCÈNE!*

Plateforme musicale révolutionnaire conçue pour connecter les créateurs et les passionnés de musique.

## 👨‍💻 Développeur & Fondateur

**Développeur Principal** : M. Tetang Tanekou M.N (EL_AX)  
**Fondateur & Vision** : M. Arthur Tidoh (XWrld)

## 🎵 Vision & Mission

NovaSound-TITAN LUX n'est pas juste une plateforme de streaming, c'est un écosystème musical où :
- 🎨 **Les artistes s'expriment librement** — Upload de créations
- 👥 **Les fans découvrent de nouveaux talents** — Exploration intelligente
- 🎯 **La communauté se connecte** — Likes, follows, interactions
- 🌟 **Chaque écoute compte** — Chaque artiste a sa scène

## 🛠️ Stack Technique

**Frontend** — React 18, Vite 4, TailwindCSS, Framer Motion, Lucide React, Lottie React  
**Backend** — Supabase (PostgreSQL), Auth, Row Level Security, Storage  
**Déploiement** — Vercel (frontend) + Supabase Cloud (backend)

## 📦 Installation

### Prérequis
- **Node.js 18.x** ou supérieur
- **npm 9.x** ou supérieur
- Un projet [Supabase](https://supabase.com)

### Développement local

```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan/web
npm install
```

Créez un fichier `.env` à partir du template :

```bash
cp .env.example .env
# Remplissez vos vraies clés dans .env
```

```bash
npm run dev
```

### Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Renseignez votre `.env` :
   ```env
   VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_clé_anon
   SUPABASE_SERVICE_KEY=votre_clé_service
   ```
3. Exécutez le script SQL dans `setup-supabase.sql` via l'éditeur SQL de Supabase
4. Exécutez également `news-likes.sql` pour activer les likes sur les news
5. Créez les buckets Storage :
   ```bash
   npm run setup:buckets
   ```

#### Buckets Storage requis

| Bucket | Usage | Taille max | Accès |
|--------|-------|-----------|-------|
| `avatars` | Photos de profil | 5 MB | Public |
| `audio` | Fichiers audio | 50 MB | Public |
| `covers` | Pochettes d'albums | 10 MB | Public |

> ⚠️ Le script `setup:buckets` doit être lancé **manuellement** avant le premier upload — il n'est pas inclus dans le build Vercel.

## 🚀 Déploiement (Vercel)

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Variables d'environnement à configurer dans Vercel :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> ⚠️ Ne jamais mettre `SUPABASE_SERVICE_KEY` dans Vercel — cette clé est uniquement pour le script local `setup:buckets`.

## 🧭 Routing

L'application utilise `HashRouter` pour éviter les erreurs 404 sur Vercel.

- Accueil : `/#/`
- Profil : `/#/profile`
- Explorer : `/#/explorer`
- News : `/#/news`
- Artiste : `/#/artist/:id`

## 📁 Architecture (v3.7)

```
NovaSound-Titan/
└── web/
    ├── src/
    │   ├── components/
    │   │   ├── ui/
    │   │   │   ├── Dialog.jsx
    │   │   │   ├── Toast.jsx
    │   │   │   ├── button.jsx
    │   │   │   └── slider.jsx
    │   │   ├── AudioPlayer.jsx       # Player avec equalizer Lottie
    │   │   ├── EditProfileModal.jsx
    │   │   ├── FollowButton.jsx
    │   │   ├── Header.jsx
    │   │   ├── LikeButton.jsx        # Likes chansons avec animation cœur
    │   │   ├── NewsLikeButton.jsx    # Likes news avec animation cœur
    │   │   ├── SongCard.jsx          # Modifier + Supprimer pour le propriétaire
    │   │   └── ...
    │   ├── contexts/
    │   │   └── AuthContext.jsx       # Auth + enrichissement profil DB
    │   ├── lib/
    │   │   ├── supabaseClient.js     # LockManager custom + Supabase 2.49
    │   │   └── networkDetector.js
    │   ├── pages/
    │   │   ├── HomePage.jsx          # Modal lecture news + likes
    │   │   ├── ExplorerPage.jsx      # Scroll throttle
    │   │   ├── UserProfilePage.jsx   # Callback onUpdated pour SongCard
    │   │   ├── ArtistProfilePage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── SignupPage.jsx
    │   │   ├── MusicUploadPage.jsx
    │   │   ├── NewsPage.jsx          # Modifier + Supprimer pour l'auteur
    │   │   ├── ModerationPanel.jsx
    │   │   ├── PrivacyPolicy.jsx     # Page enrichie (RGPD, RLS, conservation)
    │   │   ├── TermsOfService.jsx    # Page enrichie (modération, limitation)
    │   │   └── CopyrightInfo.jsx     # Page enrichie (DMCA, artistes, Fair Use)
    │   ├── animations/
    │   │   ├── heart-animation.json  # Explosion cœurs au like
    │   │   └── play-animation.json   # Equalizer 3 barres
    │   └── App.jsx                   # Lazy loading pages
    ├── public/
    │   ├── background.png
    │   └── profil par defaut.png
    ├── setup-buckets.js
    ├── setup-supabase.sql
    ├── news-likes.sql                # ⚠️ À exécuter dans Supabase
    ├── owner-edit-delete-rls.sql     # ⚠️ À exécuter dans Supabase (v3.7)
    ├── .env.example
    └── package.json
```

## 🗄️ Base de données

| Table | Description |
|-------|-------------|
| `users` | Profils avec avatar, bio, stats |
| `songs` | Musiques avec métadonnées et compteurs |
| `likes` | Likes utilisateurs sur les chansons |
| `follows` | Relations follower/following |
| `news` | Actualités communautaires |
| `news_likes` | Likes utilisateurs sur les news ⚠️ créer via `news-likes.sql` |

> Les politiques RLS de modification/suppression par l'auteur sont dans `owner-edit-delete-rls.sql` ⚠️

## 🔐 Sécurité

- Row Level Security (RLS) sur toutes les tables
- Auth Supabase avec vérification email
- Flow PKCE pour les tokens
- LockManager custom anti-timeout multi-onglets
- `.env` jamais commité (`.gitignore` inclus)
- Clé service (`SUPABASE_SERVICE_KEY`) uniquement côté script local

## 🎵 Fonctionnalités

**Artistes** — Upload audio (50 MB max), pochette album, profil personnalisable (avatar, bio), statistiques (plays, likes, followers), **modification et suppression de ses propres musiques**

**Fans** — Découverte, likes avec animations Lottie, follow/unfollow, téléchargement, partage, lecteur audio complet (equalizer animé, shuffle, repeat, volume)

**Communauté** — Système de news avec lecture complète en modal, likes sur les news, **modification et suppression de ses propres news**, modération, profils artistes publics

**Pages légales** — Politique de Confidentialité (RGPD), Conditions d'Utilisation, Droits d'Auteur (DMCA)

## ⚡ Performance

- **Lazy loading** des pages (React.lazy + Suspense)
- **Code splitting** Vite — React, Supabase, Framer Motion, Lottie en chunks séparés
- **React.memo** sur SongCard
- **Images lazy** (`loading="lazy"`) sur toutes les pochettes
- **Scroll throttle** via `requestAnimationFrame`
- Bundle initial réduit de ~1073KB → ~400KB

## 🧪 Dépannage

**Buckets introuvables**
```bash
# Vérifier que SUPABASE_SERVICE_KEY est dans .env
npm run setup:buckets
```

**Erreur 404 au refresh**
> Normal avec HashRouter — les URLs doivent commencer par `/#/`

**Session perdue après refresh**
> Vérifiez que `VITE_SUPABASE_ANON_KEY` est bien configurée dans Vercel

**Upload d'avatar échoue**
> Vérifiez que le bucket `avatars` existe et que les politiques RLS sont actives

**Email de confirmation non reçu**
> Vérifiez les spams — cherchez un email de `noreply@supabase.io`

**Likes sur les news ne fonctionnent pas**
> Exécutez `news-likes.sql` dans le SQL Editor de votre dashboard Supabase

## 📝 Changelog

### v3.7 (2026-02-24)
- ✨ Modification et suppression des **news** par l'auteur — édition inline avec confirmation
- ✨ Modification des **musiques** (titre, artiste) par l'uploader — édition inline dans SongCard
- ✨ Confirmation "Oui / Non" avant toute suppression (news + musiques)
- ✨ Sécurité double : vérification `author_id` / `uploader_id` côté client + politiques RLS Supabase
- 📄 `owner-edit-delete-rls.sql` — nouvelles politiques UPDATE/DELETE pour `news` et `songs`
- 📄 Pages légales enrichies : Politique de Confidentialité (RGPD complet), Conditions d'Utilisation (modération, limitation), Droits d'Auteur (DMCA complet, responsabilité artistes)

### v3.5 (2026-02-24)
- ✨ Modal lecture complète des news (clic sur une carte)
- ✨ `NewsLikeButton` — likes interactifs sur les news avec animation cœur
- ✨ Table `news_likes` (script SQL inclus)
- ⚡ Lazy loading des pages (bundle initial ~400KB)
- ⚡ Code splitting Vite (React, Supabase, Lottie en chunks séparés)
- ⚡ `React.memo` sur SongCard + images lazy
- ⚡ Scroll throttle via `requestAnimationFrame`
- 🐛 Fix auteur UUID → username dans News (HomePage + NewsPage)
- 🐛 Fix colonne `display_name` inexistante (400 Bad Request)
- 🐛 Fix LockManager Supabase timeout multi-onglets
- 🐛 Fix login (callback async incompatible Supabase)
- 🔧 Supabase JS mis à jour → 2.49.0
- 🔧 Animations Lottie branchées (equalizer player + explosion cœur)
- 🔧 Bouton supprimer dans SongCard

### v3.3 (2026-02-24)
- ✨ Bouton "Get Started" masqué pour les utilisateurs connectés
- ✨ Lien "Accueil" ajouté dans le header desktop
- 🐛 Fix affichage UUID auteur dans les news
- 🔧 Nettoyage imports morts, console.log de debug

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


## 🛠️ Stack Technique

**Frontend** — React 18, Vite 4, TailwindCSS, Framer Motion, Lucide React, Lottie React  
**Backend** — Supabase (PostgreSQL), Auth, Row Level Security, Storage  
**Déploiement** — Vercel (frontend) + Supabase Cloud (backend)

## 📦 Installation

### Prérequis
- **Node.js 18.x** ou supérieur
- **npm 9.x** ou supérieur
- Un projet [Supabase](https://supabase.com)

### Développement local

```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan/web
npm install
```

Créez un fichier `.env` à partir du template :

```bash
cp .env.example .env
# Remplissez vos vraies clés dans .env
```

```bash
npm run dev
```

### Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Renseignez votre `.env` :
   ```env
   VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_clé_anon
   SUPABASE_SERVICE_KEY=votre_clé_service
   ```
3. Exécutez le script SQL dans `setup-supabase.sql` via l'éditeur SQL de Supabase
4. Créez les buckets Storage :
   ```bash
   npm run setup:buckets
   ```

#### Buckets Storage requis

| Bucket | Usage | Taille max | Accès |
|--------|-------|-----------|-------|
| `avatars` | Photos de profil | 5 MB | Public |
| `audio` | Fichiers audio | 50 MB | Public |
| `covers` | Pochettes d'albums | 10 MB | Public |

> ⚠️ Le script `setup:buckets` doit être lancé **manuellement** avant le premier upload — il n'est pas inclus dans le build Vercel.

## 🚀 Déploiement (Vercel)

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Variables d'environnement à configurer dans Vercel :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> ⚠️ Ne jamais mettre `SUPABASE_SERVICE_KEY` dans Vercel — cette clé est uniquement pour le script local `setup:buckets`.

## 🧭 Routing

L'application utilise `HashRouter` pour éviter les erreurs 404 sur Vercel.

- Accueil : `/#/`
- Profil : `/#/profile`
- Explorer : `/#/explorer`
- News : `/#/news`
- Artiste : `/#/artist/:id`

## 📁 Architecture (v3.3)

```
NovaSound-Titan/
└── web/
    ├── src/
    │   ├── components/
    │   │   ├── ui/
    │   │   │   ├── Dialog.jsx       # Dialogues modaux (Context)
    │   │   │   ├── Toast.jsx        # Notifications (Context)
    │   │   │   ├── button.jsx
    │   │   │   └── slider.jsx
    │   │   ├── AudioPlayer.jsx
    │   │   ├── EditProfileModal.jsx
    │   │   ├── FollowButton.jsx
    │   │   ├── Header.jsx
    │   │   ├── LikeButton.jsx
    │   │   ├── SongCard.jsx
    │   │   └── ...
    │   ├── contexts/
    │   │   └── AuthContext.jsx      # Auth uniquement, sans UI
    │   ├── lib/
    │   │   ├── supabaseClient.js
    │   │   └── networkDetector.js
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── ExplorerPage.jsx
    │   │   ├── UserProfilePage.jsx
    │   │   ├── ArtistProfilePage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── SignupPage.jsx
    │   │   ├── MusicUploadPage.jsx
    │   │   ├── NewsPage.jsx
    │   │   └── ModerationPanel.jsx
    │   ├── animations/
    │   └── App.jsx
    ├── public/
    │   ├── background.png
    │   └── profil par defaut.png
    ├── setup-buckets.js
    ├── setup-supabase.sql
    ├── .env.example
    └── package.json
```

## 🗄️ Base de données

| Table | Description |
|-------|-------------|
| `users` | Profils avec avatar, bio, stats |
| `songs` | Musiques avec métadonnées et compteurs |
| `likes` | Likes utilisateurs sur les chansons |
| `follows` | Relations follower/following |
| `news` | Actualités communautaires |

## 🔐 Sécurité

- Row Level Security (RLS) sur toutes les tables
- Auth Supabase avec vérification email
- Flow PKCE pour les tokens
- `.env` jamais commité (`.gitignore` inclus)
- Clé service (`SUPABASE_SERVICE_KEY`) uniquement côté script local

## 🎵 Fonctionnalités

**Artistes** — Upload audio (50 MB max), pochette album, profil personnalisable (avatar, bio), statistiques (plays, likes, followers)

**Fans** — Découverte, likes avec animations, follow/unfollow, téléchargement, partage, lecteur audio complet (shuffle, repeat, volume)

**Communauté** — Système de news, modération, profils artistes publics

## 🧪 Dépannage

**Buckets introuvables**
```bash
# Vérifier que SUPABASE_SERVICE_KEY est dans .env
npm run setup:buckets
```

**Erreur 404 au refresh**
> Normal avec HashRouter — les URLs doivent commencer par `/#/`

**Session perdue après refresh**
> Vérifiez que `VITE_SUPABASE_ANON_KEY` est bien configurée dans Vercel

**Upload d'avatar échoue**
> Vérifiez que le bucket `avatars` existe et que les politiques RLS sont actives

**Email de confirmation non reçu**
> Vérifiez les spams — cherchez un email de `noreply@supabase.io` ou votre domaine configuré

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
