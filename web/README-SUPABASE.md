# 🚀 Migration vers Supabase - Solution Alternative

## Pourquoi Supabase ?

✅ **Base de données persistante** - PostgreSQL hébergé
✅ **Compatible Vercel** - Intégration parfaite
✅ **Authentification intégrée** - Email verification incluse
✅ **Stockage de fichiers** - Pour les avatars et musiques
✅ **Real-time** - Subscriptions automatiques
✅ **Gratuit pour démarrer** - Plan généreux

## 📋 Instructions de Migration

### 1. Créer un projet Supabase
1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Notez votre URL et clé anon

### 2. Configurer le schéma
```bash
# Copiez-collez le contenu de supabase-schema.sql
# Dans l'éditeur SQL de votre projet Supabase
```

### 3. Configurer le frontend
```bash
# Copiez .env.example vers .env
cp .env.example .env

# Ajoutez vos clés Supabase
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### 4. Installer les dépendances
```bash
npm install @supabase/supabase-js
```

### 5. Mettre à jour les imports
Remplacez les imports PocketBase par Supabase :
```jsx
// Ancien
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbaseClient';

// Nouveau
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { db } from '@/lib/supabaseClient';
```

## 🔄 Composants Supabase

- **SupabaseLikeButton** - Gestion des likes avec PostgreSQL
- **SupabaseFollowButton** - Gestion des follows
- **SupabaseEditProfileModal** - Modification du profil
- **SupabaseAuthContext** - Authentification complète

## 🎯 Avantages vs PocketBase

| Fonctionnalité | PocketBase | Supabase |
|---|---|---|
| **Persistance** | Local uniquement | ✅ Cloud persistant |
| **Scalabilité** | Limitée | ✅ Auto-scaling |
| **Backup** | Manuel | ✅ Automatique |
| **Vercel** | Configuration complexe | ✅ Intégration native |
| **Coût** | Serveur requis | ✅ Plan gratuit généreux |
| **Real-time** | Basique | ✅ Avancé |

## 🚀 Déploiement

### Vercel (Frontend)
```bash
# Variables d'environnement dans Vercel
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### Supabase (Backend)
1. Importez le schéma SQL
2. Configurez l'authentification
3. Activez le stockage pour les fichiers

## 📊 Migration des données

Si vous avez des données existantes :
```sql
-- Script de migration (à adapter selon vos données)
INSERT INTO public.users (id, username, bio)
SELECT id, username, bio FROM old_users_table;
```

## 🔧 Configuration avancée

### Storage pour les avatars
```sql
-- Créer un bucket pour les avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);
```

### Politiques RLS
Le schéma inclut déjà des politiques de sécurité Row Level Security pour :
- ✅ Protection des données utilisateur
- ✅ Permissions granulaires
- ✅ Sécurité par défaut

## 🎉 Résultat

Avec Supabase, vous obtenez :
- **Base de données 100% persistante**
- **Performance optimale**
- **Sécurité intégrée**
- **Scalabilité automatique**
- **Intégration Vercel parfaite**

**Plus de problèmes d'inscription !** 🎯
