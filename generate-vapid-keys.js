// Générateur de clés VAPID
const webpush = require('web-push');

// Générer les clés VAPID
const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== CLÉS VAPID POUR NOVASOUND TITAN LUX ===');
console.log('');
console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
console.log('');
console.log('SUBJECT: mailto:eloadxfamily@gmail.com');
console.log('');
console.log('Copie ces clés dans les Edge Functions Supabase !');
