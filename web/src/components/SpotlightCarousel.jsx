/**
 * SpotlightCarousel — NovaSound TITAN LUX v30
 * Carrousel "À la une" sur la HomePage.
 * Sélectionne automatiquement les 5 sons récents les plus populaires.
 * Auto-défile toutes les 5 secondes. Cliquable → lecture directe.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ChevronLeft, ChevronRight, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SpotlightCarousel = ({ songs = [], onPlay, currentSong }) => {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef(null);

  const startAuto = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % songs.length);
    }, 5000);
  }, [songs.length]);

  useEffect(() => {
    if (songs.length > 1) startAuto();
    return () => clearInterval(intervalRef.current);
  }, [songs.length, startAuto]);

  const go = (dir) => {
    setCurrent(c => (c + dir + songs.length) % songs.length);
    startAuto();
  };

  if (!songs.length) return null;

  const song = songs[current];
  const isActive = currentSong?.id === song.id;

  return (
    // Technique universelle aspect-ratio : padding-bottom trick — iOS Safari 9+, Android 4+
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ maxHeight: 340 }}
    >
      {/* Spacer qui impose la hauteur via padding-bottom (ratio 16:7 = 43.75%) */}
      <div style={{ paddingBottom: '43.75%', maxHeight: 340 }} />

      {/* Contenu positionné en absolu sur toute la surface du wrapper */}
      <div className="absolute inset-0">
      {/* Background image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={song.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {song.cover_url ? (
            <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-900 to-purple-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 flex items-center px-6 md:px-10 gap-6">
        {/* Pochette */}
        <motion.div
          key={`cover-${song.id}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="hidden sm:block flex-shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden shadow-2xl border border-white/20"
        >
          {song.cover_url
            ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-purple-600" />
          }
        </motion.div>

        {/* Info */}
        <motion.div
          key={`info-${song.id}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex-1 min-w-0"
        >
          {song.genre && (
            <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 mb-1 block">
              {song.genre}
            </span>
          )}
          <h3 className="text-white text-2xl md:text-3xl font-black leading-tight truncate drop-shadow-lg">
            {song.title}
          </h3>
          <p className="text-gray-300 text-sm md:text-base mt-1 truncate">{song.artist}</p>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => onPlay?.(song)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-xl active:scale-95"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #06b6d4, #a855f7)'
                  : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
              }}
            >
              <Play className="w-4 h-4 fill-current" />
              {isActive ? 'En lecture' : 'Écouter'}
            </button>
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-gray-300 font-medium">
                {song.plays_count >= 1000
                  ? `${(song.plays_count / 1000).toFixed(1)}k`
                  : song.plays_count || 0}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation buttons */}
      {songs.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all backdrop-blur-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {songs.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); startAuto(); }}
                className="transition-all rounded-full"
                style={{
                  width: i === current ? 20 : 6,
                  height: 6,
                  background: i === current ? '#06b6d4' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
        </>
      )}
      </div>{/* fin du div absolute inset-0 */}
    </div>
  );
};

export default SpotlightCarousel;
