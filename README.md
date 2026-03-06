# NovaSound TITAN LUX — V410000

> **La plateforme musicale nouvelle génération.**  
> Streamez, uploadez, découvrez — et maintenant dans votre langue, partout.

---

## 🚀 Nouveautés V410000

### 🌍 Internationalisation (i18n) — Complète et Totale
La refonte i18n est la pièce maîtresse de cette version. **Chaque texte visible** de l'application passe désormais par le système de traduction `react-i18next` — sans exception.

| Composant | Avant V410000 | V410000 |
|-----------|--------------|---------|
| `Header` | Chaînes hardcodées | ✅ `useTranslation()` complet |
| `Footer` | Chaînes hardcodées | ✅ `useTranslation()` complet |
| `AudioPlayer` | Chaînes hardcodées | ✅ `useTranslation()` complet |
| `LocalPlayerPage` | Chaînes hardcodées | ✅ `useTranslation()` complet |
| `LanguageSwitcher` | Modes limités | ✅ 4 modes : `dropdown`, `inline`, `compact`, `grid` |
| Locales (fr/en/es/it/pt) | ~120 clés | ✅ 200+ clés, sections `localPlayer.*` complètes |

**Langues supportées :** Français 🇫🇷 · English 🇬🇧 · Español 🇪🇸 · Italiano 🇮🇹 · Português 🇧🇷

**Détection automatique** : langue du navigateur → `localStorage` → fallback `fr`

**Admin Panel** : Les clés peuvent être surchargées en base via `i18n_overrides` sans redéploiement.

---

### 🎵 Lecteur Local — Refonte Desktop Totale

L'interface du Lecteur Local a été **entièrement repensée** pour PC. L'aspect "mobile étiré sur grand écran" est définitivement éliminé.

#### Architecture 3 panneaux (desktop)
```
┌──────────────────┬──────────────────────────────────────────────┐
│  Player Sidebar  │  Bibliothèque / Playlists                    │
│  (380–420px)     │                                              │
│                  │  ┌─ Onglets ─────────────────────────────┐   │
│  ┌────────────┐  │  │ 🎵 Bibliothèque [42]  📁 Playlists [3]│   │
│  │  Pochette  │  │  └───────────────────────────────────────┘   │
│  │  340×340   │  │                                              │
│  └────────────┘  │  ┌─ Recherche + Tri ──────────────────────┐  │
│  Titre           │  │ 🔍 Filtrer les fichiers…  [Trier par ▼] │  │
│  Artiste         │  └────────────────────────────────────────┘  │
│  Album           │                                              │
│                  │  # │ Cover │ Titre / Artiste │ Album │ ⏱ │ 🗑 │
│  ══ SeekBar ══   │  ─────────────────────────────────────────   │
│                  │  1 │  🎵  │ Midnight Pulse   │ Ablaze │ 3:24│  │
│  ⏮  ⏭  ⏸  🔀  🔁 │  2 │  🎵  │ Hero             │ Local  │ 4:01│  │
│                  │  …                                          │
│  🔊 ─────── 80%  │                                              │
│                  │  ┌─ Playlists ──────────────────────────┐    │
│  ── Queue ──     │  │  [cover grid 2×2]  [cover grid 2×2]  │    │
│  Next 3 tracks   │  │  My Mix (6)        Chill (12)         │    │
└──────────────────┴──────────────────────────────────────────────┘
```

