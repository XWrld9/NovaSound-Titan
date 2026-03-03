# NovaSound TITAN LUX — v12000

## Correctifs v12000

### 🎵 Lecteur Local
- ✅ **"Vider la playlist locale"** fonctionne maintenant correctement (arrête aussi le player global)
- ✅ **Playlists persistantes** : utilisation d'IndexedDB pour stocker les playlists entre sessions
- ✅ **File System Access API (PC)** : sur Chrome/Edge PC, les fichiers sont mémorisés avec `FileSystemFileHandle` — relecture sans re-sélection
- ✅ **Lecteur Local accessible sur PC** : ajouté dans le Header desktop ET le menu mobile
- ✅ **Shuffle & Repeat synchronisés** : état partagé via PlayerContext entre AudioPlayer, mini-lecteur local, et NowPlayingScreen

### 📊 TOP — Artistes
- ✅ **Auditeurs synchronisés** : `get_trending_artists()` utilise maintenant `song_play_events` pour compter les vraies écoutes par période (24h, 7j, 30j) au lieu des uploads récents
- ✅ **Table `song_play_events`** : chaque écoute est loggée avec timestamp pour des statistiques précises

### 💬 Chat Global & Mes Messages
- ✅ **"Mes messages"** : titre complet visible et lisible (plus de truncate abusif)
- ✅ Amélioration layout titre + date + badge non-lu

### 🔔 Notifications Push
- ✅ **Push garanti** : double déclenchement — webhook DB + appel direct Edge Function en backup
- ✅ **RLS push_subscriptions** corrigé pour multi-appareils
- ✅ Index performance sur notifications

### 🗄️ Migration SQL v12000
- `novasound-v12000-migration.sql` à exécuter dans Supabase SQL Editor

### 📦 Commit
`feat(v12000): local-player persistence FSA+IDB, shuffle/repeat sync, trending play_events, push backup, mes-messages layout, local nav PC`
