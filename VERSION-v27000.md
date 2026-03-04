# NovaSound TITAN LUX — V27000

## Nouveautés

### Profil utilisateur
- ✅ Onglet **Repartagés** ajouté (2ème position)
- ✅ Stats du header cliquables → navigation directe vers l'onglet
- ✅ Stat "Repartagés" visible dans le header
- ✅ URL persistée (`?tab=reposts`) — tab conservé au refresh
- ✅ Skeleton loader au chargement
- ✅ Transitions AnimatePresence entre onglets

### Profil artiste (public)
- ✅ Onglet **Repartagés** sur les profils publics

### Bouton Repartager
- ✅ Toast cliquable → redirige vers l'onglet Repartagés du profil
- ✅ Message explicite : "Sur ton profil · onglet Repartagés"
- ✅ Icône Check quand actif

### Recherche
- ✅ **Filtres genre** en pills cliquables (Hip-Hop, Afrobeats, Trap, R&B…)
- ✅ Recherche par genre sans texte possible

### Lecteur local
- ✅ Fix séquentiel `requestPermission` (Chrome/TWA)
- ✅ Playlists se rechargent correctement sans "À recharger"

### Base de données (migration SQL)
- ✅ RLS `song_reposts` (select public, insert/delete par user)
- ✅ RLS `achievement_definitions` (lecture publique)
- ✅ FK `user_achievements.achievement → achievement_definitions.code`
- ✅ Colonne `reposts_count` sur `songs`
- ✅ Index sur `song_reposts`

## Migration
Lancer `web/novasound-v27000-migration.sql` dans Supabase SQL Editor.
