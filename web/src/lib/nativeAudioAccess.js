/**
 * nativeAudioAccess — NovaSound TITAN LUX
 *
 * Accès AUTOMATIQUE aux fichiers audio du mobile.
 * Pas d'import manuel. Comportement lecteur natif.
 *
 * Stratégie par plateforme :
 * ─ Android/Desktop (Chrome ≥ 86) :
 *     1. showDirectoryPicker() → handle stocké dans IndexedDB
 *     2. Visites suivantes → queryPermission() → si granted → scan auto sans aucun clic
 *     3. Si permission révoquée → 1 clic pour re-autoriser
 *
 * ─ iOS / Safari (pas de File System Access API) :
 *     1. <input type="file" multiple accept="audio/*"> → user sélectionne ses fichiers UNE FOIS
 *     2. Blobs stockés dans IndexedDB → persistent entre sessions
 *     3. Reload = 0 action requise, les fichiers sont déjà là
 */

import { handles, tracks, blobs } from './localMusicDB.js';

// ── Constantes ──────────────────────────────────────────────────────────────
const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus',
  'wma', 'aiff', 'aif', '3gp', 'amr'
]);

const HANDLE_KEY = 'music-dir-handle';

// ── Détection plateforme ────────────────────────────────────────────────────
export const getPlatform = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua))                           return 'ios';
  if (/Android/i.test(ua))                                    return 'android';
  if (/Macintosh/i.test(ua) && 'ontouchend' in document)     return 'ios';
  if (/Windows/i.test(ua))                                    return 'windows';
  if (/Macintosh/i.test(ua))                                  return 'macos';
  if (/Linux/i.test(ua))                                      return 'linux';
  return 'desktop';
};

export const isIOS = () => getPlatform() === 'ios';
export const hasFSA = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ── ID3v2 parser léger ──────────────────────────────────────────────────────
function parseID3v2(buffer) {
  const view  = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const meta  = { title: '', artist: '', album: '', year: '', artwork: null };

  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return meta;

  const version = bytes[3];
  const tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  let offset = 10;

  if (bytes[5] & 0x40 && version >= 3) {
    const extSize = view.getUint32(offset);
    offset += extSize + 4;
  }

  const end = Math.min(offset + tagSize, buffer.byteLength);
  const iso  = new TextDecoder('iso-8859-1', { fatal: false });
  const utf8 = new TextDecoder('utf-8',      { fatal: false });

  const readText = (start, size) => {
    if (size <= 1) return '';
    const enc = bytes[start];
    const raw = new Uint8Array(buffer, start + 1, size - 1);
    if (enc === 0) return iso.decode(raw).replace(/\0/g, '').trim();
    if (enc === 1 || enc === 2) return new TextDecoder('utf-16', { fatal: false }).decode(raw).replace(/\0/g, '').trim();
    return utf8.decode(raw).replace(/\0/g, '').trim();
  };

  while (offset < end - 10) {
    let frameId, frameSize;

    if (version === 2) {
      frameId   = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2]);
      frameSize = (bytes[offset+3] << 16) | (bytes[offset+4] << 8) | bytes[offset+5];
      offset   += 6;
    } else {
      frameId   = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
      frameSize = version === 4
        ? (bytes[offset+4] << 21) | (bytes[offset+5] << 14) | (bytes[offset+6] << 7) | bytes[offset+7]
        : view.getUint32(offset + 4);
      offset += 10;
    }

    if (frameSize <= 0 || frameId === '\0\0\0\0') break;
    if (offset + frameSize > end) break;

    switch (frameId) {
      case 'TIT2': case 'TT2':  meta.title  = readText(offset, frameSize); break;
      case 'TPE1': case 'TP1':  meta.artist = readText(offset, frameSize); break;
      case 'TALB': case 'TAL':  meta.album  = readText(offset, frameSize); break;
      case 'TYER': case 'TYE':
      case 'TDRC':               meta.year   = readText(offset, frameSize).slice(0, 4); break;
      case 'APIC': case 'PIC': {
        try {
          let pos = offset;
          const enc = bytes[pos++];
          let mimeStr = '';
          if (frameId === 'APIC') {
            while (pos < offset + frameSize && bytes[pos] !== 0) mimeStr += String.fromCharCode(bytes[pos++]);
            pos++;
          } else {
            mimeStr = String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2]);
            pos += 3;
          }
          pos++; // pic type
          // skip description
          while (pos < offset + frameSize && bytes[pos] !== 0) pos++;
          if (enc === 1 || enc === 2) pos++;
          pos++;
          const imgData = new Uint8Array(buffer, pos, offset + frameSize - pos);
          const mime    = mimeStr.includes('png') ? 'image/png' : 'image/jpeg';
          meta.artwork  = URL.createObjectURL(new Blob([imgData], { type: mime }));
        } catch (_) {}
        break;
      }
    }

    offset += frameSize;
  }

  return meta;
}

// ── Extraction métadonnées ──────────────────────────────────────────────────
export const extractMetadata = async (file) => {
  const base = {
    title:   file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    artist:  '',
    album:   '',
    year:    '',
    artwork: null,
    duration: 0,
    format:  file.name.split('.').pop().toLowerCase(),
    size:    file.size
  };

  try {
    const chunk  = file.slice(0, 262144); // 256 KB
    const buffer = await chunk.arrayBuffer();
    const id3    = parseID3v2(buffer);
    if (id3.title)   base.title   = id3.title;
    if (id3.artist)  base.artist  = id3.artist;
    if (id3.album)   base.album   = id3.album;
    if (id3.year)    base.year    = id3.year;
    if (id3.artwork) base.artwork = id3.artwork;
  } catch (_) {}

  return base;
};

