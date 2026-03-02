## 📦 Changelog v8500 — Corrections critiques

### 🔴 Fix CRITIQUE — NotificationToast hors du Router (crash navigation)
`NotificationToast` utilisait `useNavigate()` mais était rendu **en dehors** du `<Router>` dans `App.jsx` → crash React dès qu'une notification était cliquée. **Fix** : déplacé à l'intérieur du `<Router>`.

### 🔴 Fix CRITIQUE — Route `/admin` manquante
`AdminPanel` importé dans `App.jsx` mais aucune `<Route path="/admin">` n'existait → panneau admin inaccessible. **Fix** : route ajoutée avec `ProtectedRoute`.

### 🔴 Fix — AdminPanel : requêtes `auth.users` invalides depuis le client
`supabase.from('auth.users')` et les joins `auth.users!host_id` échouaient silencieusement (schéma auth non accessible côté client). **Fix** : remplacé par `users` (table publique).

### 🔴 Fix SQL — Vue `user_stats` et fonction `get_user_conversations` utilisaient `auth.users`
Ces objets SQL référençaient `auth.users` dans un contexte inaccessible depuis les clients RLS. **Fix** : recréés pour utiliser uniquement `public.users`.

### 🔧 Lien Admin Panel dans le Header
Lien "Panneau Admin" (icône Shield 🛡️) ajouté dans le menu desktop et mobile, visible uniquement pour les admins.

### 🔢 Version bump
`package.json` 8.2.0 → 8.5.0 · manifest v8003 → v8500 · SW cache v8000 → v8500 · X-Client-Info 500.0.0 → 8500.0.0

### 🗄️ SQL (étape 20) : `v8500-migration.sql`
Migration complète incluant toutes les tables v8200 + corrections v8500.

---

## 📦 Changelog v900.0 — PWA Score · Chat Nettoyage Admin · Fix Warnings · Améliorations

### 🌐 PWA Manifest — Score PWABuilder amélioré

