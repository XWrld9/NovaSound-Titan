// Script de débogage pour vérifier les notifications push
// À exécuter dans la console du navigateur sur NovaSound

(async function debugPushNotifications() {
  console.log('🔍 DÉBOGAGE NOTIFICATIONS PUSH NOVASOUND');
  
  // 1. Vérifier Service Worker
  console.log('\n📡 1. SERVICE WORKER:');
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    console.log('✅ Service Worker actif:', reg.scope);
    console.log('✅ SW state:', reg.active?.state);
  } else {
    console.log('❌ Service Worker non supporté');
    return;
  }
  
  // 2. Vérifier permission notification
  console.log('\n🔔 2. PERMISSION NOTIFICATION:');
  console.log('Permission:', Notification.permission);
  console.log('Support desktop:', 'Notification' in window && 'PushManager' in window);
  
  // 3. Vérifier subscription existante
  console.log('\n📱 3. SUBSCRIPTION PUSH:');
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      console.log('✅ Subscription trouvée:', sub.endpoint);
      console.log('Keys:', sub.toJSON().keys);
      console.log('p256dh length:', sub.toJSON().keys.p256dh.length);
      console.log('auth length:', sub.toJSON().keys.auth.length);
    } else {
      console.log('❌ Aucune subscription trouvée');
    }
  } catch (e) {
    console.log('❌ Erreur subscription:', e);
  }
  
  // 4. Vérifier localStorage
  console.log('\n💾 4. LOCAL STORAGE:');
  const userId = localStorage.getItem('supabase.auth.token') ? 'Présent' : 'Absent';
  console.log('Auth token:', userId);
  
  // 5. Vérifier VAPID key
  console.log('\n🔑 5. VAPID KEY:');
  const vapidKey = 'BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc';
  console.log('VAPID key (frontend):', vapidKey.substring(0, 20) + '...');
  console.log('VAPID key length:', vapidKey.length);
  
  // 6. Test d'envoi de notification locale
  console.log('\n🧪 6. TEST NOTIFICATION LOCALE:');
  try {
    const notification = new Notification('Test NovaSound', {
      body: 'Ceci est un test de notification locale',
      icon: '/icon-192.png',
      badge: '/notification-badge.png',
      tag: 'test-local'
    });
    console.log('✅ Notification locale envoyée');
    setTimeout(() => notification.close(), 3000);
  } catch (e) {
    console.log('❌ Erreur notification locale:', e);
  }
  
  // 7. Vérifier si l'utilisateur peut recevoir des push
  console.log('\n📊 7. CAPACITÉS PUSH:');
  console.log('Push support:', 'PushManager' in window);
  console.log('Service Worker support:', 'serviceWorker' in navigator);
  console.log('Notification support:', 'Notification' in window);
  console.log('Permission OK:', Notification.permission === 'granted');
  
  console.log('\n🎯 DIAGNOSTIC FINAL:');
  const canReceivePush = 
    'serviceWorker' in navigator && 
    'PushManager' in window && 
    'Notification' in window && 
    Notification.permission === 'granted';
    
  console.log('Peut recevoir des push:', canReceivePush ? '✅ OUI' : '❌ NON');
  
  if (!canReceivePush) {
    console.log('\n🔧 ACTIONS RECOMMANDÉES:');
    if (Notification.permission !== 'granted') {
      console.log('- Demander la permission notification');
    }
    if (!('serviceWorker' in navigator)) {
      console.log("- Mettre à jour le navigateur (Service Worker requis)");
    }
    if (!('PushManager' in window)) {
      console.log("- Mettre à jour le navigateur (Push Manager requis)");
    }
  }
})();
