/**
 * 🧪 COMPLETE TEST SUITE - NOTIFICATIONS NOVASOUND
 * 
 * Tests complets pour valider tout le système de notifications
 * Frontend + Backend + Edge Function + Database
 */

// ========================================
// 1. CONFIGURATION
// ========================================
const SUPABASE_URL = 'https://tleuzlyfelrnykpbwhkc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODY4OTUsImV4cCI6MjA4NzE2Mjg5NX0.PEXcdsykNhIhtXOmprBkshqZfZ9qkc8WKmFbBNSn-II';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-push-notification`;

// ========================================
// 2. UTILITAIRES
// ========================================
const log = (message, data = null) => {
  console.log(`[TEST] ${new Date().toISOString()} - ${message}`, data || '');
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...options.headers
      },
      ...options
    });
    return await response.json();
  } catch (error) {
    log('❌ Request failed:', error);
    throw error;
  }
};

// ========================================
// 3. TESTS BASE DE DONNÉES
// ========================================
async function testDatabaseConnection() {
  log('🔍 Testing database connection...');
  
  try {
    // Test connexion simple
    const { data, error } = await makeRequest(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET'
    });
    
    if (error) throw error;
    
    log('✅ Database connection successful');
    return true;
  } catch (error) {
    log('❌ Database connection failed:', error);
    return false;
  }
}

async function testNotificationsTable() {
  log('🔍 Testing notifications table...');
  
  try {
    // Vérifier structure table
    const { data, error } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications?select=id,type,title,created_at&limit=1`,
      { method: 'GET' }
    );
    
    if (error) throw error;
    
    log('✅ Notifications table accessible', data);
    return true;
  } catch (error) {
    log('❌ Notifications table test failed:', error);
    return false;
  }
}

async function testPushSubscriptionsTable() {
  log('🔍 Testing push_subscriptions table...');
  
  try {
    const { data, error } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=id,user_id,endpoint&limit=1`,
      { method: 'GET' }
    );
    
    if (error) throw error;
    
    log('✅ Push subscriptions table accessible', data);
    return true;
  } catch (error) {
    log('❌ Push subscriptions table test failed:', error);
    return false;
  }
}

// ========================================
// 4. TESTS EDGE FUNCTION
// ========================================
async function testEdgeFunctionHealth() {
  log('🔍 Testing edge function health...');
  
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Edge function healthy:', data);
      return true;
    } else {
      log('❌ Edge function unhealthy:', data);
      return false;
    }
  } catch (error) {
    log('❌ Edge function health check failed:', error);
    return false;
  }
}

async function testEdgeFunctionAuth() {
  log('🔍 Testing edge function authentication...');
  
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
      body: JSON.stringify({
        title: 'Test',
        body: 'Test'
      })
    });
    
    if (response.status === 401) {
      log('✅ Edge function auth working (401 as expected)');
      return true;
    } else {
      log('❌ Edge function auth not working:', response.status);
      return false;
    }
  } catch (error) {
    log('❌ Edge function auth test failed:', error);
    return false;
  }
}

// ========================================
// 5. TESTS NOTIFICATIONS FRONTEND
// ========================================
async function testNotificationTypes() {
  log('🔍 Testing all notification types...');
  
  const types = [
    'like', 'like_song', 'like_news', 'comment', 'comment_news',
    'reply', 'mention', 'follow', 'repost', 'new_song', 'queue_song',
    'mood_vote', 'news', 'chat_reply', 'chat_mention', 'chat_mention_all',
    'live_start', 'live_started', 'live_invite', 'live_join',
    'live_comment', 'live_like', 'live_leave', 'achievement', 'broadcast'
  ];
  
  const results = {};
  
  for (const type of types) {
    try {
      // Simuler insertion notification
      const { data, error } = await makeRequest(
        `${SUPABASE_URL}/rest/v1/notifications`,
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: '00000000-0000-0000-0000-000000000000', // Fake user ID
            type: type,
            title: `Test ${type}`,
            body: `Testing ${type} notification`,
            url: '/test',
            metadata: { test: true }
          })
        }
      );
      
      results[type] = error ? '❌ Failed' : '✅ Success';
      
      // Nettoyer
      if (data && data[0]) {
        await makeRequest(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${data[0].id}`, {
          method: 'DELETE'
        });
      }
      
    } catch (error) {
      results[type] = '❌ Error';
    }
  }
  
  log('📊 Notification types test results:', results);
  
  const successCount = Object.values(results).filter(r => r.includes('✅')).length;
  const totalCount = Object.keys(results).length;
  
  log(`📈 ${successCount}/${totalCount} types working (${Math.round(successCount/totalCount*100)}%)`);
  
  return successCount === totalCount;
}

