# NovaSound TITAN LUX  v2.0.1

> **La plateforme musicale nouvelle génération.**  
> Streamez, uploadez, connectez-vous avec des artistes, et profitez d'un lecteur audio natif complet.  
> © 2026 NovaSound TITAN LUX — ELOADXFAMILY · [eloadxfamily@gmail.com](mailto:eloadxfamily@gmail.com)

---

## 🌟 Fonctionnalités principales

### 🔔 Notifications (22 types)
- Système complet avec 22 types de notifications in-app et push
- Gamification : 18 trophées avec 4 niveaux de rareté
- Broadcast admin : 6 types d'annonces avec ciblage avancé
- Push notifications Web Push (VAPID) — Android, iOS 16.4+ PWA, Desktop
- Interface moderne : filtres avancés, animations, badge dynamique

### 🎵 Lecteur audio global
- Persistant : survit à toute navigation (monté une seule fois)
- Auto-skip sur erreur : avance au son suivant après 2s si inaccessible
- File d'attente dédupliquée : impossible d'ajouter le même son deux fois
- Bulle minimisée : draggable, contrôles rapides play/next
- Mode radio : lecture infinie par genre/artiste

### 📁 Lecteur audio natif (hors-ligne)
- Scan automatique de votre bibliothèque musicale locale
- Support multi-plateformes : iOS, Android, Desktop
- Extraction automatique des métadonnées ID3
- 100% offline — aucune connexion requise

### 🏆 Gamification
- 18 trophées répartis en catégories : Music, Social, Chat, Live, Spéciaux
- 4 niveaux de rareté : Common, Rare, Epic, Legendary
- Système de points XP et classements
- Notifications spéciales avec animations

### 👑 Administration
- Broadcasts ciblés : Maintenance, Update, Event, Announcement…
- Panneau admin complet avec historique
- Permissions sécurisées via RLS (Admin/Moderator roles)

---

## 🏗️ Architecture

```
NovaSound TITAN LUX/
├── web/                                  # Frontend React + Vite + Tailwind
│   ├── index.html                        # Entrée SPA + enregistrement SW
│   ├── public/
│   │   └── sw.js                         # Service Worker (cache, push, sync)
│   └── src/
│       ├── App.jsx                       # Router, providers globaux
│       ├── contexts/
│       │   ├── NotificationContext.jsx   # Notifications + push VAPID
│       │   ├── PlayerContext.jsx         # État lecteur global
│       │   ├── AuthContext.jsx           # Session Supabase Auth
│       │   ├── ChatContext.jsx           # Chat global + realtime
│       │   └── PlayerTimeContext.jsx     # Temps lecture (anti re-render)
│       ├── components/
│       │   ├── AudioPlayer.jsx           # Lecteur audio global (persistant)
│       │   ├── NotificationBell.jsx      # Interface notifications 22 types
│       │   ├── AchievementNotification.jsx
│       │   ├── AdminBroadcastPanel.jsx
│       │   └── BottomNav.jsx             # Navigation mobile
│       ├── lib/
│       │   ├── notifUtils.js             # Notifications DB + push Edge Fn
│       │   ├── notificationService.js    # CRUD notifications
│       │   ├── achievementUtils.js       # Système de trophées
│       │   ├── broadcastUtils.js         # Broadcasts admin
│       │   └── offlineStore.js           # Stockage offline localStorage
│       └── pages/
│           └── ...
├── supabase/
│   └── functions/
│       └── send-push-notification/
│           └── index.ts                  # Edge Function v2.0 — VAPID RFC 8291
└── README.md
```

---

## 🚀 Installation

### Prérequis
- Node.js 18+
- Supabase CLI
- Git

### Démarrage local
```bash
git clone <repository-url>
cd NovaSound-TITAN-LUX/web
npm install
npm run dev
```

### Variables d'environnement
```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

---

## 🔔 Système de notifications

### Flux complet
```
Action utilisateur (like, follow, commentaire…)
  → INSERT dans public.notifications (notifUtils.js)
  → _push() appelle l'Edge Function send-push-notification
  → Edge Function récupère push_subscriptions de l'user
  → Chiffrement Web Push RFC 8291 (ECDH P-256 + AES-128-GCM)
  → Envoi VAPID vers le push service (FCM / Apple Push / Mozilla)
  → Service Worker reçoit l'événement 'push'
  → Affiche la notification système (Android / iOS / Desktop)
  → NotificationContext reçoit la mise à jour via Supabase Realtime
  → Badge in-app mis à jour (navigator.setAppBadge)
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

### Urgency et TTL par catégorie
| Catégorie | Urgency | TTL |
|---|---|---|
| Live, Chat | `high` | 1h – 24h |
| Social, Musique | `normal` | 7 jours |
| Likes, News | `low` | 7 jours – 30 jours |
| Achievement | `high` | 7 jours |

### Schéma de la table `notifications`
| Champ | Type | Description |
|---|---|---|
| `user_id` | text | Destinataire |
| `type` | text | Type parmi les 22 supportés |
| `title` | text | Titre (max 120 chars) |
| `body` | text | Contenu (max 200 chars) |
| `url` | text | Lien de navigation |
| `icon_url` | text | Icône |
| `is_read` | boolean | Lu ou non |
| `from_user_id` | text | Expéditeur |
| `song_id` | text | Deep link son |
| `metadata` | jsonb | Données supplémentaires |

