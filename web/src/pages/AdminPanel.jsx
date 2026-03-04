/**
 * AdminPanel — NovaSound TITAN LUX v9000
 * Panneau administrateur complet : ban users, delete songs, stop live, clear chat, reports
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, Trash2, Settings, AlertCircle, CheckCircle, Clock,
  Music, MessageSquare, FileAudio, UserCheck, Radio, RefreshCw,
  XCircle, Search, Lock, Unlock, Ban,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import AdminConfirmDialog from '@/components/AdminConfirmDialog';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

const AdminPanel = () => {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ users: 0, songs: 0, liveRooms: 0, messages: 0, reports: 0 });
  const [liveRooms,  setLiveRooms]  = useState([]);
  const [users,      setUsers]      = useState([]);
  const [songs,      setSongs]      = useState([]);
  const [reports,    setReports]    = useState([]);
  const [chatMsgs,   setChatMsgs]   = useState([]);
  const [actionMsg,  setActionMsg]  = useState('');
  const showAction = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  // États pour les dialogues de confirmation
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmer',
    cancelText: 'Annuler'
  });

  const showConfirmDialog = (options) => {
    setConfirmDialog({
      isOpen: true,
      type: options.type || 'danger',
      title: options.title,
      message: options.message,
      onConfirm: options.onConfirm,
      confirmText: options.confirmText || 'Confirmer',
      cancelText: options.cancelText || 'Annuler'
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const isAdminEmail = currentUser.email === ADMIN_EMAIL || currentUser.user_metadata?.email === ADMIN_EMAIL;
    if (isAdminEmail) { setIsAdmin(true); setLoading(false); return; }
    // Vérification secondaire via user_roles (si pas admin email)
    supabase.from('user_roles').select('role').eq('user_id', currentUser.id).eq('role', 'admin').eq('is_active', true).maybeSingle()
      .then(({ data }) => { if (data) setIsAdmin(true); }).catch(() => {}).finally(() => setLoading(false));
  }, [currentUser]);

  const loadStats = useCallback(async () => {
    try {
      const [u, s, lr, m] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('live_rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      ]);
      setStats({ users: u.count||0, songs: s.count||0, liveRooms: lr.count||0, messages: m.count||0 });
    } catch {}
  }, []);

  const loadLiveRooms = useCallback(async () => {
    try {
      const { data } = await supabase.from('live_rooms').select('*, host:users!host_id(username, avatar_url, email)').order('created_at', { ascending: false }).limit(30);
      setLiveRooms(data || []);
    } catch {}
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await supabase.from('users').select('id, username, avatar_url, email, created_at, is_banned').order('created_at', { ascending: false }).limit(100);
      setUsers(data || []);
    } catch {}
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      const { data } = await supabase.from('songs').select('id, title, artist, cover_url, plays_count, is_archived, created_at').order('created_at', { ascending: false }).limit(100);
      setSongs(data || []);
    } catch {}
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const { data } = await supabase.from('chat_messages').select('*, user:user_id(username, avatar_url)').eq('is_deleted', false).order('created_at', { ascending: false }).limit(50);
      setChatMsgs(data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadStats(); loadLiveRooms(); loadUsers(); loadSongs(); loadChat();
  }, [isAdmin]);

  const stopLiveRoom = async (room) => {
    try {
      await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', room.id);
      showAction(`✅ Live "${room.name}" arrêté`);
      loadLiveRooms(); loadStats();
    } catch (e) { showAction(`❌ ${e.message}`); }
  };

  const deleteLiveRoom = async (roomId) => {
    showConfirmDialog({
      type: 'radio',
      title: 'Supprimer une salle live',
      message: 'Êtes-vous sûr de vouloir supprimer cette salle live ?\n\nTous les participants seront déconnectés et la salle sera définitivement supprimée.',
      confirmText: 'Supprimer',
      onConfirm: async () => {
        try {
          await supabase.from('live_rooms').delete().eq('id', roomId);
          showAction('✅ Salle supprimée');
          loadLiveRooms();
          loadStats();
        } catch (e) {
          showAction(`❌ ${e.message}`);
        }
      }
    });
  };

  const cleanupInactiveRooms = async () => {
    try { await supabase.from('live_rooms').delete().eq('is_active', false); showAction('✅ Salles inactives supprimées'); loadLiveRooms(); loadStats(); } catch (e) { showAction(`❌ ${e.message}`); }
  };

  const toggleBanUser = async (user) => {
    const newBan = !user.is_banned;
    if (newBan) {
      showConfirmDialog({
        type: 'ban',
        title: 'Bannir un utilisateur',
        message: `Êtes-vous sûr de vouloir bannir ${user.username || user.email} ?\n\nL'utilisateur ne pourra plus accéder à la plateforme.`,
        confirmText: 'Bannir',
        onConfirm: async () => {
          try {
            await supabase.from('users').update({ is_banned: newBan }).eq('id', user.id);
            showAction(`🚫 ${user.username} banni`);
            loadUsers();
          } catch (e) {
            showAction(`❌ ${e.message}`);
          }
        }
      });
    } else {
      try {
        await supabase.from('users').update({ is_banned: newBan }).eq('id', user.id);
        showAction(`✅ ${user.username} débanni`);
        loadUsers();
      } catch (e) {
        showAction(`❌ ${e.message}`);
      }
    }
  };

  const deleteSong = async (song) => {
    showConfirmDialog({
      type: 'danger',
      title: 'Archiver une musique',
      message: `Êtes-vous sûr de vouloir archiver "${song.title}" de ${song.artist} ?\n\nLa musique ne sera plus visible mais ne sera pas définitivement supprimée.`,
      confirmText: 'Archiver',
      onConfirm: async () => {
        try {
          await supabase.from('songs').update({ is_archived: true }).eq('id', song.id);
          showAction(`📦 "${song.title}" archivé`);
          loadSongs();
          loadStats();
        } catch (e) {
          showAction(`❌ ${e.message}`);
        }
      }
    });
  };

  const deleteChatMsg = async (id) => {
    try { await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', id); setChatMsgs(p => p.filter(m => m.id !== id)); } catch {}
  };

  const clearAllChat = async () => {
    showConfirmDialog({
      type: 'chat',
      title: 'Nettoyer le chat global',
      message: 'Êtes-vous sûr de vouloir effacer TOUS les messages du chat global ?\n\nCette action est irréversible et affectera tous les utilisateurs.',
      confirmText: 'Nettoyer',
      onConfirm: async () => {
        try {
          await supabase.from('chat_messages').update({ is_deleted: true }).eq('is_deleted', false);
          showAction('🧹 Chat nettoyé');
          loadChat();
          loadStats();
        } catch (e) {
          showAction(`❌ ${e.message}`);
        }
      }
    });
  };

  const q = searchQuery.toLowerCase();
  const filteredUsers = users.filter(u => !q || (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  const filteredSongs = songs.filter(s => !q || (s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q));

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" /></div>;

  if (!isAdmin) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center"><Shield className="w-16 h-16 text-red-500 mx-auto mb-4" /><h1 className="text-2xl font-bold text-white mb-2">Accès refusé</h1><p className="text-gray-400">Vous n'avez pas les permissions administrateur</p></div>
    </div>
  );

  const TABS = [
    { k: 'overview', l: '📊 Vue d\'ensemble' },
    { k: 'live-rooms', l: '🔴 Lives' },
    { k: 'users', l: '👥 Utilisateurs' },
    { k: 'songs', l: '🎵 Musiques' },
    { k: 'chat', l: '💬 Chat' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-cyan-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Panneau d'administration</h1>
            <p className="text-xs text-gray-500">NovaSound TITAN LUX v9000 · {currentUser?.email}</p>
          </div>
        </div>

        <AnimatePresence>
          {actionMsg && (
            <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="mb-4 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-sm font-medium">
              {actionMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50" />
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(({ k, l }) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === k ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 text-white border border-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              {l}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users,         color: 'text-blue-400',   val: stats.users,     label: 'Utilisateurs' },
              { icon: Music,         color: 'text-green-400',  val: stats.songs,     label: 'Musiques' },
              { icon: Radio,         color: 'text-red-400',    val: stats.liveRooms, label: 'Lives actifs' },
              { icon: MessageSquare, color: 'text-purple-400', val: stats.messages,  label: 'Messages chat' },
            ].map(({ icon: Icon, color, val, label }) => (
              <div key={label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-2"><Icon className={`w-6 h-6 ${color}`} /><span className="text-2xl font-black">{val}</span></div>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-sm font-bold mb-3 text-gray-300">⚡ Actions rapides</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={cleanupInactiveRooms} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-all"><Trash2 className="w-3.5 h-3.5" /> Nettoyer lives inactifs</button>
                <button onClick={clearAllChat} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/25 text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-500/25 transition-all"><MessageSquare className="w-3.5 h-3.5" /> Vider le chat</button>
                <button onClick={() => { loadStats(); loadLiveRooms(); loadUsers(); loadSongs(); loadChat(); showAction('✅ Données actualisées'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/25 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Actualiser</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'live-rooms' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Salles live ({liveRooms.length})</h2>
              <button onClick={cleanupInactiveRooms} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/25 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-all"><Trash2 className="w-3.5 h-3.5" /> Nettoyer inactives</button>
            </div>
            <div className="space-y-3">
              {liveRooms.length === 0 && <p className="text-gray-500 text-sm">Aucune salle live.</p>}
              {liveRooms.map(room => (
                <div key={room.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${room.is_active ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                        <span className="text-white font-semibold truncate">{room.name || 'Sans nom'}</span>
                      </div>
                      <p className="text-gray-400 text-xs">Hôte: {room.host?.username || '?'} · {room.participants_count} participants · {new Date(room.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {room.is_active && (
                        <button onClick={() => stopLiveRoom(room)} className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/35 transition-all">
                          <XCircle className="w-3.5 h-3.5" /> Stopper
                        </button>
                      )}
                      <button onClick={() => deleteLiveRoom(room.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-lg font-bold mb-4">Utilisateurs ({filteredUsers.length})</h2>
            <div className="space-y-2">
              {filteredUsers.map(user => (
                <div key={user.id} className={`bg-gray-900 rounded-xl p-4 border transition-all ${user.is_banned ? 'border-red-500/30' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-3">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-gray-500" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate">{user.username || '?'}</span>
                        {user.is_banned && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">BANNI</span>}
                        {user.email === ADMIN_EMAIL && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>}
                      </div>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>
                    {user.email !== ADMIN_EMAIL && (
                      <button onClick={() => toggleBanUser(user)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${user.is_banned ? 'bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25' : 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25'}`}>
                        {user.is_banned ? <><Unlock className="w-3.5 h-3.5" /> Débannir</> : <><Ban className="w-3.5 h-3.5" /> Bannir</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'songs' && (
          <div>
            <h2 className="text-lg font-bold mb-4">Musiques ({filteredSongs.length})</h2>
            <div className="space-y-2">
              {filteredSongs.map(song => (
                <div key={song.id} className={`bg-gray-900 rounded-xl p-3 border transition-all ${song.is_archived ? 'border-gray-700/50 opacity-60' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                      {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-gray-600" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{song.title}</p>
                      <p className="text-gray-500 text-xs">{song.artist} · {song.plays_count || 0} écoutes</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => deleteSong(song)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Chat global ({chatMsgs.length} messages récents)</h2>
              <button onClick={clearAllChat} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/25 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/25 transition-all"><Trash2 className="w-3.5 h-3.5" /> Tout vider</button>
            </div>
            <div className="space-y-2">
              {chatMsgs.map(msg => (
                <div key={msg.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 text-xs flex items-center justify-center text-gray-400">
                    {msg.user?.avatar_url ? <img src={msg.user.avatar_url} alt="" className="w-full h-full object-cover" /> : (msg.user?.username||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-cyan-400 text-xs font-bold">{msg.user?.username || '?'}</span>
                    <span className="text-gray-600 text-xs ml-2">{new Date(msg.created_at).toLocaleString('fr-FR')}</span>
                    <p className="text-gray-300 text-sm mt-0.5 break-words">{msg.content}</p>
                  </div>
                  <button onClick={() => deleteChatMsg(msg.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
