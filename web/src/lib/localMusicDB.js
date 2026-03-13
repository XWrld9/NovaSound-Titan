/**
 * localMusicDB — NovaSound TITAN LUX
 *
 * Base de données IndexedDB pour la bibliothèque musicale locale.
 * Stocke : handles de dossiers, métadonnées, blobs (iOS), playlists, favoris.
 *
 * Pourquoi IndexedDB et pas localStorage ?
 * → Capacité illimitée (vs ~5MB localStorage)
 * → Stockage binaire (blobs audio pour iOS)
 * → Stockage des FileSystemDirectoryHandle (Android auto-scan)
 */

const DB_NAME    = 'novasound_music_db';
const DB_VERSION = 2;

// ── Ouverture / migration ───────────────────────────────────────────────────
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Handles de dossiers (Android auto-rescan)
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'id' });
      }

      // Métadonnées des pistes (titre, artiste, album, durée, artwork…)
      if (!db.objectStoreNames.contains('tracks')) {
        const ts = db.createObjectStore('tracks', { keyPath: 'id' });
        ts.createIndex('artist', 'artist', { unique: false });
        ts.createIndex('album',  'album',  { unique: false });
        ts.createIndex('folder', 'folder', { unique: false });
      }

      // Blobs audio — uniquement sur iOS où on ne peut pas re-lire les handles
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' });
      }

      // Playlists
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
      }

      // Settings & misc
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Helper tx ───────────────────────────────────────────────────────────────
async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t  = db.transaction(store, mode);
    const os = t.objectStore(store);
    const req = fn(os);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Handles de dossiers ─────────────────────────────────────────────────────
export const handles = {
  async save(id, handle) {
    return tx('handles', 'readwrite', os => os.put({ id, handle, savedAt: Date.now() }));
  },

  async get(id) {
    const row = await tx('handles', 'readonly', os => os.get(id));
    return row?.handle || null;
  },

  async remove(id) {
    return tx('handles', 'readwrite', os => os.delete(id));
  }
};

// ── Pistes ──────────────────────────────────────────────────────────────────
export const tracks = {
  async saveAll(trackList) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t  = db.transaction('tracks', 'readwrite');
      const os = t.objectStore('tracks');
      trackList.forEach(track => os.put(track));
      t.oncomplete = () => resolve(trackList.length);
      t.onerror    = () => reject(t.error);
    });
  },

  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t   = db.transaction('tracks', 'readonly');
      const req = t.objectStore('tracks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  },

  async update(id, patch) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t  = db.transaction('tracks', 'readwrite');
      const os = t.objectStore('tracks');
      const get = os.get(id);
      get.onsuccess = () => {
        const track = get.result;
        if (!track) return resolve(null);
        const put = os.put({ ...track, ...patch });
        put.onsuccess = () => resolve(put.result);
        put.onerror   = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  },

  async clear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t  = db.transaction('tracks', 'readwrite');
      const req = t.objectStore('tracks').clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
};

// ── Blobs (iOS) ─────────────────────────────────────────────────────────────
export const blobs = {
  async save(id, blob) {
    return tx('blobs', 'readwrite', os => os.put({ id, blob, savedAt: Date.now() }));
  },

  async get(id) {
    const row = await tx('blobs', 'readonly', os => os.get(id)).catch(() => null);
    return row?.blob || null;
  },

  async remove(id) {
    return tx('blobs', 'readwrite', os => os.delete(id));
  },

  // Estimation de l'espace utilisé par les blobs
  async estimateSize() {
    const db = await openDB();
    return new Promise((resolve) => {
      const t = db.transaction('blobs', 'readonly');
      const req = t.objectStore('blobs').getAll();
      req.onsuccess = () => {
        const total = (req.result || []).reduce((sum, row) => sum + (row.blob?.size || 0), 0);
        resolve(total);
      };
      req.onerror = () => resolve(0);
    });
  }
};

// ── Settings ────────────────────────────────────────────────────────────────
export const settings = {
  async set(key, value) {
    return tx('settings', 'readwrite', os => os.put({ key, value }));
  },

  async get(key, defaultValue = null) {
    const row = await tx('settings', 'readonly', os => os.get(key)).catch(() => null);
    return row != null ? row.value : defaultValue;
  }
};

// ── Playlists ───────────────────────────────────────────────────────────────
export const playlists = {
  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('playlists', 'readonly').objectStore('playlists').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  },

  async create(name, trackIds = []) {
    return tx('playlists', 'readwrite', os => os.add({
      name,
      trackIds,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
  },

  async update(id, patch) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t  = db.transaction('playlists', 'readwrite');
      const os = t.objectStore('playlists');
      const get = os.get(id);
      get.onsuccess = () => {
        const pl = get.result;
        if (!pl) return resolve(null);
        const put = os.put({ ...pl, ...patch, updatedAt: Date.now() });
        put.onsuccess = () => resolve(put.result);
        put.onerror   = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  },

  async remove(id) {
    return tx('playlists', 'readwrite', os => os.delete(id));
  }
};

export default { handles, tracks, blobs, settings, playlists, openDB };
