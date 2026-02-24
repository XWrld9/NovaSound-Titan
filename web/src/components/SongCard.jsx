import React, { useState, memo } from 'react';
import { Play, Download, Share2, Music, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/LikeButton';
import ReportButton from './ReportButton';

const SongCard = memo(({ song, onPlay, isPlaying, setCurrentSong, currentSong, showDelete, onDelete }) => {
  const { currentUser } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  const handlePlay = () => {
    if (onPlay) onPlay(song);
    else if (setCurrentSong) setCurrentSong(song);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!song.audio_url) return;
    const link = document.createElement('a');
    link.href = song.audio_url;
    link.download = `${song.title}.mp3`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#/song/${song.id}`;
    navigator.clipboard.writeText(url);
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-cyan-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
    toast.textContent = 'Lien copié!';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 2000);
  };

  return (
    <div
      className="bg-gray-900/80 border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400 transition-all group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-square">
        {song.cover_url ? (
          <img
            src={song.cover_url}
            alt={song.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
            <Music className="w-16 h-16 text-white" />
          </div>
        )}

        {/* Overlay — rendu seulement au hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform hover:scale-110 transition-all shadow-lg shadow-cyan-500/50"
            >
              <Play className="w-8 h-8 text-white fill-current" />
            </button>
          </div>
        )}

        {/* Indicateur lecture en cours */}
        {isPlaying && (
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-semibold truncate text-lg">{song.title}</h3>
        <p className="text-gray-400 text-sm truncate mb-3">{song.artist}</p>

        <div className="flex items-center justify-between mt-2">
          <LikeButton
            songId={song.id}
            initialLikes={song.likes_count || 0}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="text-gray-400 hover:text-cyan-400 transition-colors"
              title="Télécharger"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={handleShare}
              className="text-gray-400 hover:text-white transition-colors"
              title="Partager"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <ReportButton contentType="song" contentId={song.id} />
            {showDelete && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {song.plays_count || 0} plays
          </div>
        </div>
      </div>
    </div>
  );
});

SongCard.displayName = 'SongCard';

export default SongCard;
