/**
 * MyPlaylistsPage — NovaSound TITAN LUX v60
 * Page de gestion des playlists de l'utilisateur.
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePlaylist } from '@/contexts/PlaylistContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Plus, ListMusic, Lock, Globe, Loader2, Trash2,
  Play, ArrowLeft, Music,
} from 'lucide-react';

const MyPlaylistsPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { myPlaylists, loadingPl, fetchMyPlaylists, createPlaylist, deletePlaylist } = usePlaylist();

  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newDesc,     setNewDesc]     = useState('');
  const [isPublic,    setIsPublic]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // playlist à supprimer

  useEffect(() => {
    if (currentUser) fetchMyPlaylists();
  }, [currentUser, fetchMyPlaylists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await createPlaylist({ name: newName, description: newDesc, is_public: isPublic });
    setNewName(''); setNewDesc(''); setIsPublic(true);
    setShowCreate(false);
    setSaving(false);
  };

  const handleDelete = async (e, pl) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmTarget(pl);
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    await deletePlaylist(confirmTarget.id);
    setConfirmTarget(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-28">
      <Helmet><title>Mes Playlists — NovaSound</title></Helmet>
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Mes Playlists</h1>
            <p className="text-gray-600 text-sm mt-0.5">{myPlaylists.length} playlist{myPlaylists.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-400 hover:to-magenta-400 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        </div>

        {/* Formulaire création */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-gray-900/80 border border-white/10 rounded-2xl p-5 space-y-3">
                <h3 className="text-white font-bold text-sm">Nouvelle playlist</h3>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                  placeholder="Nom de la playlist…"
                  maxLength={60}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description (optionnelle)"
                  rows={2}
                  maxLength={200}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
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
                  <button onClick={() => setShowCreate(false)} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Annuler</button>
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || saving}
                    className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-5 py-2 rounded-full text-sm disabled:opacity-50 transition-all"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Créer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste playlists */}
        {loadingPl ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : myPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ListMusic className="w-20 h-20 text-gray-800 mb-5" />
            <p className="text-gray-500 font-semibold text-lg">Aucune playlist</p>
            <p className="text-gray-700 text-sm mt-1 max-w-xs">Crée ta première playlist et organise tes sons favoris</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-magenta-500 text-white font-bold px-6 py-3 rounded-full text-sm transition-all shadow-lg hover:from-cyan-400 hover:to-magenta-400 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Créer ma première playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myPlaylists.map((pl, idx) => (
              <motion.div
                key={pl.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link
                  to={`/playlist/${pl.id}`}
                  className="flex items-center gap-4 p-4 bg-gray-900/60 border border-white/8 rounded-2xl hover:border-cyan-500/25 hover:bg-gray-900/90 transition-all group"
                >
                  {/* Cover */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-cyan-500/20 to-magenta-500/20 flex items-center justify-center border border-white/8">
                    {pl.cover_url
                      ? <img src={pl.cover_url} alt="" className="w-full h-full object-cover" />
                      : <ListMusic className="w-8 h-8 text-gray-600" />
                    }
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate group-hover:text-cyan-300 transition-colors">{pl.name}</p>
                    {pl.description && (
                      <p className="text-gray-500 text-xs truncate mt-0.5">{pl.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {pl.is_public
                        ? <Globe className="w-3 h-3 text-cyan-500/60" />
                        : <Lock className="w-3 h-3 text-gray-600" />
                      }
                      <span className="text-[10px] text-gray-600">{pl.is_public ? 'Publique' : 'Privée'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => handleDelete(e, pl)}
                      className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {/* Confirmation suppression — remplace window.confirm (bloqué en iOS PWA standalone) */}
      <AnimatePresence>
        {confirmTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={() => setConfirmTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-bold">Supprimer la playlist ?</p>
                  <p className="text-gray-500 text-xs mt-0.5">« {confirmTarget.name} »</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-5">Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold transition-all">
                  Annuler
                </button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all">
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyPlaylistsPage;
