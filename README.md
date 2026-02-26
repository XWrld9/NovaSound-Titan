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

## ⚙️ Configuration Supabase (ordre impératif)

> Tous les scripts SQL se trouvent dans le dossier `web/`.  
> Les exécuter **dans cet ordre exact** depuis **Supabase Dashboard → SQL Editor**.

| Étape | Fichier | Ce que ça fait |
|-------|---------|----------------|
| 1 | `setup-supabase.sql` | Tables, RLS, triggers, création auto profil à l'inscription |
| 2 | `news-likes.sql` | Table `news_likes` + trigger `likes_count` |
| 3 | `increment-plays.sql` | Fonction RPC atomique pour les écoutes |
| 4 | `fix-rls-avatars.sql` | Politiques RLS sur le bucket `avatars` |
| 5 | `moderation-system.sql` | Table `reports` + rôles modérateur/admin |
| 6 | `enable-realtime.sql` | Active Supabase Realtime sur `likes` et `news_likes` |

> ⚠️ **Ne pas exécuter d'autres fichiers SQL.** Tous les scripts intermédiaires ont été fusionnés ou supprimés.

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

## 📧 Configuration Email (Gmail SMTP)

> Voir le guide complet : **`GMAIL_SMTP_SETUP.md`**

**Résumé rapide :**

1. Activer la validation en 2 étapes sur votre compte Google
2. Générer un mot de passe d'application → [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Dans **Supabase → Authentication → Email → SMTP Settings** :

| Champ | Valeur |
|-------|--------|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `votre@gmail.com` |
| Password | Mot de passe d'application (16 caractères) |
| Sender email | `votre@gmail.com` |
| Sender name | `NovaSound TITAN LUX` |

4. Dans **Supabase → Authentication → URL Configuration** :
   - Site URL : `https://votre-projet.vercel.app`
   - Redirect URLs : `https://votre-projet.vercel.app/**`

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
| `/#/news` | Actualités communautaires |
| `/#/profile` | Mon profil |
| `/#/artist/:id` | Profil public d'un artiste |
| `/#/upload` | Uploader un son |
| `/#/song/:id` | Page dédiée d'un morceau |
| `/#/login` | Connexion |
| `/#/signup` | Inscription |

> L'application utilise **HashRouter** pour éviter les erreurs 404 sur Vercel.

---

## 📁 Architecture

```
NovaSound-Titan/
├── GMAIL_SMTP_SETUP.md          # Guide configuration email
├── CHROME_EXTENSION_FIX.md     # Fix extensions Chrome
└── web/
    ├── src/
    │   ├── components/
    │   │   ├── ui/
    │   │   │   ├── slider.jsx           # Slider tactile iOS natif
    │   │   │   ├── Dialog.jsx
    │   │   │   ├── Toast.jsx
    │   │   │   └── button.jsx
    │   │   ├── AudioPlayer.jsx          # Lecteur complet + croix fermeture
    │   │   ├── EditProfileModal.jsx
    │   │   ├── FollowButton.jsx
    │   │   ├── Footer.jsx
    │   │   ├── Header.jsx
    │   │   ├── LikeButton.jsx
    │   │   ├── NewsLikeButton.jsx
    │   │   ├── ReportButton.jsx
    │   │   └── SongCard.jsx
    │   ├── contexts/
    │   │   └── AuthContext.jsx          # Auth + signup robuste + autoLogin
    │   ├── lib/
    │   │   ├── supabaseClient.js        # iOS Safari + LockManager + retry
    │   │   └── utils.js
    │   └── pages/
    │       ├── HomePage.jsx
    │       ├── ExplorerPage.jsx
    │       ├── SignupPage.jsx           # 100% français + gestion erreurs
    │       ├── LoginPage.jsx            # Renvoi email confirmation
    │       ├── MusicUploadPage.jsx      # Upload iOS robuste
    │       └── ...
    ├── setup-supabase.sql       # ⚠️ Exécuter en 1er
    ├── news-likes.sql           # ⚠️ Exécuter en 2e
    ├── increment-plays.sql      # ⚠️ Exécuter en 3e
    ├── fix-rls-avatars.sql      # ⚠️ Exécuter en 4e
    ├── moderation-system.sql    # ⚠️ Exécuter en 5e
    └── enable-realtime.sql      # ⚠️ Exécuter en 6e
```

---

## 🗄️ Base de données

| Table | Description | Trigger associé |
|-------|-------------|-----------------|
| `users` | Profils | `handle_new_user` à l'inscription |
| `songs` | Morceaux | `update_likes_count` auto |
| `likes` | Likes chansons | → `songs.likes_count` |
| `follows` | Relations | → `users.followers_count` + `following_count` |
| `news` | Actualités | `update_news_likes_count` auto |
| `news_likes` | Likes news | → `news.likes_count` |
| `reports` | Signalements | — |

---

## 🔐 Sécurité

- **RLS** activé sur toutes les tables
- **SECURITY DEFINER** sur les fonctions critiques
- **GREATEST(0, ...)** sur tous les décrements
- **Trigger robuste** : `ON CONFLICT + EXCEPTION unique_violation` — ne peut jamais planter
- Auth Supabase `flowType: implicit` (iOS Safari + Android compatible)
- LockManager custom anti-timeout multi-onglets
- `.env` jamais commité

---

## 🎵 Fonctionnalités v5.4

**Artistes**
- Upload audio (50 MB max) + pochette album — robuste sur iOS
- Profil public (`/artist/:id`) avec stats complètes
- Modifier avatar et bio

