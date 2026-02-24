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