// ── Scanner un dossier récursivement ───────────────────────────────────────
async function scanDirectoryHandle(dirHandle, path, onProgress) {
  const found = [];

  for await (const [name, entry] of dirHandle.entries()) {
    const fullPath = path ? `${path}/${name}` : name;

    if (entry.kind === 'directory') {
      if (name.startsWith('.')) continue;
      const sub = await scanDirectoryHandle(entry, fullPath, onProgress);
      found.push(...sub);
    } else if (entry.kind === 'file') {
      const ext = name.split('.').pop().toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) continue;

      try {
        const file     = await entry.getFile();
        const metadata = await extractMetadata(file);
        const id       = `fsa-${fullPath}-${file.size}`;

        found.push({
          id,
          path:     fullPath,
          name:     file.name,
          size:     file.size,
          type:     file.type || `audio/${metadata.format}`,
          lastModified: file.lastModified,
          folder:   path || '/',
          fileHandle: entry,
          ...metadata,
          isFavorite: false,
          playCount:  0,
          lastPlayed: null,
          addedAt:    Date.now()
        });

        onProgress?.(found.length);
      } catch (_) {}
    }
  }

  return found;
}

// ── API publique ────────────────────────────────────────────────────────────

/**
 * Scan auto au démarrage (Android/Desktop).
 * Retourne les pistes ou null si handle absent/révoqué.
 */
export const tryAutoScan = async (onProgress) => {
  if (!hasFSA()) return null;

  try {
    const handle = await handles.get(HANDLE_KEY);
    if (!handle) return null;

    let perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      perm = await handle.requestPermission({ mode: 'read' });
    }
    if (perm !== 'granted') return null;

    const found = await scanDirectoryHandle(handle, '', onProgress);
    if (found.length > 0) await tracks.saveAll(found);
    return found;
  } catch (err) {
    console.warn('[nativeAudioAccess] Auto-scan:', err.message);
    return null;
  }
};

/**
 * Setup initial : l'utilisateur choisit son dossier UNE SEULE FOIS.
 */
export const setupMusicFolder = async (onProgress) => {
  if (!hasFSA()) throw new Error('Non supporté sur cette plateforme');
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  await handles.save(HANDLE_KEY, handle);
  const found = await scanDirectoryHandle(handle, '', onProgress);
  if (found.length > 0) await tracks.saveAll(found);
  return found;
};

/**
 * iOS : sélection fichiers → blobs IndexedDB.
 */
export const selectFilesIOS = () => new Promise((resolve, reject) => {
  const input = document.createElement('input');
  input.type     = 'file';
  input.multiple = true;
  input.accept   = 'audio/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.opus,.wma,.aiff';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = async () => {
    document.body.removeChild(input);
    const files = Array.from(input.files || []);
    if (!files.length) { resolve([]); return; }

    const result = [];
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) continue;
      try {
        const metadata = await extractMetadata(file);
        const id       = `ios-${file.name}-${file.size}-${file.lastModified}`;
        await blobs.save(id, file);
        result.push({
          id, name: file.name, size: file.size,
          type: file.type || `audio/${metadata.format}`,
          lastModified: file.lastModified,
          folder: 'Fichiers sélectionnés',
          ...metadata,
          isFavorite: false, playCount: 0, lastPlayed: null, addedAt: Date.now()
        });
      } catch (_) {}
    }
    await tracks.saveAll(result);
    resolve(result);
  };

  input.onerror = (e) => { document.body.removeChild(input); reject(e); };
  input.click();
});

/** Charger les pistes sauvegardées (IndexedDB). */
export const loadSavedTracks = () => tracks.getAll();

/**
 * Obtenir une URL de lecture pour une piste.
 * Priority: fileHandle (Android) → blob (iOS) → error
 */
export const getPlaybackUrl = async (track) => {
  if (track.fileHandle) {
    try {
      const file = await track.fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (_) {}
  }
  const blob = await blobs.get(track.id);
  if (blob) return URL.createObjectURL(blob);
  throw new Error(`Fichier introuvable : ${track.name}`);
};

/** Re-scanner le dossier existant. */
export const rescan = async (onProgress) => {
  if (!hasFSA()) return null;
  await tracks.clear();
  return tryAutoScan(onProgress);
};

/** Vérifier si une bibliothèque existe déjà. */
export const hasSavedLibrary = async () => {
  if (isIOS()) {
    const saved = await tracks.getAll().catch(() => []);
    return saved.length > 0;
  }
  const handle = await handles.get(HANDLE_KEY).catch(() => null);
  return !!handle;
};

export const nativeAudioAccess = {
  getPlatform, isIOS, hasFSA,
  tryAutoScan, setupMusicFolder, selectFilesIOS,
  loadSavedTracks, getPlaybackUrl, rescan, hasSavedLibrary, extractMetadata,
  checkCapabilities: async () => ({
    platform: getPlatform(), canAccessFiles: true,
    hasFSA: hasFSA(), isIOS: isIOS(),
    supportedFormats: [...AUDIO_EXTENSIONS]
  })
};

export default nativeAudioAccess;
