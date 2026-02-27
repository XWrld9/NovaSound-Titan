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
| 7 | `archive-songs.sql` | Colonnes `is_archived` + `is_deleted` + politiques RLS mises à jour |
| 8 | `comments-favorites.sql` | Tables `favorites`, `song_comments`, `comment_likes` + triggers + RLS |

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
    ├── enable-realtime.sql      # ⚠️ Exécuter en 6e
    ├── archive-songs.sql        # ⚠️ Exécuter en 7e
    └── comments-favorites.sql   # ⚠️ Exécuter en 8e
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

## 🎵 Fonctionnalités v20.0

**Player**
- **File d'attente (Queue)** : bouton ⊕ sur chaque SongCard pour empiler des sons. Panneau dédié dans le player expanded (slide from bottom) avec liste réorderable, suppression individuelle, bouton "Vider". Le son suivant en queue est prioritaire sur la playlist.
- **Sleep Timer (minuteur de sommeil)** : arrête automatiquement la lecture après 5, 10, 15, 20, 30, 45 ou 60 minutes. Compte à rebours visible dans le header du player (🌙 + timer) et dans le mini-player mobile. Annulable à tout moment.
- **Swipe-to-close mobile** : glisser le mini-player vers le bas (>60px) ferme le lecteur naturellement.
- **Mode immersif** : fond pochette flou + plein écran natif (Android/Desktop) ou CSS (iOS), inchangé et stable.
- **Badge genre** visible dans le player expanded et dans le mini-player desktop.

**Catalogue**
- **Genres musicaux** : 17 genres disponibles (Afrobeats, Hip-Hop, R&B, Pop, Électronique, Trap, Gospel, Jazz, Reggae, Dancehall, Amapiano, Coupé-Décalé, Rock, Classique, Folk, Latin, Drill)
- **Durée auto-détectée** à l'upload via l'API Audio HTML5 — affichée sur les SongCards (coin bas droit) et dans le player
- **Badge genre** sur les SongCards et dans le player

**Explorer**
- **Filtre par genre** : chips cliquables au-dessus de la grille — filtre côté Supabase
- **Squelettes de chargement** (skeleton screens) au premier chargement et lors de la pagination — plus de spinner blanc solitaire
- **Tri "Plus aimés"** (likes_count) ajouté en option
- Compteur de résultats contextuel ("42+ morceaux · Afrobeats")

**Homepage**
- **Section "Top 3 du moment"** : les 3 sons les plus écoutés, affichés avec médailles 🥇🥈🥉, pochette en fond flou, plays count et genre. Lecture directe au clic.

**Upload**
- **Sélecteur de genre** : chips interactives dans le formulaire d'upload
- **Durée auto** : détectée à la sélection du fichier, affichée dans le champ

**SQL**
- Migration `v20-migration.sql` : colonnes `genre TEXT`, `duration_s INTEGER`, index sur genre/likes_count/plays_count

**Infrastructure**
- `package.json → 20.0.0` · SW cache `novasound-titan-v6` · client-info `20.0.0`

---



**Artistes**
- Upload audio (50 MB max) + pochette album — robuste sur iOS
- Profil public (`/artist/:id`) avec stats complètes
- Modifier avatar et bio (compression auto + retry réseau ×3)

**Fans**
- Écoutes atomiques sans race condition
- Likes en temps réel (Supabase Realtime)
- Lecteur audio complet avec slider tactile iOS natif
- Croix de fermeture sur le player (mini et expanded)
- Follow/unfollow depuis le player expanded uniquement
- Téléchargement et partage natif mobile
- **Boucle (Repeat)** : mode `off / one / all` — `loop` HTML5 natif sur iOS/Android
- **Mode immersif** : plein écran natif (Android/Desktop) + mode couverture CSS (iOS) avec fond pochette flou

