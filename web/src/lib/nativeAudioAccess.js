/**
 * 🎵 Native Audio Access - NovaSound TITAN LUX
 * 
 * Accès natif aux fichiers audio de l'appareil
 * Support complet : iOS, Android, Desktop
 */

// 📱 Détection de plateforme
export const getPlatform = () => {
  const ua = navigator.userAgent;
  
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh/i.test(ua) && 'ontouchend' in document) return 'ios'; // iPad iOS 13+
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  
  return 'desktop';
};

// 🔍 Vérification des permissions et capacités
export const checkAudioCapabilities = async () => {
  const platform = getPlatform();
  const capabilities = {
    platform,
    canAccessFiles: false,
    canRecord: false,
    canUseMicrophone: false,
    hasFilePicker: false,
    hasFileSystemAccess: false,
    supportedFormats: [],
    maxFileSize: null,
    requiresPermission: false
  };

  // 🖥️ Desktop (Chrome/Edge)
  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    capabilities.hasFilePicker = 'showOpenFilePicker' in window;
    capabilities.hasFileSystemAccess = 'showDirectoryPicker' in window;
    capabilities.canAccessFiles = capabilities.hasFilePicker || 'webkitdirectory' in document.createElement('input');
    capabilities.supportedFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    capabilities.maxFileSize = 500 * 1024 * 1024; // 500MB
  }

  // 📱 iOS
  if (platform === 'ios') {
    capabilities.hasFilePicker = true; // iOS 14+ file picker
    capabilities.canAccessFiles = true;
    capabilities.supportedFormats = ['mp3', 'wav', 'aac', 'm4a', 'flac'];
    capabilities.maxFileSize = 100 * 1024 * 1024; // 100MB
    capabilities.requiresPermission = true; // Photos/Music library access
  }

  // 📱 Android
  if (platform === 'android') {
    capabilities.hasFilePicker = true;
    capabilities.hasFileSystemAccess = true;
    capabilities.canAccessFiles = true;
    capabilities.supportedFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', '3gp'];
    capabilities.maxFileSize = 200 * 1024 * 1024; // 200MB
    capabilities.requiresPermission = true; // Storage permission
  }

  // 🎤 Microphone (toutes plateformes)
  capabilities.canUseMicrophone = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  capabilities.canRecord = capabilities.canUseMicrophone;

  return capabilities;
};

// 📁 Accès aux fichiers audio - Desktop
const getAudioFilesFromDirectory = async (dirHandle, path = '') => {
  const files = [];
  
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      // 🎵 Vérifier si c'est un fichier audio
      const extension = entry.name.split('.').pop()?.toLowerCase();
      const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff'];
      
      if (audioExtensions.includes(extension)) {
        const file = await entry.getFile();
        files.push({
          file,
          path: entryPath,
          name: entry.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        });
      }
    } else if (entry.kind === 'directory') {
      // 📁 Récursion sur sous-dossiers
      const subFiles = await getAudioFilesFromDirectory(entry, entryPath);
      files.push(...subFiles);
    }
  }
  
  return files;
};

// 📱 Accès aux fichiers audio - Mobileexport const getAudioFilesDesktop = async (options = {}) => {
  const {
    multiple = true,
    accept = 'audio/*',
    directory = false
  } = options;

  try {
    let files = [];

    // 🎯 File System Access API (moderne)
    if ('showOpenFilePicker' in window) {
      if (directory) {
        // Accès à un dossier complet
        const dirHandle = await window.showDirectoryPicker({
          mode: 'read'
        });
        
        files = await getAudioFilesFromDirectory(dirHandle);
      } else {
        // Sélection de fichiers multiples
        const fileHandles = await window.showOpenFilePicker({
          multiple,
          types: [{
            description: 'Fichiers audio',
            accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'] }
          }]
        });
        
        files = await Promise.all(
          fileHandles.map(handle => handle.getFile())
        );
      }
    }
    // 🔄 Fallback input file
    else {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        input.accept = accept;
        input.webkitdirectory = directory;
        
        input.onchange = (e) => {
          resolve(Array.from(e.target.files));
        };
        
        input.click();
      });
    }

    return files;
  } catch (error) {
    console.error('[NativeAudioAccess] Desktop access error:', error);
    throw error;
  }
};

