// Script de test pour envoyer une notification push
// À exécuter dans la console du navigateur sur NovaSound

(async function testPushNotification() {
  console.log('🧪 TEST ENVOI NOTIFICATION PUSH');
  
  // Vérifier si l'utilisateur est connecté
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ Utilisateur non connecté');
    return;
  }
  
  console.log('✅ Utilisateur connecté:', user.email);
  
  // Créer une notification de test
  const testNotification = {
    user_id: user.id,
    type: 'test',
    title: '🧪 Test Push NovaSound',
    body: 'Ceci est un test de notification push pour vérifier que tout fonctionne',
    url: '#/explore',
    icon_url: '/icon-192.png',
    renotify: true,
    silent: false
  };
  
  try {
    // Insérer la notification dans la base
    const { data: notif, error: insertError } = await supabase
      .from('notifications')
      .insert(testNotification)
      .select()
      .single();
    
    if (insertError) {
      console.log('❌ Erreur insertion notification:', insertError);
      return;
    }
    
    console.log('✅ Notification créée:', notif.id);
    
    // Appeler l'edge function
    const response = await fetch('/functions/v1/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        record: {
          ...testNotification,
          id: notif.id,
          notif_id: notif.id
        }
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Push envoyé avec succès:', result);
      console.log('📊 Statistiques:', {
        envoyées: result.sent,
        échouées: result.failed,
        total: result.total,
        purgées: result.purged,
        temps: result.elapsed_ms + 'ms'
      });
    } else {
      console.log('❌ Erreur push:', response.status, result);
    }
    
  } catch (error) {
    console.log('❌ Erreur test:', error);
  }
})();
