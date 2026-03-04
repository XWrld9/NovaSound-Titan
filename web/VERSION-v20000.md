# NovaSound TITAN LUX — v20000 Changelog

## 🚀 Version 20.0.0 — Release majeure

### 🐛 BUGS CORRIGÉS
- **LocalPlayerPage CRASH** — `verifyBlobUrl` référencé avant sa déclaration (hook circulaire) → ordre des callbacks strictement respecté
- **AdminPanel** — aucun bouton retour à l'accueil → ajouté `ArrowLeft` + `Home` dans le header
- **RLS user_roles** — `uuid = text` sans cast → corrigé dans migration SQL
- **push_subscriptions** — policy manquante → corrigée dans migration SQL
- **BottomNav** — affiché sur /local-player → masqué via `BottomNavConditional`

### ✨ NOUVELLES FONCTIONNALITÉS

#### 🎵 Lecteur Local (refonte complète)
- Réécriture sans bugs d'ordre de hooks
- 3 onglets : Lecteur · Playlists · Fichiers
- **Persistance mobile garantie** : IDB primaire + localStorage fallback
- Covers SVG déterministes (jamais de blob URL dans les saves)
- Barre de recherche/lecture drag & drop (touch + mouse)
- Waveform animé sur le son actif
- Badge ⚠ sur les fichiers à recharger
- Import par batch (4 fichiers en parallèle)
- Parse ID3v2 minimal (titre, artiste, album, pochette)
- Révocation automatique des blob URLs au démontage

#### 🛡️ Panneau Admin (refonte pro)
- Header sticky avec bouton retour à l'accueil
- Toast notifications internes animées (succès / erreur / info)
- Cartes stats avec indicateurs live pulsants
- Navigation par onglets avec badges de count
- Recherche globale (users/songs)
- Actions : archiver/désarchiver musiques (au lieu de supprimer)
- Remettre en ligne les musiques archivées
- Logs de date d'inscription pour chaque user
- Badge ADMIN sur eloadxfamily@gmail.com
- Confirmation stylisée pour toutes les actions destructives

### 🔐 MIGRATION SQL v20000
- Fix RLS `user_roles` (cast uuid → text)
- Fix RLS `push_subscriptions` (policies manquantes)
- **Insertion privilèges admin** pour `eloadxfamily@gmail.com`
- Script idempotent (safe à relancer plusieurs fois)

### 🎨 UI/UX
- Animation `novaWave` pour l'égaliseur actif
- Scrollbar custom sur l'admin panel
- Gradient covers sur les cards de playlists locales
- Empty states améliorés partout

---
Build: v20000 · Mars 2026 · NovaSound TITAN LUX
