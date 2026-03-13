# NovaSound TITAN LUX — v1000001

> **La plateforme musicale nouvelle génération avec système de notifications parfait.**  
> Streamez, uploadez, connectez-vous avec des artistes, et profitez d'un lecteur audio natif complet.  
> © 2026 NovaSound TITAN LUX — ELOADXFAMILY · [eloadxfamily@gmail.com](mailto:eloadxfamily@gmail.com)

---

## 🌟 Caractéristiques Principales

### 🔔 **Notifications Parfaites (22/22 types)**
- **Système complet** avec 22 types de notifications fonctionnels
- **Gamification** : 18 trophées avec 4 niveaux de rareté
- **Broadcast admin** : 6 types d'annonces avec ciblage avancé
- **Push notifications** : Support complet desktop/mobile (VAPID Web Push)
- **Interface moderne** : Filtres avancés, animations, badge dynamique

### 🎵 **Lecteur Audio Global**
- **Persistant** : survit à toute navigation (monté une seule fois)
- **Auto-skip sur erreur** : avance au son suivant après 2s si inaccessible
- **File d'attente dédupliquée** : impossible d'ajouter le même son deux fois
- **Bulle minimisée** : draggable, contrôles rapides play/next
- **Mode radio** : lecture infinie par genre/artiste

### 🎵 **Lecteur Audio Natif (hors-ligne)**
- **Scan automatique** de votre bibliothèque musicale locale
- **Support multi-plateformes** : iOS, Android, Desktop
- **Métadonnées riches** : Extraction automatique ID3
- **100% offline** : aucune connexion requise

### 🏆 **Gamification Complète**
- **18 trophées** : Music, Social, Chat, Live, Spéciaux
- **4 niveaux de rareté** : Common, Rare, Epic, Legendary
- **Points et classements** : Système de progression XP
- **Notifications spéciales** : Animations et brillance

### 👑 **Administration Avancée**
- **Broadcasts ciblés** : Maintenance, Update, Event, Announcement…
- **Interface admin** : Panneau complet avec historique
- **Permissions sécurisées** : Admin/Moderator roles (RLS)

---

## 🏗️ Architecture

```
NovaSound TITAN LUX/
├── web/                          # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx               # Router, providers globaux
│   │   ├── contexts/
│   │   │   ├── PlayerContext.jsx       # État lecteur global
│   │   │   ├── NotificationContext.jsx # Notifications + push VAPID
│   │   │   ├── AuthContext.jsx         # Session Supabase Auth
│   │   │   ├── ChatContext.jsx         # Chat global + realtime
│   │   │   └── PlayerTimeContext.jsx   # Temps lecture (anti re-render)
│   │   ├── components/
│   │   │   ├── AudioPlayer.jsx         # Lecteur audio global (persistant)
│   │   │   ├── NotificationBell.jsx    # Interface notifications 22 types
│   │   │   ├── AchievementNotification.jsx # Composant trophées animé
│   │   │   ├── AdminBroadcastPanel.jsx # Panneau admin broadcasts
│   │   │   ├── NativeAudioPlayer.jsx   # Lecteur audio natif
│   │   │   ├── BottomNav.jsx           # Navigation mobile
│   │   │   └── OfflineBanner.jsx       # Gestion mode offline
│   │   ├── lib/
│   │   │   ├── notifUtils.js           # Notifications DB + push Edge Fn
│   │   │   ├── notificationService.js  # CRUD notifications (client partagé)
│   │   │   ├── achievementUtils.js     # Système de trophées
│   │   │   ├── broadcastUtils.js       # Broadcasts admin
│   │   │   ├── offlineStore.js         # Stockage offline localStorage
│   │   │   └── networkDetector.js      # Détection réseau + sync offline
│   │   └── pages/
│   │       ├── LocalPlayerPageNative.jsx # Lecteur local natif
│   │       └── ...
│   └── package.json
├── supabase/
│   └── functions/
│       └── send-push-notification/
│           └── index.ts              # Edge Function v2.0 — 22 types VAPID
└── README.md
```

---

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- Supabase CLI
- Git

### Installation
```bash
# Cloner le projet
git clone <repository-url>
cd NovaSound-TITAN-LUX

# Installer les dépendances frontend
cd web
npm install

# Démarrer le développement
npm run dev
```

### Variables d'environnement
```bash
cp .env.example .env

VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

---

## 🔔 Système de Notifications

### Flux complet
```
Action utilisateur (like, follow, commentaire…)
  → INSERT dans public.notifications (notifUtils.js)
  → _push() appelle Edge Function send-push-notification
  → Edge Fn récupère push_subscriptions de l'user
  → Envoie push VAPID chiffré (Web Push Protocol)
  → Service Worker reçoit 'push' event
  → Affiche notification système Android/iOS/PC
  → NotificationContext lit les nouvelles notifs via Realtime
  → Badge in-app mis à jour (setAppBadge)
