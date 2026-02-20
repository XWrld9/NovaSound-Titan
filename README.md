# NovaSound-Titan

Plateforme musicale avec React et Supabase.

## 🎵 Fonctionnalités

- Catalogue musical et exploration
- Upload de musique
- Profils d'artistes
- Lecteur audio intégré
- Authentification utilisateur
- Interface responsive

## 🛠️ Stack Technique

**Frontend**
- React 18
- Vite
- React Router
- TailwindCSS
- Lucide React
- Framer Motion

**Backend**
- Supabase (PostgreSQL cloud)
- Authentification Supabase
- Stockage Supabase

## 👨‍💻 Développeur

Ce projet a été développé par **Tetang Tanekou Morel Noel** pour **XWrld**.

## 📦 Installation

### Développement Local
```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan
cd web
npm install
npm run dev
```

### Configuration Supabase
1. Créez un projet sur [supabase.com](https://supabase.com)
2. Configurez les variables d'environnement :
   ```
   VITE_SUPABASE_URL=votre-url-supabase
   VITE_SUPABASE_ANON_KEY=votre-clé-anon
   ```
3. Créez les tables nécessaires via l'interface Supabase

## 🚀 Déploiement

### Frontend (Vercel)
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`

### Backend (Supabase)
- Base de données PostgreSQL hébergée
- Authentification intégrée
- Stockage de fichiers
- Real-time subscriptions

## 📁 Structure

```
NovaSound-Titan/
├── web/           # Application React
├── README.md      # Documentation
└── LICENSE        # Licence
```

## 🎯 Configuration

### Variables d'environnement
- `VITE_SUPABASE_URL` : URL de l'instance Supabase
- `VITE_SUPABASE_ANON_KEY` : Clé publique Supabase

### Base de données
La base de données est configurée avec les tables :
- `users` : Profils utilisateurs
- `songs` : Musiques et métadonnées
- `likes` : Likes des utilisateurs
- `follows` : Relations follow/following

## 🎨 Design

- Interface moderne et responsive
- Animations fluides avec Framer Motion
- Thème sombre/clair
- Optimisé mobile

## 📈 Performance

- Optimisé pour Vercel Edge Network
- Base de données PostgreSQL performante
- Lazy loading des composants
- Images optimisées

## 🔐 Sécurité

- Row Level Security (RLS) Supabase
- Authentification sécurisée
- Validation des entrées
- Protection XSS

## 📞 Contact

Pour toute question ou collaboration :
- **Développeur** : Tetang Tanekou Morel Noel
- **Organisation** : XWrld

## 📄 Licence

MIT License - voir [LICENSE](LICENSE)
