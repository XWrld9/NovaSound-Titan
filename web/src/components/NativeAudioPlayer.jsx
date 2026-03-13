/**
 * 🎵 Native Audio Player - NovaSound TITAN LUX
 * 
 * Lecteur audio natif avec accès complet aux fichiers de l'appareil
 * Exactement comme une appli lecteur de musique native
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Heart, MoreHorizontal, Search,
  FolderOpen, Music, Clock, Disc, User, List, Grid,
  Smartphone, Headphones, Radio, Mic, Settings, ChevronDown,
  ChevronRight, Home, Library, PlayCircle, Plus, X
} from 'lucide-react';
import { nativeAudioAccess } from '@/lib/nativeAudioAccess';
import { offlineStore } from '@/lib/offlineStore';

const NativeAudioPlayer = () => {
  // 🎵 États principaux
  const [audioFiles, setAudioFiles] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // off, one, all
  
  // 🎨 États UI
  const [view, setView] = useState('library'); // library, player, folders
  const [sortBy, setSortBy] = useState('name'); // name, artist, album, date, duration
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  
  // 📊 États de chargement
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ processed: 0, total: 0 });
  const [platform, setPlatform] = useState('unknown');
  const [capabilities, setCapabilities] = useState({});
  
  // 🎛️ Références
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const fileInputRef = useRef(null);

  // 🎵 Audio context
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(128));

  // 🚀 Initialisation
  useEffect(() => {
    initializeAudioSystem();
    loadSavedAudioFiles();
  }, []);

  // 🔧 Initialisation système audio
  const initializeAudioSystem = async () => {
    try {
      // 📊 Détection plateforme
      const detectedPlatform = nativeAudioAccess.getPlatform();
      setPlatform(detectedPlatform);
      
      // 🔍 Vérification capacités
      const detectedCapabilities = await nativeAudioAccess.checkCapabilities();
      setCapabilities(detectedCapabilities);
      
      // 🎵 Audio Context pour visualisation
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      
      setAudioContext(ctx);
      setAnalyser(analyserNode);
      
      // 🎤 Connecter l'élément audio à l'analyseur
      if (audioRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyserNode);
        analyserNode.connect(ctx.destination);
      }
      
      console.info(`[NativeAudioPlayer] Initialized on ${detectedPlatform}`, detectedCapabilities);
    } catch (error) {
      console.error('[NativeAudioPlayer] Initialization failed:', error);
    }
  };

  // 📂 Charger les fichiers sauvegardés
  const loadSavedAudioFiles = async () => {
    try {
      const savedFiles = await offlineStore.get('nativeAudioFiles');
      if (savedFiles && savedFiles.length > 0) {
        setAudioFiles(savedFiles);
        console.info(`[NativeAudioPlayer] Loaded ${savedFiles.length} saved files`);
      }
    } catch (error) {
      console.error('[NativeAudioPlayer] Failed to load saved files:', error);
    }
  };

  // 📂 Scanner les fichiers audio
  const scanAudioFiles = async () => {
    if (!capabilities.canAccessFiles) {
      alert(`Accès aux fichiers audio non disponible sur ${platform}`);
      return;
    }

    setIsScanning(true);
    setScanProgress({ processed: 0, total: 0 });

    try {
      const files = await nativeAudioAccess.scanAudioFiles({
        autoDetect: true,
        includeFolders: view === 'folders',
        maxFiles: 10000,
        progressCallback: (progress) => {
          setScanProgress(progress);
        }
      });

      // 🎵 Enrichir les fichiers avec des métadonnées supplémentaires
      const enrichedFiles = files.map((file, index) => ({
        ...file,
        id: file.id || `file-${index}`,
        trackNumber: index + 1,
        isFavorite: false,
        playCount: 0,
        lastPlayed: null,
        addedAt: Date.now()
      }));

      setAudioFiles(enrichedFiles);
      
      // 💾 Sauvegarder pour la prochaine session
      await offlineStore.save('nativeAudioFiles', enrichedFiles);
      
      console.info(`[NativeAudioPlayer] Scanned ${enrichedFiles.length} audio files`);
    } catch (error) {
      console.error('[NativeAudioPlayer] Scan failed:', error);
      alert('Échec du scan des fichiers audio: ' + error.message);
    } finally {
      setIsScanning(false);
      setScanProgress({ processed: 0, total: 0 });
    }
  };

  // 🎵 Jouer une piste
  const playTrack = useCallback(async (track) => {
    if (!track || !track.file) return;

    try {
      // 🔄 Arrêter la piste actuelle
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }

      // 🎵 Créer l'URL du fichier
      const fileUrl = URL.createObjectURL(track.file);
      
      // 🎯 Charger la nouvelle piste
      if (audioRef.current) {
        audioRef.current.src = fileUrl;
        audioRef.current.load();
        
        // 🎵 Jouer
        await audioRef.current.play();
        
        // 📊 Mettre à jour les états
        setCurrentTrack(track);
        setIsPlaying(true);
        setShowFullPlayer(true);
        
        // 📈 Mettre à jour les statistiques
        const updatedFiles = audioFiles.map(f => 
          f.id === track.id 
            ? { ...f, playCount: (f.playCount || 0) + 1, lastPlayed: Date.now() }
            : f
        );
        setAudioFiles(updatedFiles);
        
        // 💾 Sauvegarder les stats
        await offlineStore.save('nativeAudioFiles', updatedFiles);
        
        console.info(`[NativeAudioPlayer] Playing: ${track.metadata.title || track.name}`);
      }
    } catch (error) {
      console.error('[NativeAudioPlayer] Play failed:', error);
      alert('Erreur lors de la lecture: ' + error.message);
    }
  }, [audioFiles]);

  // 🎛️ Contrôles de lecture
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const playNext = useCallback(() => {
    if (!currentTrack || audioFiles.length === 0) return;
    
    const currentIndex = audioFiles.findIndex(f => f.id === currentTrack.id);
    let nextIndex;
    
    if (isShuffled) {
      // 🎲 Aléatoire
      nextIndex = Math.floor(Math.random() * audioFiles.length);
    } else {
      // ⏭️ Suivant
      nextIndex = (currentIndex + 1) % audioFiles.length;
    }
    
    playTrack(audioFiles[nextIndex]);
  }, [currentTrack, audioFiles, isShuffled, playTrack]);

  const playPrevious = useCallback(() => {
    if (!currentTrack || audioFiles.length === 0) return;
    
    const currentIndex = audioFiles.findIndex(f => f.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? audioFiles.length - 1 : currentIndex - 1;
    
    playTrack(audioFiles[prevIndex]);
  }, [currentTrack, audioFiles, playTrack]);

  // 🎨 Gestion du volume
  const handleVolumeChange = useCallback((e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // 🎛️ Gestion de la progression
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, []);

  // 🎵 Gestion de la fin de piste
  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one') {
      // 🔂 Répéter la même piste
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (repeatMode === 'all' || audioFiles.length > 1) {
      // 🔁 Jouer la piste suivante
      playNext();
    } else {
      // ⏹️ Arrêter
      setIsPlaying(false);
    }
  }, [repeatMode, audioFiles, playNext]);

  // 🎨 Visualisation audio
  const updateVisualization = useCallback(() => {
    if (analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      setFrequencyData(dataArray);
    }
    requestAnimationFrame(updateVisualization);
  }, [analyser]);

  useEffect(() => {
    if (analyser) {
      updateVisualization();
    }
  }, [analyser, updateVisualization]);

  // 🎨 Formatage du temps
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🔍 Filtrage et tri
  const filteredFiles = audioFiles.filter(file => {
    const query = searchQuery.toLowerCase();
    const title = (file.metadata.title || file.name).toLowerCase();
    const artist = (file.metadata.artist || '').toLowerCase();
    const album = (file.metadata.album || '').toLowerCase();
    
    return title.includes(query) || artist.includes(query) || album.includes(query);
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
      case 'artist':
        return (a.metadata.artist || '').localeCompare(b.metadata.artist || '');
      case 'album':
        return (a.metadata.album || '').localeCompare(b.metadata.album || '');
      case 'date':
        return (b.lastModified || 0) - (a.lastModified || 0);
      case 'duration':
        return (a.metadata.duration || 0) - (b.metadata.duration || 0);
      default:
        return 0;
    }
  });

  // 🎨 Rendu principal
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black text-white">
      {/* 🎨 Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold">NovaSound Player</h1>
            <p className="text-xs text-gray-400">
              {audioFiles.length} fichiers • {platform}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('library')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'library' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Library className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setView('folders')}
            className={`p-2 rounded-lg transition-colors ${
              view === 'folders' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          
          <button
            onClick={scanAudioFiles}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scan...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Scanner
              </>
            )}
          </button>
        </div>
      </div>

      {/* 📊 Progression du scan */}
      {isScanning && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Scan des fichiers audio...</span>
            <span className="text-sm text-purple-400">
              {scanProgress.processed} / {scanProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(scanProgress.processed / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 🔍 Barre de recherche */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par titre, artiste, album..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
        </div>
        
        {/* 🎨 Options de tri */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-gray-400">Trier par:</span>
          {['name', 'artist', 'album', 'date', 'duration'].map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortBy === option 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {option === 'name' ? 'Titre' : 
               option === 'artist' ? 'Artiste' :
               option === 'album' ? 'Album' :
               option === 'date' ? 'Date' : 'Durée'}
            </button>
          ))}
        </div>
      </div>

      {/* 📱 Liste des fichiers */}
      <div className="flex-1 overflow-y-auto">
        {sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Music className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Aucun fichier audio</h3>
            <p className="text-sm mb-4">Scannez vos fichiers audio pour commencer</p>
            <button
              onClick={scanAudioFiles}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Search className="w-4 h-4" />
              Scanner les fichiers
            </button>
          </div>
        ) : (
          <div className="p-2">
            {sortedFiles.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-800 ${
                  currentTrack?.id === file.id ? 'bg-purple-500/20 border border-purple-500/30' : ''
                }`}
                onClick={() => playTrack(file)}
              >
                {/* 🎨 Visualisation miniature */}
                <div className="relative w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                  {currentTrack?.id === file.id && isPlaying ? (
                    <div className="flex items-center gap-1">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-purple-400 rounded-full"
                          animate={{ height: [4, 12, 4] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.1
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <PlayCircle className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                {/* 📄 Informations */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">
                    {file.metadata.title || file.name}
                  </h4>
                  <p className="text-sm text-gray-400 truncate">
                    {file.metadata.artist || 'Artiste inconnu'}
                    {file.metadata.album && ` • ${file.metadata.album}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {file.metadata.format?.toUpperCase() || 'AUDIO'}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">
                      {formatTime(file.metadata.duration || 0)}
                    </span>
                    {file.playCount > 0 && (
                      <>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">
                          {file.playCount} lectures
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 🎛️ Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle favorite
                    }}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // More options
                    }}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 🎵 Lecteur audio caché */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* 🎨 Mini-lecteur (bas de page) */}
      {currentTrack && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="border-t border-gray-800 p-4 bg-gray-900/95 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            {/* 📄 Infos piste */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white truncate">
                {currentTrack.metadata.title || currentTrack.name}
              </h4>
              <p className="text-sm text-gray-400 truncate">
                {currentTrack.metadata.artist || 'Artiste inconnu'}
              </p>
            </div>

            {/* 🎛️ Contrôles */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              <button
                onClick={playPrevious}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              
              <button
                onClick={playNext}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setRepeatMode(prev => 
                  prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
                )}
                className={`p-2 transition-colors ${
                  repeatMode === 'off' ? 'text-gray-400 hover:text-white' : 'text-purple-400'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setIsShuffled(!isShuffled)}
                className={`p-2 transition-colors ${
                  isShuffled ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 🎛️ Barre de progression */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {formatTime(currentTime)}
              </span>
              
              <input
                ref={progressBarRef}
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              
              <span className="text-xs text-gray-400">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* 🎨 Volume */}
          <div className="mt-2 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </motion.div>
      )}

      {/* 🎨 Plein écran (optionnel) */}
      <AnimatePresence>
        {showFullPlayer && currentTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-b from-purple-900/20 to-black z-50 flex items-center justify-center"
            onClick={() => setShowFullPlayer(false)}
          >
            <div
              className="w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 🎨 Illustration album */}
              <div className="w-48 h-48 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Music className="w-16 h-16 text-white" />
              </div>

              {/* 📄 Infos complètes */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {currentTrack.metadata.title || currentTrack.name}
                </h2>
                <p className="text-gray-300">
                  {currentTrack.metadata.artist || 'Artiste inconnu'}
                </p>
                {currentTrack.metadata.album && (
                  <p className="text-gray-400 text-sm">
                    {currentTrack.metadata.album}
                  </p>
                )}
              </div>

              {/* 🎛️ Contrôles plein écran */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={playPrevious} className="p-3 text-gray-400 hover:text-white">
                  <SkipBack className="w-6 h-6" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="p-4 bg-purple-500 text-white rounded-full hover:bg-purple-600"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                </button>
                <button onClick={playNext} className="p-3 text-gray-400 hover:text-white">
                  <SkipForward className="w-6 h-6" />
                </button>
              </div>

              {/* 🎛️ Progression plein écran */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* 🎨 Visualisation */}
              <div className="mt-6 h-16 flex items-center justify-center gap-1">
                {Array.from(frequencyData).slice(0, 32).map((value, index) => (
                  <motion.div
                    key={index}
                    className="w-1 bg-purple-400 rounded-full"
                    animate={{ height: `${(value / 255) * 64}px` }}
                    transition={{ duration: 0.1 }}
                  />
                ))}
              </div>

              {/* 🎛️ Actions */}
              <div className="flex items-center justify-center gap-6 mt-6">
                <button className="p-2 text-gray-400 hover:text-white">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white">
                  <Shuffle className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white">
                  <Repeat className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white">
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NativeAudioPlayer;
