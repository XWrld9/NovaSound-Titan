# NovaSound-Titan

Plateforme musicale avec React et PocketBase.

## Fonctionnalités

- Catalogue musical et exploration
- Upload de musique
- Profils d'artistes
- Lecteur audio intégré
- Authentification utilisateur
- Interface responsive

## Stack Technique

**Frontend**
- React 18
- Vite
- React Router
- TailwindCSS
- Lucide React

**Backend**
- PocketBase
- SQLite

## Installation

```bash
git clone https://github.com/XWrld9/NovaSound-Titan.git
cd NovaSound-Titan/web
npm install
npm run dev
```

## Déploiement

**Vercel**
- Root Directory: `web`
- Build Command: `npm run build`
- Output Directory: `dist`

**Local**
```bash
cd pocketbase
./pocketbase serve
```

## Structure

```
NovaSound-Titan/
├── web/           # Application React
├── pocketbase/    # Backend PocketBase
└── README.md
```

## Licence

MIT License - voir [LICENSE](LICENSE)
