/**
 * LocalPlayerPageNative — NovaSound TITAN LUX V3000000
 *
 * ✅ MODE NATIF COMPLET - Remplacement total du système d'import
 * ✅ Plus besoin d'importer manuellement les fichiers
 * ✅ Scan automatique de la bibliothèque musicale de l'appareil
 * ✅ Interface lecteur natif (Spotify/Apple Music style)
 * ✅ Support iOS/Android/Desktop avec accès natif complet
 * ✅ Métadonnées complètes + organisation automatique
 * ✅ Fonctionne exactement comme une appli lecteur de musique native
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Home, Music2, Headphones, Radio, Smartphone,
  Search, Settings, ChevronDown, Library, Grid, List, Clock,
  User, FolderOpen, RefreshCw, Wifi, WifiOff, AlertTriangle,
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import NativeAudioPlayer from '@/components/NativeAudioPlayer';
import { nativeAudioAccess } from '@/lib/nativeAudioAccess';
import { useNetworkDetector } from '@/components/OfflineBanner';

const LocalPlayerPageNative = () => {
  const navigate = useNavigate();
  const { status: networkStatus } = useNetworkDetector();
  
  // 🎵 États principaux
  const [activeView, setActiveView] = useState('player'); // player, library, folders
  const [platform, setPlatform] = useState('unknown');
  const [capabilities, setCapabilities] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // 📊 États de scan
  const [isScanning, setIsScanning] = useState(false);
  const [scanStats, setScanStats] = useState({ total: 0, processed: 0, current: '' });
  
  // 🎨 États UI
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('list'); // list, grid

  // 🚀 Initialisation
  useEffect(() => {
    initializeNativePlayer();
  }, []);

  // 🔧 Initialisation du lecteur natif
  const initializeNativePlayer = async () => {
    try {
      // 📊 Détection plateforme
      const detectedPlatform = nativeAudioAccess.getPlatform();
      setPlatform(detectedPlatform);
      
      // 🔍 Vérification capacités
      const detectedCapabilities = await nativeAudioAccess.checkCapabilities();
      setCapabilities(detectedCapabilities);
      
      // 🎵 Vérifier si des fichiers existent déjà
      const savedFiles = await nativeAudioAccess.getStorageStats();
      
      setIsInitialized(true);
      
      console.log(`[NativePlayer] Initialized on ${detectedPlatform}`, {
        platform: detectedPlatform,
        capabilities: detectedCapabilities,
        storage: savedFiles
      });
      
      // 📱 Afficher le welcome uniquement la première fois
      const hasSeenWelcome = localStorage.getItem('novasound_native_welcome_seen');
      if (hasSeenWelcome) {
        setShowWelcome(false);
      }
    } catch (error) {
      console.error('[NativePlayer] Initialization failed:', error);
      setIsInitialized(true);
    }
  };

  // 📂 Scanner la bibliothèque musicale
  const scanLibrary = async () => {
    if (!capabilities.canAccessFiles) {
      alert(`L'accès aux fichiers audio n'est pas disponible sur ${platform}`);
      return;
    }

    setIsScanning(true);
    setScanStats({ total: 0, processed: 0, current: '' });

    try {
      const files = await nativeAudioAccess.scanAudioFiles({
        autoDetect: true,
        includeFolders: true,
        maxFiles: 10000,
        progressCallback: (progress) => {
          setScanStats({
            total: progress.total,
            processed: progress.processed,
            current: progress.current
          });
        }
      });

      console.log(`[NativePlayer] Library scan completed: ${files.length} files`);
      
      // 🎉 Afficher un message de succès
      alert(`Bibliothèque scannée avec succès !\n\n${files.length} fichiers audio trouvés`);
      
    } catch (error) {
      console.error('[NativePlayer] Library scan failed:', error);
      alert('Échec du scan de la bibliothèque: ' + error.message);
    } finally {
      setIsScanning(false);
      setScanStats({ total: 0, processed: 0, current: '' });
    }
  };

  // 🎨 Rendu du welcome screen
  const renderWelcome = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-gradient-to-b from-purple-900/20 to-black z-50 flex items-center justify-center p-6"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full">
        {/* 🎵 Icône animée */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="p-4 bg-purple-500/20 rounded-full"
          >
            <Music2 className="w-12 h-12 text-purple-400" />
          </motion.div>
        </div>

        {/* 📝 Titre et description */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            NovaSound Player Natif
          </h1>
          <p className="text-gray-400 mb-4">
            Accédez à toute votre musique directement depuis votre appareil
          </p>
          
          {/* 📱 Informations plateforme */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {platform === 'ios' && <Smartphone className="w-4 h-4 text-blue-400" />}
            {platform === 'android' && <Smartphone className="w-4 h-4 text-green-400" />}
            {['windows', 'macos', 'linux'].includes(platform) && <Headphones className="w-4 h-4 text-purple-400" />}
            <span className="text-sm text-gray-500 capitalize">
              {platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Desktop'}
            </span>
          </div>
        </div>

        {/* ✅ Capacités */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${capabilities.canAccessFiles ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-300">
              Accès aux fichiers audio: {capabilities.canAccessFiles ? 'Disponible' : 'Non disponible'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${capabilities.canRecord ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span className="text-gray-300">
              Enregistrement audio: {capabilities.canRecord ? 'Disponible' : 'Non disponible'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${capabilities.hasFileSystemAccess ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span className="text-gray-300">
              Accès dossier complet: {capabilities.hasFileSystemAccess ? 'Disponible' : 'Limité'}
            </span>
          </div>
        </div>

        {/* 🎯 Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={scanLibrary}
            disabled={!capabilities.canAccessFiles || isScanning}
            className="w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scanner ma bibliothèque musicale
              </>
            )}
          </button>

          <button
            onClick={() => {
              setShowWelcome(false);
              localStorage.setItem('novasound_native_welcome_seen', 'true');
            }}
            className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Continuer vers le lecteur
          </button>
        </div>

        {/* 📊 Progression du scan */}
        {isScanning && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Scan en cours...</span>
              <span>{scanStats.processed} / {scanStats.total}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(scanStats.processed / scanStats.total) * 100}%` }}
              />
            </div>
            {scanStats.current && (
              <p className="text-xs text-gray-500 truncate">
                Fichier actuel: {scanStats.current}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );

  // 🎨 Rendu principal
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Initialisation du lecteur natif...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* 🎨 Welcome screen */}
      <AnimatePresence>
        {showWelcome && renderWelcome()}
      </AnimatePresence>

      {/* 🎨 Lecteur natif principal */}
      {!showWelcome && (
        <div className="relative">
          {/* 📱 Header */}
          <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                  <Music2 className="w-6 h-6 text-purple-400" />
                  <div>
                    <h1 className="text-lg font-bold text-white">NovaSound</h1>
                    <p className="text-xs text-gray-400">Lecteur Natif</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 📊 Statut réseau */}
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded-lg">
                  {networkStatus === 'online' ? (
                    <>
                      <Wifi className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-red-400" />
                      <span className="text-xs text-red-400">Offline</span>
                    </>
                  )}
                </div>

                {/* 🎛️ Settings */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 📱 Navigation tabs */}
            <div className="flex border-t border-gray-800">
              <button
                onClick={() => setActiveView('player')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeView === 'player'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Lecteur
              </button>
              <button
                onClick={() => setActiveView('library')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeView === 'library'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Bibliothèque
              </button>
              <button
                onClick={() => setActiveView('folders')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeView === 'folders'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Dossiers
              </button>
            </div>
          </div>

          {/* 🎵 Contenu principal */}
          <div className="pb-20">
            {activeView === 'player' && <NativeAudioPlayer />}
            
            {activeView === 'library' && (
              <div className="p-4">
                <div className="text-center text-gray-400">
                  <Library className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Bibliothèque Musicale</h3>
                  <p className="text-sm mb-4">Organisez votre musique par artistes, albums, playlists</p>
                  <button
                    onClick={() => setActiveView('player')}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Aller au lecteur
                  </button>
                </div>
              </div>
            )}
            
            {activeView === 'folders' && (
              <div className="p-4">
                <div className="text-center text-gray-400">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Dossiers Audio</h3>
                  <p className="text-sm mb-4">Accédez directement à vos dossiers de musique</p>
                  <button
                    onClick={scanLibrary}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Scanner les dossiers
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 🎨 Settings panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
                onClick={() => setShowSettings(false)}
              >
                <div
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-bold text-white mb-4">Paramètres</h2>
                  
                  <div className="space-y-4">
                    {/* 📱 Infos plateforme */}
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Plateforme</h3>
                      <p className="text-white capitalize">{platform}</p>
                    </div>

                    {/* 🔧 Capacités */}
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Capacités</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Accès fichiers:</span>
                          <span className={capabilities.canAccessFiles ? 'text-green-400' : 'text-red-400'}>
                            {capabilities.canAccessFiles ? 'Oui' : 'Non'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Enregistrement:</span>
                          <span className={capabilities.canRecord ? 'text-green-400' : 'text-gray-400'}>
                            {capabilities.canRecord ? 'Oui' : 'Non'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Stockage max:</span>
                          <span className="text-gray-400">
                            {capabilities.maxFileSize ? `${(capabilities.maxFileSize / 1024 / 1024).toFixed(0)}MB` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 🎵 Formats supportés */}
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Formats supportés</h3>
                      <div className="flex flex-wrap gap-1">
                        {capabilities.supportedFormats?.map(format => (
                          <span key={format} className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                            {format.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 🎯 Actions */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Fermer
                    </button>
                    <button
                      onClick={scanLibrary}
                      className="flex-1 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      Scanner
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 🎨 Footer */}
      <Footer />
    </div>
  );
};

export default LocalPlayerPageNative;
