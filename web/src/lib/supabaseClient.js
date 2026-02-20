import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions pour les opérations communes
export const auth = {
  signUp: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          emailVisibility: true
        }
      }
    });
    return { data, error };
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Database helpers
export const db = {
  // Users
  updateUser: async (userId, updates) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  getUserById: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Songs
  getSongs: async (filters = {}) => {
    let query = supabase
      .from('songs')
      .select(`
        *,
        uploader:users(username, avatar)
      `)
      .order('created', { ascending: false });

    if (filters.uploaderId) {
      query = query.eq('uploader_id', filters.uploaderId);
    }

    const { data, error } = await query;
    return { data, error };
  },

  createSong: async (songData) => {
    const { data, error } = await supabase
      .from('songs')
      .insert(songData)
      .select()
      .single();
    return { data, error };
  },

  // Likes
  toggleLike: async (userId, songId) => {
    // Vérifier si déjà liké
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('song_id', songId);
      return { action: 'unliked', error };
    } else {
      // Like
      const { data, error } = await supabase
        .from('likes')
        .insert({ user_id: userId, song_id: songId })
        .select()
        .single();
      return { action: 'liked', data, error };
    }
  },

  getLikesCount: async (songId) => {
    const { count, error } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', songId);
    return { count, error };
  },

  // Follows
  toggleFollow: async (followerId, followingId) => {
    // Vérifier si déjà follow
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (existingFollow) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
      return { action: 'unfollowed', error };
    } else {
      // Follow
      const { data, error } = await supabase
        .from('follows')
        .insert({ follower_id: followerId, following_id: followingId })
        .select()
        .single();
      return { action: 'followed', data, error };
    }
  },

  getFollowers: async (userId) => {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower:users(username, avatar)
      `)
      .eq('following_id', userId);
    return { data, error };
  },

  getFollowing: async (userId) => {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following:users(username, avatar)
      `)
      .eq('follower_id', userId);
    return { data, error };
  }
};

export default supabase;
