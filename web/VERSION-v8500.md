# NovaSound TITAN LUX v8500

## 🐛 Corrections majeures v8500

### 🔴 Fix CRITIQUE — NotificationToast hors du Router
- `NotificationToast` utilisait `useNavigate()` mais était rendu **en dehors** du `<Router>`
- → crash React : "useNavigate() may be used only in the context of a Router"
- **Fix** : `NotificationToast` déplacé à l'intérieur de `<Router>` dans `App.jsx`

### 🔴 Fix CRITIQUE — Route `/admin` manquante
- `AdminPanel` était importé dans `App.jsx` mais aucune `<Route>` n'existait pour `/admin`
- → panneau admin totalement inaccessible
- **Fix** : Route `<Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />` ajoutée

### 🔴 Fix — AdminPanel queryait `auth.users` depuis le client
- `supabase.from('auth.users')` et le join `host:auth.users!host_id(...)` échouent silencieusement
  car le schéma `auth` n'est pas accessible directement par les clients Supabase
- **Fix** : Remplacé par `supabase.from('users')` (table publique) dans `loadStats()`, `loadUsers()`, et `loadLiveRooms()`

### 🔴 Fix — user_stats VIEW utilisait auth.users
- La vue SQL `user_stats` joinait `auth.users` — inaccessible en dehors de SECURITY DEFINER
- **Fix** : Vue recréée avec `public.users` uniquement (v8500-migration.sql)

### 🔴 Fix — get_user_conversations joinait auth.users
- Même problème dans la fonction SQL — corrigé pour utiliser `public.users`

### 🔧 Lien Admin Panel dans le menu Header
- Lien "Panneau Admin" ajouté dans le dropdown desktop **et** le menu mobile
- Visible uniquement pour les utilisateurs admin (`isAdmin === true`)
- Icône Shield rouge pour distinction visuelle claire

### 🔢 Versions mises à jour
- `package.json` : 8.2.0 → **8.5.0**
- `manifest.json` name : "v8003" → **"v8500"** | version : "8003" → **"8500"**
- SW cache : `novasound-titan-v8000` → **`novasound-titan-v8500`**
- `X-Client-Info` : `500.0.0` → **`8500.0.0`**

## 📋 Migration v8500

Exécuter **`v8500-migration.sql`** dans Supabase SQL Editor (remplace v8200-migration-new.sql).

Ce script inclut toutes les tables v8200 + les corrections v8500 :
- Tables `private_conversations`, `private_messages`, `file_shares`, `audio_sessions`, `cache_entries`
- Table `notification_types` avec valeurs par défaut
- Fonction `get_user_conversations` corrigée (utilise `public.users`)
- Vue `user_stats` recréée sans référence à `auth.users`
- Colonnes iOS sur `songs` (`ios_metadata`, `is_ios_compatible`)
- Mise à jour de `app_meta.version` = '8500'

---

**NovaSound TITAN LUX v8500** - Stabilité et corrections critiques ! 🎵✨
