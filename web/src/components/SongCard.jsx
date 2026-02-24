import React, { useState, memo } from 'react';
import { Play, Download, Share2, Music, Trash2, Pencil, Check, X, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/LikeButton';
import ReportButton from './ReportButton';
import { supabase } from '@/lib/supabaseClient';

const SongCard = memo(({ song, onPlay, isPlaying, setCurrentSong, currentSong, showDelete, onDelete, onUpdated }) => {
  const { currentUser } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm state
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const startEdit = (e) => {
    e.stopPropagation();
    setEditTitle(song.title);
    setEditArtist(song.artist || '');
    setEditError('');
    setEditing(true);
    setConfirmDelete(false);
  };

  const cancelEdit = (e) => {
    e && e.stopPropagation();
    setEditing(false);
    setEditError('');
  };

  const handleUpdate = async (e) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditError('Le titre est requis.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const { error } = await supabase
        .from('songs')
        .update({ title: editTitle.trim(), artist: editArtist.trim() })
        .eq('id', song.id)
        .eq('uploader_id', currentUser.id);
      if (error) throw error;
      setEditing(false);
      if (onUpdated) onUpdated(song.id, { title: editTitle.trim(), artist: editArtist.trim() });
    } catch (err) {
      setEditError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setEditLoading(false);
    }
  };

  // Le bouton modifier/supprimer n'apparaît que pour l'uploader
  const isOwner = showDelete && onDelete && currentUser && song.uploader_id === currentUser.id;

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

        {isHovered && !editing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform hover:scale-110 transition-all shadow-lg shadow-cyan-500/50"
            >
              <Play className="w-8 h-8 text-white fill-current" />
            </button>
          </div>
        )}

        {isPlaying && (
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
        )}
      </div>

      <div className="p-4">
        {/* Mode édition */}
        {editing ? (
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            {editError && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {editError}
              </div>
            )}
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Titre"
              className="w-full px-2 py-1.5 bg-gray-800 border border-cyan-500/40 rounded-lg text-white text-sm font-semibold focus:outline-none focus:border-cyan-400 transition-all"
            />
            <input
              type="text"
              value={editArtist}
              onChange={e => setEditArtist(e.target.value)}
              placeholder="Artiste"
              className="w-full px-2 py-1.5 bg-gray-800 border border-cyan-500/40 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-cyan-400 transition-all"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={cancelEdit}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleUpdate}
                disabled={editLoading}
                className="p-1.5 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-60"
                title="Enregistrer"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-white font-semibold truncate text-lg">{song.title}</h3>
            <p className="text-gray-400 text-sm truncate mb-3">{song.artist}</p>

            <div className="flex items-center justify-between mt-2">
              <LikeButton
                songId={song.id}
                initialLikes={song.likes_count || 0}
              />
              <div className="flex items-center gap-2">
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

                {/* Boutons propriétaire : Modifier + Supprimer */}
                {isOwner && (
                  <>
                    <button
                      onClick={startEdit}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {confirmDelete ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(song.id); setConfirmDelete(false); }}
                          className="text-xs px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                        >
                          Oui
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                          className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {song.plays_count || 0} plays
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

SongCard.displayName = 'SongCard';

export default SongCard;
