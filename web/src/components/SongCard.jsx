import React, { useState, memo } from 'react';
import { Play, Download, Share2, Music, Headphones, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/LikeButton';
import FavoriteButton from '@/components/FavoriteButton';
import ReportButton from './ReportButton';
import SongShareModal from '@/components/SongShareModal';
import SongActionsMenu from '@/components/SongActionsMenu';
import { formatPlays } from '@/lib/utils';

const SongCard = memo(({ song: initialSong, onPlay, isPlaying, setCurrentSong, currentSong, onArchived, onDeleted }) => {
  const { currentUser } = useAuth();
  const [song, setSong] = useState(initialSong);
  const [isHovered, setIsHovered] = useState(false);
  const [showShare, setShowShare] = useState(false);

  React.useEffect(() => { setSong(initialSong); }, [initialSong]);

  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (song.is_archived) return;
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
        className={`bg-gray-900/80 border rounded-xl transition-all group relative ${song.is_archived ? 'border-amber-500/40 opacity-70' : 'border-cyan-500/30 hover:border-cyan-400'}`}
        style={{ overflow: 'visible' }}
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
        <div className="relative aspect-square rounded-t-xl overflow-hidden">
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

          {/* Bouton Play — toujours visible sur mobile, hover sur desktop */}
          {!song.is_archived && (
            <div className="absolute inset-0 bg-black/40 md:bg-transparent md:group-hover:bg-black/50 flex items-center justify-center transition-all duration-200">
              <button
                onClick={handlePlay}
                className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform md:scale-90 md:opacity-0 md:group-hover:scale-100 md:group-hover:opacity-100 active:scale-95 transition-all duration-200 shadow-xl shadow-cyan-500/40"
                aria-label="Lancer la lecture"
              >
                <Play className="w-8 h-8 text-white fill-current" />
              </button>
            </div>
          )}
          {song.is_archived && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* Lien page dédiée — coin haut droite, toujours visible */}
          <Link
            to={`/song/${song.id}`}
            onClick={e => e.stopPropagation()}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white hover:bg-black/80 transition-all z-10"
            title="Voir la page du son & commenter"
            aria-label="Voir la page du son"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Infos */}
        <div className="p-4">
          {/* Titre → page du son */}
          <Link
            to={`/song/${song.id}`}
            onClick={e => e.stopPropagation()}
            className="text-white font-semibold truncate text-base block hover:text-cyan-400 transition-colors"
          >
            {song.title}
          </Link>

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
                  <FavoriteButton songId={song.id} size="sm" />
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
