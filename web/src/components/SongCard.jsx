import React, { useState, useEffect } from 'react';
import { Play, Heart, Download, Share2, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LikeButton from '@/components/LikeButton';

const SongCard = ({ song, onPlay, isPlaying }) => {
  const { currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [likesCount, setLikesCount] = useState(0); // Local count for UI
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Check if user has liked this song
    if (currentUser) {
      checkLikeStatus();
    }
    // In a real app with likes_count field, we'd use that. 
    // Here we might fetch count or just show a placeholder if field missing.
    // Assuming we don't have a direct count field on song yet, we'll just handle the toggle state.
  }, [currentUser, song.id]);

  const checkLikeStatus = async () => {
    try {
      const records = await pb.collection('likes').getList(1, 1, {
        filter: `userId="${currentUser.id}" && songId="${song.id}"`,
        $autoCancel: false
      });
      if (records.items.length > 0) {
        setIsLiked(true);
        setLikeId(records.items[0].id);
      }
    } catch (err) {
      console.error('Error checking like status:', err);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser) return alert('Please login to like songs');

    try {
      if (isLiked && likeId) {
        await pb.collection('likes').delete(likeId);
        setIsLiked(false);
        setLikeId(null);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        const record = await pb.collection('likes').create({
          userId: currentUser.id,
          songId: song.id
        });
        setIsLiked(true);
        setLikeId(record.id);
        setLikesCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!song.audio_file) return;
    const url = pb.files.getUrl(song, song.audio_file) + '?download=1';
    const link = document.createElement('a');
    link.href = url;
    link.download = song.title; // Suggest filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/song/${song.id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <motion.div
      className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400 transition-all group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -5 }}
    >
      <div className="relative aspect-square">
        {song.album_cover ? (
          <img
            src={pb.files.getUrl(song, song.album_cover)}
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
            initialLikes={song.likes || 0}
            initialLiked={isLiked}
          />
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownload}
              className="text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={handleShare}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
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