import React, { useState, memo } from 'react';
import { Play, Download, Share2, Music, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/LikeButton';
import ReportButton from './ReportButton';
import SongShareModal from '@/components/SongShareModal';
import SongActionsMenu from '@/components/SongActionsMenu';
import { formatPlays } from '@/lib/utils';

const SongCard = memo(({ song: initialSong, onPlay, isPlaying, setCurrentSong, currentSong, onArchived, onDeleted }) => {
  const { currentUser } = useAuth();
  const [song, setSong] = useState(initialSong);
  const [isHovered, setIsHovered] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Sync si la prop change (ex: refresh parent)
  React.useEffect(() => { setSong(initialSong); }, [initialSong]);

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
    setShowShare(true);
  };

  return (
    <>
      <div
        className={`bg-gray-900/80 border rounded-xl overflow-hidden hover:border-cyan-400 transition-all group relative ${song.is_archived ? 'border-amber-500/40 opacity-70' : 'border-cyan-500/30'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Badge archivé */}
        {song.is_archived && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <span className="text-[10px] text-white font-bold tracking-wide">ARCHIVÉ</span>
          </div>
        )}

        {/* Pochette */}
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

          {/* Overlay hover */}
          {isHovered && !song.is_archived && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <button
                onClick={handlePlay}
                className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform hover:scale-110 transition-all shadow-lg shadow-cyan-500/50"
              >
                <Play className="w-8 h-8 text-white fill-current" />
              </button>
            </div>
          )}
          {isHovered && song.is_archived && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-amber-400 text-xs font-semibold">Son archivé</span>
            </div>
          )}

          {/* Lecture en cours */}
          {isPlaying && (
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
          )}

          {/* Badge plays */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <Headphones className="w-3 h-3 text-cyan-400" />
            <span className="text-xs text-cyan-300 font-medium">{formatPlays(song.plays_count)}</span>
          </div>
        </div>

        {/* Infos */}
        <div className="p-4">
          <h3 className="text-white font-semibold truncate text-base">{song.title}</h3>

          {song.uploader_id ? (
            <Link
              to={`/artist/${song.uploader_id}`}
              className="text-gray-400 text-sm truncate block hover:text-cyan-400 transition-colors mt-0.5"
              onClick={e => e.stopPropagation()}
            >
              {song.artist}
            </Link>
          ) : (
            <p className="text-gray-400 text-sm truncate mt-0.5">{song.artist}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
            <div className="flex items-center gap-2">
              {!song.is_archived && (
                <>
                  <button onClick={handleDownload} className="text-gray-400 hover:text-cyan-400 transition-colors" title="Télécharger">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors" title="Partager">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <ReportButton contentType="song" contentId={song.id} />
                </>
              )}
              <SongActionsMenu
                song={song}
                onArchived={(id, isArch) => {
                  setSong((s) => ({ ...s, is_archived: isArch }));
                  onArchived?.(id, isArch);
                }}
                onDeleted={(id) => {
                  onDeleted?.(id);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <SongShareModal song={song} onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </>
  );
});

SongCard.displayName = 'SongCard';
export default SongCard;