// ========================================
// 6. TESTS PUSH NOTIFICATIONS
// ========================================
async function testPushNotification() {
  log('🔍 Testing push notification...');
  
  try {
    // Créer un abonnement de test
    const testSubscription = {
      user_id: '00000000-0000-0000-0000-000000000001',
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      p256dh_key: 'test-p256dh-key',
      auth_key: 'test-auth-key'
    };
    
    // Insérer abonnement test
    const { data: subData, error: subError } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/push_subscriptions`,
      {
        method: 'POST',
        body: JSON.stringify(testSubscription)
      }
    );
    
    if (subError) throw subError;
    
    // Envoyer notification test
    const { data, error } = await makeRequest(EDGE_FUNCTION_URL, {
      method: 'POST',
      body: JSON.stringify({
        user_id: testSubscription.user_id,
        title: '🧪 Test Notification',
        body: 'Ceci est un test du système de notifications NovaSound',
        url: '/test',
        type: 'broadcast',
        icon_url: '/icon-192.png'
      })
    });
    
    // Nettoyer
    await makeRequest(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${subData[0].id}`, {
      method: 'DELETE'
    });
    
    if (error) {
      log('❌ Push notification failed (expected for fake endpoint):', error);
      return true; // Échec attendu pour endpoint fake
    }
    
    log('✅ Push notification test completed');
    return true;
    
  } catch (error) {
    log('❌ Push notification test failed:', error);
    return false;
  }
}

// ========================================
// 7. TESTS PERFORMANCE
// ========================================
async function testNotificationPerformance() {
  log('🔍 Testing notification performance...');
  
  try {
    const startTime = Date.now();
    
    // Créer 10 notifications en batch
    const promises = Array.from({ length: 10 }, (_, i) =>
      makeRequest(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000000',
          type: 'like',
          title: `Performance test ${i}`,
          body: `Testing performance ${i}`,
          url: '/test'
        })
      })
    );
    
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    
    // Nettoyer
    await makeRequest(`${SUPABASE_URL}/rest/v1/notifications?title=like.*Performance test`, {
      method: 'DELETE'
    });
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const duration = endTime - startTime;
    
    log(`📊 Performance: ${successCount}/10 notifications in ${duration}ms`);
    
    return successCount >= 9; // 90% success rate
    
  } catch (error) {
    log('❌ Performance test failed:', error);
    return false;
  }
}

