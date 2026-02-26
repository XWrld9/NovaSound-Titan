/**
 * PlayerContext — NovaSound TITAN LUX v10
 * Player global persistant : survit à la navigation entre toutes les pages.
 * Monté UNE SEULE FOIS dans App.jsx, jamais démonté.
 */
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const PlayerContext = createContext(null);

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
};

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong]   = useState(null);
  const [playlist, setPlaylist]         = useState([]);
  const [isVisible, setIsVisible]       = useState(false);

  // Refs pour accès synchrone (évite stale closure dans next/previous)
  const playlistRef    = useRef([]);
  const currentSongRef = useRef(null);

  /**
   * Lance la lecture d'un son.
   * @param {Object} song       — le son à jouer
   * @param {Array}  songList   — la playlist complète (les sons de la page courante)
   */
  const playSong = useCallback((song, songList = []) => {
    if (!song) return;
    const list = (songList.length ? songList : [song]).filter(s => !s.is_archived);
    // S'assurer que le son courant est dans la liste
    if (!list.find(s => s.id === song.id)) list.unshift(song);

    playlistRef.current    = list;
    currentSongRef.current = song;
    setPlaylist(list);
    setCurrentSong(song);
    setIsVisible(true);
  }, []);

  const handleNext = useCallback((songOverride) => {
    const song = songOverride || (() => {
      const pl = playlistRef.current;
      const cs = currentSongRef.current;
      if (!pl.length || !cs) return null;
      const idx = pl.findIndex(s => s.id === cs.id);
      return pl[(idx + 1) % pl.length];
    })();
    if (song) {
      currentSongRef.current = song;
      setCurrentSong(song);
    }
  }, []);

  const handlePrevious = useCallback((songOverride) => {
    const song = songOverride || (() => {
      const pl = playlistRef.current;
      const cs = currentSongRef.current;
      if (!pl.length || !cs) return null;
      const idx = pl.findIndex(s => s.id === cs.id);
      return pl[(idx - 1 + pl.length) % pl.length];
    })();
    if (song) {
      currentSongRef.current = song;
      setCurrentSong(song);
    }
  }, []);

  const closePlayer = useCallback(() => {
    setIsVisible(false);
    setCurrentSong(null);
    setPlaylist([]);
    playlistRef.current    = [];
    currentSongRef.current = null;
    // Signal legacy (pour compatibilité avec les listeners existants)
    window.dispatchEvent(new CustomEvent('novasound:close-player'));
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentSong,
      playlist,
      isVisible,
      playSong,
      handleNext,
      handlePrevious,
      closePlayer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
