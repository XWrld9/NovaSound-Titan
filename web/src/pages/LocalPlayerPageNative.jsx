/**
 * LocalPlayerPageNative — NovaSound TITAN LUX
 *
 * Page wrapper du lecteur de musique local.
 * Remplace l'ancien système d'import manuel.
 *
 * Comportement :
 * ─ Android/Desktop : scan automatique au démarrage (dossier mémorisé)
 * ─ iOS             : sélection fichiers une seule fois, blobs mémorisés
 * ─ Aucun écran d'import, aucun "Welcome screen"
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { useNetworkDetector } from '@/components/OfflineBanner';
import NativeAudioPlayer from '@/components/NativeAudioPlayer';

const LocalPlayerPageNative = () => {
  const navigate     = useNavigate();
  const { isOnline } = useNetworkDetector();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header minimaliste */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-gray-950/95 backdrop-blur-xl border-b border-white/[0.06]">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-white font-bold text-sm">Lecteur local</h1>

        {/* Indicateur réseau */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isOnline
            ? 'bg-green-500/10 text-green-400'
            : 'bg-orange-500/10 text-orange-400'
        }`}>
          {isOnline
            ? <><Wifi className="w-3 h-3" />En ligne</>
            : <><WifiOff className="w-3 h-3" />Hors ligne</>
          }
        </div>
      </div>

      {/* Lecteur */}
      <div className="flex-1">
        <NativeAudioPlayer />
      </div>
    </div>
  );
};

export default LocalPlayerPageNative;
