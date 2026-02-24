import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'novasound.auth.token',
    flowType: 'pkce',
    // Désactiver le LockManager pour éviter le timeout multi-onglets
    lock: async (name, acquireTimeout, fn) => {
      // Fallback sans verrou si LockManager non disponible ou timeout
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
        // Si le verrou échoue, on exécute quand même sans verrou
        return fn();
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'novasound-titan-web/3.3.0'
    },
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000)
      });
    }
  }
});

export default supabase;
