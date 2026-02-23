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
- **Lottie React** - Animations type Spotify

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

## 🚀 Fonctionnalités

### 🎵 Pour les Artistes
- 📤 **Upload illimité** de musiques
- 🎨 **Personnalisation du profil** avec avatar et bio
- 📊 **Statistiques détaillées** (plays, likes, followers)
- 🔔 **Notifications en temps réel**
- 📱 **Interface mobile optimisée**
- ✨ **Avatar par défaut** élégant
- 🎭 **Background personnalisé**

### 👥 Pour les Fans
- 🔍 **Découverte intelligente** de nouveaux artistes
- ❤️ **Système de likes** avec animations Lottie
- 👥 **Follow/Unfollow** pour ne rien manquer
- 📥 **Téléchargement** des musiques préférées
- 🔗 **Partage** des chansons
- 🎧 **Lecteur audio avancé**
- ✏️ **Modification de profil** complète

### 🔐 Sécurité & Performance
- 🛡️ **Row Level Security** - Protection des données
- 🚀 **Performance optimisée** - Lazy loading
- 📱 **Responsive design** - Parfait sur tous appareils
- 🎬 **Animations fluides** - Micro-interactions
- 🌈 **Design moderne** - Type Spotify

## 📦 Installation

### Prérequis Système
- **Node.js 24.x** ou supérieur (requis pour Vite 4.x)
- **npm 9.x** ou supérieur
- **Git** pour cloner le repository

### Développement Local
```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan
cd web
npm install
npm run dev
```

### ⚠️ Points Critiques Avant Déploiement
1. **Node.js Version** : Vérifiez `node --version` (doit être 24.x)
2. **Variables d'environnement** : Toutes les 3 clés sont OBLIGATOIRES
3. **Buckets Storage** : Doivent être créés AVANT le premier upload
4. **Politiques RLS** : Activer manuellement si script échoue
5. **Domaine Supabase** : Configurer les redirect URLs après déploiement

