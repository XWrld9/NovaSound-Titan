import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Music, Upload, Heart, Edit3, LogOut, Users, UserPlus, Archive, Bookmark, ListMusic, BarChart2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('songs'); // songs, archived, favorites, followers, following
  const [loading, setLoading] = useState(true);
  const { playSong: globalPlaySong, currentSong } = usePlayer();
  const [showEditModal, setShowEditModal] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Charger le profil et les données en une seule fois
  useEffect(() => {
    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!showEditModal && currentUser) {
      fetchUserData();
    }
  }, [showEditModal]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      // Timeout pour éviter les chargements infinis
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000) // 10 secondes
      );

      const fetchDataPromise = (async () => {
        // Vérifier si l'utilisateur existe dans la base de données
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (userError || !userData) {
          console.error('Utilisateur non trouvé dans la base de données:', userError);
          // Profil DB absent mais auth OK — ne pas rediriger, afficher vide
          return;
        }

        // Récupérer les chansons de l'utilisateur (actives + archivées)
        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .select('*')
          .eq('uploader_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (songsError) throw songsError;

        // Récupérer les favoris (table favorites)
        const { data: favData } = await supabase
          .from('favorites')
          .select(`song_id, songs(id, title, artist, cover_url, audio_url, created_at, plays_count, likes_count, uploader_id, is_archived)`)
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        const favoriteSongsData = (favData || []).map(f => f.songs).filter(Boolean).filter(s => !s?.is_archived);

        // Récupérer les sons likés (table likes)
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select(`
            song_id,
            songs (
              id, title, artist, cover_url, audio_url,
              created_at, plays_count, likes_count, uploader_id, is_archived
            )
          `)
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (likesError) throw likesError;
        const likedSongsData = (likesData || []).map(l => l.songs).filter(Boolean).filter(s => !s?.is_archived);

        // Récupérer les followers
        const { data: followersData, error: followersError } = await supabase
          .from('follows')
          .select('follower_id, users!follows_follower_id_fkey(*)')
          .eq('following_id', currentUser.id);

        if (followersError) throw followersError;

        // Récupérer les following
        const { data: followingData, error: followingError } = await supabase
          .from('follows')
          .select('following_id, users!follows_following_id_fkey(*)')
          .eq('follower_id', currentUser.id);

        if (followingError) throw followingError;

        setProfile(userData);
        setUserSongs(songsData || []);
        setFavoriteSongs(favoriteSongsData);
        setLikedSongs(likedSongsData);
        setFollowers(followersData || []);
        setFollowing(followingData || []);
      })();

      // Race entre le fetch et le timeout
      await Promise.race([fetchDataPromise, timeoutPromise]);

    } catch (error) {
      console.error('Error fetching user data:', error);
      // Ne pas rediriger brutalement - laisser l'utilisateur sur la page
      // Les listes seront vides mais l'en-tête du profil restera visible
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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

  return (
    <>
      <Helmet>
        <title>Profil - NovaSound-Titan</title>
        <meta name="description" content="Votre profil utilisateur NovaSound-Titan" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 pb-24 md:pb-32 overflow-x-hidden">
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
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-cyan-500 to-magenta-500 rounded-full flex items-center justify-center">
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
                    className="bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600"
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
              { id: 'songs',     icon: Music,     label: 'Morceaux',    mobileLabel: 'Sons',     color: 'cyan',   count: userSongs.filter(s => !s.is_archived).length },
              { id: 'archived',  icon: Archive,   label: 'Archivés',    mobileLabel: 'Archivés', color: 'amber',  count: userSongs.filter(s => s.is_archived).length },
              { id: 'favorites', icon: Bookmark,  label: 'Favoris',     mobileLabel: 'Favoris',  color: 'purple', count: favoriteSongs.length },
              { id: 'liked',     icon: Heart,     label: 'Likés',       mobileLabel: 'Likés',    color: 'pink',   count: likedSongs.length },
              { id: 'followers', icon: Users,     label: 'Abonnés',     mobileLabel: 'Abonnés',  color: 'green',  count: followers.length },
              { id: 'following', icon: UserPlus,  label: 'Abonnements', mobileLabel: 'Suivis',   color: 'blue',   count: following.length },
            ].map(({ id, icon: Icon, label, mobileLabel, color, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-semibold whitespace-nowrap transition-colors flex-shrink-0 text-sm ${
                  activeTab === id
                    ? `text-${color}-400 border-b-2 border-${color}-400`
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{mobileLabel}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? `bg-${color}-500/20 text-${color}-400` : 'bg-gray-800 text-gray-500'}`}>
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
                          onPlay={(song) => globalPlaySong(song)}
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
                        <Button className="bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600">
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
                            onPlay={(song) => globalPlaySong(song)}
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
                          onPlay={(song) => globalPlaySong(song)}
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
                          onPlay={(song) => globalPlaySong(song)}
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
