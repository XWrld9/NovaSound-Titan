# GUIDE CONFIGURATION SUPABASE

## 📍 1. Récupérer les clés Supabase

**Dans le Dashboard Supabase :**
1. Va dans `Settings` → `API`
2. Copie ces 3 clés :

```
SUPABASE_URL: https://tleuzlyfrelrnkpbwhkc.supabase.co
SUPABASE_ANON_KEY:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODY4OTUsImV4cCI6MjA4NzE2Mjg5NX0.PEXcdsykNhIhtXOmprBkshqZfZ9qkc8WKmFbBNSn-II
SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU4Njg5NSwiZXhwIjoyMDg3MTYyODk1fQ.AxYNyho-IywJt4-5bpyL8rQ0cN9W1J4f-o2cxeaABK4
```

## 📍 2. Configurer les Edge Functions

**Dans le Dashboard Supabase :**
1. Va dans `Edge Functions`
2. Clique sur `send-push-notification`
3. Va dans `Settings` (icône engrenage)
4. Ajoute ces variables :

```
VAPID_PUBLIC_KEY:BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc
VAPID_PRIVATE_KEY: d1UoZRYkI4T6Uo7y5cF7byqXXX60LaMEt8wXtX1eG7A 
VAPID_SUBJECT: mailto:eloadxfamily@gmail.com
SUPABASE_URL: https://tleuzlyfrelrnkpbwhkc.supabase.co
SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU4Njg5NSwiZXhwIjoyMDg3MTYyODk1fQ.AxYNyho-IywJt4-5bpyL8rQ0cN9W1J4f-o2cxeaABK4
```

## 📍 3. Générer les clés VAPID

**Option 1 - Via le dashboard Supabase :**
1. Va dans `Authentication` → `Settings`
2. Cherche "Push Notifications"
3. Génère les clés VAPID

**Option 2 - Via web-vapid (recommandé) :**
1. Va sur https://web-push-codelab.glitch.me/
2. Entre ton email : `eloadxfamily@gmail.com`
3. Copie le `Public Key` et `Private Key`

## 📍 4. Variables finales à configurer

**Dans Edge Functions → send-push-notification → Settings :**

```
SUPABASE_URL=https://tleuzlyfrelrnkpbwhkc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_role_key_du_dashboard]
VAPID_PUBLIC_KEY=[clé_publique_vapid]
VAPID_PRIVATE_KEY=[clé_privée_vapid]
VAPID_SUBJECT=mailto:eloadxfamily@gmail.com
```

## 📍 5. Vérification

**Après configuration :**
1. Teste l'Edge Function
2. Vérifie les logs
3. Teste une notification push

## 🚨 IMPORTANT

- **Ne partage jamais** les clés Service Role !
- **Anon Key** est publique (déjà dans le frontend)
- **VAPID keys** sont pour les notifications push
- **Subject** doit être ton email exact