### Configuration Supabase
1. Créez un projet sur [supabase.com](https://supabase.com)
2. Configurez les variables d'environnement :
   ```env
   VITE_SUPABASE_URL=votre-url-supabase
   VITE_SUPABASE_ANON_KEY=votre-clé-anon
   SUPABASE_SERVICE_KEY=votre-clé-service  # Pour créer les buckets
   ```
3. **Exécutez le script SQL complet** dans `setup-supabase.sql`
4. **Installez les dépendances** (une seule fois) :
   ```bash
   npm install
   ```
5. **Créez les buckets automatiquement** avec le script :
   ```bash
   npm run setup:buckets
   ```

#### 🤖 Script Automatisé de Buckets
Le script `setup-buckets.js` crée automatiquement :
- ✅ **Bucket `avatars`** - Photos de profil (5MB max, public)
- ✅ **Bucket `audio`** - Fichiers audio (50MB max, public)  
- ✅ **Bucket `covers`** - Pochettes d'albums (10MB max, public)
- ✅ **Politiques RLS** automatiques pour chaque bucket
- ✅ **Permissions** lecture publique + écriture authentifiée

**Prérequis pour le script :**
- Installer les dépendances : `npm install @supabase/supabase-js dotenv`
- Créer une clé service dans Supabase Dashboard > Settings > API
- Ajouter `SUPABASE_SERVICE_KEY` dans votre `.env`

## 🚀 Déploiement

### Frontend (Vercel)
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variables d'environnement :
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### Backend (Supabase)
- Base de données PostgreSQL hébergée
- Authentification intégrée avec email verification
- Stockage de fichiers pour avatars et médias
- Real-time subscriptions

## 🧭 Routing (important)

Cette application utilise `HashRouter` (React Router) pour éviter les erreurs `404` au rafraîchissement sur Vercel.

- **URL d'accueil** : `https://nova-sound-titan.vercel.app/#/`
- **Profil** : `https://nova-sound-titan.vercel.app/#/profile`
- **Explorer** : `https://nova-sound-titan.vercel.app/#/explorer`

## 📁 Architecture

```
NovaSound-Titan/
├── web/                    # Application React
│   ├── src/
│   │   ├── components/    # Composants UI
│   │   │   ├── LottieAnimation.jsx  # Animations Lottie
│   │   │   ├── LoadingSpinner.jsx # Spinner moderne
│   │   │   └── ...
│   │   ├── contexts/     # Contextes React
│   │   ├── lib/          # Utilitaires
│   │   ├── pages/         # Pages de l'app
│   │   ├── animations/    # Animations Lottie JSON
│   │   └── ui/           # Composants de base
│   ├── public/             # Fichiers statiques
│   │   ├── background.png  # Background personnalisé
│   │   └── profil par defaut.png # Avatar par défaut
│   ├── setup-buckets.js   # Script automatisé buckets
│   └── package.json        # Dépendances
├── README.md              # Documentation
└── LICENSE                # Licence
```

## 🎯 Configuration

### Variables d'environnement
- `VITE_SUPABASE_URL` : URL de l'instance Supabase
- `VITE_SUPABASE_ANON_KEY` : Clé publique Supabase
- `SUPABASE_SERVICE_KEY` : Clé service (pour buckets)

### Base de données
La base de données est configurée avec les tables :
- `users` : Profils artistes avec avatars, bio, statistiques
- `songs` : Musiques avec métadonnées, compteurs
- `likes` : Système de likes des utilisateurs
- `follows` : Relations follow/following
- `news` : Actualités et annonces

### Storage Buckets
- `avatars` : Photos de profil des utilisateurs
- `audio` : Fichiers audio des chansons
- `covers` : Pochettes d'albums

## 🎨 Design & Performance

### Interface Moderne
- Design épuré et professionnel
- Animations fluides avec Framer Motion + Lottie
- Thème sombre avec background personnalisé
- Optimisé pour mobile et desktop
- Avatar par défaut élégant

### Performance
- Optimisé pour Vercel Edge Network
- Base de données PostgreSQL performante
- Lazy loading des composants
- Images optimisées automatiquement
- Animations Lottie légères

## 🔐 Sécurité

### Protection des Données
- Row Level Security (RLS) Supabase
- Authentification sécurisée avec email verification
- Validation des entrées utilisateur
- Protection XSS automatique
- CORS configuré

## 🎵 Nouveautés (Version 2.0)

### ✨ Améliorations récentes
- 🎨 **Background personnalisé** - Utilise `background.png`
- 👤 **Avatar par défaut** - Utilise `profil par defaut.png`
- 🎬 **Animations Lottie** - Type Spotify pour likes et play
- 🔧 **SQL complet** - Script `setup-supabase.sql` irréprochable
- 🤖 **Buckets automatisés** - Script `setup-buckets.js`
- 📱 **Micro-interactions** - LoadingSpinner et transitions fluides
- 🚀 **Performance** - Optimisations et responsive design

### 🎯 Fonctionnalités clés
- Upload d'avatar fonctionnel avec bucket `avatars`
- Système de follow/followers complet
- Système de likes avec animations
- Profil utilisateur avec tous les onglets
- Login/signup améliorés avec gestion d'erreurs

## 🗺️ Roadmap & Versions Futures

### Version 2.1 (Prochainement)
- 🎵 **Player avancé** - Playlist, shuffle, repeat
- 💬 **Commentaires** - Sur les chansons et profils
- 🔔 **Notifications push** - Nouveaux followers et likes
- 📊 **Analytics détaillées** - Stats artistes en temps réel

### Version 2.2 (Q2 2026)
- 🎥 **Live streaming** - Concerts en direct
- 🤝 **Collaborations** - Duos entre artistes
- 💰 **Monétisation** - Tips et abonnements
- 🌍 **Multi-langues** - Internationalisation

### Version 3.0 (2026)
- 📱 **App mobile native** - iOS et Android
- 🎧 **Podcasts intégrés** - Émissions et interviews
- 🤖 **IA Music** - Recommandations intelligentes
- 🎪 **Événements virtuels** - Concerts online

### 🐛 Bugs Connus & En Cours
- ⚠️ **Upload gros fichiers** > 50MB (limitation Supabase)
- ⚠️ **Streaming sur mobile** - Optimisation en cours
- ⚠️ **Recherche avancée** - Filtrage en développement

## �📞 Contact & Équipe

### Équipe Fondatrice
- **Développeur Principal** : M. Tetang Tanekou M.N (EL_AX)
- **Fondateur & Vision** : M. Tindo Arthur

### Pour toute collaboration
- 📧 **Technique** : Contactez M. Tetang Tanekou M.N
- 🎯 **Stratégique** : Contactez M. Tindo Arthur
- 🌐 **Plateforme** : [NovaSound-TITAN LUX](https://nova-sound-titan.vercel.app)

## � Dépannage & Erreurs Courantes

### ❌ Erreurs Fréquentes

**Build échoue**
```bash
# Vérifier version Node.js
node --version  # Doit être 24.x

# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
```

**Variables d'environnement non trouvées**
```bash
# Créer fichier .env
echo "VITE_SUPABASE_URL=votre-url" > .env
echo "VITE_SUPABASE_ANON_KEY=votre-clé" >> .env
echo "SUPABASE_SERVICE_KEY=votre-clé-service" >> .env
```

**Buckets non créés automatiquement**
```bash
# Vérifier clés Supabase
node -e "console.log(process.env.SUPABASE_SERVICE_KEY)"

# Créer manuellement si échoue
npm run setup:buckets
```

**Upload d'avatar échoue**
- ✅ Vérifier bucket `avatars` existe
- ✅ Vérifier politiques RLS activées
- ✅ Vérifier taille fichier < 5MB

**Login/Signup ne fonctionne pas**
- ✅ Vérifier email confirmation dans Supabase
- ✅ Vérifier redirect URLs configurées
- ✅ Vérifier RLS policies actives

### 🚨 Solutions Rapides

**Problème de CORS**
```javascript
// Dans Supabase Dashboard > Settings > API
// Ajouter votre domaine Vercel dans les CORS allowed origins
```

**Problème de routing 404**
```javascript
// L'application utilise HashRouter (#/)
// URLs correctes : https://votre-domaine.com/#/profile
```

**Problème de performance**
```bash
# Vider cache et rebuild
npm run build --force
```

## 📞 Support & Aide

### 🆘 Obtenir de l'Aide
- **Documentation Supabase** : [supabase.com/docs](https://supabase.com/docs)
- **Documentation Vercel** : [vercel.com/docs](https://vercel.com/docs)
- **Issues GitHub** : [Signaler un bug](https://github.com/XWrld9/NovaSound-Titan/issues)

### 📧 Contact Technique
- **Développeur** : M. Tetang Tanekou M.N (EL_AX)
- **Email** : elax@novasound-titan.com
- **GitHub** : [@EL_AX](https://github.com/EL_AX)

### ⏰ Temps de Réponse
- **Support technique** : 24-48h
- **Bugs critiques** : < 24h
- **Fonctionnalités** : Selon roadmap

---

## �📄 Licence

MIT License - voir [LICENSE](LICENSE)

---

> *"Ici chaque écoute compte. Bienvenue dans la nouvelle ère de la musique digitale."*  
> **NovaSound-TITAN LUX - Votre scène, votre musique, votre communauté.**
