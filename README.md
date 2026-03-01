# NovaSound TITAN LUX — v4000

## 🚀 Changelog v4000 (depuis v3000)

### 🐛 Bug Fix Critique
- **Édition commentaire song** : corrigé — le bug était une incohérence UUID/TEXT dans la RLS policy Supabase + absence du `.eq('user_id', ...)` dans la requête UPDATE. Désormais robuste avec gestion d'erreur explicite.

### 🎵 SongPage — Redesign Complet
- **Hero immersif** : cover avec effet parallax blur, glow coloré par genre, shadow dynamique
- **Waveform animée** : bars qui pulsent en rythme quand le son est en lecture
- **Mode cover plein écran** : clic sur la pochette → overlay immersif
- **Navigation ← → clavier** : ArrowLeft/ArrowRight naviguent entre les sons, Espace = play/pause
- **Mood/Vibe votes** : système crowd-sourcé — vote le vibe du son (🔥 Hype, 😌 Chill, 💪 Motivant…)
- **Compteur commentaires live** : mis à jour en temps réel
- **Boutons prev/next** visibles en haut de page
- **Tip clavier** affiché en sidebar desktop

### 💬 CommentSection — Fix + Amélioration
- **Bug edit résolu** : `.eq('user_id', currentUser.id)` + `.select()` + gestion des 0 rows
- **Message d'erreur précis** : distingue "refus RLS" vs erreur réseau
- **Feedback visuel** amélioré sur l'édition

### 🎵 AudioPlayer — Mini Player Tablette
- **Breakpoint SM (tablet portrait)** : layout intermédiaire `sm:flex md:hidden`
  - Cover 48×48, titre tronqué, artiste, boutons prev/play/next compacts
  - Like + close visibles sans débordement
  - Plus compact qu'avant tout en gardant les contrôles essentiels

### 📡 Offline / Background Sync
- **OnlineContext** : provider global `isOnline` + `wasOffline` + `onReconnect()`
- **OfflineBanner** : bannière animée (spring) affichée en hors-ligne + reconnexion
- **offlineStore** : IndexedDB léger pour sauvegarder les messages chat hors-ligne
- **ChatContext** : sauvegarde automatique hors-ligne en cas d'échec réseau

### 🧩 Nouveaux Composants
- `MoodVote` — vote de vibe crowd-sourcé avec animation
- `OfflineBanner` — bannière réseau non-intrusive
- `OnlineContext` — contexte réseau global
- `offlineStore` — wrapper IndexedDB offline

### 🗄️ Migration SQL v4000
**Fichier : `v4000-migration.sql`** — à exécuter dans Supabase SQL Editor

- Fix RLS `song_comments` UPDATE (UUID/TEXT robuste)
- Table `song_comment_replies` (imbrication niveau 2)
- Table `user_streaks` + fonction `update_user_streak()`
- Table `song_moods` + `get_song_dominant_mood()`
- Table `artist_spotlight` (mise en avant éditoriale)
- Colonne `songs.description`
- Colonne `users.last_seen` + `touch_user_last_seen()`
- Fonction `get_trending_songs_v4()` (algorithme score)
- RPC `sync_offline_messages()` (flush batch)
- 7 index performances supplémentaires

---

## 📦 Déploiement

```bash
cd web
npm install
npm run build
# Déployer sur Vercel/Netlify
```

## 🗄️ Migration

1. Ouvre Supabase Dashboard → SQL Editor
2. Copie-colle le contenu de `web/v4000-migration.sql`
3. Clique **Run** — la migration est idempotente (IF NOT EXISTS partout)

## 📌 Nom du commit

```
feat(v4000): fix comment edit RLS bug + SongPage hero redesign + mood votes + tablet mini player + offline sync
```
