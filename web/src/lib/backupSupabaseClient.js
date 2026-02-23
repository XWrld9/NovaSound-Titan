import { createClient } from '@supabase/supabase-js';

// Configuration de backup pour les problèmes réseau
const BACKUP_CONFIGS = [
  {
    name: 'Primary (US)',
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY,
    region: 'us-east-1'
  },
  {
    name: 'Backup (EU)',
    url: 'https://eu.supabase.co',
    key: import.meta.env.VITE_SUPABASE_ANON_KEY, // Même clé si possible
    region: 'eu-west-1'
  }
];

export const createRobustClient = () => {
  let currentConfigIndex = 0;
  let client = null;
  
  const createClientWithConfig = (config) => {
    return createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'supabase.auth.token',
        debug: true,
        flowType: 'pkce',
        redirectTo: window.location.origin
      },
      global: {
        headers: {
          'X-Client-Info': 'novasound-titan-web/1.0.0'
        },
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000) // 10s timeout pour backup
          });
        }
      }
    });
  };
  
  client = createClientWithConfig(BACKUP_CONFIGS[0]);
  
  return {
    client,
    switchToBackup: async () => {
      console.log(`🔄 Switching to backup server: ${BACKUP_CONFIGS[1].name}`);
      currentConfigIndex = 1;
      client = createClientWithConfig(BACKUP_CONFIGS[1]);
      return client;
    },
    getCurrentConfig: () => BACKUP_CONFIGS[currentConfigIndex],
    testConnection: async (testClient = client) => {
      try {
        const { data, error } = await testClient.auth.getSession();
        return !error;
      } catch {
        return false;
      }
    }
  };
};

export const robustSupabase = createRobustClient();
