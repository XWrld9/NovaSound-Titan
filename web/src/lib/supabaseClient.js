import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Storage robuste — iOS Safari en mode privé bloque localStorage
const safeStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* mode privé iOS */ }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch { /* mode privé iOS */ }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    storageKey: 'novasound.auth.token',
    flowType: 'pkce',
    // Désactiver le LockManager pour éviter le timeout multi-onglets + iOS
    lock: async (name, acquireTimeout, fn) => {
      if (typeof navigator === 'undefined' || !navigator.locks) {
        return fn();
      }
      try {
        return await Promise.race([
          navigator.locks.request(name, { mode: 'exclusive' }, fn),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Lock timeout')), acquireTimeout ?? 5000)
          )
        ]);
      } catch {
        return fn();
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'novasound-titan-web/4.7.0'
    },
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000)
      });
    }
  }
});

export default supabase;