// 📁 Récursif - fichiers audio depuis dossierexport const getAudioFilesMobile = async () => {
  const platform = getPlatform();
  
  try {
    // 🍎 iOS - Media Library Framework (via Web App)
    if (platform === 'ios') {
      return await getIOSAudioFiles();
    }
    
    // 🤖 Android - MediaStore API
    if (platform === 'android') {
      return await getAndroidAudioFiles();
    }
    
    throw new Error('Platform not supported');
  } catch (error) {
    console.error('[NativeAudioAccess] Mobile access error:', error);
    throw error;
  }
};

// 🍎 iOS - Accès bibliothèque musicaleconst getIOSAudioFiles = async () => {
  // 🎯 iOS 14+ File Picker avec filtre audio
  if ('showOpenFilePicker' in window) {
    try {
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Musique et fichiers audio',
          accept: { 
            'audio/*': ['.mp3', '.wav', '.aac', '.m4a', '.flac'],
            'com.apple.iTunes.library': ['.itl', '.itlp']
          }
        }]
      });
      
      const files = await Promise.all(
        fileHandles.map(async (handle) => {
          const file = await handle.getFile();
          
          // 🏷️ Extraction métadonnées iOS
          const metadata = await extractAudioMetadata(file);
          
          return {
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            metadata,
            platform: 'ios'
          };
        })
      );
      
      return files;
    } catch (error) {
      // 🔄 Fallback vers input file
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*,.mp3,.wav,.aac,.m4a,.flac';
        
        input.onchange = (e) => {
          const files = Array.from(e.target.files);
          resolve(files.map(file => ({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            platform: 'ios'
          })));
        };
        
        input.click();
      });
    }
  }
  
  throw new Error('iOS File Picker not available');
};

// 🤖 Android - Accès MediaStoreconst getAndroidAudioFiles = async () => {
  // 🎯 Android File Picker avec accès stockage
  if ('showOpenFilePicker' in window) {
    try {
      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Fichiers audio Android',
          accept: { 
            'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.3gp', '.amr'],
            'application/ogg': ['.ogg']
          }
        }]
      });
      
      const files = await Promise.all(
        fileHandles.map(async (handle) => {
          const file = await handle.getFile();
          
          // 🏷️ Extraction métadonnées Android
          const metadata = await extractAudioMetadata(file);
          
          return {
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            metadata,
            platform: 'android'
          };
        })
      );
      
      return files;
    } catch (error) {
      // 🔄 Fallback
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.3gp';
        
        input.onchange = (e) => {
          const files = Array.from(e.target.files);
          resolve(files.map(file => ({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            platform: 'android'
          })));
        };
        
        input.click();
      });
    }
  }
  
  throw new Error('Android File Picker not available');
};

// 🏷️ Extraction métadonnées audio
export const extractAudioMetadata = async (file) => {
  const metadata = {
    title: '',
    artist: '',
    album: '',
    duration: 0,
    bitrate: 0,
    sampleRate: 0,
    format: '',
    size: file.size,
    lastModified: file.lastModified
  };

  try {
    // 🎵 Utiliser Web Audio API pour les métadonnées de base
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    
    // 🎯 Décoder le fichier audio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    metadata.duration = audioBuffer.duration;
    metadata.sampleRate = audioBuffer.sampleRate;
    metadata.format = file.type.split('/')[1] || 'unknown';
    
    // 🏷️ Extraire du nom de fichier si pas de métadonnées ID3
    if (!metadata.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      metadata.title = nameWithoutExt.replace(/[-_]/g, ' ');
    }
    
    // 🎯 Calcul du bitrate approximatif
    if (metadata.duration > 0) {
      metadata.bitrate = Math.round((file.size * 8) / metadata.duration / 1000);
    }
    
    return metadata;
  } catch (error) {
    console.warn('[NativeAudioAccess] Metadata extraction failed:', error);
    
    // 🔄 Fallback basique
    metadata.title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    metadata.format = file.type.split('/')[1] || 'unknown';
    
    return metadata;
  }
};

