# NovaSound-Titan

Une plateforme musicale moderne construite avec React et PocketBase, permettant aux utilisateurs de découvrir, uploader et partager de la musique.

## 🎵 Fonctionnalités

- **Catalogue Musical** : Explorez une vaste collection de musiques
- **Upload de Musique** : Partagez vos propres créations
- **Profils d'Artistes** : Découvrez et suivez vos artistes préférés
- **Lecteur Audio Intégré** : Écoutez vos morceaux préférés
- **Authentification Sécurisée** : Créez un compte ou connectez-vous
- **Interface Responsive** : Profitez de l'expérience sur tous les appareils

## 🛠️ Stack Technique

### Frontend
- **React 18** - Framework JavaScript moderne
- **Vite** - Outil de build ultra-rapide
- **React Router** - Gestion du routing
- **TailwindCSS** - Framework CSS utilitaire
- **Lucide React** - Icônes modernes

### Backend
- **PocketBase** - Backend BaaS open-source
- **SQLite** - Base de données légère

## 🚀 Déploiement

### Développement Local
```bash
# Cloner le repository
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan

# Installer les dépendances
cd web
npm install

# Démarrer le serveur de développement
npm run dev
```

### Déploiement sur Vercel
1. Connecter votre repository GitHub à Vercel
2. Configurer le **Root Directory** sur `web`
3. **Build Command**: `npm install && npm run build`
4. **Output Directory**: `dist`
5. Déployer !

### Production avec PocketBase
```bash
# Démarrer PocketBase
cd pocketbase
./pocketbase serve
```

## 📁 Structure du Projet

```
NovaSound-Titan/
├── web/                    # Application React
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── pages/         # Pages de l'application
│   │   ├── contexts/      # Contextes React
│   │   └── ui/           # Composants UI réutilisables
│   ├── public/           # Fichiers statiques
│   └── package.json
├── pocketbase/           # Backend PocketBase
│   ├── pb_hooks/        # Hooks PocketBase
│   └── pb_data/         # Données de la base
└── README.md
```

## 🎨 Composants Principaux

- **AudioPlayer** : Lecteur audio avec contrôles complets
- **SongCard** : Carte pour afficher les morceaux
- **Header/Footer** : Navigation et pied de page
- **ProtectedRoute** : Protection des routes authentifiées

## 🔐 Authentification

Le système utilise :
- JWT tokens pour la sécurité
- Routes protégées pour les fonctionnalités avancées
- Contexte React pour la gestion d'état

## 🌟 Contribuer

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🤝 Auteur

**XWrld9** - *Développeur principal* - [GitHub](https://github.com/XWrld9)

## 🙏 Remerciements

- L'équipe React pour ce framework incroyable
- PocketBase pour cette solution backend élégante
- La communauté open-source pour l'inspiration et le support

---

**NovaSound-Titan** - La musique à portée de clic 🎧
