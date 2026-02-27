/**
 * PlayerContext — NovaSound TITAN LUX v75
 * Nouvelles fonctionnalités v75 :
 *   - currentPlaylistId  : ID de la playlist Supabase en cours de lecture
 *   - removeFromPlaylist : retire un son de la playlist lecture ET synchro DB playlist profil
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const PlayerContext = createContext(null);

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
};

export const PlayerProvider = ({ children }) => {
  const [currentSong,       setCurrentSong]       = useState(null);
  const [playlist,          setPlaylist]           = useState([]);
  const [queue,             setQueue]              = useState([]);
  const [isVisible,         setIsVisible]          = useState(false);
  const [sleepTimer,        setSleepTimerVal]      = useState(null);
  const [radioMode,         setRadioMode]          = useState(false);
  const [radioLoading,      setRadioLoading]       = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId]  = useState(null);

  const playlistRef          = useRef([]);
  const currentSongRef       = useRef(null);
  const queueRef             = useRef([]);
  const sleepIntervalRef     = useRef(null);
  const radioModeRef         = useRef(false);
  const currentPlaylistIdRef = useRef(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { radioModeRef.current = radioMode; }, [radioMode]);
  useEffect(() => { currentPlaylistIdRef.current = currentPlaylistId; }, [currentPlaylistId]);

  // ── Fetch prochain son radio ──────────────────────────────────────
  const fetchRadioNext = useCallback(async (currentSongData) => {
    if (!currentSongData) return null;
    setRadioLoading(true);
    try {
      const excludeIds = [
        currentSongData.id,
        ...playlistRef.current.map(s => s.id),
        ...queueRef.current.map(s => s.id),
      ].filter(Boolean);

      if (currentSongData.genre) {
        const { data } = await supabase
          .from('songs')
          .select('*')
          .eq('is_archived', false)
          .eq('genre', currentSongData.genre)
          .not('id', 'in', `(${excludeIds.join(',')})`)
          .order('plays_count', { ascending: false })
          .limit(10);
        if (data?.length) {
          const pool = data.slice(0, Math.min(5, data.length));
          return pool[Math.floor(Math.random() * pool.length)];
        }
      }

      const { data: byArtist } = await supabase
        .from('songs')
        .select('*')
        .eq('is_archived', false)
        .ilike('artist', `%${currentSongData.artist}%`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(5);
      if (byArtist?.length) return byArtist[Math.floor(Math.random() * byArtist.length)];

      const { data: popular } = await supabase
        .from('songs')
        .select('*')
        .eq('is_archived', false)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .order('plays_count', { ascending: false })
        .limit(20);
      if (popular?.length) return popular[Math.floor(Math.random() * popular.length)];
    } catch {}
    finally { setRadioLoading(false); }
    return null;
  }, []);

  const toggleRadio = useCallback(() => setRadioMode(prev => !prev), []);

  // ── Sleep timer ─────────────────────────────────────────────────
  const clearSleepTimer = useCallback(() => {
    clearInterval(sleepIntervalRef.current);
    setSleepTimerVal(null);
  }, []);

  const setSleepTimer = useCallback((minutes) => {
    clearInterval(sleepIntervalRef.current);
    if (!minutes || minutes <= 0) { setSleepTimerVal(null); return; }
    let remaining = minutes * 60;
    setSleepTimerVal(remaining);
    sleepIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSleepTimerVal(remaining);
      if (remaining <= 0) {
        clearInterval(sleepIntervalRef.current);
        setSleepTimerVal(null);
        window.dispatchEvent(new CustomEvent('novasound:sleep-end'));
      }
    }, 1000);
  }, []);

  // ── playSong : accepte un playlistId optionnel pour la synchro ───
  const playSong = useCallback((song, songList = [], playlistId = null) => {
    if (!song) return;
    const list = (songList.length ? songList : [song]).filter(s => !s.is_archived);
    if (!list.find(s => s.id === song.id)) list.unshift(song);
    playlistRef.current    = list;
    currentSongRef.current = song;
    setPlaylist(list);
    setCurrentSong(song);
    setIsVisible(true);
    setCurrentPlaylistId(playlistId || null);
  }, []);

  // ── Retirer un son de la playlist lecture + synchro DB ───────────
  const removeFromPlaylist = useCallback(async (songId) => {
    const newList = playlistRef.current.filter(s => s.id !== songId);
    playlistRef.current = newList;
    setPlaylist(newList);

    if (currentSongRef.current?.id === songId) {
      if (newList.length > 0) {
        currentSongRef.current = newList[0];
        setCurrentSong(newList[0]);
      } else {
        currentSongRef.current = null;
        setCurrentSong(null);
        setIsVisible(false);
      }
    }

    const plId = currentPlaylistIdRef.current;
    if (plId) {
      try {
        await supabase
          .from('playlist_songs')
          .delete()
          .eq('playlist_id', plId)
          .eq('song_id', songId);
        window.dispatchEvent(new CustomEvent('novasound:playlist-song-removed', {
          detail: { playlistId: plId, songId },
        }));
      } catch (err) {
        console.warn('[PlayerContext] removeFromPlaylist sync error:', err);
      }
    }
  }, []);

  // ── handleNext ────────────────────────────────────────────────────
  const handleNext = useCallback(async (songOverride) => {
    if (!songOverride && queueRef.current.length > 0) {
      const [next, ...rest] = queueRef.current;
      queueRef.current = rest;
      setQueue(rest);
      currentSongRef.current = next;
      setCurrentSong(next);
      return;
    }
    if (songOverride) {
      currentSongRef.current = songOverride;
      setCurrentSong(songOverride);
      return;
    }
    const pl  = playlistRef.current;
    const cs  = currentSongRef.current;
    const idx = pl.findIndex(s => s.id === cs?.id);
    const isLast = idx === pl.length - 1 || pl.length === 0;

    if (isLast && radioModeRef.current && cs) {
      const radioSong = await fetchRadioNext(cs);
      if (radioSong) {
        playlistRef.current = [...pl, radioSong];
        setPlaylist([...pl, radioSong]);
        currentSongRef.current = radioSong;
        setCurrentSong(radioSong);
        return;
      }
    }

    const song = pl[(idx + 1) % pl.length];
    if (song) { currentSongRef.current = song; setCurrentSong(song); }
  }, [fetchRadioNext]);

  const handlePrevious = useCallback((songOverride) => {
    const song = songOverride || (() => {
      const pl  = playlistRef.current;
      const cs  = currentSongRef.current;
      if (!pl.length || !cs) return null;
      const idx = pl.findIndex(s => s.id === cs.id);
      return pl[(idx - 1 + pl.length) % pl.length];
    })();
    if (song) { currentSongRef.current = song; setCurrentSong(song); }
  }, []);

  const closePlayer = useCallback(() => {
    clearSleepTimer();
    setIsVisible(false);
    setCurrentSong(null);
    setPlaylist([]);
    setQueue([]);
    setRadioMode(false);
    setCurrentPlaylistId(null);
    playlistRef.current    = [];
    currentSongRef.current = null;
    queueRef.current       = [];
    window.dispatchEvent(new CustomEvent('novasound:close-player'));
  }, [clearSleepTimer]);

  // ── Queue management ─────────────────────────────────────────────
  const addToQueue = useCallback((song) => {
    if (!song) return;
    setQueue(prev => {
      const next = [...prev, song];
      queueRef.current = next;
      return next;
    });
    if (!currentSongRef.current) {
      currentSongRef.current = song;
      setCurrentSong(song);
      setIsVisible(true);
    }
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== index);
      queueRef.current = next;
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    queueRef.current = [];
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentSong, playlist, queue, isVisible, sleepTimer,
      radioMode, radioLoading, currentPlaylistId,
      playSong, handleNext, handlePrevious, closePlayer,
      addToQueue, removeFromQueue, clearQueue,
      removeFromPlaylist, setCurrentPlaylistId,
      setSleepTimer, clearSleepTimer, toggleRadio,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
