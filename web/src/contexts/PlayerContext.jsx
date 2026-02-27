/**
 * PlayerContext — NovaSound TITAN LUX v20
 * Nouvelles fonctionnalités :
 *   - queue          : file d'attente manuelle (après le son courant)
 *   - addToQueue     : ajouter un son en queue depuis n'importe quelle SongCard
 *   - removeFromQueue / clearQueue
 *   - sleepTimer     : compte à rebours en secondes (null = inactif)
 *   - setSleepTimer  : activer le minuteur (en minutes)
 *   - clearSleepTimer: désactiver le minuteur
 */
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

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

  const playlistRef      = useRef([]);
  const currentSongRef   = useRef(null);
  const queueRef         = useRef([]);
  const sleepIntervalRef = useRef(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);

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

  // ── handleNext : queue prioritaire ──────────────────────────────
  const handleNext = useCallback((songOverride) => {
    if (!songOverride && queueRef.current.length > 0) {
      const [next, ...rest] = queueRef.current;
      queueRef.current = rest;
      setQueue(rest);
      currentSongRef.current = next;
      setCurrentSong(next);
      return;
    }
    const song = songOverride || (() => {
      const pl = playlistRef.current;
      const cs = currentSongRef.current;
      if (!pl.length || !cs) return null;
      const idx = pl.findIndex(s => s.id === cs.id);
      return pl[(idx + 1) % pl.length];
    })();
    if (song) { currentSongRef.current = song; setCurrentSong(song); }
  }, []);

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
      playSong, handleNext, handlePrevious, closePlayer,
      addToQueue, removeFromQueue, clearQueue,
      setSleepTimer, clearSleepTimer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