**Notifications**
- Push notifications web (Service Worker + VAPID)
- Le bouton "Activer" se masque correctement une fois les notifs activées
- Chaque notification est entièrement cliquable → navigue vers la page cible

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
| Upload avatar : "row-level security" | Ré-exécuter `fix-rls-avatars.sql` (v2 avec DROP IF EXISTS) |
| Upload avatar : "Failed to fetch" | Réseau mobile instable — la v11 ajoute un retry ×3 et compression auto |
| Likes news ne s'enregistrent pas | Exécuter `news-likes.sql` |
| Plays ne s'incrémentent pas | Exécuter `increment-plays.sql` |
| Likes pas en temps réel | Exécuter `enable-realtime.sql` |
| Email de confirmation non reçu | Vérifier spams — voir `GMAIL_SMTP_SETUP.md` |
| `database error saving new user` | Trigger déjà corrigé dans `setup-supabase.sql` v5.4 |
| Impossible de se connecter après inscription | Email non confirmé → bouton "Renvoyer" sur la page login |
| Slider seek/volume ne répond pas sur iOS | Vérifier que `slider.jsx` v5.4 est bien déployé |
| Buckets introuvables | `SUPABASE_SERVICE_KEY` dans `.env` puis `npm run setup:buckets` |
| Bouton "Activer push" s'affiche toujours | Corrigé en v11 — pushEnabled initialisé depuis le SW au montage |
| Plein écran ne fonctionne pas sur iOS | Normal — iOS Safari bloque l'API Fullscreen. La v12 utilise un mode immersif CSS équivalent |
| Contenu masqué par le mini-player mobile | Corrigé en v12 — `pb-24 md:pb-32` sur toutes les pages |

---

## 📝 Changelog

### v20.0 (2026-02-27) — Queue · Sleep Timer · Genres · Top 3 · Squelettes · Swipe

- ✨ **File d'attente (Queue)** : bouton ⊕ sur toutes les SongCards → panneau slide-up dans le player expanded, suppression individuelle, vider en un clic. `PlayerContext` étendu : `queue`, `addToQueue`, `removeFromQueue`, `clearQueue`. Le prochain son en queue est prioritaire sur la playlist normale.
- 🌙 **Sleep Timer** : minuteur de sommeil 5/10/15/20/30/45/60 min. Compte à rebours affiché en temps réel sur le badge (header expanded + mini-player). Pause automatique quand le timer arrive à 0. Annulable à tout moment. `PlayerContext` étendu : `sleepTimer`, `setSleepTimer`, `clearSleepTimer`.
- 👆 **Swipe-to-close** : glisser le mini-player mobile vers le bas > 60px ferme le lecteur. Indicateur visuel (pill handle) en haut du mini-player.
- 🎵 **Genres musicaux** : 17 genres sélectionnables à l'upload (chips interactives). Filtre par genre dans l'Explorer (requête Supabase `.eq('genre', selectedGenre)`). Badge genre sur les SongCards et dans le player (expanded + desktop mini).
- ⏱ **Durée auto-détectée** à l'upload via `new Audio()` → `onloadedmetadata`. Affichée sur les SongCards (overlay coin bas droit) et dans les métadonnées.
- 🏆 **Top 3 du moment** sur la HomePage : les 3 sons les plus écoutés (`order plays_count DESC LIMIT 3`), médailles 🥇🥈🥉, fond pochette flou, lecture directe au clic.
- 💀 **Skeleton screens** dans l'Explorer : 8 squelettes animés au premier chargement, 4 à la pagination. Remplace l'ancien spinner.
- 📊 **Tri "Plus aimés"** ajouté dans l'Explorer (option `likes_count DESC`).
- 🎨 **Indicateur de lecture** redesigné en SongCard : 3 barres animées au lieu du point.
- 🗄 `v20-migration.sql` : `ALTER TABLE songs ADD COLUMN genre TEXT`, `ADD COLUMN duration_s INTEGER` + index optimisés.
- 🔢 Versions : `package.json → 20.0.0` · SW cache `v6` · client-info `20.0.0`.

### v12.0 (2026-02-27) — Loop/Repeat parfait iOS+Android + Plein écran immersif

- 🔴 Fix **Repeat/Loop iOS & Android** — implémentation à deux niveaux :
  - **Niveau 1 (natif)** : `loop` HTML5 synchronisé avec `repeat === 'one'` sur l'élément `<audio>`. Sur iOS et Android, le navigateur gère la boucle nativement sans dépendance JS — fiabilité maximale.
  - **Niveau 2 (secours)** : `handleEnded` en fallback pour les navigateurs qui ignoreraient `loop`.
  - Synchronisation immédiate de `loop` lors du chargement d'un nouveau son (`audioRef.current.loop = (repeat === 'one')` dans le `useEffect` de changement de son).
  - Indicateur visuel amélioré : `repeat='one'` → badge **1** sous l'icône ; `repeat='all'` → point cyan en haut.

