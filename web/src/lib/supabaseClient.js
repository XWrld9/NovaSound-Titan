import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Instance unique Supabase avec persistance de session garantie et debug
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Force localStorage pour la persistance
    storageKey: 'supabase.auth.token', // Clé de stockage explicite
    debug: true, // Activer les logs de debug Supabase
    flowType: 'pkce', // Flow PKCE plus sécurisé
    redirectTo: window.location.origin, // Redirection explicite
    // Augmenter les timeouts pour éviter les erreurs réseau
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'novasound-titan-web/1.0.0'
      },
      // Configuration fetch pour les timeouts
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          // Timeout de 15 secondes au lieu de 10 par défaut
          signal: AbortSignal.timeout(15000)
        });
      }
    }
  },
  // Options globales pour la connexion
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'novasound-titan-web/1.0.0'
    },
    // Timeout global pour toutes les requêtes
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Timeout de 15 secondes
        signal: AbortSignal.timeout(15000)
      });
    }
  }
});

// Fonctions utilitaires pour la compatibilité
export const supabaseClient = {
  // Authentification
  auth: {
    signUp: async (email, password, options) => {
      return await supabase.auth.signUp({
        email,
        password,
        options
      });
    },
    signInWithPassword: async (email, password) => {
      return await supabase.auth.signInWithPassword({
        email,
        password
      });
    },
    signOut: async () => {
      return await supabase.auth.signOut();
    },
    getUser: async () => {
      return await supabase.auth.getUser();
    },
    onAuthStateChange: (callback) => {
      return supabase.auth.onAuthStateChange(callback);
    },
    resend: async (options) => {
      return await supabase.auth.resend(options);
    }
  },

  // Database
  from: (table) => supabase.from(table),

  // Storage
  storage: {
    from: (bucket) => supabase.storage.from(bucket)
  },

  // Real-time
  channel: (name) => supabase.channel(name),

  // Helper pour la compatibilité avec l'ancien code
  collection: (collectionName) => ({
    getFirstListItem: async (filter, options = {}) => {
      const { data, error } = await supabase
        .from(collectionName)
        .select('*')
        .match(filter)
        .single();
      
      if (error) throw error;
      return data;
    },

    getFullList: async (options = {}) => {
      const { data, error } = await supabase
        .from(collectionName)
        .select('*');
      
      if (error) throw error;
      return data;
    },

    create: async (data) => {
      const { data: result, error } = await supabase
        .from(collectionName)
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },

    update: async (id, data) => {
      const { data: result, error } = await supabase
        .from(collectionName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },

    delete: async (id) => {
      const { error } = await supabase
        .from(collectionName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },

    subscribe: async (filter, callback) => {
      return supabase
        .channel(`${collectionName}_changes`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: collectionName,
            filter: filter 
          }, 
          callback
        )
        .subscribe();
    }
  })
};

export default supabaseClient;
