import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Music, Upload, Heart, Edit3, LogOut, Users, UserPlus, Archive, Bookmark, ListMusic, BarChart2, MessageCircle, ExternalLink, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SongCard from '@/components/SongCard';
import FollowButton from '@/components/FollowButton';
import EditProfileModal from '@/components/EditProfileModal';
import { Link, useNavigate } from 'react-router-dom';

const UserProfilePage = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [userSongs, setUserSongs] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('songs'); // songs, archived, favorites, liked, followers, following, comments
  const [loading, setLoading] = useState(true);
  const { playSong: globalPlaySong, currentSong } = usePlayer();
  const [showEditModal, setShowEditModal] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [myComments, setMyComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [achievements, setAchievements] = useState([]);

  // Charger le profil et les données en une seule fois
  useEffect(() => {
    if (currentUser) {
      fetchUserData();
      fetchAchievements();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!showEditModal && currentUser) {
      fetchUserData();
    }
  }, [showEditModal]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // ── Étape 1 : profil utilisateur — affiché immédiatement ────────
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (userError || !userData) {
        console.error('[UserProfile] profil introuvable:', userError);
        // Auth OK mais pas de ligne DB — on affiche quand même avec les données auth
        setProfile(null);
        setLoading(false);
        return;
      }
      // Afficher le header du profil dès que possible (iOS ne reste plus blanc)
      setProfile(userData);
      setLoading(false); // ← déverrouille le rendu AVANT les requêtes secondaires

      // ── Étape 2 : données secondaires en parallèle (non bloquantes) ──
      const [songsRes, favRes, likesRes, followersRes, followingRes] = await Promise.allSettled([
        supabase
          .from('songs')
          .select('*')
          .eq('uploader_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('favorites')
          .select('song_id, songs(id, title, artist, cover_url, audio_url, created_at, plays_count, likes_count, uploader_id, is_archived)')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('likes')
          .select('song_id, songs(id, title, artist, cover_url, audio_url, created_at, plays_count, likes_count, uploader_id, is_archived)')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('follows')
          .select('follower_id, users!follows_follower_id_fkey(*)')
          .eq('following_id', currentUser.id),
        supabase
          .from('follows')
          .select('following_id, users!follows_following_id_fkey(*)')
          .eq('follower_id', currentUser.id),
      ]);

      if (songsRes.status === 'fulfilled' && !songsRes.value.error)
        setUserSongs(songsRes.value.data || []);

      if (favRes.status === 'fulfilled' && !favRes.value.error)
        setFavoriteSongs((favRes.value.data || []).map(f => f.songs).filter(Boolean).filter(s => !s?.is_archived));

      if (likesRes.status === 'fulfilled' && !likesRes.value.error)
        setLikedSongs((likesRes.value.data || []).map(l => l.songs).filter(Boolean).filter(s => !s?.is_archived));

      if (followersRes.status === 'fulfilled' && !followersRes.value.error)
        setFollowers(followersRes.value.data || []);

      if (followingRes.status === 'fulfilled' && !followingRes.value.error)
        setFollowing(followingRes.value.data || []);

    } catch (error) {
      console.error('[UserProfile] fetchUserData error:', error);
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    if (!currentUser?.id) return;
    try {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement, unlocked_at, achievement_definitions:achievement(label,icon,rarity,points)')
        .eq('user_id', currentUser.id)
        .order('unlocked_at', { ascending: false });
      setAchievements(data || []);
    } catch {}
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ── Charger mes commentaires ─────────────────────────────────────
  const fetchMyComments = async () => {
    if (!currentUser?.id) return;
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('song_comments')
        .select('id, content, created_at, likes_count, song_id, songs(id, title, artist, cover_url)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      // Filtre côté client si is_deleted n'existe pas en DB
      setMyComments((data || []).filter(c => c.is_deleted !== true));
    } catch (e) {
      console.error('[UserProfile] fetchMyComments:', e);
    }
    setLoadingComments(false);
  };

  useEffect(() => {
    if (activeTab === 'comments' && currentUser) fetchMyComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser]);

  const handleSongArchived = (songId, isArchived) => {
    setUserSongs(prev => prev.map(s => s.id === songId ? { ...s, is_archived: isArchived } : s));
  };

  const handleSongDeleted = (songId) => {
    setUserSongs(prev => prev.filter(s => s.id !== songId));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Non connecté</h1>
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }


  // Sync song-updated (titre/artiste edites depuis le menu)
  useEffect(() => {
    const handler = (e) => {
      const updated = e.detail;
      if (!updated?.id) return;
      setUserSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
      setLikedSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
      setFavoriteSongs(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, []);

  return (
    <>
      <Helmet>
        <title>Profil - NovaSound-Titan</title>
        <meta name="description" content="Votre profil utilisateur NovaSound-Titan" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 pb-36 md:pb-32 overflow-x-hidden">
        <Header />

        <main className="container mx-auto px-4 py-8">
          {/* En-tête profil */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-cyan-500 to-fuchsia-500 rounded-full flex items-center justify-center">
                  {(profile?.avatar_url || currentUser.avatar_url) ? (
                    <img
                      src={profile?.avatar_url || currentUser.avatar_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <img
                      src="/profil par defaut.png"
                      alt="Default Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  )}
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="absolute bottom-0 right-0 bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-full transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Infos profil */}
              <div className="flex-1 text-center md:text-left min-w-0 w-full overflow-hidden">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-white break-words">
                    {profile?.username || currentUser.username || currentUser.email}
                  </h1>
                  {/* Badge artiste vérifié si ≥ 1000 écoutes totales */}
                  {userSongs.reduce((sum, s) => sum + (s.plays_count || 0), 0) >= 1000 && (
                    <span title="Artiste populaire — 1 000+ écoutes" className="flex-shrink-0 text-cyan-400" style={{ fontSize: 20 }}>✦</span>
                  )}
                </div>
                {profile?.bio && (
                  <div className="mb-2 max-w-md">
                    <p className={`text-gray-400 text-sm break-words leading-relaxed ${bioExpanded ? '' : 'line-clamp-3'}`}>{profile.bio}</p>
                    {profile.bio.length > 120 && (
                      <button
                        onClick={() => setBioExpanded(!bioExpanded)}
                        className="text-cyan-400 text-xs mt-1 hover:text-cyan-300 transition-colors font-medium"
                      >
                        {bioExpanded ? 'Réduire ▲' : 'Lire la suite ▼'}
                      </button>
                    )}
                  </div>
                )}
                <p className="text-gray-500 text-sm mb-4 truncate max-w-[260px] md:max-w-sm" title={currentUser.email}>{currentUser.email}</p>
                
                <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-cyan-400">{userSongs.filter(s => !s.is_archived).length}</div>
                    <div className="text-sm text-gray-400">Morceaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-amber-400">
                      {(() => {
                        const total = userSongs.reduce((sum, s) => sum + (s.plays_count || 0), 0);
                        if (total >= 1000000) return `${(total/1000000).toFixed(1)}M`;
                        if (total >= 1000) return `${(total/1000).toFixed(1)}k`;
                        return String(total);
                      })()}
                    </div>
                    <div className="text-sm text-gray-400">Écoutes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-pink-400">{likedSongs.length}</div>
                    <div className="text-sm text-gray-400">Likés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">{favoriteSongs.length}</div>
                    <div className="text-sm text-gray-400">Favoris</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{followers.length}</div>
                    <div className="text-sm text-gray-400">Abonnés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">{following.length}</div>
                    <div className="text-sm text-gray-400">Abonnements</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <Button
                    onClick={() => setShowEditModal(true)}
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Modifier le profil
                  </Button>
                  
                  <Link to="/upload">
                    <Button className="bg-green-500 hover:bg-green-600">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload un son
                    </Button>
                  </Link>

                  <Link to="/playlists">
                    <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                      <ListMusic className="w-4 h-4 mr-2" />
                      Mes playlists
                    </Button>
                  </Link>

                  {userSongs.filter(s => !s.is_archived).length > 0 && (
                    <Link to="/stats">
                      <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                        <BarChart2 className="w-4 h-4 mr-2" />
                        Mes stats
                      </Button>
                    </Link>
                  )}
                  
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Onglets — scroll horizontal sur mobile */}
          <div className="flex gap-1 mb-6 border-b border-gray-800 overflow-x-auto scrollbar-hide">
            {[
              { id: 'songs',     icon: Music,          label: 'Morceaux',    mobileLabel: 'Sons',     color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',  count: userSongs.filter(s => !s.is_archived).length },
              { id: 'archived',  icon: Archive,        label: 'Archivés',    mobileLabel: 'Archivés', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  count: userSongs.filter(s => s.is_archived).length },
              { id: 'favorites', icon: Bookmark,       label: 'Favoris',     mobileLabel: 'Favoris',  color: '#c084fc', bg: 'rgba(192,132,252,0.15)', count: favoriteSongs.length },
              { id: 'liked',     icon: Heart,          label: 'Likés',       mobileLabel: 'Likés',    color: '#f472b6', bg: 'rgba(244,114,182,0.15)', count: likedSongs.length },
              { id: 'comments',  icon: MessageCircle,  label: 'Commentaires',mobileLabel: 'Comms',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  count: myComments.length },
              { id: 'followers', icon: Users,          label: 'Abonnés',     mobileLabel: 'Abonnés',  color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  count: followers.length },
              { id: 'following', icon: UserPlus,       label: 'Abonnements', mobileLabel: 'Suivis',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  count: following.length },
              { id: 'achievements', icon: Trophy,      label: 'Badges',      mobileLabel: 'Badges',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  count: achievements.length },
            ].map(({ id, icon: Icon, label, mobileLabel, color, bg, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={activeTab === id ? { color, borderBottomColor: color } : {}}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-semibold whitespace-nowrap transition-colors flex-shrink-0 text-sm border-b-2 ${
                  activeTab === id ? 'border-current' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{mobileLabel}</span>
                {count > 0 && (
                  <span
                    style={activeTab === id ? { background: bg, color } : {}}
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? '' : 'bg-gray-800 text-gray-500'}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contenu des onglets */}
          {loading ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin"></div>
                <div className="text-cyan-400 text-lg">Chargement du profil...</div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'songs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {userSongs.filter(s => !s.is_archived).length > 0 ? (
                    userSongs.filter(s => !s.is_archived).map((song, index) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <SongCard
                          song={song}
                          currentSong={currentSong}
                          onPlay={(s) => globalPlaySong(s, userSongs.filter(x => !x.is_archived))}
                          onArchived={handleSongArchived}
                          onDeleted={handleSongDeleted}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl">
                      <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-4">Aucun morceau uploadé</p>
                      <Link to="/upload">
                        <Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload ton premier morceau
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'archived' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {userSongs.filter(s => s.is_archived).length > 0 ? (
                    <>
                      <div className="col-span-full flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-2">
                        <Archive className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <p className="text-amber-300 text-sm">Ces sons sont masqués du public. Clique sur ⋯ → Restaurer pour les remettre en ligne.</p>
                      </div>
                      {userSongs.filter(s => s.is_archived).map((song, index) => (
                        <motion.div
                          key={song.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <SongCard
                            song={song}
                            currentSong={currentSong}
                            onPlay={(s) => globalPlaySong(s, userSongs)}
                            onArchived={handleSongArchived}
                            onDeleted={handleSongDeleted}
                          />
                        </motion.div>
                      ))}
                    </>
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-amber-500/20 rounded-xl">
                      <Archive className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun son archivé</p>
                      <p className="text-gray-500 text-sm mt-2">Les sons que tu archives apparaîtront ici</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'favorites' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {favoriteSongs.length > 0 ? (
                    favoriteSongs.map((song, index) => (
                      <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                        <SongCard
                          song={song}
                          currentSong={currentSong}
                          onPlay={(s) => globalPlaySong(s, favoriteSongs)}
                          onDeleted={(id) => setFavoriteSongs(prev => prev.filter(s => s.id !== id))}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-purple-500/20 rounded-xl">
                      <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun favori</p>
                      <p className="text-gray-500 text-sm mt-2">Sauvegarde des sons avec 🔖 pour les retrouver ici</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'liked' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {likedSongs.length > 0 ? (
                    likedSongs.map((song, index) => (
                      <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                        <SongCard
                          song={song}
                          currentSong={currentSong}
                          onPlay={(s) => globalPlaySong(s, likedSongs)}
                          onDeleted={(id) => setLikedSongs(prev => prev.filter(s => s.id !== id))}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-pink-500/20 rounded-xl">
                      <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun son liké</p>
                      <p className="text-gray-500 text-sm mt-2">Les sons que tu ❤️ apparaîtront ici</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-3">
                  {loadingComments ? (
                    <div className="flex justify-center py-12">
                      <div className="w-7 h-7 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
                    </div>
                  ) : myComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MessageCircle className="w-14 h-14 text-gray-800 mb-4" />
                      <p className="text-gray-500 font-semibold">Aucun commentaire</p>
                      <p className="text-gray-700 text-sm mt-1">Tes commentaires sur les publications apparaîtront ici</p>
                    </div>
                  ) : (
                    myComments.map(comment => {
                      const song = comment.songs;
                      return (
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4 hover:border-teal-500/20 transition-all"
                        >
                          {/* En-tête : lien vers la publication */}
                          {song && (
                            <Link
                              to={`/song/${song.id}`}
                              className="flex items-center gap-3 mb-3 group"
                            >
                              {song.cover_url ? (
                                <img src={song.cover_url} alt={song.title} className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                                  <Music className="w-4 h-4 text-gray-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors truncate">{song.title}</p>
                                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-teal-400 transition-colors flex-shrink-0" />
                            </Link>
                          )}
                          {/* Contenu du commentaire */}
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-[11px] text-gray-600">
                              {new Date(comment.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {comment.likes_count > 0 && (
                              <span className="text-[11px] text-gray-600 flex items-center gap-1">
                                <Heart className="w-3 h-3 text-pink-500" />
                                {comment.likes_count}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'followers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {followers.length > 0 ? (
                    followers.map((follow, index) => (
                      <motion.div
                        key={follow.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-900/50 backdrop-blur-xl border border-green-500/30 rounded-xl p-4"
                      >
                        <Link to={`/artist/${follow.follower_id}`} className="flex items-center gap-3">
                          {follow.users?.avatar_url ? (
                            <img
                              src={follow.users.avatar_url}
                              alt={follow.users.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <img
                              src="/profil par defaut.png"
                              alt={follow.users.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <div className="font-bold text-white">
                              {follow.users?.username || 'Utilisateur'}
                            </div>
                            <div className="text-sm text-gray-400">
                              Abonné(e)
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-green-500/30 rounded-xl">
                      <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun abonné</p>
                      <p className="text-gray-500 text-sm mt-2">
                        Les utilisateurs qui t'abonnent apparaîtront ici
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'following' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {following.length > 0 ? (
                    following.map((follow, index) => (
                      <motion.div
                        key={follow.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-900/50 backdrop-blur-xl border border-blue-500/30 rounded-xl p-4"
                      >
                        <Link to={`/artist/${follow.following_id}`} className="flex items-center gap-3">
                          {follow.users?.avatar_url ? (
                            <img
                              src={follow.users.avatar_url}
                              alt={follow.users.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <img
                              src="/profil par defaut.png"
                              alt={follow.users.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <div className="font-bold text-white">
                              {follow.users?.username || 'Utilisateur'}
                            </div>
                            <div className="text-sm text-gray-400">
                              Abonnement
                            </div>
                          </div>
                          <FollowButton
                            userId={follow.following_id}
                            initialFollowing={true}
                          />
                        </Link>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-blue-500/30 rounded-xl">
                      <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun abonnement</p>
                      <p className="text-gray-500 text-sm mt-2">
                        Les artistes que tu suis apparaîtront ici
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Onglet Achievements v5000 */}
              {activeTab === 'achievements' && (
                <div>
                  {achievements.length === 0 ? (
                    <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-2xl">
                      <span className="text-4xl block mb-3">🏆</span>
                      <p className="text-gray-500">Aucun badge encore.</p>
                      <p className="text-gray-600 text-sm mt-1">Upload des sons, écoute de la musique et interagis pour débloquer tes trophées !</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-400">{achievements.length} badge{achievements.length > 1 ? 's' : ''} débloqué{achievements.length > 1 ? 's' : ''}</p>
                        <p className="text-sm font-bold text-fuchsia-400">
                          {achievements.reduce((s, a) => s + (a.achievement_definitions?.points || 0), 0)} XP total
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {achievements.map((a) => {
                          const def = a.achievement_definitions;
                          const rarityColor = {
                            common: 'border-gray-700 bg-gray-800/50',
                            rare: 'border-cyan-500/40 bg-cyan-500/5',
                            epic: 'border-fuchsia-500/40 bg-fuchsia-500/5',
                            legendary: 'border-amber-500/40 bg-amber-500/8',
                          }[def?.rarity || 'common'];
                          return (
                            <div key={a.achievement}
                              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${rarityColor}`}
                            >
                              <span className="text-2xl flex-shrink-0">{def?.icon || '🎵'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold">{def?.label || a.achievement}</p>
                                <p className="text-gray-500 text-xs">{def?.description || ''}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-fuchsia-400 text-sm font-bold">+{def?.points || 0} XP</p>
                                <p className="text-gray-600 text-[10px] capitalize">{def?.rarity || 'common'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <Footer />
      </div>

      {showEditModal && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
};

export default UserProfilePage;
