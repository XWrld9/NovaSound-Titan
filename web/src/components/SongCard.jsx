import React, { useState, useEffect } from 'react';
import { Play, Heart, Download, Share2, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LikeButton from '@/components/LikeButton';
import ReportButton from './ReportButton';

const SongCard = ({ song, onPlay, isPlaying }) => {
  const { currentUser } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!song.audio_url) return;
    
    // Créer un lien de téléchargement direct
    const link = document.createElement('a');
    const url = song.audio_url;
    link.href = url;
    link.download = `${song.title}.mp3`; // Suggest filename
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#/song/${song.id}`;
    navigator.clipboard.writeText(url);
    // Toast moderne
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-cyan-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
    toast.textContent = 'Lien copié!';
    document.body.appendChild(toast);
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 2000);
  };

  return (
    <motion.div
      className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400 transition-all group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -5 }}
    >
      <div className="relative aspect-square">
        {song.cover_url ? (
          <img
            src={song.cover_url}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
            <Music className="w-16 h-16 text-white" />
          </div>
        )}
        
        {/* Overlay */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => onPlay(song)}
            className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform hover:scale-110 transition-all shadow-lg shadow-cyan-500/50"
          >
            <Play className="w-8 h-8 text-white fill-current" />
          </button>
        </div>
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
            <ReportButton 
              contentType="song" 
              contentId={song.id}
            />
          </div>
          
          <div className="text-xs text-gray-500 font-mono">
            {song.plays_count || 0} plays
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SongCard;