import React, { useState, memo, useEffect } from 'react';
import { Play, Download, Share2, Music, Headphones, ExternalLink, Plus, Check, MessageCircle, ListMusic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/lib/supabaseClient';
import LikeButton from '@/components/LikeButton';
import FavoriteButton from '@/components/FavoriteButton';
import ReportButton from './ReportButton';
import SongShareModal from '@/components/SongShareModal';
import SongActionsMenu from '@/components/SongActionsMenu';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import { formatPlays } from '@/lib/utils';

const fmtDuration = (s) => {
  if (!s || s <= 0 || isNaN(s)) return '--:--';
  const minutes = Math.floor(s / 60);
  const seconds = Math.floor(s % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const SongCard = memo(({ song: initialSong, onPlay, isPlaying, setCurrentSong, currentSong, onArchived, onDeleted }) => {
  const { currentUser } = useAuth();
  const { addToQueue } = usePlayer();
  const [song, setSong] = useState(initialSong);
  const [isHovered, setIsHovered] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [queueFlash, setQueueFlash] = useState(false);
  const [commentCount, setCommentCount] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  React.useEffect(() => { setSong(initialSong); }, [initialSong]);

  // Charger le nb de commentaires une seule fois (lazy, pas bloquant)
  useEffect(() => {
    if (!song?.id) return;
    let cancelled = false;
    supabase
      .from('song_comments')
      .select('id', { count: 'exact', head: true })
      .eq('song_id', song.id)
      .then(({ count }) => {
        if (!cancelled) setCommentCount(count ?? 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song?.id]);

  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (song.is_archived) return;
    if (onPlay) onPlay(song);
    else if (setCurrentSong) setCurrentSong(song);
  };

  const handleAddToQueue = (e) => {
    e.stopPropagation();
    if (song.is_archived) return;
    addToQueue(song);
    setQueueFlash(true);
    setTimeout(() => setQueueFlash(false), 1200);
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

  const durationStr = fmtDuration(song.duration_s);

  return (
    <>
      <div
        className={`bg-gray-900/80 border rounded-xl transition-all group relative ${song.is_archived ? 'border-amber-500/40 opacity-70' : 'border-cyan-500/30 hover:border-cyan-400'}`}
        style={{ overflow: 'visible' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {song.is_archived && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <span className="text-[10px] text-white font-bold tracking-wide">ARCHIVÉ</span>
          </div>
        )}

        {/* Pochette */}
        <div className="relative aspect-square rounded-t-xl overflow-hidden">
          {song.cover_url ? (
            <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
              <Music className="w-16 h-16 text-white" />
            </div>
          )}

          {!song.is_archived && (
            <div className="absolute inset-0 bg-black/40 md:bg-transparent md:group-hover:bg-black/50 flex items-center justify-center transition-all duration-200">
              <button onClick={handlePlay}
                className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform md:scale-90 md:opacity-0 md:group-hover:scale-100 md:group-hover:opacity-100 active:scale-95 transition-all duration-200 shadow-xl shadow-cyan-500/40"
                aria-label="Lancer la lecture">
                <Play className="w-8 h-8 text-white fill-current" />
              </button>
            </div>
          )}

          {isPlaying && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full border border-cyan-400/30">
              <div className="flex gap-px items-end h-3.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-0.5 bg-cyan-400 rounded-full"
                    style={{
                      height: `${6 + i * 2}px`,
                      animation: `equalizer ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.08}s`
                    }} />
                ))}
              </div>
              <span className="text-[9px] text-cyan-300 font-bold ml-0.5">LIVE</span>
            </div>
          )}

          {/* Badge plays */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <Headphones className="w-3 h-3 text-cyan-400" />
            <span className="text-xs text-cyan-300 font-medium">{formatPlays(song.plays_count)}</span>
          </div>

          {/* Durée */}
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-gray-300 tabular-nums font-medium">
            {durationStr}
          </div>

          {/* Page son */}
          <Link to={`/song/${song.id}`} onClick={e => e.stopPropagation()}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-cyan-500 hover:text-white transition-all z-20"
            title="Voir la page du son" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Infos */}
        <div className="p-3.5">
          <Link to={`/song/${song.id}`} onClick={e => e.stopPropagation()}
            className="text-white font-semibold truncate text-sm block hover:text-cyan-400 transition-colors">
            {song.title}
          </Link>

          {song.uploader_id ? (
            <Link to={`/artist/${song.uploader_id}`}
              className="text-gray-400 text-xs truncate block hover:text-cyan-400 transition-colors mt-0.5"
              onClick={e => e.stopPropagation()}>
              {song.artist}
            </Link>
          ) : (
            <p className="text-gray-400 text-xs truncate mt-0.5">{song.artist}</p>
          )}

          {/* Genre badge */}
          {song.genre && (
            <div className="mt-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-block">
                {song.genre}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2">
              <LikeButton songId={song.id} initialLikes={song.likes_count || 0} />
              {commentCount !== null && commentCount > 0 && (
                <Link
                  to={`/chat?tagger=${song.artist?.replace(/\s+/g, '_') || 'unknown'}`}
                  className="flex items-center gap-1 text-gray-500 hover:text-cyan-400 transition-colors"
                  title={`${commentCount} commentaire${commentCount > 1 ? 's' : ''}`}
                  onClick={e => e.stopPropagation()}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">{commentCount}</span>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!song.is_archived && (
                <>
                  <FavoriteButton songId={song.id} size="sm" />
                  {/* ⊕ Ajouter à la file */}
                  <button onClick={handleAddToQueue}
                    className={`transition-all p-1 rounded-md ${queueFlash ? 'text-cyan-400 bg-cyan-500/15' : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10'}`}
                    title="Ajouter à la file d'attente">
                    {queueFlash ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                  {/* 🎵 Ajouter à une playlist */}
                  {currentUser && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowPlaylistModal(true); }}
                      className="text-gray-400 hover:text-magenta-400 transition-colors p-1 rounded-md hover:bg-magenta-500/10"
                      title="Ajouter à une playlist"
                    >
                      <ListMusic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={handleDownload} className="text-gray-400 hover:text-cyan-400 transition-colors p-1" title="Télécharger">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors p-1" title="Partager">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <ReportButton contentType="song" contentId={song.id} />
                </>
              )}
              <SongActionsMenu
                song={song}
                onArchived={(id, isArch) => { setSong((s) => ({ ...s, is_archived: isArch })); onArchived?.(id, isArch); }}
                onDeleted={(id) => { onDeleted?.(id); }}
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showShare && <SongShareModal song={song} onClose={() => setShowShare(false)} />}
        {showPlaylistModal && <AddToPlaylistModal song={song} onClose={() => setShowPlaylistModal(false)} />}
      </AnimatePresence>
    </>
  );
});

SongCard.displayName = 'SongCard';
export default SongCard;
