# 🔧 MODIFICATIONS À APPLIQUER - NovaSound TITAN LUX v700000

Ce fichier liste toutes les modifications à faire dans le code pour finaliser la v700000.

---

## 📋 ORDRE D'APPLICATION

### 1. Base de données (PRIORITÉ 1)
### 2. Edge Function (PRIORITÉ 1)
### 3. Frontend (PRIORITÉ 2)

---

## 🗄️ 1. BASE DE DONNÉES

### Exécuter le script SQL

**Fichier**: `supabase/migrations/migration_v700000.sql`

**Action**:
1. Aller dans Supabase Dashboard > SQL Editor
2. Copier tout le contenu du fichier
3. Exécuter
4. Vérifier les messages de succès

**Ensuite, configurer les clés**:
```sql
INSERT INTO public.app_meta (key, value) VALUES
  ('supabase_url',      'https://VOTRE_REF.supabase.co'),
  ('service_role_key',  'VOTRE_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 🔧 2. EDGE FUNCTION

### Fichier déjà remplacé
**Fichier**: `supabase/functions/send-push-notification/index.ts`
✅ Le fichier a déjà été remplacé par la version v700000

**Action**:
```bash
cd supabase/functions
supabase functions deploy send-push-notification
```

**Configuration des variables d'environnement** (Supabase Dashboard):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT

---

## 📱 3. FRONTEND - MODIFICATIONS MANUELLES

### 3.1. LiveListPage.jsx

**Fichier**: `web/src/pages/LiveListPage.jsx`

#### Modification 1: Import (ligne 21)
**AJOUTER après** `import { ALL_GENRES } from '@/hooks/useGenreTheme';`:
```javascript
import { GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';
```

#### Modification 2: GENRES (lignes 31-40)
**REMPLACER** tout le const GENRES par:
```javascript
const GENRES = [
  { id: 'all', name: 'Tous', color: 'from-cyan-500 to-purple-500' },
  { id: 'bikutsi', name: 'Bikutsi', color: 'from-red-600 to-red-800' },
  { id: 'makossa', name: 'Makossa', color: 'from-yellow-600 to-yellow-800' },
  { id: 'assiko', name: 'Assiko', color: 'from-green-600 to-green-800' },
  { id: 'ambas-bay', name: 'Ambas-Bay', color: 'from-blue-600 to-blue-800' },
  { id: 'benskin', name: 'Benskin', color: 'from-purple-600 to-purple-800' },
  { id: 'mbole', name: 'Mbolé', color: 'from-orange-600 to-orange-800' },
  { id: 'afrobeats', name: 'Afrobeats', color: 'from-amber-600 to-amber-800' },
  { id: 'hip-hop', name: 'Hip-Hop', color: 'from-violet-600 to-violet-800' },
  { id: 'r&b', name: 'R&B', color: 'from-pink-600 to-pink-800' },
  { id: 'pop', name: 'Pop', color: 'from-cyan-600 to-cyan-800' },
  { id: 'electronique', name: 'Électronique', color: 'from-emerald-600 to-emerald-800' },
  { id: 'trap', name: 'Trap', color: 'from-red-600 to-red-800' },
  { id: 'gospel', name: 'Gospel', color: 'from-orange-600 to-orange-800' },
  { id: 'jazz', name: 'Jazz', color: 'from-violet-600 to-violet-800' },
  { id: 'reggae', name: 'Reggae', color: 'from-lime-600 to-lime-800' },
  { id: 'dancehall', name: 'Dancehall', color: 'from-yellow-600 to-yellow-800' },
  { id: 'amapiano', name: 'Amapiano', color: 'from-emerald-600 to-emerald-800' },
  { id: 'coupe-decale', name: 'Coupé-Décalé', color: 'from-pink-600 to-pink-800' },
  { id: 'rock', name: 'Rock', color: 'from-orange-600 to-orange-800' },
  { id: 'classique', name: 'Classique', color: 'from-yellow-600 to-yellow-800' },
  { id: 'folk', name: 'Folk', color: 'from-green-600 to-green-800' },
  { id: 'country', name: 'Country', color: 'from-amber-600 to-amber-800' },
  { id: 'latin', name: 'Latin', color: 'from-red-600 to-red-800' },
  { id: 'drill', name: 'Drill', color: 'from-slate-600 to-slate-800' },
  { id: 'outro', name: 'Outro', color: 'from-purple-600 to-purple-800' },
];
```

#### Modification 3: Style fond (ligne ~134)
**REMPLACER**:
```javascript
// DE:
<div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
// À:
<div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510]">
```

---

### 3.2. LiveRoomPage.jsx

**Fichier**: `web/src/pages/LiveRoomPage.jsx`

Voir le fichier `LiveRoomPage_patches.jsx` pour tous les détails.

**Modifications principales**:
1. Ajouter imports GENRE_DESCRIPTIONS
2. Modifier createRoom pour utiliser descriptions
3. Changer tous les bg-gradient-to-br
4. Utiliser ALL_GENRES dans le select

---

### 3.3. LocalPlayerPage.jsx

**Fichier**: `web/src/pages/LocalPlayerPage.jsx`

Voir le fichier `LocalPlayerPage_patches.jsx` pour tous les détails.

**Modifications principales**:
1. Fix raccourcis clavier (ligne ~600)
2. Améliorer Waveform
3. Améliorer drag & drop

---

### 3.4. LocalPlayerPageMobile.jsx

**Fichier**: `web/src/pages/LocalPlayerPageMobile.jsx`

**Modification principale**: Padding (ligne ~50)
```javascript
// DE:
pb-24
// À:
pb-40
```

---

### 3.5. index.css

**Fichier**: `web/src/index.css`

**AJOUTER à la fin**:
```css
/* Safe area support for iOS - v700000 */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

/* Smooth scrolling on mobile - v700000 */
.overscroll-contain {
  overscroll-behavior: contain;
}
```

---

## 🚀 4. BUILD ET DÉPLOIEMENT

```bash
cd web
npm install
npm run build
vercel --prod
# OU
netlify deploy --prod --dir=dist
```

---

## ✅ 5. VÉRIFICATIONS

### Base de données
```sql
-- Vérifier colonnes
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'live_room_participants' AND column_name = 'is_host';

-- Vérifier fonctions
SELECT proname FROM pg_proc 
WHERE proname IN ('is_user_admin', 'get_default_live_description');

-- Vérifier index
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('live_rooms', 'songs');
```

### Edge Function
```bash
supabase functions logs send-push-notification
```

### Frontend
- [ ] Les 25 genres s'affichent dans LiveListPage
- [ ] Création de live avec description personnalisée fonctionne
- [ ] Local player ne bug pas sur mobile
- [ ] Style cohérent partout

---

## 📝 NOTES

- Tous les fichiers `.jsx` à modifier ont des commentaires `// v700000` pour vous aider
- Consultez `GUIDE_AMELIORATIONS.md` pour plus de détails
- Consultez les fichiers `*_patches.jsx` pour les extraits de code exacts

---

**Version**: v700000  
**Date**: 2026-03-07
