// Script pour vérifier si l'edge function est accessible
// À exécuter dans la console du navigateur

(async function checkEdgeFunction() {
  console.log('🔍 VÉRIFICATION EDGE FUNCTION');
  
  try {
    // Test 1: Vérifier si l'edge function répond
    console.log('\n📡 1. TEST DISPONIBILITÉ EDGE FUNCTION:');
    const response = await fetch('/functions/v1/send-push-notification', {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers CORS:', response.headers.get('Access-Control-Allow-Origin'));
    console.log('Methods:', response.headers.get('Access-Control-Allow-Methods'));
    
    // Test 2: Vérifier les variables d'environnement
    console.log('\n🔑 2. VÉRIFICATION VARIABLES FRONTEND:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
    console.log('VITE_VAPID_PUBLIC_KEY:', import.meta.env.VITE_VAPID_PUBLIC_KEY?.substring(0, 20) + '...');
    
    // Test 3: Vérifier la configuration Supabase
    console.log('\n🗄️ 3. VÉRIFICATION CONFIG SUPABASE:');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session active:', !!session);
    console.log('User ID:', session?.user?.id);
    
    // Test 4: Vérifier les abonnements push de l'utilisateur
    if (session?.user?.id) {
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', session.user.id);
      
      if (error) {
        console.log('❌ Erreur abonnements:', error);
      } else {
        console.log('✅ Abonnements trouvés:', subs.length);
        subs.forEach((sub, i) => {
          console.log(`  ${i + 1}. Endpoint: ${sub.endpoint.substring(0, 50)}...`);
          console.log(`     Créé: ${new Date(sub.created_at).toLocaleString()}`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Erreur vérification:', error);
  }
})();
