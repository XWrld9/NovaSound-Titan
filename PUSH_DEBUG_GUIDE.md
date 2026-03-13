# 🚨 GUIDE DE DÉBOGAGE - NOTIFICATIONS PUSH NOVASOUND

## 🔍 PROBLÈMES COURANTS ET SOLUTIONS

### 1. **UTILISATEURS NE REÇOIVENT PAS LES NOTIFICATIONS**

#### 📋 ÉTAPES DE VÉRIFICATION:

##### A. **Côté Client (Navigateur)**
```javascript
// Copier-coller dans la console du navigateur
// 1. Vérifier les capacités push
navigator.serviceWorker.ready.then(() => {
  console.log('✅ Service Worker OK');
  console.log('Permission:', Notification.permission);
  console.log('Push support:', 'PushManager' in navigator);
});

// 2. Vérifier l'abonnement actuel
navigator.serviceWorker.ready.then(async (reg) => {
  const sub = await reg.pushManager.getSubscription();
  console.log('Subscription:', sub ? sub.endpoint : 'Aucune');
});
```

##### B. **Base de Données (Supabase)**
```sql
-- Exécuter dans Supabase SQL Editor
-- 1. Vérifier les notifications récentes
SELECT type, COUNT(*) as count, 
       COUNT(CASE WHEN push_sent = true THEN 1 END) as push_sent
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY type;

-- 2. Vérifier les abonnements push
SELECT user_id, COUNT(*) as subs_count
FROM push_subscriptions 
GROUP BY user_id;
```

##### C. **Edge Function**
```javascript
// Tester l'edge function
fetch('/functions/v1/send-push-notification', {
  method: 'OPTIONS'
}).then(r => console.log('Edge function status:', r.status));
```

---

### 2. **PROBLÈMES SPÉCIFIQUES**

#### 🔑 **CLÉS VAPID INCORRECTES**
- **Symptôme**: Erreur 401/403 sur l'edge function
- **Solution**: Vérifier que `VITE_VAPID_PUBLIC_KEY` dans le frontend correspond à `VAPID_PUBLIC_KEY` dans l'edge function

#### 📱 **PERMISSIONS MANQUANTES**
- **Symptôme**: `Notification.permission` != "granted"
- **Solution**: L'utilisateur doit cliquer sur "Activer les notifications push"

#### 📡 **SERVICE WORKER NON ACTIF**
- **Symptôme**: Pas de service worker enregistré
- **Solution**: Recharger la page ou réinstaller le PWA

#### 🗄️ **ABONNEMENTS NON ENREGISTRÉS**
- **Symptôme**: `push_subscriptions` vide pour l'utilisateur
- **Solution**: Vérifier la fonction `upsertSubscription` dans NotificationContext

---

### 3. **SCRIPTS DE TEST**

#### 🧪 **Test Complet Push**
```javascript
// Exécuter dans la console
// Copier le contenu de test-push-notification.js
```

#### 🔍 **Diagnostic Client**
```javascript
// Exécuter dans la console  
// Copier le contenu de debug-push.js
```

#### 📊 **Vérification Base**
```sql
-- Exécuter dans Supabase
-- Copier le contenu de check-notifications.sql
```

---

### 4. **CONFIGURATION REQUISE**

#### 🌐 **Variables d'Environnement (Frontend)**
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon
VITE_VAPID_PUBLIC_KEY=BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc
```

#### ⚙️ **Variables d'Environnement (Edge Function)**
```env
VAPID_PUBLIC_KEY=BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc
VAPID_PRIVATE_KEY=d1UoZRYkI4T6Uo7y5cF7byqXXX60LaMEt8wXtX1eG7A
VAPID_SUBJECT=mailto:eloadxfamily@gmail.com
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service
SUPABASE_ANON_KEY=votre_clé_anon
```

---

### 5. **TYPES DE NOTIFICATIONS SUPPORTÉS**

✅ **TOUS LES TYPES SONT GÉRÉS:**
- `like`, `like_song`, `like_news` → Pages chansons/news
- `comment`, `comment_news`, `reply`, `mention` → Pages chansons
- `follow`, `repost` → Pages artistes/explore
- `new_song`, `queue_song`, `mood_vote` → Pages chansons
- `news` → Page news
- `chat_reply`, `chat_mention`, `chat_mention_all` → Chat avec highlight
- `live_*` → Pages live rooms
- `broadcast`, `achievement` → Pages appropriées

---

### 6. **DÉBOGAGE ÉTAPE PAR ÉTAPE**

1. **🔍 Vérifier le navigateur** (debug-push.js)
2. **📊 Vérifier la base** (check-notifications.sql)  
3. **🧪 Tester l'envoi** (test-push-notification.js)
4. **🔧 Corriger les problèmes** (voir sections ci-dessus)

---

### 7. **MONITORING**

#### 📈 **Logs à Surveiller**
- Console du navigateur (erreurs push)
- Logs edge function (Supabase)
- Table `push_notification_logs` (statistiques)
- Table `notifications` (push_sent flag)

#### 🎯 **KPIs**
- Taux de livraison: `sent / total`
- Taux d'échec: `failed / total`
- Abonnements actifs: `COUNT(push_subscriptions)`
- Notifications par type: `GROUP BY type`

---

## 🆘 **SUPPORT**

Si après tous ces tests les notifications ne fonctionnent toujours pas:

1. **📋 Collecter les infos**: Navigateur, OS, permissions, logs
2. **🧪 Exécuter tous les scripts** de test
3. **📊 Vérifier la base** avec les requêtes SQL
4. **🔍 Partager les résultats** pour diagnostic avancé

---

**💡 ASTUCE**: La plupart des problèmes viennent de permissions manquantes ou de clés VAPID incorrectes. Commencez par vérifier ces deux points !
