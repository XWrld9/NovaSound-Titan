/**
 * 🎵 Native Audio Access - NovaSound TITAN LUX v1000000
 * 
 * Accès natif aux fichiers audio pour iOS, Android et Desktop
 * Scan automatique, métadonnées, et lecture multi-plateformes
 */

// ── DÉTECTION DE PLATEFORME ───────────────────────────────────────────
export const getPlatform = () => {
  if (typeof window === 'undefined') return 'server';
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  return 'desktop';
};

// ── ACCÈS DESKTOP ───────────────────────────────────────────────
export const getDesktopAudioFiles = async () => {
  try {
    if (!window.showDirectoryPicker) {
      throw new Error('Directory picker not available');
    }

    const dirHandle = await window.showDirectoryPicker({
      mode: 'read',
      title: 'Sélectionner votre dossier de musique'
    });

    if (!dirHandle) {
      throw new Error('No directory selected');
    }

    const files = [];
    for await (const [key, value] of dirHandle.entries()) {
      if (value.kind === 'file' && isAudioFile(value.name)) {
        const file = await value.getFile();
        const arrayBuffer = await file.arrayBuffer();
        files.push({
          name: value.name,
          size: arrayBuffer.byteLength,
          arrayBuffer: arrayBuffer,
          lastModified: file.lastModified,
          file: file
        });
      }
    }

    return files;
  } catch (error) {
    console.error('[NativeAudioAccess] Desktop access error:', error);
    throw error;
  }
};

// ── ACCÈS iOS ───────────────────────────────────────────────────────
export const getIOSAudioFiles = async () => {
  try {
    if (!window.showOpenFilePicker) {
      throw new Error('File picker not available');
    }

    const fileHandles = await window.showOpenFilePicker({
      multiple: true,
      types: [{
        description: 'Musique et fichiers audio',
        accept: {
          'audio/*': ['.mp3', '.wav', '.aac', '.m4a', '.flac']
        }
      }]
    });

    const files = [];
    for (const fileHandle of fileHandles) {
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      
      // 🎯 Extraire les métadonnées avec Web Audio API
      const metadata = await extractAudioMetadata(arrayBuffer, file.name);
      
      files.push({
        name: file.name,
        size: arrayBuffer.byteLength,
        arrayBuffer: arrayBuffer,
        lastModified: file.lastModified,
        file: file,
        metadata: metadata
      });
    }

    return files;
  } catch (error) {
    console.error('[NativeAudioAccess] iOS access error:', error);
    throw error;
  }
};

// ── ACCÈS ANDROID ───────────────────────────────────────────────────────
export const getAndroidAudioFiles = async () => {
  try {
    if (!('mediaStore' in navigator)) {
      throw new Error('MediaStore API not available');
    }

    // 🤖 Demander l'accès à la bibliothèque musicale
    const mediaAccess = await navigator.mediaStore.requestAccess();
    
    if (!mediaAccess) {
      throw new Error('Media access denied');
    }

    // 🎵 Scanner les fichiers audio
    const audioFiles = [];
    for await (const mediaItem of mediaAccess.getDirectory()) {
      if (mediaItem.kind === 'file' && isAudioFile(mediaItem.name)) {
        const fileHandle = await mediaItem.getFileHandle();
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        
        // 🎯 Extraire les métadonnées
        const metadata = await extractAudioMetadata(arrayBuffer, file.name);
        
        audioFiles.push({
          name: file.name,
          size: arrayBuffer.byteLength,
          arrayBuffer: arrayBuffer,
          lastModified: file.lastModified,
          file: file,
          metadata: metadata
        });
      }
    }

    return audioFiles;
  } catch (error) {
    console.error('[NativeAudioAccess] Android access error:', error);
    throw error;
  }
};

// ── UTILITAIRES ───────────────────────────────────────────────────────
export const isAudioFile = (filename) => {
  const audioExtensions = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.wma'];
  const ext = filename.split('.').pop().toLowerCase();
  return audioExtensions.includes(ext);
};

// 🎯 Extraction des métadonnées audio avec Web Audio API
export const extractAudioMetadata = async (arrayBuffer, filename) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    if (!audioBuffer) {
      return {
        title: filename.replace(/\.[^/.]+$/, ''),
        artist: '',
        album: '',
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        format: '',
        size: arrayBuffer.byteLength,
        lastModified: Date.now()
      };
    }

    const audioBufferSource = audioContext.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    
    // 🎵 Essayer de lire les métadonnées depuis le buffer audio
    const metadata = {
      title: filename.replace(/\.[^/.]+$/, ''),
      artist: '',
      album: '',
      duration: audioBuffer.duration || 0,
      bitrate: 0,
      sampleRate: audioBuffer.sampleRate || 0,
      format: '',
      size: arrayBuffer.byteLength,
      lastModified: Date.now()
    };

    audioBufferSource.disconnect();
    audioContext.close();
    
    return metadata;
  } catch (error) {
    console.warn('[NativeAudioAccess] Metadata extraction error:', error);
    return {
      title: filename.replace(/\.[^/.]+$/, ''),
      artist: '',
      album: '',
      duration: 0,
      bitrate: 0,
      sampleRate: 0,
      format: '',
      size: arrayBuffer.byteLength,
      lastModified: Date.now()
    };
  }
};

// ── FONCTION PRINCIPALE ───────────────────────────────────────────────────────
export const getAudioFiles = async () => {
  const platform = getPlatform();
  
  try {
    switch (platform) {
      case 'desktop':
        return await getDesktopAudioFiles();
      case 'ios':
        return await getIOSAudioFiles();
      case 'android':
        return await getAndroidAudioFiles();
      default:
        throw new Error('Platform not supported');
    }
  } catch (error) {
    console.error('[NativeAudioAccess] Error accessing audio files:', error);
    throw error;
  }
};

export default {
  getPlatform,
  getDesktopAudioFiles,
  getIOSAudioFiles,
  getAndroidAudioFiles,
  isAudioFile,
  extractAudioMetadata,
  getAudioFiles
};
