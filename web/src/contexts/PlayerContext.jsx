/**
 * PlayerContext — NovaSound TITAN LUX v70
 * Nouvelles fonctionnalités v70 :
 *   - radioMode      : lecture infinie basée sur genre/artiste du son courant
 *   - toggleRadio    : activer / désactiver le mode radio
 *   - radioLoading   : indique qu'on charge le prochain son radio
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
  const [currentSong,  setCurrentSong]  = useState(null);
  const [playlist,     setPlaylist]      = useState([]);
  const [queue,        setQueue]         = useState([]);
  const [isVisible,    setIsVisible]     = useState(false);
  const [sleepTimer,   setSleepTimerVal] = useState(null);
  const [radioMode,    setRadioMode]     = useState(false);
  const [radioLoading, setRadioLoading]  = useState(false);

  const playlistRef      = useRef([]);
  const currentSongRef   = useRef(null);
  const queueRef         = useRef([]);
  const sleepIntervalRef = useRef(null);
  const radioModeRef     = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { radioModeRef.current = radioMode; }, [radioMode]);

  // ── Fetch prochain son radio ──────────────────────────────────────
  // Cherche d'abord par genre, puis par artiste, puis aléatoire
  const fetchRadioNext = useCallback(async (currentSongData) => {
    if (!currentSongData) return null;
    setRadioLoading(true);
    try {
      const excludeIds = [
        currentSongData.id,
        ...playlistRef.current.map(s => s.id),
        ...queueRef.current.map(s => s.id),
      ].filter(Boolean);

      // Tenter 1 : même genre
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

      // Tenter 2 : même artiste
      const { data: byArtist } = await supabase
        .from('songs')
        .select('*')
        .eq('is_archived', false)
        .ilike('artist', `%${currentSongData.artist}%`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(5);
      if (byArtist?.length) return byArtist[Math.floor(Math.random() * byArtist.length)];

      // Tenter 3 : populaire aléatoire
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

  const toggleRadio = useCallback(() => {
    setRadioMode(prev => !prev);
  }, []);

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

  // ── playSong ─────────────────────────────────────────────────────
  const playSong = useCallback((song, songList = []) => {
    if (!song) return;
    const list = (songList.length ? songList : [song]).filter(s => !s.is_archived);
    if (!list.find(s => s.id === song.id)) list.unshift(song);
    playlistRef.current    = list;
    currentSongRef.current = song;
    setPlaylist(list);
    setCurrentSong(song);
    setIsVisible(true);
  }, []);

  // ── handleNext : queue prioritaire, puis radio si activé ────────
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
    const pl = playlistRef.current;
    const cs = currentSongRef.current;
    const idx = pl.findIndex(s => s.id === cs?.id);
    const isLast = idx === pl.length - 1 || pl.length === 0;

    // Fin de playlist + radio mode → chercher un son similaire
    if (isLast && radioModeRef.current && cs) {
      const radioSong = await fetchRadioNext(cs);
      if (radioSong) {
        // Ajouter à la playlist
        playlistRef.current = [...pl, radioSong];
        setPlaylist([...pl, radioSong]);
        currentSongRef.current = radioSong;
        setCurrentSong(radioSong);
        return;
      }
    }

    // Comportement standard
    const song = pl[(idx + 1) % pl.length];
    if (song) { currentSongRef.current = song; setCurrentSong(song); }
  }, [fetchRadioNext]);

  const handlePrevious = useCallback((songOverride) => {
    const song = songOverride || (() => {
      const pl = playlistRef.current;
      const cs = currentSongRef.current;
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
      radioMode, radioLoading,
      playSong, handleNext, handlePrevious, closePlayer,
      addToQueue, removeFromQueue, clearQueue,
      setSleepTimer, clearSleepTimer, toggleRadio,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
