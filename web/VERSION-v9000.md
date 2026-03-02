# NovaSound TITAN LUX — v9000

## Corrections et améliorations V9000

### 🔴 Fix CRITIQUE — Bouton ▶ Écouter synchronisé avec tous les players
- `isPlayingGlobal` ajouté dans `PlayerContext` et synchronisé par `AudioPlayer`
- `SongPage.handlePlay` toggle play/pause si le son est déjà chargé (via `novasound:toggle-play`)
- Bouton affiche ▶ / ⏸ selon l'état réel de lecture
- MiniPlayer, expanded player et desktop player tous synchronisés

### 🔴 Fix CRITIQUE — Offline sans internet → Lecteur Local sur TOUS les appareils (y compris PC)
- `OfflineRedirect` redirige depuis TOUTES les pages (pas seulement les pages "online-only")
- Service Worker v9000 : navigation offline → sert toujours `index.html` (SPA) → React redirige vers `/local-player`
- Fonctionne sur iOS (sans connexion), Android et PC

### 🔴 Fix CRITIQUE — iOS : sélection fichiers .mp3 dans le lecteur local
- `accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac,.opus,.webm,.mp4,.3gp,.caf,.aiff"` (extensions explicites pour iOS Safari)
- iOS reconnaît maintenant les fichiers .mp3 lors de la sélection fichier

### 🔴 Fix — NowPlayingScreen (player avec animation vague)
- Disponible sur PC : tout clic expand ouvre NowPlayingScreen pour les fichiers locaux
- Player EXCLUSIF pour les fichiers locaux (`is_local=true`)

### 🔧 Fix — Chat "Mes messages" : bulles sombres illisibles
- Backgrounds opaques et contrastés (`#12121e`, `#0e1428`)
- Texte body en `text-gray-200` (plus lisible)

### 🔧 Fix — Notifications : groupement par catégorie
- Panel notifications groupe les notifications par type (Likes, Commentaires, Abonnés, etc.)
- Header de section coloré pour chaque catégorie
- Vue filtrée reste plate (non groupée) quand un filtre est actif

### 🔧 Fix — Live Room : bouton "Stopper le live"
- Visible pour l'hôte ET pour l'admin (`eloadxfamily@gmail.com`)
- L'admin peut stopper n'importe quel live depuis la salle
- Admin Panel : bouton "Stopper" sur chaque salle active

### 🔧 Fix — Mot de passe oublié (NOUVEAU)
- Lien "Mot de passe oublié ?" sur la page connexion
- `sendPasswordReset()` dans `AuthContext` → email Supabase
- Page `/reset-password` complète avec validation, confirmation, redirect auto
- `updatePassword()` dans `AuthContext`

### 🛡️ Amélioration — Admin Panel v9000
- Ban / Débannir des utilisateurs
- Stopper des live rooms en direct (broadcast + DB)
- Supprimer/archiver des musiques
- Vider le chat global (message par message ou tout d'un coup)
- Nettoyer les salles live inactives
- Recherche globale utilisateurs/musiques
- Stats en temps réel

### 🗄️ SQL (v9000-migration.sql)
- Colonne `is_banned` sur la table `users`
- Index `idx_users_is_banned`
- Politique RLS pour bannissement
- Table `user_roles` si non existante (pour futurs admins)

### 🔢 Version bump
`package.json` 8.5.0 → 9.0.0 · manifest v8500 → v9000 · SW cache `novasound-titan-v8500` → `novasound-titan-v9000`