#### Fonctionnalités nouvelles
- **Drag & Drop** : glissez vos fichiers audio directement dans la fenêtre
- **Recherche/Filtre** : filtrez en temps réel par nom, artiste ou album
- **Tri** : par nom, artiste (d'autres tris extensibles)
- **Raccourcis clavier** :
  - `Espace` — Lecture / Pause
  - `←` / `→` — Reculer / Avancer de 10s
  - `↑` / `↓` — Volume +5% / -5%
  - `M` — Muet
  - `N` — Piste suivante
  - `P` — Piste précédente
- **EQ animé** : barres d'égaliseur animées sur la piste active
- **Hover reveal** : bouton play au survol d'un titre
- **File size badge** : taille du fichier affiché sur la pochette
- **Queue preview** : prochaines pistes visibles dans la sidebar
- **Mode mobile préservé** : tabs navigation (🎵 / 📚 / 📁)

---

### 🔧 Corrections et améliorations techniques

- **`LocalPlayerPage`** : `aler''` → bug JS corrigé (`return`)
- **`LocalPlayerPage`** : `CustomEven'novasound:close-player'` → typo corrigée
- **`Header`** : le `LanguageSwitcher` est maintenant intégré dans le dropdown "Plus" (desktop) et dans le footer du drawer mobile
- **Locales** : clés `upload`, `song`, `artist`, `playlists` alignées entre fr/en/es/it/pt
- **`AudioPlayer`** : import `useTranslation` ajouté

---

## 📦 Structure du projet

```
novasound_v410000/
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioPlayer.jsx        ← useTranslation ajouté
│   │   │   ├── Footer.jsx             ← Fully translated
│   │   │   ├── Header.jsx             ← Fully translated + LanguageSwitcher intégré
│   │   │   └── LanguageSwitcher.jsx   ← 4 modes (dropdown/inline/compact/grid)
│   │   ├── locales/
│   │   │   ├── fr.json                ← 200+ clés
│   │   │   ├── en.json                ← 200+ clés
│   │   │   ├── es.json                ← Mis à jour
│   │   │   ├── it.json                ← Mis à jour
│   │   │   └── pt.json                ← Mis à jour
│   │   └── pages/
│   │       └── LocalPlayerPage.jsx    ← Refonte desktop totale (1414 lignes)
│   └── ...
├── supabase/
│   ├── functions/
│   │   └── send-push-notification/
│   │       └── index.ts               ← v410000 (inchangé fonctionnellement)
│   └── migrations/
│       └── 20260306_V410000.sql       ← Migration complète
└── README.md
```

---

## 🗄️ Migration V410000

**Fichier :** `supabase/migrations/20260306_V410000.sql`

### Ce que fait la migration :

1. **`i18n_overrides`** : table idempotente (re-créée si absente), peuplée avec les nouvelles clés `localPlayer.*`
2. **`users.preferred_lang`** : nouvelle colonne pour synchroniser la langue préférée côté serveur
3. **`local_player_sessions`** : nouvelle table de tracking anonyme des sessions locales (stats internes)
4. **`get_i18n_overrides(lang)`** : fonction RPC pour charger les overrides côté client
5. **`upsert_preferred_lang(lang)`** : fonction RPC pour sauvegarder la langue préférée
6. **Index** : 3 index supplémentaires sur `songs` pour les performances

### Appliquer la migration

```bash
# Via Supabase CLI
supabase db push --db-url "postgresql://..."

# Ou via le Dashboard Supabase
# SQL Editor → coller le contenu de 20260306_V410000.sql → Run
```

---

## ⚡ Edge Function — send-push-notification

**Version :** V410000 (hérite de V400001 sans changement fonctionnel)

### Déployer

```bash
supabase functions deploy send-push-notification \
  --project-ref <votre-ref> \
  --no-verify-jwt
```

### Variables d'environnement requises

```bash
VAPID_PUBLIC_KEY=<votre-clé-publique>
VAPID_PRIVATE_KEY=<votre-clé-privée>
VAPID_SUBJECT=mailto:eloadxfamily@gmail.com
SUPABASE_URL=<votre-url>
SUPABASE_SERVICE_ROLE_KEY=<votre-service-role-key>
```

---

## 🛠 Installation & Développement

```bash
# 1. Cloner et installer
cd web
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# 3. Lancer le dev server
npm run dev

# 4. Build production
npm run build
```

---

## 🌐 Déploiement Vercel

```bash
# Build command
npm run build

# Output directory
dist

# Root directory
web
```

Variables Vercel à configurer :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 📝 Nom de commit recommandé

```
feat(v410000): full i18n, desktop local player redesign, drag&drop, keyboard shortcuts
```

---

## 🗺 Roadmap

| Version | Statut | Fonctionnalité |
|---------|--------|----------------|
| V400001 | ✅ Done | Migration réparatrice, push notifications |
| **V410000** | **✅ Current** | **i18n complète, refonte Local Player desktop** |
| V420000 | 🔜 Planned | Dark/Light mode, admin i18n editor en live |
| V430000 | 🔜 Planned | Equalizer visuel, audio fingerprint |

---

## 📄 Licence

© 2026 NovaSound TITAN LUX — ELOADXFAMILY  
Tous droits réservés.
