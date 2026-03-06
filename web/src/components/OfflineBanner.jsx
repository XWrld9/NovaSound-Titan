/**
 * Offline Banner - NovaSound TITAN LUX V410000
 * Bannière d'alerte hors-ligne
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkDetector } from '@/lib/networkDetector';

const OfflineBanner = () => {
  const { isOnline, isSlowConnection } = useNetworkDetector();
  
  // Ne pas afficher si on est en ligne avec une bonne connexion
  if (isOnline && !isSlowConnection) {
    return null;
  }
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${
      isOnline 
        ? 'bg-yellow-500/90 border-yellow-600' 
        : 'bg-red-500/90 border-red-600'
    } border-b backdrop-blur-sm`}>
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-white" />
          ) : (
            <WifiOff className="w-4 h-4 text-white" />
          )}
          <span className="text-white text-sm font-medium">
            {isOnline 
              ? 'Connexion lente détectée' 
              : 'Vous êtes hors-ligne'
            }
          </span>
        </div>
        
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3 h-3 text-white" />
          <span className="text-white text-xs">Actualiser</span>
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
