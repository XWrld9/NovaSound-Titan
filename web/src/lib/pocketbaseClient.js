import { supabase } from './supabaseClient';

const translatePocketBaseField = (field) => {
  // Minimal translation layer for legacy PocketBase filters
  if (!field) return field;

  return field
    .replaceAll('uploader.id', 'uploader_id')
    .replaceAll('uploader', 'uploader_id')
    .replaceAll('following', 'following_id')
    .replaceAll('follower', 'follower_id')
    .replaceAll('songId', 'song_id')
    .replaceAll('userId', 'user_id')
    .replaceAll('created', 'created_at');
};

const applyPocketBaseFilter = (query, filter) => {
  if (!filter) return query;

  // Supports a small subset:
  // - field = "value"
  // - field="value"
  // - multiple conditions joined by &&
  // Unsupported patterns (like ~) are ignored.
  const parts = filter.split('&&').map((s) => s.trim()).filter(Boolean);

  let q = query;
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z0-9_\.]+)\s*=\s*"([^"]*)"$/);
    if (!match) continue;
    const rawField = match[1];
    const value = match[2];
    const field = translatePocketBaseField(rawField);
    q = q.eq(field, value);
  }

  return q;
};

// Interface compatible avec l'ancien PocketBase pour éviter de tout modifier
const pb = {
  // File URLs compatibility (PocketBase had pb.files.getUrl(record, filename))
  files: {
    getUrl: (record, _file) => {
      // Supabase schema stores direct public URLs in *_url columns
      if (!record) return '';
      return (
        record.audio_file_url ||
        record.album_cover_url ||
        record.avatar_url ||
        ''
      );
    }
  },

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

  // Helper pour la compatibilité
  collection: (collectionName) => ({
    getList: async (page = 1, perPage = 50, options = {}) => {
      const from = supabase.from(collectionName).select('*');

      const start = Math.max(0, (page - 1) * perPage);
      const end = start + perPage - 1;

      let q = from.range(start, end);

      if (options?.sort) {
        const sort = options.sort;
        const desc = sort.startsWith('-');
        const rawField = desc ? sort.slice(1) : sort;
        const field = translatePocketBaseField(rawField);
        q = q.order(field, { ascending: !desc });
      }

      q = applyPocketBaseFilter(q, options?.filter);

      const { data, error, count } = await q;
      if (error) throw error;

      return {
        items: data || [],
        page,
        perPage,
        totalItems: typeof count === 'number' ? count : (data || []).length,
      };
    },

    getFirstListItem: async (filter, options = {}) => {
      let q = supabase.from(collectionName).select('*');
      q = applyPocketBaseFilter(q, filter);
      const { data, error } = await q.single();
      
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
    },

    // PocketBase had unsubscribe; we keep a no-op to prevent runtime errors
    unsubscribe: async () => {
      return;
    }
  })
};

export default pb;
