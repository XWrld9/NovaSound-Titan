/**
 * PlaylistContext — NovaSound TITAN LUX v60
 * Gestion globale des playlists : création, lecture, ajout de sons.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PlaylistContext = createContext(null);

export const usePlaylist = () => {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylist must be used inside PlaylistProvider');
  return ctx;
};

export const PlaylistProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [myPlaylists, setMyPlaylists]   = useState([]);
  const [loadingPl,   setLoadingPl]     = useState(false);

  // ── Auto-charger les playlists dès que l'utilisateur est connecté ──
  useEffect(() => {
    if (currentUser) {
      fetchMyPlaylists();
    } else {
      setMyPlaylists([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ── Charger les playlists de l'utilisateur ──────────────────────
  const fetchMyPlaylists = useCallback(async () => {
    if (!currentUser) return;
    setLoadingPl(true);
    try {
      const { data } = await supabase
        .from('playlists')
        .select('id, name, cover_url, is_public, updated_at')
        .eq('owner_id', currentUser.id)
        .order('updated_at', { ascending: false });
      setMyPlaylists(data || []);
    } catch {}
    finally { setLoadingPl(false); }
  }, [currentUser]);

  // ── Créer une playlist ──────────────────────────────────────────
  const createPlaylist = useCallback(async ({ name, description = '', is_public = true }) => {
    if (!currentUser || !name?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({ owner_id: currentUser.id, name: name.trim(), description, is_public })
        .select('*')
        .single();
      if (error) throw error;
      setMyPlaylists(prev => [data, ...prev]);
      return data;
    } catch { return null; }
  }, [currentUser]);

  // ── Supprimer une playlist ──────────────────────────────────────
  const deletePlaylist = useCallback(async (playlistId) => {
    if (!currentUser?.id) return;
    try {
      // Double protection : RLS + vérification owner côté client
      await supabase.from('playlists').delete()
        .eq('id', playlistId)
        .eq('owner_id', currentUser.id); // seulement le créateur peut supprimer
      setMyPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } catch {}
  }, [currentUser?.id]);

  // ── Ajouter un son à une playlist ──────────────────────────────
  const addSongToPlaylist = useCallback(async (playlistId, songId) => {
    try {
      await supabase.rpc('add_song_to_playlist', {
        p_playlist_id: playlistId,
        p_song_id:     songId,
      });
      return true;
    } catch { return false; }
  }, []);

  // ── Retirer un son d'une playlist ──────────────────────────────
  const removeSongFromPlaylist = useCallback(async (playlistId, songId) => {
    try {
      await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);
      return true;
    } catch { return false; }
  }, []);

  // ── Charger les sons d'une playlist ────────────────────────────
  const fetchPlaylistSongs = useCallback(async (playlistId) => {
    try {
      const { data } = await supabase
        .from('playlist_songs')
        .select('position, song_id, songs(*)')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
      return (data || []).map(r => r.songs).filter(Boolean);
    } catch { return []; }
  }, []);

  // ── Mettre à jour les infos d'une playlist ──────────────────────
  const updatePlaylist = useCallback(async (playlistId, updates) => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', playlistId)
        .select('*')
        .single();
      if (error) throw error;
      setMyPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, ...data } : p));
      return data;
    } catch { return null; }
  }, []);

  return (
    <PlaylistContext.Provider value={{
      myPlaylists, loadingPl,
      fetchMyPlaylists, createPlaylist, deletePlaylist,
      addSongToPlaylist, removeSongFromPlaylist,
      fetchPlaylistSongs, updatePlaylist,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
};