// 🔍 Scan automatique des fichiers audio
export const scanAudioFiles = async (options = {}) => {
  const {
    autoDetect = true,
    includeFolders = false,
    maxFiles = 10000,
    progressCallback
  } = options;

  const platform = getPlatform();
  const capabilities = await checkAudioCapabilities();
  
  if (!capabilities.canAccessFiles) {
    throw new Error('Audio file access not supported on this platform');
  }

  try {
    let audioFiles = [];
    
    // 🖥️ Desktop
    if (['windows', 'macos', 'linux', 'desktop'].includes(platform)) {
      if (includeFolders && capabilities.hasFileSystemAccess) {
        // 📁 Scanner un dossier complet
        audioFiles = await getAudioFilesDesktop({ directory: true });
      } else {
        // 📁 Sélection manuelle
        audioFiles = await getAudioFilesDesktop({ multiple: true });
      }
    }
    // 📱 Mobile
    else {
      audioFiles = await getAudioFilesMobile();
    }

    // 🔍 Filtrer et enrichir
    const enrichedFiles = [];
    const processed = 0;
    
    for (const audioFile of audioFiles) {
      if (processed >= maxFiles) break;
      
      try {
        // 🏷️ Extraire métadonnées
        const metadata = await extractAudioMetadata(audioFile.file || audioFile);
        
        enrichedFiles.push({
          ...audioFile,
          metadata,
          id: `${audioFile.name}-${audioFile.size}-${audioFile.lastModified}`,
          addedAt: Date.now()
        });
        
        processed++;
        
        // 📊 Progress callback
        if (progressCallback) {
          progressCallback({
            processed,
            total: Math.min(audioFiles.length, maxFiles),
            current: audioFile.name
          });
        }
      } catch (error) {
        console.warn(`[NativeAudioAccess] Failed to process ${audioFile.name}:`, error);
      }
    }

    // 🎵 Trier par métadonnées
    enrichedFiles.sort((a, b) => {
      // Priorité 1: Artist → Album → Track
      if (a.metadata.artist && b.metadata.artist) {
        const artistCompare = a.metadata.artist.localeCompare(b.metadata.artist);
        if (artistCompare !== 0) return artistCompare;
        
        if (a.metadata.album && b.metadata.album) {
          const albumCompare = a.metadata.album.localeCompare(b.metadata.album);
          if (albumCompare !== 0) return albumCompare;
        }
      }
      
      // Priorité 2: Nom de fichier
      return a.name.localeCompare(b.name);
    });

    return enrichedFiles;
  } catch (error) {
    console.error('[NativeAudioAccess] Scan failed:', error);
    throw error;
  }
};

// 🎤 Enregistrement audio (optionnel)
export const startAudioRecording = async () => {
  const capabilities = await checkAudioCapabilities();
  
  if (!capabilities.canRecord) {
    throw new Error('Audio recording not supported');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    const chunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    return {
      mediaRecorder,
      stream,
      start: () => mediaRecorder.start(1000), // 1s chunks
      stop: () => new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
          stream.getTracks().forEach(track => track.stop());
          resolve(blob);
        };
        mediaRecorder.stop();
      }),
      pause: () => mediaRecorder.pause(),
      resume: () => mediaRecorder.resume()
    };
  } catch (error) {
    console.error('[NativeAudioAccess] Recording failed:', error);
    throw error;
  }
};

// 🎨 Interface d'accès unifiée
export const nativeAudioAccess = {
  // 🔍 Capacités
  checkCapabilities: checkAudioCapabilities,
  getPlatform: getPlatform,
  
  // 📁 Accès fichiers
  scanAudioFiles: scanAudioFiles,
  getAudioFilesDesktop: getAudioFilesDesktop,
  getAudioFilesMobile: getAudioFilesMobile,
  
  // 🏷️ Métadonnées
  extractMetadata: extractAudioMetadata,
  
  // 🎤 Enregistrement
  startRecording: startAudioRecording,
  
  // 📊 Statistiques
  getStorageStats: async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota,
        usage: estimate.usage,
        available: estimate.quota - estimate.usage,
        usageDetails: estimate.usageDetails
      };
    }
    return null;
  }
};

export default nativeAudioAccess;
