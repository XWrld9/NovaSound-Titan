# Guide de dépannage pour les erreurs de navigateur

## Erreur: `chrome-extension://... Unexpected token 'export'`

### Cause
Cette erreur est causée par une extension Chrome qui injecte du code dans ta page Vercel. L’extension utilise des modules ES6 (`export`) que le navigateur ne peut pas charger dans ce contexte.

### Solutions rapides

#### 1. Mode navigation privée (test immédiat)
- Ouvre ton application Vercel dans une fenêtre de navigation privée/incognito
- Si l’erreur disparaît, c’est bien une extension

#### 2. Désactiver les extensions (temporaire)
1. Va dans `chrome://extensions/`
2. Désactive les extensions une par une, en commençant par :
   - AdBlock / uBlock Origin
   - Antivirus (Kaspersky, Avast, Bitdefender)
   - Développeur web (React DevTools, Vue DevTools)
   - Sécurité (HTTPS Everywhere, Privacy Badger)
   - Traducteurs

#### 3. Mode sans échec
1. Ferme complètement Chrome
2. Relance avec : `chrome --disable-extensions`
3. Teste ton application

#### 4. Extension spécifique identifiée
Si l’erreur mentionne `content_reporter.js`, il s’agit probablement de :
- **Kaspersky Protection Extension**
- **Bitdefender TrafficLight**
- **Avast Online Security**
- **McAfee WebAdvisor**

### Solution permanente
- Ajoute ton domaine Vercel aux exceptions de l’extension
- Ou utilise un navigateur différent pour le développement (Firefox, Edge)

### Impact sur ton application
Cette erreur **n’affecte pas** le fonctionnement de NovaSound TITAN LUX. C’est un problème côté client uniquement.

### Actions recommandées
1. Teste en navigation privée pour confirmer
2. Identifie l’extension responsable
3. Ajoute `*.vercel.app` aux exceptions de l’extension
4. Redémarre Chrome et teste à nouveau
