import React, { useState, useEffect } from 'react';
import { Users, Shield, Trash2, Settings, AlertCircle, CheckCircle, Clock, Music, MessageSquare, FileAudio, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const AdminPanel = () => {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    songs: 0,
    liveRooms: 0,
    messages: 0
  });
  const [liveRooms, setLiveRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    checkAdminAccess();
    loadStats();
    loadLiveRooms();
    loadUsers();
  }, []);

  const checkAdminAccess = async () => {
    if (!currentUser) return;
    
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .single();

      // Vérification hardcodée pour eloadxfamily@gmail.com
      if (currentUser.email === 'eloadxfamily@gmail.com' || roleData) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('Erreur vérification admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [usersCount, songsCount, liveRoomsCount, messagesCount] = await Promise.all([
        supabase.from('auth.users').select('id', { count: 'exact' }),
        supabase.from('songs').select('id', { count: 'exact' }),
        supabase.from('live_rooms').select('id', { count: 'exact' }),
        supabase.from('live_room_messages').select('id', { count: 'exact' })
      ]);

      setStats({
        users: usersCount.count || 0,
        songs: songsCount.count || 0,
        liveRooms: liveRoomsCount.count || 0,
        messages: messagesCount.count || 0
      });
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    }
  };

  const loadLiveRooms = async () => {
    try {
      const { data } = await supabase
        .from('live_rooms')
        .select(`
          *,
          host:auth.users!host_id(username, email, avatar_url)
        `)
        .order('created_at', { ascending: false });

      setLiveRooms(data || []);
    } catch (err) {
      console.error('Erreur chargement live rooms:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('auth.users')
        .select('id, username, email, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      setUsers(data || []);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  const deleteLiveRoom = async (roomId) => {
    try {
      await supabase.from('live_rooms').delete().eq('id', roomId);
      loadLiveRooms();
      loadStats();
    } catch (err) {
      console.error('Erreur suppression live room:', err);
    }
  };

  const cleanupInactiveRooms = async () => {
    try {
      const { data } = await supabase.rpc('cleanup_inactive_rooms');
      console.log('Nettoyage terminé:', data);
      loadLiveRooms();
      loadStats();
    } catch (err) {
      console.error('Erreur nettoyage rooms:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Accès refusé</h1>
          <p className="text-gray-400">Vous n'avez pas les permissions administrateur</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold">Panneau d'administration</h1>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {['overview', 'live-rooms', 'users', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'live-rooms' && 'Live Rooms'}
              {tab === 'users' && 'Utilisateurs'}
              {tab === 'settings' && 'Paramètres'}
            </button>
          ))}
        </div>

        {/* Vue d'ensemble */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold">{stats.users}</span>
              </div>
              <p className="text-gray-400">Utilisateurs</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <Music className="w-8 h-8 text-green-400" />
                <span className="text-2xl font-bold">{stats.songs}</span>
              </div>
              <p className="text-gray-400">Musiques</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold">{stats.liveRooms}</span>
              </div>
              <p className="text-gray-400">Live Rooms</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <FileAudio className="w-8 h-8 text-orange-400" />
                <span className="text-2xl font-bold">{stats.messages}</span>
              </div>
              <p className="text-gray-400">Messages</p>
            </div>
          </div>
        )}

        {/* Live Rooms */}
        {activeTab === 'live-rooms' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Live Rooms actives</h2>
              <button
                onClick={cleanupInactiveRooms}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Nettoyer inactives
              </button>
            </div>
            <div className="space-y-4">
              {liveRooms.map((room) => (
                <div key={room.id} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{room.title}</h3>
                      <p className="text-gray-400">Par {room.host?.username || 'Unknown'}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {room.participants_count} participants
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(room.created_at).toLocaleString()}
                        </span>
                        <span className={`flex items-center gap-1 ${
                          room.is_active ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {room.is_active ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          {room.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteLiveRoom(room.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Utilisateurs */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Derniers utilisateurs</h2>
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <div className="flex items-center gap-4">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{user.username || 'Anonymous'}</h3>
                      <p className="text-gray-400">{user.email}</p>
                      <p className="text-sm text-gray-500">
                        Inscrit le {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paramètres */}
        {activeTab === 'settings' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Paramètres système</h2>
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-semibold mb-4">Maintenance</h3>
                <div className="space-y-4">
                  <button
                    onClick={cleanupInactiveRooms}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Nettoyer les salons inactifs
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
