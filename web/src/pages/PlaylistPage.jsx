/**
 * PlaylistPage — NovaSound TITAN LUX v60
 * Page d'une playlist : liste des sons, lecture, gestion.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlaylist } from '@/contexts/PlaylistContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Play, Pause, Music, ListMusic, Lock, Globe, Trash2,
  Edit2, Check, X, Loader2, ArrowLeft, Shuffle, Users,
} from 'lucide-react';

const PlaylistPage = () => {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { currentUser } = useAuth();
  const { playSong, currentSong, isVisible, removeFromPlaylist, currentPlaylistId } = usePlayer();
  const { deletePlaylist, removeSongFromPlaylist, updatePlaylist } = usePlaylist();

  const [playlist,   setPlaylist]   = useState(null);
  const [songs,      setSongs]      = useState([]);
  const [owner,      setOwner]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editMode,   setEditMode]   = useState(false);
  const [editName,   setEditName]   = useState('');
  const [editDesc,   setEditDesc]   = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const isOwner = currentUser && playlist?.owner_id === currentUser.id;

  useEffect(() => { fetchPlaylist(); }, [id]);

  // Synchro bidirectionnelle : si le PlayerContext retire un son depuis le mini-player, répercuter ici
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.playlistId === id && e.detail?.songId) {
        setSongs(prev => prev.filter(s => s.id !== e.detail.songId));
      }
    };
    window.addEventListener('novasound:playlist-song-removed', handler);
    return () => window.removeEventListener('novasound:playlist-song-removed', handler);
  }, []);

  // Mettre à jour les songs si un titre/artiste est edite
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, [id]);

  // Rafraîchir si un son est ajouté à CETTE playlist depuis AddToPlaylistModal
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.playlistId !== id) return;
      const newSong = e.detail?.song;
      if (!newSong) return;
      setSongs(prev => {
        if (prev.find(s => s.id === newSong.id)) return prev; // déjà présent
        return [...prev, newSong];
      });
    };
    window.addEventListener('novasound:playlist-song-added', handler);
    return () => window.removeEventListener('novasound:playlist-song-added', handler);
  }, [id]);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const { data: pl, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !pl) { navigate('/'); return; }
      setPlaylist(pl);
      setEditName(pl.name);
      setEditDesc(pl.description || '');
      setEditPublic(pl.is_public);

      // Owner info
      const { data: ownerData } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', pl.owner_id)
        .single();
      setOwner(ownerData);

      // Songs
      const { data: psData } = await supabase
        .from('playlist_songs')
        .select('position, song_id, songs(*)')
        .eq('playlist_id', id)
        .order('position', { ascending: true });
      setSongs((psData || []).map(r => r.songs).filter(Boolean));
    } catch { navigate('/'); }
    finally { setLoading(false); }
  };

  const handlePlayAll = (startIdx = 0) => {
    if (!songs.length) return;
    const ordered = songs.slice(startIdx);
    playSong(ordered[0], ordered, id);
  };

  const handlePlayShuffle = () => {
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    playSong(shuffled[0], shuffled, id);
  };

  const handleRemoveSong = async (songId) => {
    await removeSongFromPlaylist(id, songId);
    setSongs(prev => prev.filter(s => s.id !== songId));
    // Synchro avec le player si c'est cette playlist qui est lue
    if (currentPlaylistId === id) {
      removeFromPlaylist(songId);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const updated = await updatePlaylist(id, {
      name: editName.trim(),
      description: editDesc.trim(),
      is_public: editPublic,
    });
    if (updated) { setPlaylist(prev => ({ ...prev, ...updated })); }
    setSaving(false);
    setEditMode(false);
  };

  const handleDelete = async () => {
    await deletePlaylist(id);
    navigate('/profile');
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-36 md:pb-28">
      <Helmet>
        <title>{playlist?.name || 'Playlist'} — NovaSound</title>
      </Helmet>
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour
        </button>

        {/* Hero playlist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row gap-6 mb-8 p-5 bg-gray-900/60 border border-white/8 rounded-3xl"
        >
          {/* Cover */}
          <div className="w-full sm:w-40 h-40 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center border border-white/10">
            {playlist?.cover_url
              ? <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
              : <ListMusic className="w-16 h-16 text-gray-600" />
            }
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {!editMode ? (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Playlist</span>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${playlist?.is_public ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-gray-800 text-gray-500 border border-white/10'}`}>
                      {playlist?.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {playlist?.is_public ? 'Publique' : 'Privée'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 break-words">{playlist?.name}</h1>
                  {playlist?.description && (
                    <p className="text-gray-400 text-sm mb-2 leading-relaxed">{playlist.description}</p>
                  )}
                  {owner && (
                    <Link to={`/artist/${owner.id}`} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors w-fit">
                      {owner.avatar_url
                        ? <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        : <Users className="w-4 h-4" />
                      }
                      <span className="text-xs">{owner.username}</span>
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-gray-600 text-sm">{songs.length} son{songs.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1" />
                  {songs.length > 0 && (
                    <>
                      <button onClick={() => handlePlayAll(0)}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
                        <Play className="w-4 h-4 fill-current" /> Lire tout
                      </button>
                      <button onClick={handlePlayShuffle}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-semibold px-4 py-2.5 rounded-full text-sm transition-all active:scale-95">
                        <Shuffle className="w-4 h-4" /> Aléatoire
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <>
                      <button onClick={() => setEditMode(true)}
                        className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDel(true)}
                        className="p-2.5 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Mode édition */
              <div className="space-y-3">
                <input
                  ref={el => el && setTimeout(() => el.focus(), 50)}
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Nom de la playlist"
                  maxLength={60}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-lg placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description (optionnelle)"
                  rows={2}
                  maxLength={200}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditPublic(!editPublic)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${editPublic ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-gray-500'}`}>
                    {editPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {editPublic ? 'Publique' : 'Privée'}
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => setEditMode(false)} className="p-2 text-gray-500 hover:text-white rounded-lg"><X className="w-4 h-4" /></button>
                  <button onClick={handleSaveEdit} disabled={saving || !editName.trim()}
                    className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-4 py-2 rounded-full text-sm disabled:opacity-50 transition-all">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Liste des sons */}
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Music className="w-16 h-16 text-gray-800 mb-4" />
            <p className="text-gray-500 font-medium">Cette playlist est vide</p>
            <p className="text-gray-700 text-sm mt-1">Ajoute des sons depuis l'Explorer ou une fiche son</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {songs.map((song, idx) => {
              const isNowPlaying = currentSong?.id === song.id && isVisible;
              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group cursor-pointer ${isNowPlaying ? 'bg-cyan-500/10 border border-cyan-500/25' : 'hover:bg-white/[0.04] border border-transparent hover:border-white/8'}`}
                  onClick={() => handlePlayAll(idx)}
                >
                  {/* Numéro / play icon */}
                  <div className="w-6 text-center flex-shrink-0">
                    {isNowPlaying ? (
                      <div className="flex gap-px items-end h-3.5 justify-center">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-0.5 bg-cyan-400 rounded-full"
                            style={{ height: `${6 + i * 2}px`, animation: `equalizer ${0.5 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 0.08}s` }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <span className="text-gray-600 text-sm tabular-nums group-hover:hidden">{idx + 1}</span>
                        <Play className="w-3.5 h-3.5 text-white hidden group-hover:block mx-auto fill-current" />
                      </>
                    )}
                  </div>

                  {/* Cover */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow">
                    {song.cover_url
                      ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center"><Music className="w-4 h-4 text-white" /></div>
                    }
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isNowPlaying ? 'text-cyan-300' : 'text-white'}`}>{song.title}</p>
                    <p className="text-gray-500 text-xs truncate">{song.artist}</p>
                  </div>

                  {/* Durée + remove */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {song.duration_s && (
                      <span className="text-gray-600 text-xs tabular-nums">
                        {Math.floor(song.duration_s / 60)}:{String(song.duration_s % 60).padStart(2,'0')}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRemoveSong(song.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
                        title="Retirer de la playlist"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation suppression — remplace window.confirm (bloqué en iOS PWA standalone) */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={() => setConfirmDel(false)}
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
                  <p className="text-gray-500 text-xs mt-0.5">« {playlist?.name} »</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-5">Cette action est irréversible. Tous les sons seront retirés de la playlist.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold transition-all">
                  Annuler
                </button>
                <button onClick={() => { setConfirmDel(false); handleDelete(); }} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all">
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default PlaylistPage;
