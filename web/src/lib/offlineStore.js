/**
 * offlineStore — NovaSound TITAN LUX v4000
 * IndexedDB léger pour stocker les messages/actions offline
 */
const DB_NAME    = 'novasound_offline_v4';
const DB_VERSION = 1;
const STORE_MSGS = 'pending_messages';

let _db = null;

const openDB = () => new Promise((resolve, reject) => {
  if (_db) return resolve(_db);
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_MSGS)) {
      const store = db.createObjectStore(STORE_MSGS, { keyPath: 'id', autoIncrement: true });
      store.createIndex('by_created', 'created_at', { unique: false });
    }
  };
  req.onsuccess = e => { _db = e.target.result; resolve(_db); };
  req.onerror   = e => reject(e.target.error);
});

export const offlineStore = {
  async addMessage(content, replyTo = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_MSGS, 'readwrite');
      const req = tx.objectStore(STORE_MSGS).add({
        content,
        reply_to: replyTo ? { id: replyTo.id, content: replyTo.content?.slice(0,120), username: replyTo.reply_to_username } : null,
        created_at: new Date().toISOString(),
        synced: false,
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  async getPending() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_MSGS, 'readonly');
      const req = tx.objectStore(STORE_MSGS).index('by_created').getAll();
      req.onsuccess = () => resolve((req.result||[]).filter(m=>!m.synced));
      req.onerror   = () => reject(req.error);
    });
  },

  async markSynced(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_MSGS, 'readwrite');
      const store = tx.objectStore(STORE_MSGS);
      const get   = store.get(id);
      get.onsuccess = () => {
        if (!get.result) return resolve();
        const upd = store.put({ ...get.result, synced: true, synced_at: new Date().toISOString() });
        upd.onsuccess = () => resolve();
        upd.onerror   = () => reject(upd.error);
      };
      get.onerror = () => reject(get.error);
    });
  },

  async clearSynced() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_MSGS, 'readwrite');
      const req = tx.objectStore(STORE_MSGS).openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) return resolve();
        if (cursor.value.synced) cursor.delete();
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  },
};