**Fix CRITIQUE — Screenshot taille incorrecte** :
- `background.png` déclarée en `1280x720` alors que la taille réelle est `1920x1080` → corrigé
- Screenshot mobile (`narrow`) ajoutée pour le score PWABuilder
- `display_override` ajouté : `["window-controls-overlay", "standalone", "minimal-ui"]`
- `dir: "ltr"` ajouté (direction de texte explicite)
- `launch_handler` ajouté : `client_mode: "focus-existing"` (évite d'ouvrir plusieurs fenêtres)
- `share_target` ajouté : NovaSound apparaît dans le menu de partage natif iOS/Android
- 3ème shortcut `Uploader` ajouté pour accès rapide depuis l'icône PWA
- Score PWABuilder passé de **26/44** vers score amélioré

### ♿ Fix Warning — Champs de formulaire sans id/name
- `ExplorerPage` : input recherche → `id="explorer-search" name="explorer-search" autoComplete="off"`
- `EditProfileModal` : input email → `id="profile-email" name="email" autoComplete="email"`
- `ChatPage` : textarea message → `id="chat-input" name="chat-message"`
- `ChatPage` : input édition message → `id="edit-msg-{id}" name="chat-edit"`
- Zéro warning DevTools "form field should have id or name attribute"

### 🧹 Chat Global — Nettoyer les messages (Admin uniquement)

**Bouton "Nettoyer"** visible uniquement pour `eloadxfamily@gmail.com` dans la barre du chat.

**Modale de confirmation en grande pompe** :
- Animation d'entrée spring avec icône Trash animée (rotation)
- Warning rouge clair : action irréversible pour tous les utilisateurs
- Affiche la période active visée (Aujourd'hui / 7 jours / Ce mois…)
- Bouton Confirmer rouge gradient avec état de chargement

**Animation de succès spectaculaire** :
- Icône ✨ Sparkles avec rotation spring
- 8 particules colorées qui explosent dans toutes les directions
- Barre de progression gradient cyan→fuchsia
- Fermeture automatique après 2.2 secondes + rechargement du chat

**Implémentation** :
- Soft-delete via `UPDATE chat_messages SET is_deleted = true` (messages récupérables en DB)
- Optionnellement utilisable via la RPC Supabase `clear_chat_messages(admin_id)` pour sécurité serveur
- Realtime : les messages disparaissent instantanément pour TOUS les utilisateurs connectés

### 🔧 Autres améliorations
- SW cache bumped : `novasound-titan-v40` → `novasound-titan-v41`
- **Version bump** : 800.0.0 → 900.0.0

### 🗄️ SQL (étape 19) : `v900-migration.sql`
- Colonnes `cleared_by` + `cleared_at` sur `chat_messages`
- Fonction RPC `clear_chat_messages(UUID)` sécurisée (SECURITY DEFINER)
- Index de performance `idx_chat_messages_not_deleted`
- Table `app_meta` pour version tracking

---

## 📦 Changelog v160.0 — Chat Pro · @tous · Commentaires · Fix Page Blanche

### 🔴 Fix CRITIQUE — Page blanche au clic sur un son (toujours présent)

**Cause racine identifiée et corrigée** : `SongPage` avait un `if (!song) return null` en fin de composant — si Supabase retournait `data=null` sans `error`, l'état `error` n'était pas set, `loading=false`, `song=null` → React rendait `null` = écran entièrement blanc.

**Fix** :
- Si le son a `is_deleted=true` → `setError(true)` immédiat
- Le `if (!song) return null` remplacé par l'affichage de l'état d'erreur complet ("Son introuvable" + bouton retour)
- Plus aucun chemin ne peut produire une page vide

---

### 💬 Système de commentaires de publication — Restauré et amélioré

Onglet **Commentaires** ajouté au profil utilisateur :
- Affiche tous tes commentaires sur des sons avec pochette + titre du son (cliquable)
- Date, likes reçus, chargement lazy

---

### 💬 Chat Global — Améliorations majeures v160

#### @tous multilingue
- `@tous`, `@all`, `@everyone`, `@todos`, `@tutti`, `@allen`… → notifie TOUT LE MONDE
- Suggestion dans l'autocomplétion, badge 📢 sur le message, fond teinté jaune

#### Suppression par l'auteur
- Chaque utilisateur peut supprimer **ses propres messages** (plus seulement l'admin)

#### Reply → Tag auto + notifications complètes
- Reply → `@username` préfixé automatiquement
- Auteur notifié dans **Mes messages** + **Notifications** + push écran
- Clic sur notification → retour direct dans le chat au message exact (scroll + highlight 3s)
- Chaîne de réponse complète et traçable

#### Onglet "Mes messages" amélioré
- Centralise : replies, @mentions, @tous
- Badge rouge non lus, icônes colorées par type
- Mark as read automatique au clic

### 🗄️ SQL (étape 18) : `v160-migration.sql`

**Version bump** : 150.0.0 → 160.0.0 | SW cache : novasound-titan-v22 → novasound-titan-v23

---

## 📦 Changelog v131.0 — Compatibilité universelle tous appareils

## 📦 Changelog v150.0 — Fix page blanche Explorer · Durée · Robustesse

### 🔴 Fix CRITIQUE — Page blanche au clic sur un son dans l'Explorer

**Symptôme** : Cliquer sur le titre ou le bouton ↗ d'une SongCard dans l'Explorer (vue grille) ouvrait une page entièrement blanche.

**Cause 1 — Skeleton SongPage vide** : L'état `loading` de `SongPage` retournait un `<div>` vide sans `<Header>` ni contenu visible. Pendant le chargement Supabase (~300–800ms), l'utilisateur voyait uniquement le fond noir — expérience identique à une page blanche.

**Fix** : `SongPage` retourne désormais un vrai skeleton animé (pochette + titre + boutons) avec `<Header>` et `<Footer>` pendant le chargement — le layout est stable immédiatement.

**Cause 2 — Erreur JS silencieuse dans `SongRow` (vue liste)** : `SongRow` contenait un `useEffect` qui appelait `setSongs()` — une fonction définie dans le composant parent `ExplorerPage` et hors de portée dans `SongRow`. Cette `ReferenceError` silencieuse pouvait casser le rendu de la vue liste.

**Fix** : `useEffect` retiré de `SongRow`. Le listener `novasound:song-updated` est désormais placé correctement dans `ExplorerPage` pour mettre à jour `songs[]` après édition d'un titre/artiste.

**Cause 3 — SongPage redirige vers `/` sur toute erreur** : Le `catch` de `fetchSong` appelait `navigate('/', { replace: true })` même sur erreur réseau temporaire. L'utilisateur était expulsé de la page sans comprendre pourquoi.

**Fix** : En cas d'erreur ou de son introuvable, `SongPage` affiche désormais un état d'erreur clair ("Son introuvable") avec un bouton retour à l'accueil — pas de redirection automatique.

---

### 🔴 Fix — Durée `--:--` affichée pour les sons sans durée en base

**Symptôme** : Les SongCards et la vue liste affichaient systématiquement `--:--` pour les morceaux dont la colonne `duration_s` est `NULL` en base (morceaux uploadés avant v20).

**Fix — `SongCard`** : Le badge durée est désormais conditionnel — il n'apparaît que si `song.duration_s > 0`. Plus de `--:--` visible.

**Fix — `SongRow` (vue liste)** : Même logique — cellule durée vide si `duration_s` manquant.

**Fix — `AudioPlayer` mini-player mobile** : Utilise `song.duration_s` comme valeur de fallback avant que l'`<audio>` ait chargé ses métadonnées — la durée totale s'affiche dès l'ouverture du player au lieu de `0:00`.

**Fix — `AudioPlayer` expanded + desktop** : Même fallback sur `currentSong.duration_s` pour l'affichage durée restante (`-mm:ss`).

**Fix — `SongPage`** : La durée affichait les secondes sans `Math.round()` → les décimales de `duration_s % 60` pouvaient produire des valeurs incorrectes. Corrigé.

---

### 🔧 Fixes mineurs

- `SongActionsMenu` : le listener `novasound:song-updated` dans `ExplorerPage` met désormais à jour les données en temps réel sans erreur JS
- Version bump : 131.0.0 → 150.0.0 | SW cache : `novasound-titan-v21` → `novasound-titan-v22`

---

### 📐 Layout mobile — Player + BottomNav
- Paddings bas unifiés : **pb-36 md:pb-32** sur toutes les pages (pb-24/pb-28 étaient insuffisants)
- Le contenu n'est plus masqué par le mini-player + BottomNav sur iPhone/Android
- **ChatPage** hauteur dynamique quand le player est actif

### 📏 iOS Safari — 100dvh
- `calc(100vh - 64px)` → `calc(100dvh - 64px)` : barre d'URL flottante iOS corrigée

### 🎵 WaveformVisualizer — Android < 7
- CSS custom properties supprimées, chaque barre a sa propre keyframe `waveBar_N`

### ⌨️ autoFocus remplacé partout
- `ref={el => el && setTimeout(() => el.focus(), 50)}` dans tous les modals/forms
- Évite le scroll/zoom brutal sur iOS Safari

### ♿ prefers-reduced-motion
- Animations CSS désactivées si l'utilisateur le demande dans ses réglages système

**Version bump** : 130.0.0 → 131.0.0 | SW cache : novasound-titan-v20 → novasound-titan-v21

---

## 📦 Changelog v130.0 — Nettoyage · Radio · Online · Playlists sync

### 🧹 Suppression complète de l'ancienne messagerie privée

- Fichiers `MessagesPage.jsx` et `MessageContext.jsx` **supprimés** définitivement
- `MessageProvider` retiré de `App.jsx` — zéro import, zéro référence restante
- Lien bugué `setIsMenuOpen` dans le menu mobile du Header **corrigé** → `closeMenu()` (le Chat Global était inaccessible depuis le menu mobile)
- Plus aucun lien ne mène à une page blanche liée à l'ancienne messagerie

### 🟢 Compteur d'utilisateurs en ligne — visible de tous

- Le badge "X en ligne" dans le Chat Global est désormais **visible de tous les utilisateurs**, pas seulement de l'admin
- Affiché dans l'en-tête du Chat avec animation pulse verte

### 📻 Mode Radio — feedback visuel + toast

- Activation/désactivation du mode Radio déclenche maintenant un **toast de confirmation** immédiat ("Mode Radio activé 📻" / "Mode Radio désactivé")
- L'état actif est clairement indiqué (bouton cyan avec point animé)
- La logique radio (lecture infinie basée sur le genre/artiste) était déjà fonctionnelle

### 🎵 Playlists — synchronisation automatique

- `PlaylistContext` charge désormais automatiquement les playlists **dès la connexion** de l'utilisateur (plus besoin de visiter `/playlists` d'abord)
- Le modal "Ajouter à une playlist" dans le player affiche immédiatement les playlists créées depuis le profil
- Synchronisation bidirectionnelle : création depuis le profil ↔ visible dans le player, et vice versa

### 🔧 Fixes mineurs

- Import `MessageCircle` conservé (icône de commentaires dans SongCard — usage légitime)
- Service Worker bumped : `novasound-titan-v19` → `novasound-titan-v20`

**Version bump** : 130.0.0 → 131.0.0 | SW cache : novasound-titan-v20 → novasound-titan-v21

---



### 1. 🎵 Mini-Playlist (File d'attente) — 2 nouveaux boutons

**Bouton « Playlist »** (icône + violet) :
- Ouvre directement `AddToPlaylistModal` pour le son en cours de lecture
- Identique au bouton ⊕ des SongCards dans Explorer — même fonctionnalité, intégré à la mini-playlist
- Visible uniquement si l'utilisateur est connecté

**Bouton « Ce mois » (icône calendrier cyan)** :
- Affiche tous les sons publiés pendant le mois en cours (modal slide-up)
- Triés par nombre d'écoutes décroissant
- Cliquer sur un son navigue vers sa page `/song/:id`

---

### 2. 💬 Chat Global — Tagage @username & onglet "Mes messages"

**Tagage @username** :
- Taper `@` dans la zone de saisie déclenche une autocomplétion des utilisateurs inscrits
- La liste filtre en temps réel selon les caractères saisis après `@`
- Cliquer sur un utilisateur dans la liste l'insère dans le texte
- Les @mentions apparaissent en cyan dans les bulles de message

**Onglet « Mes messages »** :
- Affiche tous les messages du chat global contenant `@votre_pseudo`
- Cliquer sur un message reçu : navigue vers le Chat Global, highlight le message original (2s en cyan) ET pré-rempli automatiquement la zone de saisie avec `@expéditeur `
- Rechargement automatique à chaque ouverture de l'onglet

**Nouveaux filtres de période** :
- Aujourd'hui · 7 jours · Ce mois · Cette année · Tout
- "Ce mois" : messages depuis le 1er du mois courant
- "Cette année" : messages depuis le 1er janvier

---

### 3. 🗑️ Messagerie privée retirée des menus

- Lien « Messages » retiré du header desktop (icône + lien dans le dropdown)
- Lien « Messages » retiré du menu mobile hamburger
- Le Chat Global reste le point d'entrée unique de communication
- La route `/messages` reste accessible techniquement mais n'est plus mise en avant

---

### 4. 📁 Upload Musique — Zone unique d'import

- Les 2 zones distinctes ("Mes fichiers" / "Cloud / Stockage") remplacées par **une seule grande zone** avec icône FileAudio cyan
- Une seule balise `<input type="file" accept="audio/*,...">` — le système d'exploitation choisit lui-même le picker approprié :
  - **iOS** → Files.app (accès à iCloud Drive, stockage local, apps tierces)
  - **Android** → Gestionnaire de fichiers natif (stockage interne, carte SD, Drive)
  - **PC/Mac** → Explorateur de fichiers / Finder
- `multiple={false}` — un seul fichier à la fois
- Aucun attribut `capture` — jamais d'ouverture caméra/micro

---

### 🔧 Fixes divers détectés et corrigés

- Import `MessageCircle` retiré du Header (inutile après suppression du lien Messages)
- Autocomplétion @mention : `onMouseDown` (pas `onClick`) pour éviter la perte de focus sur l'input
- Navigation `/chat?highlight=ID&tagger=USERNAME` pour la redirection depuis "Mes messages"

**Version bump** : 101.0.0 → 120.0.0 | SW cache : novasound-titan-v17 → novasound-titan-v18

## 📦 Changelog v101.0 — Fix messages chat

### 🔴 Fix CRITIQUE — 3 bugs bloquant l'envoi de messages

**Bug 1 — Provider nesting cassé dans `App.jsx`**
`<ChatProvider>` était imbriqué avec une indentation incorrecte à l'intérieur de `<MessageProvider>` → les balises fermantes étaient désalignées → React ne montait pas `ChatContext` correctement → `sendChatMessage` était undefined au moment de l'appel.

**Bug 2 — Pas d'optimistic update**
Les messages n'apparaissaient qu'après confirmation Realtime Supabase (latence réseau + Realtime non configuré si SQL pas encore exécuté). Ajout d'un affichage immédiat du message (grisé + `···`) avant confirmation serveur, remplacé par la vraie donnée au retour, ou annulé en cas d'erreur.

**Bug 3 — `currentUser` incomplet dans l'optimistic message**
Le message optimiste récupère maintenant `username` et `avatar_url` depuis `currentUser.user_metadata` en fallback.

**Version bump** : 100.0.0 → 101.0.0 | SW cache : novasound-titan-v16 → novasound-titan-v17

---

## 📦 Changelog v100.0 — Chat Public Global 🌐

### 🆕 Nouveau système : Chat Global communautaire (remplace la messagerie privée)

Inspiré du chat communautaire de Lord Mobile — une boîte de conversation commune à TOUS les utilisateurs.

#### Fonctionnalités

**Filtres de période**
- Aujourd'hui · 7 derniers jours · 30 derniers jours · Tout voir
- Changement de période instant avec rechargement

**Reply / Tagage de message**
- Cliquer sur un message → bouton "Répondre" → preview du message cité dans la saisie
- Le message envoyé affiche le bloc cité avec l'auteur et un extrait
- Cliquer sur le bloc cité scrolle vers le message original (highlight cyan 2s)

**Réactions emoji**
- Palette : ❤️ 🔥 🎵 👏 😂 🙌 💯 😍
- Toggle : cliquer une réaction déjà posée l'enlève
- Realtime : les réactions des autres apparaissent instantanément
- Compteur par emoji avec indicateur "j'ai réagi" (couleur cyan)

**Realtime Supabase**
- Nouveau message → apparaît immédiatement pour tout le monde
- Soft delete → disparaît instantanément pour tout le monde
- Présence : compteur "X en ligne" (Supabase Presence)

**UX**
- Scroll auto en bas sur nouveau message (si déjà en bas)
- Bouton flottant ↓ pour revenir en bas
- Pagination remontante (charger plus) avec maintien de position
- Compteur de caractères (max 1000)
- Shift+Enter = saut de ligne, Enter = envoyer
- Connecté requis pour écrire (non-connectés peuvent lire)
- Soft delete (auteur + admin) — message retiré sans laisser de trace

#### Fichiers ajoutés/modifiés
| Fichier | Action |
|---------|--------|
| `v100-chat-public.sql` | **Nouveau** — tables `chat_messages` + `chat_reactions` + RLS + fix RLS messages privés |
| `src/contexts/ChatContext.jsx` | **Nouveau** — context global : fetch, realtime, réactions, période, présence |
| `src/pages/ChatPage.jsx` | **Nouveau** — interface complète 517 lignes |
| `src/App.jsx` | Route `/chat` + `<ChatProvider>` |
| `src/components/Header.jsx` | Lien "Chat" dans nav desktop + mobile |

#### SQL à exécuter dans Supabase (étape 17)
```sql
-- Depuis Supabase Dashboard → SQL Editor
-- Exécuter : v100-chat-public.sql
```
Ce script inclut aussi le **fix du bug messages privés** (RLS UUID vs TEXT).

### 🔴 Fix messages privés — messages qui ne partent pas
- **Cause** : policies RLS sur la table `messages` utilisaient `auth.uid()` (UUID) comparé à `sender_id` (TEXT) — certains projets Supabase refusent ce cast implicite
- **Fix** : toutes les policies recrées avec `auth.uid()::text` explicite dans `v100-chat-public.sql`

**Version bump** : 95.0.0 → 100.0.0 | SW cache : novasound-titan-v15 → novasound-titan-v16

---

## 📦 Changelog v95.0

### 🔴 Fix CRITIQUE — Messagerie : clavier iOS qui disparaît + messages non envoyés

**Cause racine** : `ConvList` et `ChatView` étaient définis comme des **fonctions-composants à l'intérieur du composant parent** `MessagesPage`. À chaque frappe dans un input, le parent se re-rend → React détruisait et recréait ces composants → démontage complet de l'input → perte du focus → clavier fermé. Même mécanisme empêchait l'envoi (closure stale sur `newMsg`).

**Fix** : `ConvList` et `ChatView` extraits **complètement hors du composant parent**, wrappés en `React.memo`. Toutes les callbacks passées en props via `useCallback` pour éviter les re-renders inutiles.

**Détails supplémentaires** :
- Focus auto sur desktop uniquement (`window.innerWidth >= 768`) — sur iOS le focus auto déclenche un scroll non désiré
- `handleSend`, `handleKeyDown` etc. tous wrappés en `useCallback`
- Barre de recherche : même fix, `onSearchChange` reçoit directement `setSearchQuery` stable

### 🔴 Fix iOS — Profil blanc / chargement très lent (`UserProfilePage`)

**Cause** : `fetchUserData` enchaînait **6 requêtes Supabase séquentiellement** avant d'appeler le moindre `setState`. Sur iOS réseau mobile lent, tout restait blanc jusqu'à la fin (ou jusqu'au timeout 10s).

**Fix** : Chargement en 2 étapes :
1. Requête profil seule → `setProfile(userData)` + `setLoading(false)` immédiatement → le header du profil s'affiche en ~300ms
2. Les 5 requêtes secondaires (sons, favoris, likes, followers, following) lancées en **`Promise.allSettled` parallèle** — chaque donnée s'affiche dès qu'elle arrive, sans bloquer les autres

**Version bump** : 90.0.0 → 95.0.0 | SW cache : novasound-titan-v14 → novasound-titan-v15

---

## 📦 Changelog v90.0

### 🔍 Audit complet synchronisation — 3 bugs supplémentaires corrigés

**Bug 1 — Modale d'édition playlist en double (`MyPlaylistsPage`)**
- Le bloc `<AnimatePresence>{editTarget && ...}` était rendu **deux fois** dans le JSX (copier-coller oublié)
- Fix : suppression du bloc dupliqué

**Bug 2 — Ajout d'un son à une playlist ne se reflétait pas en temps réel (`AddToPlaylistModal`)**
- Quand l'utilisateur ajoutait un son depuis le modal ⊕, la `PlaylistPage` déjà ouverte en fond ne se mettait pas à jour
- Fix : dispatch `novasound:playlist-song-added` dans `handleAdd` et `handleCreate` de `AddToPlaylistModal`

**Bug 3 — `PlaylistPage` n'écoutait pas les ajouts de sons**
- Fix : nouveau listener `novasound:playlist-song-added` dans `PlaylistPage` → ajoute le son à la liste locale si la playlist correspond

**Version bump** : 85.0.0 → 90.0.0 | SW cache : novasound-titan-v13 → novasound-titan-v14

---

## 📦 Changelog v85.0

### 🔄 Synchronisation universelle après modification d'une publication

**Problème** : Après avoir modifié le titre ou le nom d'artiste d'un son via le menu ⋯, les changements n'apparaissaient pas dans :
- Le mini player / file d'attente (Image 1)
- La PlaylistPage (Image 2)
- Les pages profil, explorer, artiste, page du son (Image 3)

**Cause** : L'événement `novasound:song-updated` était dispatché mais aucun composant ne l'écoutait.

**Fix** : Ajout de listeners `novasound:song-updated` dans :
- `PlayerContext` → met à jour `currentSong`, `playlist[]`, et `queue[]` en mémoire
- `PlaylistPage` → met à jour la liste locale des sons de la playlist
- `UserProfilePage` → met à jour `userSongs`, `likedSongs`, `favoriteSongs`
- `ArtistProfilePage` → met à jour `songs[]`
- `ExplorerPage` → met à jour `songs[]`
- `SongPage` → met à jour le `song` affiché

**Version bump** : 80.0.0 → 85.0.0 | SW cache : novasound-titan-v12 → novasound-titan-v13

---

## 📦 Changelog v80.0

### 🔴 Fix Build — SongActionsMenu apostrophe
- Correction d'un bug de syntaxe JSX dans `SongActionsMenu.jsx` ligne 255 : l'apostrophe dans `'Le nom d'artiste est obligatoire'` cassait le build esbuild/Vite (`Expected ")" but found "artiste"`)
- Fix : chaîne convertie en guillemets doubles → `"Le nom d'artiste est obligatoire"`
- **Version bump** : 75.0.0 → 80.0.0 | SW cache : novasound-titan-v11 → novasound-titan-v12

---

## 📦 Changelog v75.0

### 🎵 Synchronisation Playlist Lecture ↔ Playlist Profil
- `PlayerContext` étendu : `currentPlaylistId` mémorise la playlist Supabase en cours de lecture
- `playSong()` accepte maintenant un 3ème argument `playlistId` pour lier le player à une playlist profil
- `removeFromPlaylist()` : retire un son de la playlist de lecture ET supprime la ligne `playlist_songs` en base — synchro bidirectionnelle
- `PlaylistPage` : `handlePlayAll/handlePlayShuffle` transmettent l'ID de playlist au player ; `handleRemoveSong` appelle `removeFromPlaylist` si la playlist courante est liée
- Event `novasound:playlist-song-removed` : écoute dans `PlaylistPage` pour répercuter les suppressions faites depuis le mini-player

### 📋 Mini Playlist (Queue Panel)
- **Icône poubelle** 🗑️ par musique dans la file d'attente (remplace le X) — plus explicite, jamais ambigu
- **Boutons "Vider" et "X" espacés** (`gap-3`, bouton Vider avec bordure `min-w-[60px]`) — fini la confusion sur mobile
- **Flou d'arrière-plan** : à l'apparition du panneau queue, un overlay `backdrop-filter: blur(8px)` assombrit le contenu du player — la liste est parfaitement lisible

### ✏️ Gestion Playlists Profil
- `MyPlaylistsPage` : bouton **Modifier** (crayon bleu) sur chaque carte playlist → modale d'édition (nom, description, public/privé)
- Modal d'édition avec validation, bouton Enregistrer/Annuler, synchronisé avec `PlaylistContext.updatePlaylist()`

### 🎤 Modification de Publication (Artiste)
- `SongActionsMenu` : nouvelle option **Modifier** (icône Edit2, couleur bleue) dans le menu ⋯
- `EditSongModal` : modale dédiée permettant de modifier **nom d'artiste**, **titre** et **description** (champs indépendants — modifie uniquement les champs changés)
- Validation côté client : titre et nom d'artiste obligatoires
- Event `novasound:song-updated` dispatché après sauvegarde pour notifier les composants parents

### 📱 Upload Musique — iOS & Gestionnaires de Fichiers
- **Magnétophone supprimé** — plus d'icône ambiguë
- **2 zones de sélection distinctes** :
  - 🗂️ **Mes fichiers** (icône dossier bleu) → Files.app iOS, Explorateur Android
  - ☁️ **Cloud / Stockage** (icône upload orange) → iCloud Drive, Google Drive, carte SD
- `multiple={false}` explicite sur tous les `<input type="file">` audio
- `capture` jamais défini → le système ouvre toujours le gestionnaire de fichiers, jamais le micro/caméra
- Zone "Changer" visible après sélection — meilleure UX
- Pochette : même refonte visuelle

### 🔧 Fixes divers
- `package.json` → v75.0.0 · SW cache `novasound-titan-v10`

# NovaSound-TITAN LUX v75

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
| 1 | `setup-supabase.sql` | Tables de base, RLS, triggers, création auto profil |
| 2 | `news-likes.sql` | Table `news_likes` + trigger `likes_count` |
| 3 | `increment-plays.sql` | Fonction RPC atomique pour les écoutes |
| 4 | `fix-rls-avatars.sql` | Politiques RLS sur le bucket `avatars` |
| 5 | `moderation-system.sql` | Table `reports` + rôles modérateur/admin |
| 6 | `enable-realtime.sql` | Active Supabase Realtime sur `likes` et `news_likes` |
| 7 | `archive-songs.sql` | Colonnes `is_archived` + `is_deleted` + politiques RLS |
| 8 | `comments-favorites.sql` | Tables `favorites`, `song_comments`, `comment_likes` + RLS |
| 9 | `v20-migration.sql` | Colonnes `genre` et `duration_s` sur `songs` + index |
| 10 | `v30-migration.sql` | Index perf + vue `spotlight_songs` + `get_artist_stats()` + `bio_url` |
| 11 | `v60-migration.sql` | Tables `playlists` + `playlist_songs` + RLS + RPC `add_song_to_playlist` |
| 12 | `v70-migration.sql` | Table `messages` (messagerie privée) + RLS + index |
| 13 | `v71-fix-upload-rls.sql` | Fix politiques RLS Storage (upload audio/cover sans erreur 401) |
| 14 | `notifications.sql` | Table `notifications` + RLS + Realtime |
| 15 | `owner-edit-delete-rls.sql` | Droits propriétaire : modifier/supprimer ses propres sons |
| 16 | `fix-comments-rls.sql` | Correction RLS commentaires |
| ... | *(v17 → v19 : chat, v8000-v8200 migrations)* | Voir fichiers SQL dans le dossier |
| 20 | `v8500-migration.sql` | ⚠️ **v8500** : messagerie privée avancée, sessions audio, cache, corrections auth.users |

> ⚠️ **Exécuter tous les fichiers dans l'ordre.** Chaque script utilise `IF NOT EXISTS` — aucun risque de doublon sur une base déjà peuplée.

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
    ├── setup-supabase.sql       # ⚠️ Étape 1
    ├── news-likes.sql           # ⚠️ Étape 2
    ├── increment-plays.sql      # ⚠️ Étape 3
    ├── fix-rls-avatars.sql      # ⚠️ Étape 4
    ├── moderation-system.sql    # ⚠️ Étape 5
    ├── enable-realtime.sql      # ⚠️ Étape 6
    ├── archive-songs.sql        # ⚠️ Étape 7
    ├── comments-favorites.sql   # ⚠️ Étape 8
    ├── v20-migration.sql        # ⚠️ Étape 9
    ├── v30-migration.sql        # ⚠️ Étape 10
    ├── v60-migration.sql        # ⚠️ Étape 11
    ├── v70-migration.sql        # ⚠️ Étape 12
    ├── v71-fix-upload-rls.sql   # ⚠️ Étape 13
    ├── notifications.sql        # ⚠️ Étape 14
    ├── owner-edit-delete-rls.sql # ⚠️ Étape 15
    └── fix-comments-rls.sql     # ⚠️ Étape 16
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

## 🎵 Fonctionnalités v30.0

**Player**
- **Thème couleur dynamique** : fond, bouton Play et visualiseur changent de couleur selon le genre du son en lecture — 19 thèmes (Afrobeats, Hip-Hop, R&B, etc.)
- **Waveform Visualizer** : 36 barres CSS animées dans le player expanded, synchronisées sur play/pause
- **File d'attente (Queue)** : bouton ⊕ sur chaque SongCard pour empiler des sons. Panneau dédié dans le player expanded (slide from bottom) avec liste réorderable, suppression individuelle, bouton "Vider". Le son suivant en queue est prioritaire sur la playlist.
- **Sleep Timer (minuteur de sommeil)** : arrête automatiquement la lecture après 5, 10, 15, 20, 30, 45 ou 60 minutes. Compte à rebours visible dans le header du player (🌙 + timer) et dans le mini-player mobile. Annulable à tout moment.
- **Swipe-to-close mobile** : glisser le mini-player vers le bas (>60px) ferme le lecteur naturellement.
- **Mode immersif** : fond pochette flou + plein écran natif (Android/Desktop) ou CSS (iOS), inchangé et stable.
- **Badge genre** visible dans le player expanded et dans le mini-player desktop.

**Homepage**
- **SpotlightCarousel** : carrousel auto-défilant des 5 derniers sons avec fond pochette, lecture directe, navigation flèches + dots
- **Section "Top 3 du moment"** : les 3 sons les plus écoutés, affichés avec médailles 🥇🥈🥉, pochette en fond flou, plays count et genre. Lecture directe au clic.

**Profils Artiste**
- **ArtistStatsCard** : 4 cartes visuelles animées (écoutes, likes, sons, abonnés) avec formatage intelligent

**Onboarding**
- **Guide 4 étapes** pour les nouveaux utilisateurs : apparaît une seule fois, thèmes colorés, raccourcis vers les pages clés

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

### v30.0 (2026-02-27) — Thème Genre · Waveform · Carrousel · Stats Artiste · Onboarding

- 🎨 **Thème couleur dynamique par genre** dans le player : le fond lumineux, le bouton Play et le visualiseur s'adaptent automatiquement à la couleur du genre du son en lecture (17 thèmes distincts — Afrobeats → amber, Hip-Hop → violet, Trap → rouge, Gospel → orange…). `useGenreTheme.js` centralisé.
- 🎵 **Waveform Visualizer** dans le player expanded : 36 barres CSS animées synchronisées sur le play/pause — zero overhead (pas de Web Audio API). Couleur accordée au thème genre. `WaveformVisualizer.jsx`.
- 🎠 **SpotlightCarousel** sur la HomePage : carrousel auto-défilant des 5 derniers sons, entre la Hero section et le Top 3. Auto-défilement toutes les 5 secondes, navigation par flèches et dots, fond pochette avec overlay gradient. Lecture directe au clic. `SpotlightCarousel.jsx`.
- 📊 **ArtistStatsCard** sur les profils artiste : remplace les stats textuelles par 4 cartes visuelles animées (écoutes totales, likes totaux, sons publiés, abonnés) avec icônes et formatage intelligent (1.2k, 3.4M…). `ArtistStatsCard.jsx`.
- 🎓 **OnboardingToast** — guide 4 étapes pour les nouveaux utilisateurs : apparaît 1,8s après la première connexion, visible une seule fois par compte (flag `novasound.onboarding.{uid}` en localStorage), thème par étape, navigation Suivant/Terminer + raccourci vers Explorer/Upload/Profil. `OnboardingToast.jsx`.
- 🗄 **v30-migration.sql** : index composites `(genre, plays_count)` + `(uploader_id, created_at)`, vue `spotlight_songs`, fonction RPC `get_artist_stats(uuid)`, colonne `bio_url` sur `users`.
- 🔢 **Versions** : `package.json → 30.0.0` · SW cache `novasound-titan-v7` · client-info `30.0.0`.

---

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

### v40.0 (2026-02-27) — Fix upload avatar mobile & plein écran PC + raccourcis clavier

- 🔴 Fix **upload avatar "Failed to fetch" sur Android/iOS** : nouvelle stratégie d'upload à deux niveaux :
  - **Niveau 1** : SDK Supabase avec retry ×3 (inchangé)
  - **Niveau 2 (nouveau fallback)** : si fetch échoue (`TypeError: Failed to fetch` ou timeout réseau), bascule automatiquement sur un `XMLHttpRequest` PUT direct vers l'API REST Supabase Storage — contourne les limitations WebView Android et certains proxy mobiles
  - Compression double : 600px JPEG 0.80 d'abord, puis 400px JPEG 0.65 si encore > 200 KB — garantit < 150 KB pour tout réseau mobile
  - Indicateur de progression visuel pendant l'upload (compression / envoi / URL / mise à jour)
- 🔴 Fix **boutons Précédent/Suivant en mode plein écran PC** : les boutons transport dans le player expanded utilisent désormais les **refs** (`goNextRef.current()`, `goPreviousRef.current()`) au lieu des closures directes — élimine tout risque de stale closure en mode fullscreen natif
- ✨ **Raccourcis clavier** en mode expanded/plein écran :
  - `→` / `←` : son suivant / précédent
  - `Space` / `K` : play/pause
  - `M` : muet/son
  - `Echap` : quitter le plein écran ou réduire le player
- 🔧 **Cache SW** bumped → `novasound-titan-v8`
- 🔢 **Bump versions** : `package.json → 40.0.0`, client-info header → `40.0.0`

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

---

## 📦 Changelog v50.0

### 🎚️ AudioPlayer — Volume persistant + Vitesse de lecture
- Volume et état mute sauvegardés dans `localStorage` → retrouvé à chaque rechargement
- Bouton **vitesse de lecture** : 0.75×, 1×, 1.25×, 1.5×, 2× — menu flottant en mode expanded
- **Durée restante** affichée à droite de la seek bar (`-mm:ss` au lieu de la durée totale)
- Raccourci clavier `Escape` ferme aussi le menu vitesse
- La vitesse est appliquée immédiatement à `audioRef.playbackRate` à chaque changement

### 🎵 SongCard — Animation "En lecture" + Compteur commentaires
- Nouvelle animation **égaliseur** 4 barres (CSS `@keyframes equalizer`) avec badge "LIVE" cyan
- **Compteur de commentaires** affiché si > 0 (fetch léger depuis `song_comments`, non-bloquant)
- Cliquable → redirige vers la page du son

### 🏠 HomePage — Realtime
- Souscription Supabase Realtime sur `songs INSERT` → nouveaux sons ajoutés en tête de liste sans rafraîchir
- Badge **"NEW"** animé (gradient cyan-magenta, pulse) sur les cartes arrivées en temps réel

### 🔍 ExplorerPage — Améliorations tri & stats
- Nouveaux tris : **Plus longs** (`-duration_s`) et **Plus courts** (`duration_s`)
- **Total exact** des morceaux affiché (requête `count: 'exact'`) plutôt que le nombre chargé

### 👤 UserProfilePage — Statistiques enrichies
- Compteur **Écoutes totales** ajouté dans les stats du profil (formaté k/M)
- Badge ✦ **artiste populaire** si ≥ 1 000 écoutes totales

### 🎨 ArtistProfilePage — Badge + 5ème stat
- Badge ✦ populaire (même logique que UserProfilePage)
- `ArtistStatsCard` : 5ème stat **Commentaires totaux** (fetch `song_comments`)
- Grille passe de 4 à 5 colonnes (`sm:grid-cols-5`)

### 📱 MusicUploadPage — Upload audio/cover robuste mobile
- Même architecture XHR fallback que v40 (EditProfileModal) appliquée à l'upload audio + cover
- Timeout XHR 60s (adapté aux gros fichiers audio)
- Retry ×3 SDK puis fallback `XMLHttpRequest POST` direct si fetch échoue sur WebView Android

### 🎨 CSS — Nouvelles animations
- `@keyframes equalizer` pour l'animation des barres de l'égaliseur SongCard
- `.scrollbar-hide` pour masquer la scrollbar sur mobile (tabs profil)

**Version bump** : 40.0.0 → 50.0.0 | SW cache : v8 → v9

---

## 📦 Changelog v9000 — TITAN LUX

### 🔴 Fixes critiques

- **▶ Bouton Écouter synchronisé** — `isPlayingGlobal` dans `PlayerContext` : le bouton reflète l'état réel play/pause sur toutes les pages (SongPage, mini-player, desktop player)
- **📶 Offline-first** — redirection automatique vers le lecteur local depuis toutes les pages quand hors ligne (iOS, Android, PC)
- **🍎 iOS MP3** — attribut `accept` étendu avec `.mp3,.m4a,.wav...` : Safari iOS reconnaît maintenant les fichiers MP3 dans le sélecteur de fichiers
- **🔒 Mot de passe oublié** — flow complet : `LoginPage` (formulaire email) → email Supabase → `ResetPasswordPage` (`/#/reset-password`) → nouveau mot de passe → redirect profil
- **💬 Chat "Mes messages"** — bulles opaques (`#12121e` / `#0e1428`) + texte `text-gray-200` : lecture confortable
- **🔔 Notifications groupées** — `NotificationBell` regroupe par catégorie (likes, commentaires, follows, mentions, nouveaux sons) avec headers colorés

### 🆕 Nouvelles fonctionnalités

- **👑 Panneau Admin complet** (`AdminPanel.jsx`) — 5 onglets : Stats, Live Rooms, Utilisateurs, Sons, Chat. Ban/déban, stop live, suppression messages, nettoyage salles inactives
- **⚡ Stop Live admin** — `eloadxfamily@gmail.com` peut stopper n'importe quelle salle live (bouton "⚡ Stop Admin" dans `LiveRoomPage`)
- **🌊 NowPlayingScreen** — lecteur wave exclusif aux fichiers locaux, accessible sur PC, mobile et tablette

### 🗄️ SQL

| Étape | Fichier | Description |
|-------|---------|-------------|
| 21 | `v9000-migration.sql` | `users.is_banned` + `ban_reason` + `ban_expires_at`, `user_roles` (TEXT ids), fonction `is_admin(TEXT)`, policies RLS avec `auth.uid()::text`, index perf, `cleanup_inactive_rooms()` |

> ⚠️ Ajouter dans Supabase → Authentication → URL Configuration → Redirect URLs :
> `https://nova-sound-titan.vercel.app/#/reset-password`

**Version bump** : 8.5.0 → 9.0.0 | SW cache : `novasound-titan-v8500` → `novasound-titan-v9000` | manifest : 8500 → 9000