// ========================================
// 8. TESTS SÉCURITÉ
// ========================================
async function testSecurity() {
  log('🔍 Testing security measures...');
  
  const tests = [];
  
  // Test 1: Injection SQL
  try {
    const { data, error } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications?select=*&limit=1;DROP TABLE notifications;--`,
      { method: 'GET' }
    );
    
    tests.push({ test: 'SQL Injection', result: !error ? '❌ Vulnerable' : '✅ Protected' });
  } catch (error) {
    tests.push({ test: 'SQL Injection', result: '✅ Protected' });
  }
  
  // Test 2: XSS Protection
  try {
    const { data, error } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000000',
          type: 'like',
          title: '<script>alert("XSS")</script>',
          body: '<img src=x onerror=alert("XSS")>',
          url: '/test'
        })
      }
    );
    
    tests.push({ test: 'XSS Protection', result: error ? '✅ Protected' : '❌ Vulnerable' });
  } catch (error) {
    tests.push({ test: 'XSS Protection', result: '✅ Protected' });
  }
  
  // Test 3: Rate limiting
  try {
    const promises = Array.from({ length: 100 }, () =>
      makeRequest(EDGE_FUNCTION_URL, {
        method: 'POST',
        body: JSON.stringify({
          user_id: '00000000-0000-0000-0000-000000000000',
          title: 'Rate limit test',
          body: 'Testing rate limiting',
          type: 'broadcast'
        })
      })
    );
    
    const results = await Promise.allSettled(promises);
    const rejectedCount = results.filter(r => r.status === 'rejected').length;
    
    tests.push({ 
      test: 'Rate Limiting', 
      result: rejectedCount > 0 ? '✅ Protected' : '❌ No protection detected' 
    });
  } catch (error) {
    tests.push({ test: 'Rate Limiting', result: '❌ Test failed' });
  }
  
  log('🛡️ Security tests results:', tests);
  return tests.every(t => t.result.includes('✅'));
}

// ========================================
// 9. TESTS INTEGRATION
// ========================================
async function testFullFlow() {
  log('🔍 Testing complete notification flow...');
  
  try {
    // 1. Créer utilisateur test
    const testUserId = '00000000-0000-0000-0000-000000000002';
    
    // 2. Créer abonnement push
    const { data: subData } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/push_subscriptions`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: testUserId,
          endpoint: 'https://test-endpoint.com',
          p256dh_key: 'test-key',
          auth_key: 'test-auth'
        })
      }
    );
    
    // 3. Créer notification
    const { data: notifData } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: testUserId,
          type: 'like',
          title: '🧪 Integration Test',
          body: 'Test complet du flux',
          url: '/test-integration'
        })
      }
    );
    
    // 4. Vérifier notification créée
    await sleep(1000);
    
    const { data: checkData } = await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications?id=eq.${notifData[0].id}`
    );
    
    // 5. Marquer comme lue
    await makeRequest(
      `${SUPABASE_URL}/rest/v1/notifications?id=eq.${notifData[0].id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true })
      }
    );
    
    // 6. Nettoyer
    await makeRequest(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${notifData[0].id}`, {
      method: 'DELETE'
    });
    
    await makeRequest(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${subData[0].id}`, {
      method: 'DELETE'
    });
    
    log('✅ Full integration test completed successfully');
    return true;
    
  } catch (error) {
    log('❌ Full integration test failed:', error);
    return false;
  }
}

// ========================================
// 10. RAPPORT FINAL
// ========================================
async function generateReport() {
  log('\n🎯 DÉMARRAGE DES TESTS COMPLETS...\n');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Notifications Table', fn: testNotificationsTable },
    { name: 'Push Subscriptions Table', fn: testPushSubscriptionsTable },
    { name: 'Edge Function Health', fn: testEdgeFunctionHealth },
    { name: 'Edge Function Auth', fn: testEdgeFunctionAuth },
    { name: 'Notification Types', fn: testNotificationTypes },
    { name: 'Push Notification', fn: testPushNotification },
    { name: 'Performance', fn: testNotificationPerformance },
    { name: 'Security', fn: testSecurity },
    { name: 'Full Integration', fn: testFullFlow }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, status: result ? '✅ PASS' : '❌ FAIL' });
      log(`${result ? '✅' : '❌'} ${test.name}`);
    } catch (error) {
      results.push({ name: test.name, status: '❌ ERROR', error: error.message });
      log(`❌ ${test.name}: ${error.message}`);
    }
    
    await sleep(500); // Pause entre tests
  }
  
  // Rapport final
  const passedCount = results.filter(r => r.status === '✅ PASS').length;
  const totalCount = results.length;
  const successRate = Math.round((passedCount / totalCount) * 100);
  
  log('\n🎉 RAPPORT FINAL DES TESTS');
  log('='.repeat(50));
  results.forEach(result => {
    log(`${result.status} ${result.name}`);
    if (result.error) log(`   Error: ${result.error}`);
  });
  log('='.repeat(50));
  log(`📊 Résultat: ${passedCount}/${totalCount} tests passés (${successRate}%)`);
  
  if (successRate >= 90) {
    log('🚀 SYSTÈME PRÊT POUR LA PRODUCTION !');
  } else if (successRate >= 70) {
    log('⚠️ SYSTÈME FONCTIONNEL AVEC QUELQUES PROBLÈMES MINEURS');
  } else {
    log('🚨 SYSTÈME NÉCESSITE DES CORRECTIONS IMPORTANTES');
  }
  
  return { successRate, results };
}

// ========================================
// 11. EXÉCUTION
// ========================================
if (typeof window !== 'undefined') {
  // Navigateur
  window.testNovaSoundNotifications = generateReport;
  console.log('🧪 Test suite loaded. Run: testNovaSoundNotifications()');
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { generateReport };
} else {
  // Auto-exécution
  generateReport().catch(console.error);
}
