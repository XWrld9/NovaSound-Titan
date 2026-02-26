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

// Fetch avec retry automatique (1 retry sur erreur réseau/abort)
const fetchWithRetry = async (url, options = {}, retries = 1) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0 && (err.name === 'AbortError' || err.name === 'TypeError')) {
      // Attendre 1 seconde avant de retry
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage,
    storageKey: 'novasound.auth.token',
    // implicit flow plus compatible avec les webviews Android et iOS Safari
    flowType: 'implicit',
    // Désactiver le LockManager pour éviter le timeout multi-onglets + iOS
    lock: async (name, acquireTimeout, fn) => {
      if (typeof navigator === 'undefined' || !navigator.locks) {
        return fn();
      }
      try {
        return await Promise.race([
          navigator.locks.request(name, { mode: 'exclusive' }, fn),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Lock timeout')), acquireTimeout ?? 8000)
          )
        ]);
      } catch {
        return fn();
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'novasound-titan-web/10.0.0'
    },
    fetch: fetchWithRetry
  }
});

export default supabase;