```

### 22 types supportés
```
like · like_song · like_news
comment · comment_news · reply · mention
follow · repost
new_song · queue_song · mood_vote
news
chat_reply · chat_mention · chat_mention_all
live_start · live_started · live_invite · live_join · live_comment · live_like · live_leave
achievement · broadcast
```

### Champs DB (table `notifications`)
| Champ | Type | Description |
|---|---|---|
| `user_id` | text | Destinataire |
| `type` | text | Type parmi les 22 supportés |
| `title` | text | Titre (max 120 chars) |
| `body` | text | Contenu (max 200 chars) |
| `url` | text | Lien de navigation |
| `icon_url` | text | Icône de la notification |
| `is_read` | boolean | Lu ou non |
| `from_user_id` | text | Expéditeur |
| `song_id` | text | Deep link son |
| `metadata` | jsonb | Données supplémentaires |

---

## 🎵 Lecteur Audio

### Fonctionnalités
- **Persistant** : l'élément `<audio>` n'est jamais démonté
- **Auto-skip erreur** : si un fichier est inaccessible, skip automatique après 2s
- **File dédupliquée** : `addToQueue()` refuse les doublons
- **Mode radio** : lecture infinie par genre/artiste (Supabase queries)
- **Bulle minimisée** : draggable verticalement, quick controls
- **Sleep timer** : pause automatique après X minutes
- **Vitesse lecture** : 0.75× à 2×

### Événements CustomEvent
| Événement | Description |
|---|---|
| `novasound:force-play` | Lancer la lecture |
| `novasound:force-pause` | Mettre en pause |
| `novasound:toggle-play` | Basculer play/pause |
| `novasound:seek-to` | Sauter à `detail.time` |
| `novasound:audio-error` | Erreur → skip automatique |
| `novasound:close-player` | Fermer le lecteur |
| `novasound:sleep-end` | Fin du sleep timer |

---

## 🏆 Système de Trophées

Les trophées se débloquent automatiquement lors de vos actions :

| Trophée | Condition | Rareté | Points |
|---|---|---|---|
| Premier Like | 1 like reçu | Common | 10 |
| Première Écoute | 1 play | Common | 5 |
| Amoureux de la Musique | 100 sons différents | Rare | 50 |
| Artiste en Tendance | 1000+ plays sur un son | Epic | 100 |
| Premier Abonné | 1 follower | Common | 20 |
| Papillon Social | 50 followers | Rare | 75 |
| Influenceur | 100 followers | Epic | 150 |
| Premier Message | 1 message chat | Common | 5 |
| Bavard | 100 messages chat | Rare | 30 |
| Premier Upload | 1 son uploadé | Common | 15 |
| Producteur | 10 sons uploadés | Rare | 60 |
| Créateur de Hits | 25 sons uploadés | Epic | 100 |
| Premier Live | 1 live hébergé | Common | 25 |
| Streamer | 10 lives hébergés | Rare | 80 |
| Pionnier | Inscrit dans les 30 premiers jours | Legendary | 100 |
| Vétéran | Actif depuis 6 mois | Legendary | 200 |

---

## 📱 Mode Offline

- **Messages chat** : stockés dans localStorage si hors-ligne, synchronisés au retour
- **Détection réseau** : `useNetworkDetector()` → events `online`/`offline`
- **Sync automatique** : reprise des messages pendants au reconnect

---

## 🔧 Stack Technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Edge Functions | Deno (TypeScript) — VAPID custom crypto |
| Push | Web Push Protocol (VAPID), Service Worker |
| Offline | localStorage, File System Access API |
| Déploiement | Vercel (frontend), Supabase Cloud (backend) |

---

## 🚀 Déploiement Production

```bash
# 1. Builder le frontend
cd web && npm run build

# 2. Déployer l'Edge Function
supabase functions deploy send-push-notification

# 3. Déployer le frontend (Vercel)
vercel --prod
```

---

## 📋 Changelog

### v1000001 (2026-03-13) — Corrections critiques
- **FIX CRASH** : `useNotifications` manquant dans `NotificationBell.jsx` → `ReferenceError` corrigé
- **FIX** : `addToQueue` — déduplication pour éviter la file cassée (même son ajouté N fois)
- **FIX** : `AudioPlayer.onError` — auto-skip automatique après 2s sur fichier inaccessible
- **FIX** : `PlayerContext` — listener `novasound:audio-error` → `handleNext()` global
- **FIX** : `notifUtils._push()` — champ `icon_url` → `icon` (alignement avec Edge Function v2.0)
- **FIX** : `notificationService.js` — suppression du champ `read_at` inexistant en DB
- **FIX** : `notificationService.js` — suppression du client Supabase dupliqué (import partagé)
- **FIX** : `console.log` → `console.info` dans tous les fichiers de production

### v1000000
- Système de notifications complet (22/22 types)
- Gamification : 18 trophées, 4 raretés
- Lecteur audio natif multi-plateformes
- Broadcast admin avec ciblage avancé
- Edge Function VAPID v2.0 custom crypto
- Push notifications Android/iOS/PC PWA

### v500000
- Push notifications via DB Trigger + pg_net
- 15 index DB pour les performances
- RLS renforcé, crons nettoyage automatique

### v410000
- Refonte complète LocalPlayerPage (FSA, ID3v2)
- Chat : @tous/@all, suppressions, éditions
- Live Room : réactions, file d'attente, historique

---

## 📞 Support

- **Email** : eloadxfamily@gmail.com
- **Licence** : © 2026 NovaSound TITAN LUX — ELOADXFAMILY

---

*NovaSound TITAN LUX — La musique réinventée.* 🎵✨