---

## 🎵 Lecteur audio

### Fonctionnalités
- **Persistant** : l'élément `<audio>` n'est jamais démonté
- **Auto-skip erreur** : skip automatique après 2s si un fichier est inaccessible
- **File dédupliquée** : `addToQueue()` refuse les doublons
- **Mode radio** : lecture infinie par genre/artiste
- **Bulle minimisée** : draggable verticalement, quick controls
- **Sleep timer** : pause automatique après X minutes
- **Vitesse lecture** : 0.75× à 2×

### CustomEvents disponibles
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

## 🏆 Trophées

| Trophée | Condition | Rareté | Points |
|---|---|---|---|
| Premier Like | 1 like reçu | Common | 10 |
| Première Écoute | 1 play | Common | 5 |
| Amoureux de la Musique | 100 sons différents | Rare | 50 |
| Artiste en Tendance | 1 000+ plays sur un son | Epic | 100 |
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

## 📱 Mode offline

- **Messages chat** : stockés dans localStorage si hors-ligne, synchronisés au retour
- **Détection réseau** : `useNetworkDetector()` → events `online`/`offline`
- **Sync automatique** : reprise des messages pendants au reconnect
- **Chunks Vite** : Network-first avec détection de deploy périmé → reload automatique

---

## 🔧 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Edge Functions | Deno (TypeScript) — VAPID custom crypto RFC 8291 |
| Push | Web Push Protocol (VAPID), Service Worker |
| Offline | localStorage, File System Access API |
| Déploiement | Vercel (frontend), Supabase Cloud (backend) |

---

## 🚀 Déploiement production

```bash
# 1. Builder le frontend
cd web && npm run build

# 2. Déployer l'Edge Function
supabase functions deploy send-push-notification

# 3. Déployer le frontend
vercel --prod
```

---

## 📋 Changelog

### v2.0.1 (2026-03-15) — Correctifs DB schema

**`ModerationPanel.jsx`**
- Suppression des champs `ban_reason` et `ban_expires_at` inexistants dans `public.users` (les détails du ban sont dans `banned_users`)

**`broadcastUtils.js`**
- Remplacement des actions `broadcast` et `targeted_broadcast` qui violaient le CHECK constraint de `moderation_logs.action` → mappées sur `resolve_report` avec prefix dans `reason`

**`achievementUtils.js`**
- Comptage des lives hébergés corrigé : `live_room_history` (historique complet) au lieu de `live_rooms WHERE is_active=true` (rooms en cours seulement → trophées jamais débloqués)
- Commentaire explicatif sur le type mismatch `song_plays_history.user_id` (uuid) vs `users.id` (text)

**`AdminPanel.jsx`**
- Remplacement du `upsert({ onConflict: "user_id,role" })` sans contrainte UNIQUE par un check-then-insert/update explicite pour la promotion admin
---

### v2.0 (2026-03-15) — Correctifs critiques push + stabilisation

**Edge Function `send-push-notification`**
- `encryptPayload` réécrit intégralement selon RFC 8291 + RFC 8188
- Correction du bug ECDH : la clé privée éphémère est maintenant correctement utilisée comme `baseKey` (au lieu d'un `CryptoKeyPair` complet qui causait un `TypeError` silencieux en runtime)
- Ajout de l'étape IKM manquante : `HKDF(salt=authSecret, ikm=ecdhSecret, info="WebPush: info\0"+sub_pub+eph_pub)`
- Construction correcte du header `aes128gcm` : `salt(16) + rs(4) + idlen(1) + ephemeralPublic(65)`
- Padding record avec délimiteur `0x02` (RFC 8188)
- Helper `concat()` pour l'assemblage des buffers

**Client — `NotificationContext.jsx`**
- Ajout d'un re-enregistrement défensif du SW si `controller` est absent au moment du subscribe (évite l'`AbortError: Registration failed - push service error` au premier chargement)
- Ajout d'un timeout de 10s sur `navigator.serviceWorker.ready` (évite le blocage définitif si le SW reste en état `installing`)
- Messages d'erreur distincts par type : `AbortError`, `NotAllowedError`, timeout SW

**Client — `index.html`**
- Remplacement du `.catch(() => {})` silencieux par un log sur l'enregistrement du SW
- Ajout d'un listener `updatefound` pour détecter les nouvelles versions du SW et émettre `sw-update-available`

### v1000001 (2026-03-13)
- FIX CRASH : `useNotifications` manquant dans `NotificationBell.jsx`
- FIX : `addToQueue` — déduplication file d'attente
- FIX : `AudioPlayer.onError` — auto-skip après 2s
- FIX : `notifUtils._push()` — champ `icon_url` → `icon`
- FIX : `notificationService.js` — suppression champ `read_at` inexistant

### v1000000
- Système de notifications complet (22/22 types)
- Gamification : 18 trophées, 4 raretés
- Lecteur audio natif multi-plateformes
- Broadcast admin avec ciblage avancé
- Edge Function VAPID custom crypto

---

## 📞 Support

- **Email** : eloadxfamily@gmail.com  
- **Licence** : © 2026 NovaSound TITAN LUX — ELOADXFAMILY

---

*NovaSound TITAN LUX — La musique réinventée.* 🎵✨