**Fans**
- Écoutes atomiques sans race condition
- Likes en temps réel (Supabase Realtime)
- Lecteur audio complet avec slider tactile iOS natif
- Croix de fermeture sur le player (mini et expanded)
- Follow/unfollow depuis le player expanded uniquement
- Téléchargement et partage natif mobile

**Communauté**
- News avec modal "Lire la suite"
- Signalement en 3 étapes
- Panneau de modération admin
- Profils artistes cliquables

---

## ⚡ Performance

- **Lazy loading** des pages (React.lazy + Suspense)
- **Code splitting** Vite
- **React.memo** sur SongCard
- **Scroll throttle** via `requestAnimationFrame`
- **Realtime** via WebSocket Supabase
- Bundle initial ~400KB

---

## 🧪 Dépannage

| Problème | Solution |
|----------|---------|
| Erreur 404 au refresh | Normal avec HashRouter — URLs en `/#/` |
| Session perdue après refresh | Vérifier `VITE_SUPABASE_ANON_KEY` dans Vercel |
| Upload avatar échoue | Vérifier bucket `avatars` + exécuter `fix-rls-avatars.sql` |
| Likes news ne s'enregistrent pas | Exécuter `news-likes.sql` |
| Plays ne s'incrémentent pas | Exécuter `increment-plays.sql` |
| Likes pas en temps réel | Exécuter `enable-realtime.sql` |
| Email de confirmation non reçu | Vérifier spams — voir `GMAIL_SMTP_SETUP.md` |
| `database error saving new user` | Trigger déjà corrigé dans `setup-supabase.sql` v5.4 |
| Impossible de se connecter après inscription | Email non confirmé → bouton "Renvoyer" sur la page login |
| Slider seek/volume ne répond pas sur iOS | Vérifier que `slider.jsx` v5.4 est bien déployé |
| Buckets introuvables | `SUPABASE_SERVICE_KEY` dans `.env` puis `npm run setup:buckets` |

---

## 📝 Changelog

### v6.0 (2026-02-26) — Fix logo partage cross-device
- 🔴 Fix **logo NovaSound absent dans la carte de partage** sur iOS, Android et PC : l'URL CDN Hostinger était bloquée par CORS lors de la génération canvas (html-to-image). Le logo est maintenant chargé depuis `/icon-192.png` (fichier local) et converti en data URL au montage → zéro CORS, fonctionne sur tous les devices
- 🔴 Fix **pochette album CORS** dans la carte : conversion préalable en data URL via canvas avant génération
- ✅ `waitForImages()` : attend que toutes les `<img>` de la carte soient chargées avant `toPng()`
- ✅ **Partage multi-fallback** : (1) fichier image natif iOS/Android → (2) URL-only si fichiers non supportés → (3) téléchargement sur desktop
- ✅ Logo de remplacement (disque coloré thème) si data URL non encore disponible

### v5.4 (2026-02-26) — Version stable finale
- 🔴 Fix **Slider iOS** : `touch-none` de Radix UI bloquait tous les événements tactiles sur Safari → réécrit avec handler `onTouchMove` natif. Seek et volume fonctionnent sur tous les iPhones
- 🔴 Fix **bouton follow gênant** en mode mini player : masqué hors mode expanded, n'interfère plus visuellement
- ✅ **Croix de fermeture** sur le player en mode mini ET expanded — event `novasound:close-player` écouté par toutes les pages
- ✅ **Bouton muet** accessible sur mobile en mode mini (était `hidden` sur petits écrans)
- 📧 **Gmail SMTP** solution définitive : guide `GMAIL_SMTP_SETUP.md` inclus, 500 emails/jour, sans domaine requis
- 🗑️ Nettoyage : suppression des fichiers obsolètes (`RESEND_SUPABASE_FIX.md`, `fix-email-confirm.sql`, `disable-email-confirm.sql`, dossier `LUX/`)
- 🔧 README entièrement mis à jour

### v5.3 (2026-02-25)
- 🔴 Fix **cast UUID→TEXT** dans tous les fichiers SQL (`au.id::text`) — erreur `operator does not exist: text = uuid`
- ✅ Flow `autoLogin` : si confirmation email désactivée → connexion directe après inscription

### v5.2 (2026-02-25)
- 🔴 Fix **signup ultra-robuste** : capture toutes les variantes d'erreurs SMTP
- ✅ Profil DB créé en fallback sur erreur SMTP

### v5.1 (2026-02-25)
- 🔴 Fix **`database error saving new user`** : trigger réécrit avec `EXCEPTION WHEN unique_violation` + déduplication username
- 🔴 Fix **`error sending confirmation email`** : retourne succès partiel si compte créé
- 🔴 Fix **`email ou mot de passe incorrect`** trompeur → bouton renvoi confirmation systématique

### v5.0 (2026-02-25)
- 🐛 Fix **EmailRedirectTo iOS** : `/#/login` au lieu de `/`
- 🐛 Fix **AudioPlayer croix** : bouton ✕ en haut à droite mode expanded
- 🐛 Fix **SignupPage labels anglais** → tout en français

### v4.9 (2026-02-25)
- 🐛 Fix AudioPlayer expanded iPhone : `overflow-y-auto`
- 🐛 Fix titre débordant iPhone : `break-words`
- 🐛 Fix LottieAnimation dimensions via `style`
- 🐛 Fix scroll body en mode expanded : `overflow: hidden`
- 🐛 Fix notch / Dynamic Island : `env(safe-area-inset-top)`
- 🐛 Fix Auth Android : `flowType: implicit`
- 🐛 Fix Auth iOS : gestion `SIGNED_IN`, `TOKEN_REFRESHED`, `INITIAL_SESSION`
- ✨ Autocomplete sur tous les champs de formulaire
- ✨ `inputMode="email"` sur les champs email

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