- ✨ **Mode plein écran immersif** avec photo de couverture en fond — iOS + Android + Desktop :
  - **Android / Desktop Chrome** : plein écran natif via `Fullscreen API` (`requestFullscreen` + fallback `webkitRequestFullscreen`) + fond image pochette.
  - **iOS Safari / PWA** : iOS bloque l'API Fullscreen → mode immersif CSS pur : fond `url(pochette) center/cover` + overlay sombre. Effet visuellement identique au plein écran.
  - Fond généré depuis une miniature 80×80px de la pochette pour éviter tout lag.
  - Pochette plus grande en mode immersif (22rem vs 20rem).
  - Transition douce (`transition: background 0.5s ease`) en entrant/sortant du mode.
  - Bouton ⛶/⛶ dans l'en-tête du player agrandi — titre adaptatif (iOS : "Vue couverture", autres : "Plein écran").

- 🔴 Fix **padding manquant** sur toutes les pages : NewsPage, MusicUploadPage, CopyrightInfo, PrivacyPolicy, TermsOfService, SongPage (état loading), ArtistProfilePage (états error/loading), ModerationPanel → le mini-player mobile ne cache plus le contenu du bas.
- 🔧 **Cache SW** bumped → `novasound-titan-v5`.
- 🔢 **Bump versions** : `package.json → 12.0.0`, client-info header → `12.0.0`.

### v11.0 (2026-02-27) — Corrections RLS, upload mobile, notifications

- 🔴 Fix **RLS Storage avatars** : politiques recréées proprement (DROP IF EXISTS + CREATE) — plus d'erreur "new row violates row-level security policy". La politique UPDATE utilisait `foldername()` inadapté aux fichiers plats `avatar-{uuid}.ext`, remplacé par `name LIKE '%uid%' OR owner = auth.uid()`.
- 🔴 Fix **upload avatar "Failed to fetch"** sur mobile : l'image est compressée/redimensionnée (800px, JPEG) avant upload pour réduire la taille et les timeout réseau. Retry automatique ×3 en cas d'erreur réseau transitoire.
- 🔴 Fix **bouton "Activer les notifications push" toujours visible** même après activation : `pushEnabled` est maintenant initialisé au montage en vérifiant la souscription existante dans le Service Worker (`reg.pushManager.getSubscription()`).
- ✨ Fix **notifications cliquables** : cliquer n'importe où sur une notification navigue vers son URL cible et ferme le panel. Les boutons "marquer lu" / "supprimer" stoppent la propagation.
- 🔢 **Bump versions** : `package.json → 11.0.0`, client-info header → `11.0.0`.




### v11.0 (2026-02-27) — Corrections & améliorations

- 🔴 Fix **RLS Storage avatars** : politiques recréées proprement (DROP IF EXISTS + CREATE) — plus d'erreur "new row violates row-level security policy". La politique UPDATE utilisait `foldername()` inadapté aux fichiers plats `avatar-{uuid}.ext`, remplacé par `name LIKE '%uid%' OR owner = auth.uid()`.
- 🔴 Fix **upload avatar "Failed to fetch"** sur mobile : l'image est désormais compressée/redimensionnée (800px, JPEG) avant upload pour réduire la taille et les timeout réseau. Retry automatique ×3 en cas d'erreur réseau transitoire.
- 🔴 Fix **bouton "Activer les notifications push" toujours visible** même après activation : `pushEnabled` est maintenant initialisé au montage en vérifiant la souscription existante dans le Service Worker (`reg.pushManager.getSubscription()`).
- ✨ Fix **notifications cliquables** : cliquer n'importe où sur une notification navigue vers son URL cible et ferme le panel. Les boutons "marquer lu" / "supprimer" stoppent la propagation.
- ✨ **Plein écran natif** dans le player expanded : bouton ⛶/⛶ utilisant la Fullscreen API (avec fallback `webkit`). Fonctionne sur Android, Chrome, Firefox — affiché dans l'en-tête du player agrandi.
- 🔴 Fix **attribut `loop` HTML5** sur l'élément `<audio>` synchronisé avec `repeat === 'one'` pour un comportement natif iOS sans dépendance JS.
- 🔧 **Cache SW** bumped → `novasound-titan-v4` (force mise à jour du worker).
- 🔢 **Bump versions** : `package.json → 11.0.0`, client-info header → `11.0.0`.

### v10.0 (2026-02-26) — Version finale & stable 🏆

