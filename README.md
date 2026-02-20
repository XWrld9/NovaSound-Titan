# NovaSound-Titan

Plateforme musicale avec React et PocketBase.

## Fonctionnalités

- Catalogue musical et exploration
- Upload de musique
- Profils d'artistes
- Lecteur audio intégré
- Authentification utilisateur
- Interface responsive
- **Système de likes** - Like/unlike les musiques
- **Système d'abonnement** - Follow/unfollow les artistes
- **Modification du profil** - Avatar, bio, informations
- **Temps réel** - Mises à jour instantanées

## Stack Technique

**Frontend**
- React 18
- Vite
- React Router
- TailwindCSS
- Lucide React
- Framer Motion

**Backend**
- PocketBase (déployé sur Fly.io)
- SQLite

## Installation

### Développement Local
```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan
cd web
npm install
npm run dev
```

### PocketBase Local
```bash
cd pocketbase
./pocketbase serve
```

## Déploiement

### Frontend (Vercel)
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`

### Backend (Fly.io)
1. Installer Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Se connecter: `fly auth login`
3. Déployer: `fly deploy`

## Structure

```
NovaSound-Titan/
├── web/           # Application React
├── pocketbase/    # Backend PocketBase
└── README.md
```

## Configuration

### Variables d'environnement
- `POCKETBASE_URL` : URL de l'instance PocketBase
- `VITE_POCKETBASE_URL` : URL pour le client

### Base de données
La base de données est automatiquement initialisée avec les tables :
- `users` : Utilisateurs avec avatar, bio, followers, following
- `songs` : Musiques avec likes, plays_count
- `likes` : Likes des utilisateurs sur les musiques
- `follows` : Relations follow/following

## Fonctionnalités Sociales

### Système de Likes
- Like/unlike en temps réel
- Compteur automatique
- Animations fluides
- Notifications (à implémenter)

### Système d'Abonnement
- Follow/unfollow les artistes
- Compteurs de followers/following
- Listes des abonnés
- Temps réel

### Gestion du Profil
- Upload d'avatar (max 5MB)
- Modification username, email, bio
- Validation des entrées
- Sauvegarde automatique

## Licence

MIT License - voir [LICENSE](LICENSE)
