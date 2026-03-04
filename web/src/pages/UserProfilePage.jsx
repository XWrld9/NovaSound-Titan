/**
 * UserProfilePage — NovaSound V27000
 *
 * NOUVEAUTÉS v27000 :
 * ✅ Onglet "Repartagés" avec fetch song_reposts
 * ✅ Compteur Repartagés dans les stats du header (cliquable)
 * ✅ Tab active persistée via URL (?tab=reposts)
 * ✅ Onglets réordonnés : Sons > Repartagés > Archivés > Favoris > ...
 * ✅ Skeleton loader au chargement
 * ✅ AnimatePresence sur les changements d'onglets
 * ✅ Stats header cliquables → scroll vers l'onglet correspondant
 * ✅ Badges legendary avec glow effect
 * ✅ Empty states enrichis avec call-to-action
 * ✅ sync novasound:song-updated couvre aussi repostedSongs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Music, Upload, Heart, Edit3, LogOut, Users, UserPlus,
  Archive, Bookmark, ListMusic, BarChart2, MessageCircle,
  ExternalLink, Trophy, Repeat2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SongCard from '@/components/SongCard';
import FollowButton from '@/components/FollowButton';
import EditProfileModal from '@/components/EditProfileModal';
import { Link, useNavigate, useLocation } from 'react-router-dom';

// ── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden animate-pulse">
    <div className="w-full aspect-square bg-gray-800" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-gray-800 rounded w-3/4" />
      <div className="h-3 bg-gray-800 rounded w-1/2" />
    </div>
  </div>
);
const SkeletonGrid = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
    {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
);

// ── Format number ─────────────────────────────────────────────────────────────
const fmtNum = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// ─────────────────────────────────────────────────────────────────────────────
const UserProfilePage = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile,        setProfile]        = useState(null);
  const [userSongs,      setUserSongs]      = useState([]);
  const [favoriteSongs,  setFavoriteSongs]  = useState([]);
  const [likedSongs,     setLikedSongs]     = useState([]);
  const [repostedSongs,  setRepostedSongs]  = useState([]);
  const [followers,      setFollowers]      = useState([]);
  const [following,      setFollowing]      = useState([]);
  const [myComments,     setMyComments]     = useState([]);
  const [achievements,   setAchievements]   = useState([]);

  const [loading,         setLoading]         = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [bioExpanded,     setBioExpanded]     = useState(false);

  const urlTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'songs');

  const { playSong: globalPlaySong, currentSong } = usePlayer();

  const switchTab = useCallback((id) => {
    setActiveTab(id);
    const params = new URLSearchParams(location.search);
    params.set('tab', id);
    navigate(`?${params.toString()}`, { replace: true });
  }, [navigate, location.search]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users').select('*').eq('id', currentUser.id).single();
      if (userError || !userData) { setLoading(false); return; }
      setProfile(userData);
      setLoading(false);

      const [songsRes, favRes, likesRes, followersRes, followingRes, repostsRes] =
        await Promise.allSettled([
          supabase.from('songs').select('*').eq('uploader_id', currentUser.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('favorites').select('song_id, songs(id,title,artist,cover_url,audio_url,created_at,plays_count,likes_count,uploader_id,is_archived)').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
          supabase.from('likes').select('song_id, songs(id,title,artist,cover_url,audio_url,created_at,plays_count,likes_count,uploader_id,is_archived)').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
          supabase.from('follows').select('follower_id, users!follows_follower_id_fkey(*)').eq('following_id', currentUser.id),
          supabase.from('follows').select('following_id, users!follows_following_id_fkey(*)').eq('follower_id', currentUser.id),
          supabase.from('song_reposts').select('song_id, created_at, songs(id,title,artist,cover_url,audio_url,created_at,plays_count,likes_count,uploader_id,is_archived)').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        ]);

      if (songsRes.status === 'fulfilled' && !songsRes.value.error)    setUserSongs(songsRes.value.data || []);
      if (favRes.status === 'fulfilled' && !favRes.value.error)        setFavoriteSongs((favRes.value.data || []).map(f => f.songs).filter(Boolean).filter(s => !s?.is_archived));
      if (likesRes.status === 'fulfilled' && !likesRes.value.error)    setLikedSongs((likesRes.value.data || []).map(l => l.songs).filter(Boolean).filter(s => !s?.is_archived));
      if (followersRes.status === 'fulfilled' && !followersRes.value.error) setFollowers(followersRes.value.data || []);
      if (followingRes.status === 'fulfilled' && !followingRes.value.error) setFollowing(followingRes.value.data || []);
      if (repostsRes.status === 'fulfilled' && !repostsRes.value.error)
        setRepostedSongs((repostsRes.value.data || []).map(r => r.songs).filter(Boolean).filter(s => !s?.is_archived));
    } catch (err) {
      console.error('[UserProfile] fetchUserData:', err);
      setLoading(false);
    }
  }, [currentUser]);

  const fetchAchievements = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement, unlocked_at, achievement_definitions:achievement(label,icon,rarity,points)')
        .eq('user_id', currentUser.id)
        .order('unlocked_at', { ascending: false });
      setAchievements(data || []);
    } catch {}
  }, [currentUser?.id]);

  const fetchMyComments = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('song_comments')
        .select('id, content, created_at, likes_count, song_id, songs(id,title,artist,cover_url)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setMyComments((data || []).filter(c => c.is_deleted !== true));
    } catch (e) { console.error('[UserProfile] fetchMyComments:', e); }
    setLoadingComments(false);
  }, [currentUser?.id]);

  useEffect(() => { if (currentUser) { fetchUserData(); fetchAchievements(); } }, [currentUser, fetchUserData, fetchAchievements]);
  useEffect(() => { if (!showEditModal && currentUser) fetchUserData(); }, [showEditModal]);
  useEffect(() => { if (activeTab === 'comments' && currentUser) fetchMyComments(); }, [activeTab, currentUser, fetchMyComments]);

  useEffect(() => {
    const handler = (e) => {
      const u = e.detail; if (!u?.id) return;
      setUserSongs(p => p.map(s => s.id === u.id ? { ...s, ...u } : s));
      setLikedSongs(p => p.map(s => s.id === u.id ? { ...s, ...u } : s));
      setFavoriteSongs(p => p.map(s => s.id === u.id ? { ...s, ...u } : s));
      setRepostedSongs(p => p.map(s => s.id === u.id ? { ...s, ...u } : s));
    };
    window.addEventListener('novasound:song-updated', handler);
    return () => window.removeEventListener('novasound:song-updated', handler);
  }, []);

  const handleLogout      = async () => { await logout(); navigate('/login'); };
  const handleSongArchived = (id, a) => setUserSongs(p => p.map(s => s.id === id ? { ...s, is_archived: a } : s));
  const handleSongDeleted  = (id)    => setUserSongs(p => p.filter(s => s.id !== id));

  if (!currentUser) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Non connecté</h1>
        <Link to="/login" className="text-cyan-400 hover:text-cyan-300">Se connecter</Link>
      </div>
    </div>
  );

  const totalPlays = userSongs.reduce((sum, s) => sum + (s.plays_count || 0), 0);

  const TABS = [
    { id: 'songs',        icon: Music,         label: 'Morceaux',    mobileLabel: 'Sons',     color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',  count: userSongs.filter(s => !s.is_archived).length },
    { id: 'reposts',      icon: Repeat2,       label: 'Repartagés',  mobileLabel: 'Reposts',  color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  count: repostedSongs.length },
    { id: 'archived',     icon: Archive,       label: 'Archivés',    mobileLabel: 'Archivés', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  count: userSongs.filter(s => s.is_archived).length },
    { id: 'favorites',    icon: Bookmark,      label: 'Favoris',     mobileLabel: 'Favoris',  color: '#c084fc', bg: 'rgba(192,132,252,0.15)', count: favoriteSongs.length },
    { id: 'liked',        icon: Heart,         label: 'Likés',       mobileLabel: 'Likés',    color: '#f472b6', bg: 'rgba(244,114,182,0.15)', count: likedSongs.length },
    { id: 'comments',     icon: MessageCircle, label: 'Commentaires',mobileLabel: 'Comms',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  count: myComments.length },
    { id: 'followers',    icon: Users,         label: 'Abonnés',     mobileLabel: 'Abonnés',  color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  count: followers.length },
    { id: 'following',    icon: UserPlus,      label: 'Abonnements', mobileLabel: 'Suivis',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  count: following.length },
    { id: 'achievements', icon: Trophy,        label: 'Badges',      mobileLabel: 'Badges',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  count: achievements.length },
  ];

  return (
    <>
      <Helmet>
        <title>Profil - NovaSound TITAN LUX</title>
        <meta name="description" content="Votre profil utilisateur NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 pb-36 md:pb-32 overflow-x-hidden">
        <Header />
        <main className="container mx-auto px-4 py-8">

          {/* ── Header profil ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-cyan-500 to-fuchsia-500 rounded-full flex items-center justify-center ring-4 ring-cyan-500/20">
                  {(profile?.avatar_url || currentUser.avatar_url)
                    ? <img src={profile?.avatar_url || currentUser.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    : <img src="/profil par defaut.png" alt="Default" className="w-full h-full rounded-full object-cover" />
                  }
                </div>
                <button onClick={() => setShowEditModal(true)}
                  className="absolute bottom-0 right-0 bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-full transition-colors shadow-lg">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Infos */}
              <div className="flex-1 text-center md:text-left min-w-0 w-full overflow-hidden">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-white break-words">
                    {profile?.username || currentUser.username || currentUser.email}
                  </h1>
                  {totalPlays >= 1000 && (
                    <span title="Artiste populaire — 1 000+ écoutes" className="flex-shrink-0 text-cyan-400" style={{ fontSize: 20 }}>✦</span>
                  )}
                </div>

                {profile?.bio && (
                  <div className="mb-2 max-w-md">
                    <p className={`text-gray-400 text-sm break-words leading-relaxed ${bioExpanded ? '' : 'line-clamp-3'}`}>{profile.bio}</p>
                    {profile.bio.length > 120 && (
                      <button onClick={() => setBioExpanded(!bioExpanded)} className="text-cyan-400 text-xs mt-1 hover:text-cyan-300 font-medium">
                        {bioExpanded ? 'Réduire ▲' : 'Lire la suite ▼'}
                      </button>
                    )}
                  </div>
                )}

                <p className="text-gray-500 text-sm mb-4 truncate max-w-[260px] md:max-w-sm" title={currentUser.email}>{currentUser.email}</p>

                {/* Stats cliquables */}
                <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-4">
                  {[
                    { label: 'Morceaux',    value: userSongs.filter(s => !s.is_archived).length, color: 'text-cyan-400',   tab: 'songs' },
                    { label: 'Écoutes',     value: fmtNum(totalPlays),                            color: 'text-amber-400',  tab: null },
                    { label: 'Likés',       value: likedSongs.length,                             color: 'text-pink-400',   tab: 'liked' },
                    { label: 'Favoris',     value: favoriteSongs.length,                          color: 'text-purple-400', tab: 'favorites' },
                    { label: 'Repartagés',  value: repostedSongs.length,                          color: 'text-green-400',  tab: 'reposts' },
                    { label: 'Abonnés',     value: followers.length,                              color: 'text-green-400',  tab: 'followers' },
                    { label: 'Abonnements', value: following.length,                              color: 'text-blue-400',   tab: 'following' },
                  ].map(({ label, value, color, tab }) => (
                    <button key={label} onClick={() => tab && switchTab(tab)}
                      className={`text-center transition-opacity ${tab ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-sm text-gray-400">{label}</div>
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <Button onClick={() => setShowEditModal(true)} className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600">
                    <Edit3 className="w-4 h-4 mr-2" />Modifier le profil
                  </Button>
                  <Link to="/upload"><Button className="bg-green-500 hover:bg-green-600"><Upload className="w-4 h-4 mr-2" />Upload un son</Button></Link>
                  <Link to="/playlists"><Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"><ListMusic className="w-4 h-4 mr-2" />Mes playlists</Button></Link>
                  {userSongs.filter(s => !s.is_archived).length > 0 && (
                    <Link to="/stats"><Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"><BarChart2 className="w-4 h-4 mr-2" />Mes stats</Button></Link>
                  )}
                  <Button onClick={handleLogout} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                    <LogOut className="w-4 h-4 mr-2" />Déconnexion
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Onglets ── */}
          <div className="flex gap-1 mb-6 border-b border-gray-800 overflow-x-auto scrollbar-hide">
            {TABS.map(({ id, icon: Icon, label, mobileLabel, color, bg, count }) => (
              <button key={id} onClick={() => switchTab(id)}
                style={activeTab === id ? { color, borderBottomColor: color } : {}}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-semibold whitespace-nowrap transition-colors flex-shrink-0 text-sm border-b-2 ${
                  activeTab === id ? 'border-current' : 'border-transparent text-gray-400 hover:text-white'
                }`}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{mobileLabel}</span>
                {count > 0 && (
                  <span style={activeTab === id ? { background: bg, color } : {}}
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? '' : 'bg-gray-800 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Contenu ── */}
          {loading ? <SkeletonGrid count={4} /> : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

                {/* SONS */}
                {activeTab === 'songs' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {userSongs.filter(s => !s.is_archived).length > 0 ? (
                      userSongs.filter(s => !s.is_archived).map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, userSongs.filter(x => !x.is_archived))} onArchived={handleSongArchived} onDeleted={handleSongDeleted} />
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-cyan-500/30 rounded-xl">
                        <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg mb-4">Aucun morceau uploadé</p>
                        <Link to="/upload"><Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500"><Upload className="w-4 h-4 mr-2" />Upload ton premier morceau</Button></Link>
                      </div>
                    )}
                  </div>
                )}

                {/* REPARTAGÉS */}
                {activeTab === 'reposts' && (
                  <div>
                    {repostedSongs.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 mb-5">
                          <Repeat2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <p className="text-green-300 text-sm">
                            Ces sons apparaissent sur ton profil public — visibles par tous tes abonnés.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                          {repostedSongs.map((song, i) => (
                            <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                              <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, repostedSongs)} onDeleted={(id) => setRepostedSongs(prev => prev.filter(s => s.id !== id))} />
                            </motion.div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-16 bg-gray-900/50 border border-green-500/20 rounded-xl">
                        <Repeat2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun son repartagé</p>
                        <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                          Clique sur 🔁 sur n'importe quel son pour le repartager — il apparaîtra ici et sur ton profil public.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ARCHIVÉS */}
                {activeTab === 'archived' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {userSongs.filter(s => s.is_archived).length > 0 ? (
                      <>
                        <div className="col-span-full flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-2">
                          <Archive className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <p className="text-amber-300 text-sm">Ces sons sont masqués du public. Clique sur ⋯ → Restaurer pour les remettre en ligne.</p>
                        </div>
                        {userSongs.filter(s => s.is_archived).map((song, i) => (
                          <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                            <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, userSongs)} onArchived={handleSongArchived} onDeleted={handleSongDeleted} />
                          </motion.div>
                        ))}
                      </>
                    ) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-amber-500/20 rounded-xl">
                        <Archive className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun son archivé</p>
                      </div>
                    )}
                  </div>
                )}

                {/* FAVORIS */}
                {activeTab === 'favorites' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {favoriteSongs.length > 0 ? (
                      favoriteSongs.map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, favoriteSongs)} onDeleted={(id) => setFavoriteSongs(p => p.filter(s => s.id !== id))} />
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-purple-500/20 rounded-xl">
                        <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun favori</p>
                        <p className="text-gray-500 text-sm mt-2">Sauvegarde des sons avec 🔖 pour les retrouver ici</p>
                      </div>
                    )}
                  </div>
                )}

                {/* LIKÉS */}
                {activeTab === 'liked' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {likedSongs.length > 0 ? (
                      likedSongs.map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <SongCard song={song} currentSong={currentSong} onPlay={(s) => globalPlaySong(s, likedSongs)} onDeleted={(id) => setLikedSongs(p => p.filter(s => s.id !== id))} />
                        </motion.div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-pink-500/20 rounded-xl">
                        <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun son liké</p>
                      </div>
                    )}
                  </div>
                )}

                {/* COMMENTAIRES */}
                {activeTab === 'comments' && (
                  <div className="space-y-3">
                    {loadingComments ? (
                      <div className="flex justify-center py-12"><div className="w-7 h-7 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" /></div>
                    ) : myComments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <MessageCircle className="w-14 h-14 text-gray-800 mb-4" />
                        <p className="text-gray-500 font-semibold">Aucun commentaire</p>
                      </div>
                    ) : myComments.map(comment => {
                      const song = comment.songs;
                      return (
                        <motion.div key={comment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-4 hover:border-teal-500/20 transition-all">
                          {song && (
                            <Link to={`/song/${song.id}`} className="flex items-center gap-3 mb-3 group">
                              {song.cover_url
                                ? <img src={song.cover_url} alt={song.title} className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                                : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-600" /></div>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white group-hover:text-teal-400 truncate">{song.title}</p>
                                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-teal-400 flex-shrink-0" />
                            </Link>
                          )}
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-[11px] text-gray-600">{new Date(comment.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            {comment.likes_count > 0 && <span className="text-[11px] text-gray-600 flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500" />{comment.likes_count}</span>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* ABONNÉS */}
                {activeTab === 'followers' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {followers.length > 0 ? followers.map((follow, i) => (
                      <motion.div key={follow.follower_id || i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="bg-gray-900/50 border border-green-500/30 rounded-xl p-4">
                        <Link to={`/artist/${follow.follower_id}`} className="flex items-center gap-3">
                          <img src={follow.users?.avatar_url || '/profil par defaut.png'} alt="" className="w-10 h-10 rounded-full object-cover" />
                          <div>
                            <div className="font-bold text-white">{follow.users?.username || 'Utilisateur'}</div>
                            <div className="text-sm text-gray-400">Abonné(e)</div>
                          </div>
                        </Link>
                      </motion.div>
                    )) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-green-500/30 rounded-xl">
                        <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun abonné</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ABONNEMENTS */}
                {activeTab === 'following' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {following.length > 0 ? following.map((follow, i) => (
                      <motion.div key={follow.following_id || i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="bg-gray-900/50 border border-blue-500/30 rounded-xl p-4">
                        <Link to={`/artist/${follow.following_id}`} className="flex items-center gap-3">
                          <img src={follow.users?.avatar_url || '/profil par defaut.png'} alt="" className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex-1">
                            <div className="font-bold text-white">{follow.users?.username || 'Utilisateur'}</div>
                            <div className="text-sm text-gray-400">Abonnement</div>
                          </div>
                          <FollowButton userId={follow.following_id} initialFollowing={true} />
                        </Link>
                      </motion.div>
                    )) : (
                      <div className="col-span-full text-center py-12 bg-gray-900/50 border border-blue-500/30 rounded-xl">
                        <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">Aucun abonnement</p>
                      </div>
                    )}
                  </div>
                )}

                {/* BADGES */}
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
                          <p className="text-sm font-bold text-fuchsia-400">{achievements.reduce((s, a) => s + (a.achievement_definitions?.points || 0), 0)} XP total</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {achievements.map((a) => {
                            const def = a.achievement_definitions;
                            const rarityStyles = {
                              common:    'border-gray-700 bg-gray-800/50',
                              rare:      'border-cyan-500/40 bg-cyan-500/5',
                              epic:      'border-fuchsia-500/40 bg-fuchsia-500/5',
                              legendary: 'border-amber-500/40 bg-amber-500/8 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
                            }[def?.rarity || 'common'];
                            return (
                              <div key={a.achievement} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${rarityStyles}`}>
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

              </motion.div>
            </AnimatePresence>
          )}
        </main>
        <Footer />
      </div>

      {showEditModal && <EditProfileModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} />}
    </>
  );
};

export default UserProfilePage;
