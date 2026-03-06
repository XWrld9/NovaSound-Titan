/**
 * Network Detector - NovaSound TITAN LUX V410000
 * Détection de l'état de connexion réseau
 */

import { useState, useEffect } from 'react';
import { offlineStore } from '@/lib/offlineStore';

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

  // Synchroniser les données hors-ligne
  const syncOfflineData = async () => {
    try {
      // Récupérer les messages en attente
      const pendingMessages = await offlineStore.get('pending_messages') || [];
      
      if (pendingMessages.length > 0) {
        console.info(`[Network] Syncing ${pendingMessages.length} offline messages`);
        // La synchronisation sera gérée par les composants concernés
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
