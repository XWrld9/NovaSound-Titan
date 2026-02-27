/**
 * AddToPlaylistModal — NovaSound TITAN LUX v60
 * Modal pour ajouter un son à une playlist existante ou en créer une nouvelle.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ListMusic, Check, Lock, Globe, Loader2, Music } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlaylist } from '@/contexts/PlaylistContext';

const AddToPlaylistModal = ({ song, onClose }) => {
  const { currentUser } = useAuth();
  const { myPlaylists, loadingPl, fetchMyPlaylists, createPlaylist, addSongToPlaylist } = usePlaylist();

  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState('');
  const [isPublic,    setIsPublic]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [addedIds,    setAddedIds]    = useState(new Set());
  const [feedback,    setFeedback]    = useState('');

  useEffect(() => {
    if (currentUser) fetchMyPlaylists();
  }, [currentUser, fetchMyPlaylists]);

  const handleAdd = async (playlist) => {
    if (addedIds.has(playlist.id)) return;
    setSaving(true);
    const ok = await addSongToPlaylist(playlist.id, song.id);
    if (ok) {
      setAddedIds(prev => new Set([...prev, playlist.id]));
      setFeedback(`Ajouté à « ${playlist.name} »`);
      setTimeout(() => setFeedback(''), 2000);
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const pl = await createPlaylist({ name: newName, is_public: isPublic });
    if (pl) {
      await addSongToPlaylist(pl.id, song.id);
      setAddedIds(prev => new Set([...prev, pl.id]));
      setFeedback(`Playlist « ${pl.name} » créée !`);
      setTimeout(() => setFeedback(''), 2000);
    }
    setNewName('');
    setCreating(false);
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-md bg-gray-950 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
              {song.cover_url
                ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center"><Music className="w-4 h-4 text-white" /></div>
              }
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{song.title}</p>
              <p className="text-gray-500 text-xs truncate">{song.artist}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors rounded-xl hover:bg-white/8">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 py-2 bg-cyan-500/15 border-b border-cyan-500/20 text-cyan-300 text-sm flex items-center gap-2"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste playlists */}
        <div className="overflow-y-auto" style={{ maxHeight: '40vh', WebkitOverflowScrolling: 'touch' }}>
          {loadingPl ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
          ) : myPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <ListMusic className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">Aucune playlist pour l'instant</p>
              <p className="text-gray-600 text-xs mt-1">Crée ta première playlist ci-dessous</p>
            </div>
          ) : (
            myPlaylists.map(pl => {
              const added = addedIds.has(pl.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => handleAdd(pl)}
                  disabled={saving || added}
                  className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${added ? 'opacity-70 cursor-default' : 'hover:bg-white/[0.04]'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <ListMusic className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{pl.name}</p>
                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                      {pl.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {pl.is_public ? 'Publique' : 'Privée'}
                    </p>
                  </div>
                  {added && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Créer une nouvelle playlist */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-semibold py-2 px-3 rounded-xl hover:bg-cyan-500/10"
            >
              <Plus className="w-4 h-4" />
              Nouvelle playlist
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Nom de la playlist…"
                maxLength={60}
                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${isPublic ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-gray-500'}`}
                >
                  {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {isPublic ? 'Publique' : 'Privée'}
                </button>
                <div className="flex-1" />
                <button onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="text-xs bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Créer
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AddToPlaylistModal;
