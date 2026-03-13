/**
 * Network Detector - NovaSound TITAN LUX V410000
 * Détection de l'état de connexion réseau
 */

import { useState, useEffect } from 'react';
import { offlineMessages } from '@/lib/offlineStore';

export const useNetworkDetector = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false
  });

  useEffect(() => {
    // Écouter les changements de connexion
    const handleOnline = () => {
      setIsOnline(true);
      console.info('[Network] Connection restored');
      // Synchroniser les données hors-ligne quand on revient en ligne
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.warn('[Network] Connection lost');
    };

    const handleConnectionChange = () => {
      if (navigator.connection) {
        setNetworkInfo({
          effectiveType: navigator.connection.effectiveType || 'unknown',
          downlink: navigator.connection.downlink || 0,
          rtt: navigator.connection.rtt || 0,
          saveData: navigator.connection.saveData || false
        });
      }
    };

    // S'abonner aux événements
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Écouter les changements de connexion (si disponible)
    if (navigator.connection) {
      navigator.connection.addEventListener('change', handleConnectionChange);
      handleConnectionChange(); // Initialiser
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  // Synchroniser les messages hors-ligne au retour de connexion
  const syncOfflineData = async () => {
    try {
      const pending = await offlineMessages.getPendingMessages();
      if (!pending?.length) return;

      console.info(`[Network] Syncing ${pending.length} offline message(s)…`);

      // Import dynamique pour éviter une dépendance circulaire au top-level
      const { supabase } = await import('@/lib/supabaseClient');

      for (const msg of pending) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user?.id) break; // pas connecté, on arrête

          const { error } = await supabase
            .from('chat_messages')
            .insert({
              user_id: user.id,
              content: msg.content,
              ...(msg.replyTo ? {
                reply_to_id:       msg.replyTo.id,
                reply_to_content:  msg.replyTo.content?.slice(0, 120),
                reply_to_username: msg.replyTo.reply_to_username || null,
              } : {}),
            });

          if (!error) {
            await offlineMessages.removeMessage(msg.id);
            console.info(`[Network] Message offline ${msg.id} synchronisé ✅`);
          } else {
            console.warn(`[Network] Échec sync message ${msg.id}:`, error.message);
          }
        } catch (msgErr) {
          console.warn(`[Network] Erreur sync message ${msg.id}:`, msgErr);
        }
      }
    } catch (error) {
      console.error('[Network] Sync error:', error);
    }
  };

  return {
    isOnline,
    networkInfo,
    isSlowConnection: networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g',
    isMeteredConnection: networkInfo.saveData
  };
};

export default useNetworkDetector;
