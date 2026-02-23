import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Music, Upload, Heart, User, Edit3, LogOut, Users, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import LikeButton from '@/components/LikeButton';
import FollowButton from '@/components/FollowButton';
import EditProfileModal from '@/components/EditProfileModal';
import { Link, useNavigate } from 'react-router-dom';

const UserProfilePage = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [userSongs, setUserSongs] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('songs'); // songs, favorites, followers, following
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!showEditModal && currentUser) {
      fetchUserData();
    }
  }, [showEditModal, currentUser]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      // Récupérer les chansons de l'utilisateur
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('uploader_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (songsError) throw songsError;

      // Récupérer les chansons favorites (likes)
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('songs(*)')
        .eq('user_id', currentUser.id);

      if (likesError) throw likesError;

      const favoriteSongsData = likesData?.map(like => like.songs).filter(Boolean) || [];

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

      setUserSongs(songsData || []);
      setFavoriteSongs(favoriteSongsData);
      setFollowers(followersData || []);
      setFollowing(followingData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDeleteSong = async (songId) => {
    try {
      // Supprimer le fichier audio du storage
      const { data: song } = await supabase
        .from('songs')
        .select('audio_url')
        .eq('id', songId)
        .single();

      if (song?.audio_url) {
        const filePath = song.audio_url.split('/').pop();
        await supabase.storage.from('audio').remove([filePath]);
      }

      // Supprimer la chanson de la base de données
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (error) throw error;

      // Mettre à jour la liste
      setUserSongs(prev => prev.filter(song => song.id !== songId));
    } catch (error) {
      console.error('Error deleting song:', error);
    }
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

      <div className="min-h-screen bg-gray-950 pb-24 md:pb-32">
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
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
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
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {currentUser.username || currentUser.email}
                </h1>
                <p className="text-gray-400 mb-4">{currentUser.email}</p>
                
                <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-cyan-400">{userSongs.length}</div>
                    <div className="text-sm text-gray-400">Morceaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-magenta-400">{favoriteSongs.length}</div>
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

          {/* Onglets */}
          <div className="flex gap-4 mb-6 border-b border-gray-800">
            <button
              onClick={() => setActiveTab('songs')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'songs'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4 inline mr-2" />
              Mes morceaux
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'favorites'
                  ? 'text-magenta-400 border-b-2 border-magenta-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4 inline mr-2" />
              Mes favoris
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'followers'
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Abonnés
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === 'following'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Abonnements
            </button>
          </div>

          {/* Contenu des onglets */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-cyan-400 text-xl">Chargement...</div>
            </div>
          ) : (
            <>
              {activeTab === 'songs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {userSongs.length > 0 ? (
                    userSongs.map((song, index) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <SongCard
                          song={song}
                          currentSong={currentSong}
                          setCurrentSong={setCurrentSong}
                          showDelete={true}
                          onDelete={handleDeleteSong}
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

              {activeTab === 'favorites' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {favoriteSongs.length > 0 ? (
                    favoriteSongs.map((song, index) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <SongCard
                          song={song}
                          currentSong={currentSong}
                          setCurrentSong={setCurrentSong}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-magenta-500/30 rounded-xl">
                      <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">Aucun favori</p>
                      <p className="text-gray-500 text-sm mt-2">
                        Ajoute des morceaux en favoris pour les retrouver ici
                      </p>
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
                              {follow.users?.username || follow.users?.email}
                            </div>
                            <div className="text-sm text-gray-400">
                              {follow.users?.email}
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
                              {follow.users?.username || follow.users?.email}
                            </div>
                            <div className="text-sm text-gray-400">
                              {follow.users?.email}
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
        {currentSong && <AudioPlayer currentSong={currentSong} />}
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
