# 🎵 NovaSound TITAN LUX — V41000

> Plateforme de streaming musical sociale, propulsée par Supabase & React.  
> Version **V41000** — La mise à jour la plus aboutie du projet.

---


## ✨ Nouveautés V60000 — "Personnalisation & Communauté"

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs dédié avec filtres par type, groupes date, actions rapides |
| **Badge notifications** | BottomNav affiche le compteur de notifs non lues |
| **Lien /notifications** | NotificationBell → "Ouvrir la page notifications" |
| **Badge Live artiste** | ArtistProfilePage affiche "🔴 EN LIVE" si l'artiste a une salle active |
| **Trending searches** | SearchPage affiche les 8 recherches populaires des 24h |
| **Log recherches** | `search_logs` table + vue `trending_searches` |
| **notifyAll broadcast** | 1 seul appel edge function si pas d'exclusions (N→1) |
| **logSearch util** | Helper fire-and-forget pour tracker les recherches |
| **chat_reactions** | Table + RLS + realtime (manquait en DB) |
| **user_achievements** | Table + RLS (manquait en DB) |
| **songs.mood** | Colonne humeur sur les sons |
| **10 nouveaux achievements** | first_upload, hundred_plays, chart_topper, etc. |
| **grant_achievement()** | Fonction SQL idempotente pour débloquer un achievement |
| **purge_old_search_logs()** | Auto-nettoyage search_logs > 7j |

## ✨ Nouveautés V41000

### 📡 Edge Function Push — Refonte complète

| Amélioration | Détail |
|---|---|
| **Retry logic** | Jusqu'à 3 tentatives avec backoff exponentiel (300ms, 600ms) |
| **Concurrence limitée** | Max 10 envois parallèles → évite les rate limits des services push |
| **Mode broadcast** | `broadcast: true` → notifie TOUS les abonnés (annonces, live start…) |
| **Urgency dynamique** | `high` pour les mentions/live, `low` pour likes/news |
| **TTL dynamique** | Live = 1h, chat = 24h, likes = 7j, news = 30j |
| **Gestion 429** | Respect du `Retry-After`, skip si dépassé |
| **Idempotency** | Guard via `notif_id` → pas de double envoi |
| **Delivery tracking** | Chaque batch loggé dans `push_notification_logs` |
| **image_url + actions** | Support des boutons et images dans les notifications |
| **Logs structurés** | Timing par endpoint, résumé complet en fin de batch |

### 🗄️ Migration V41000

- Table `push_notification_logs` — historique complet des livraisons
- Colonnes `device_name`, `last_used_at`, `fail_count` sur `push_subscriptions`
- Vue `push_stats_7d` — stats admin des 7 derniers jours
- Fonction `purge_old_push_logs()` — nettoyage automatique logs > 30j

## ✨ Nouveautés V60000 — "Personnalisation & Communauté"

| Fonctionnalité | Détail |
|---|---|
| **Page /notifications** | Centre de notifs dédié avec filtres par type, groupes date, actions rapides |
| **Badge notifications** | BottomNav affiche le compteur de notifs non lues |
| **Lien /notifications** | NotificationBell → "Ouvrir la page notifications" |
| **Badge Live artiste** | ArtistProfilePage affiche "🔴 EN LIVE" si l'artiste a une salle active |
| **Trending searches** | SearchPage affiche les 8 recherches populaires des 24h |
| **Log recherches** | `search_logs` table + vue `trending_searches` |
| **notifyAll broadcast** | 1 seul appel edge function si pas d'exclusions (N→1) |
| **logSearch util** | Helper fire-and-forget pour tracker les recherches |
| **chat_reactions** | Table + RLS + realtime (manquait en DB) |
| **user_achievements** | Table + RLS (manquait en DB) |
| **songs.mood** | Colonne humeur sur les sons |
| **10 nouveaux achievements** | first_upload, hundred_plays, chart_topper, etc. |
| **grant_achievement()** | Fonction SQL idempotente pour débloquer un achievement |
| **purge_old_search_logs()** | Auto-nettoyage search_logs > 7j |

## ✨ Nouveautés V41000

### 🎙️ Live Rooms — Refonte complète

| Fonctionnalité | Détail |
|---|---|
| **File d'attente (Queue)** | L'hôte ajoute des sons → diffusion automatique à tous |
| **Indicateur de frappe** | Affichage en temps réel quand quelqu'un écrit |
| **Messages système** | Notifications chat quand quelqu'un rejoint/quitte/change de son |
| **Equalizer animé** | Barres animées sur le titre en lecture |
| **Barre de progression** | Synchronisée avec la position de l'hôte |
| **Onglets sidebar** | Participants · File d'attente · Contrôles |
| **Panneau mobile** | Drawer accessible sur mobile |
| **Picker d'émojis** | 12 réactions flottantes |
| **Timestamps relatifs** | Affiché sous chaque message |
| **Badges de capacité** | Barre de progression des places disponibles |
| **Carte de salle enrichie** | Chanson en cours + barre de capacité dans le lobby |
| **Play Now ou Add to Queue** | Double action sur les résultats de recherche |

### 🧹 Nettoyage du projet

- Suppression de **40+ anciens fichiers SQL** de migration (remplacés par `novasound-v41000-migration.sql`)
- Suppression de tous les fichiers `VERSION-*.md` éparpillés
- Suppression des fichiers `.bak`
- Fusion des edge functions dupliquées (une seule version consolidée)
- Suppression des guides obsolètes redondants

---

## 🏗️ Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Animation | Framer Motion |
| Backend | Supabase (Postgres + Realtime + Storage + Auth) |
| Notifications Push | Edge Function Deno (VAPID + Web Push) |
| Déploiement | Vercel |

---

## 🚀 Installation

```bash
cd web
npm install
cp .env.example .env   # renseigne tes clés Supabase
npm run dev
```

### Variables d'environnement

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Base de données

### Première installation

Lance **dans l'ordre** dans le SQL Editor de Supabase :

1. `web/setup-supabase.sql` *(si premier déploiement)*
2. `web/novasound-v41000-migration.sql` *(mise à jour V41000)*

### Structure des tables principales

| Table | Rôle |
|---|---|
| `users` | Profils utilisateurs |
| `songs` | Catalogue musical |
| `live_rooms` | Salles live |
| `live_room_messages` | Chat en salle |
| `live_room_queue` | **[V41000]** File d'attente de sons |
| `push_subscriptions` | Abonnements notifications push |
| `notifications` | Centre de notifications |
| `achievements` / `user_achievements` | Système de badges |

---

## 📡 Edge Functions Supabase

### `send-push-notification`

Envoie une notification Web Push (VAPID) à un utilisateur.

**Variables d'env Supabase :**
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ton@email.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Déploiement :**
```bash
supabase functions deploy send-push-notification
```

---

## 📱 PWA

L'application est installable sur Android et iOS (via Safari).  
Le fichier APK Android est disponible dans `web/public/`.

---

## 🔐 Sécurité

- Row Level Security (RLS) activée sur toutes les tables
- Authentification Supabase Auth
- Push notifications chiffrées (AES-128-GCM + ECDH P-256)

---

## 🏆 Système de succès (Achievements)

| Code | Label | Points | Rareté |
|---|---|---|---|
| `first_live` | Premier Live | 15 | Commun |
| `live_host` | Hôte confirmé | 50 | Rare |
| `live_marathon` | Marathon Live | 75 | Épique |
| `live_social` | Rassembleur | 100 | Légendaire |

---

## 📄 Licence

MIT — © EloadX Family