- 🔴 Fix **titre SongCard** : cliquer sur le titre navigue vers `/#/song/ID` au lieu d'ouvrir le player
- 🔴 Fix **bouton ▶ Play** : toujours visible sur mobile/tactile (plus seulement au hover desktop)
- ✨ **Bouton ↗** sur chaque SongCard (coin pochette) → accès direct à la page du son & commentaires
- ✨ **Lien ↗** dans le mini player (mobile & desktop) à côté du titre → page du son en un clic
- 🔢 **Bump versions** : `package.json → 10.0.0`, client-info header → `10.0.0`
- 🔴 Fix **recherche Header** : les sons archivés n'apparaissent plus dans les résultats
- 🔴 Fix **menu ⋯ commentaires mobile** : toujours visible sur tactile (était invisible sans hover)
- 🔴 Fix **FavoriteButton non connecté** : affiche un bouton lien vers login au lieu de disparaître
- 🔐 Fix **vie privée** : emails des abonnés masqués dans les onglets Followers/Following
- 📄 README : architecture SQL complète (8 scripts dans l'ordre)


- ✨ **Favoris (⭐ Sauvegarder)** : nouvelle table `favorites` indépendante des likes — sauvegarde privée, onglet dédié dans le profil avec icône 🔖
- ✨ **Likes (❤️)** : maintenant strictement un compteur public — onglet "Likés" séparé dans le profil
- ✨ **Commentaires** : section complète sur chaque page de son avec :
  - Publication après écoute (Ctrl+Entrée ou bouton)
  - Like de commentaire (❤️ temps réel)
  - Édition illimitée par l'auteur (crayon ✏️)
  - Suppression par l'auteur OU l'admin — modale de confirmation
  - Signalement (🚩) → enregistré dans la table `reports`
  - Partage (🔗) → copie le lien ancré vers le commentaire
  - Menu ⋯ contextuel via React portal (jamais rogné)
  - Pagination "Voir X commentaires de plus" → Réduire
  - Realtime via Supabase (nouveau commentaire visible instantanément)
- 📄 Nouveau fichier SQL `comments-favorites.sql` (étape 8)

### v8.0 (2026-02-26) — Archivage & suppression des sons
- ✨ **Archiver un son** : masque le son du public sans le supprimer — restauration possible à tout moment
- ✨ **Supprimer définitivement** : supprime le son + fichiers audio/cover du storage Supabase
- 🔐 **Droits stricts** : seul l'uploader du son OU l'admin (`eloadxfamily@gmail.com`) peut archiver/supprimer
- ✨ **Menu ⋯ contextuel** sur chaque SongCard (visible uniquement si autorisé) — modale de confirmation pour chaque action
- ✨ **Badge "ARCHIVÉ"** sur la carte + onglet dédié "Archivés" dans le profil utilisateur avec compteur
- ✨ **Badge "⚡ ACTION ADMIN"** visible dans le menu quand l'admin agit sur un son qui n'est pas le sien
- ✅ Sons archivés filtrés de toutes les vues publiques (Accueil, Explorer, Profil artiste public)
- 📄 Nouveau fichier SQL `archive-songs.sql` à exécuter dans Supabase (étape 7)

### v7.0 (2026-02-26) — Fix logo & partage profil artiste + iOS PWA
- 🔴 Fix **logo NovaSound absent dans la carte de partage du profil artiste** : même cause CORS que v6 — remplacé par `/icon-192.png` local en data URL
- 🔴 Fix **avatar artiste CORS** dans la carte profil : converti en data URL via canvas avant génération `html-to-image`
- 🔴 Fix **icône iOS PWA transparente** : `apple-touch-icon.png` était en mode RGBA → iOS mettait un fond noir aléatoire. Converti en RGB avec fond `#030712` (couleur app) — icône propre à l'ajout sur l'écran d'accueil
- 🔴 Fix **boutons Follow/Modifier/Partager** : enveloppés dans `flex flex-wrap gap-2` → plus jamais collés, bouton Partager toujours visible sur tous les écrans (mobile centré, desktop aligné à gauche)
- ✅ `apple-touch-icon-precomposed` ajouté dans `index.html` → iOS ne rajoute plus son effet de brillance par dessus
- ✅ `waitForImages()` + partage multi-fallback dans `ArtistShareModal`
- 🧹 Suppression dossier `NovaSound-Titan-v5_5` obsolète

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
