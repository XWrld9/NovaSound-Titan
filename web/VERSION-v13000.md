# NovaSound TITAN LUX — VERSION v13000

## 🔧 CORRECTIONS COMPLÈTES v13000

### 🎵 Lecteur Local — Fixes critiques
- ✅ **Onglet "Playlists" entièrement refait** — l'onglet était 100% vide, maintenant fonctionnel avec grille de cartes, covers, boutons Écouter + Supprimer
- ✅ **Footer ajouté** dans le Lecteur Local (absent dans v12000)
- ✅ **Menu bas (BottomNav) masqué sur /local-player** — interface standalone sans navigation parasite
- ✅ **Bouton Précédent corrigé** — ne déclenche plus un `toggle-play` parasite en plus du `handlePrevious`
- ✅ **Bloc FSA info sorti de la toolbar** — n'était pas à sa place, redesigné proprement

### 📱 Persistance Playlists Mobile (iOS/Android)
- ✅ **Double sauvegarde IDB + localStorage** — les playlists survivent au rechargement sur mobile même sans FileSystemFileHandle
- ✅ **Covers SVG déterministes** sauvegardées au lieu des blob URLs (qui expirent) — les playlists gardent leurs visuels
- ✅ **Marquage _needsReimport** clair + badge ⚠️ sur les cartes playlist nécessitant un rechargement
- ✅ **Bouton Réimporter 🔄** par playlist sur mobile pour restaurer les fichiers audio
- ✅ **Chargement depuis localStorage** en fallback si IndexedDB vide (premier démarrage après upgrade)

### 🤖 Android/iOS — Audio online
- ✅ **AudioContext unlock global** — déverrouillage au premier geste (touchstart/click) pour autoriser la lecture sur Android Chrome
- ✅ **`preload="auto"`** ajouté sur l'élément `<audio>` pour buffering anticipé sur mobile
- ✅ **Retry sur `canplaythrough`** si AbortError (source changée pendant load)
- ✅ **Fallback NotAllowedError** — attend le prochain geste utilisateur et relance automatiquement
- ✅ Suppression des `console.log` de debug inutiles en production

### 🎨 UX/UI
- ✅ **Mini-liste dans onglet Lecteur** — les 7 premiers sons visibles sans changer d'onglet
- ✅ **Bouton Play** lance le premier son de la liste si aucun son local n'est en cours
- ✅ **État vide Playlists** avec call-to-action clair
- ✅ **Toolbar fichiers** avec sélection + bouton "Créer playlist" inline
- ✅ **Indicateurs animés** (barres EQ) pour le son actif
- ✅ **Grille 2 colonnes** pour les playlists avec covers 4 vignettes
