# NovaSound-TITAN LUX

> *Ici chaque écoute compte. Bienvenue dans la nouvelle ère. A toi, artiste qui cherche à t'exprimer aux yeux du monde entier, ICI C'EST TA SCÈNE!*

Plateforme musicale révolutionnaire conçue pour connecter les créateurs et les passionnés de musique.

## 👨‍💻 Développeur & Fondateur

**Développeur Principal** : M. Tetang Tanekou M.N (EL_AX)  
**Fondateur & Vision** : M. Tindo Arthur (XWrld)

Nous avons conçu cette plateforme pour réinventer la manière dont on découvre et vit la musique. Un espace pour connecter les sons, les créateurs et les auditeurs.

## 🎵 Vision & Mission

NovaSound-TITAN LUX n'est pas juste une plateforme de streaming, c'est un écosystème musical où :

- 🎨 **Les artistes s'expriment librement** - Upload illimité de créations
- 👥 **Les fans découvrent de nouveaux talents** - Exploration intelligente
- 🎯 **La communauté se connecte** - Likes, follows, interactions
- 🌟 **Chaque écoute compte** - Chaque artiste a sa scène

## 🛠️ Stack Technique

**Frontend**
- React 18 avec hooks modernes
- Vite - Build ultra-rapide
- TailwindCSS - Design responsive et moderne
- Framer Motion - Animations fluides
- Lucide React - Icônes professionnelles

**Backend**
- Supabase (PostgreSQL cloud)
- Authentification sécurisée avec email verification
- Row Level Security (RLS)
- Real-time subscriptions
- Storage pour avatars et médias

**Infrastructure**
- Vercel Edge Network
- Supabase Cloud
- CDN global
- SSL/TLS automatique

## � Fonctionnalités

### 🎵 Pour les Artistes
- � **Upload illimité** de musiques
- 🎨 **Personnalisation du profil** avec avatar
- 📊 **Statistiques détaillées** (plays, likes, followers)
- 🔔 **Notifications en temps réel**
- 📱 **Interface mobile optimisée**

### 👥 Pour les Fans
- 🔍 **Découverte intelligente** de nouveaux artistes
- ❤️ **Système de likes** pour soutenir vos créateurs préférés
- 👥 **Follow/Unfollow** pour ne rien manquer
- 📝 **Commentaires et interactions**
- 🎧 **Lecteur audio avancé**

### 🔐 Sécurité & Performance
- 🛡️ **Row Level Security** - Protection des données
- 🚀 **Performance optimisée** - Lazy loading
- 📱 **Responsive design** - Parfait sur tous appareils
- 🔒 **HTTPS obligatoire** - Connexions sécurisées

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
   ```env
   VITE_SUPABASE_URL=votre-url-supabase
   VITE_SUPABASE_ANON_KEY=votre-clé-anon
   ```
3. Exécutez le script SQL fourni dans `create-tables.sql`

## 🚀 Déploiement

### Frontend (Vercel)
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variables d'environnement pré-configurées

### Backend (Supabase)
- Base de données PostgreSQL hébergée
- Authentification intégrée avec email verification
- Stockage de fichiers pour avatars et médias
- Real-time subscriptions

## 📁 Architecture

```
NovaSound-Titan/
├── web/                    # Application React
│   ├── src/
│   │   ├── components/    # Composants UI
│   │   ├── contexts/     # Contextes React
│   │   ├── lib/          # Utilitaires
│   │   ├── pages/         # Pages de l'app
│   │   └── ui/           # Composants de base
│   ├── public/             # Fichiers statiques
│   └── package.json        # Dépendances
├── README.md              # Documentation
└── LICENSE                # Licence
```

## 🎯 Configuration

### Variables d'environnement
- `VITE_SUPABASE_URL` : URL de l'instance Supabase
- `VITE_SUPABASE_ANON_KEY` : Clé publique Supabase

### Base de données
La base de données est configurée avec les tables :
- `users` : Profils artistes avec avatars, bio, statistiques
- `songs` : Musiques avec métadonnées, compteurs
- `likes` : Système de likes des utilisateurs
- `follows` : Relations follow/following

## 🎨 Design & Performance

### Interface Moderne
- Design épuré et professionnel
- Animations fluides avec Framer Motion
- Thème sombre/clair adaptatif
- Optimisé pour mobile et desktop

### Performance
- Optimisé pour Vercel Edge Network
- Base de données PostgreSQL performante
- Lazy loading des composants
- Images optimisées automatiquement

## 🔐 Sécurité

### Protection des Données
- Row Level Security (RLS) Supabase
- Authentification sécurisée avec email verification
- Validation des entrées utilisateur
- Protection XSS automatique
- CORS configuré

## 📞 Contact & Équipe

### Équipe Fondatrice
- **Développeur Principal** : M. Tetang Tanekou M.N (EL_AX)
- **Fondateur & Vision** : M. Tindo Arthur (XWrld)

### Pour toute collaboration
- 📧 **Technique** : Contactez M. Tetang Tanekou M.N
- 🎯 **Stratégique** : Contactez M. Tindo Arthur
- 🌐 **Plateforme** : [NovaSound-TITAN LUX](https://nova-sound-titan.vercel.app)

## 📄 Licence

MIT License - voir [LICENSE](LICENSE)

---

> *"Ici chaque écoute compte. Bienvenue dans la nouvelle ère de la musique digitale."*  
> **NovaSound-TITAN LUX - Votre scène, votre musique, votre communauté.**
