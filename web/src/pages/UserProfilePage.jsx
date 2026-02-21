import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Music, Users, Edit, Play, User, UserMinus } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import LikeButton from '@/components/LikeButton';
import FollowButton from '@/components/FollowButton';
import EditProfileModal from '@/components/EditProfileModal';
import { Link } from 'react-router-dom';

const UserProfilePage = () => {
  const { currentUser } = useAuth();
  const [userSongs, setUserSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('songs'); // songs, followers, following
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  // Recharger les données après la fermeture de la modal d'édition
  useEffect(() => {
    if (!showEditModal && currentUser) {
      fetchUserData();
    }
  }, [showEditModal, currentUser]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      const [{ data: songsData, error: songsError }, { data: followersData, error: followersError }, { data: followingData, error: followingError }] = await Promise.all([
        supabase
          .from('songs')
          .select('*')
          .eq('uploader_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('follows')
          .select('*')
          .eq('following_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (songsError) throw songsError;
      if (followersError) throw followersError;
      if (followingError) throw followingError;

      setUserSongs(songsData || []);

      // Followers: merge user profiles
      const followerIds = (followersData || []).map((f) => f.follower_id);
      if (followerIds.length > 0) {
        const { data: followerUsers, error: followerUsersError } = await supabase
          .from('users')
          .select('*')
          .in('id', followerIds);
        if (followerUsersError) throw followerUsersError;

        const byId = new Map((followerUsers || []).map((u) => [u.id, u]));
        setFollowers((followersData || []).map((f) => ({ ...f, follower: byId.get(f.follower_id) || null })));
      } else {
        setFollowers([]);
      }

      // Following: merge user profiles
      const followingIds = (followingData || []).map((f) => f.following_id);
      if (followingIds.length > 0) {
        const { data: followingUsers, error: followingUsersError } = await supabase
          .from('users')
          .select('*')
          .in('id', followingIds);
        if (followingUsersError) throw followingUsersError;

        const byId = new Map((followingUsers || []).map((u) => [u.id, u]));
        setFollowing((followingData || []).map((f) => ({ ...f, following: byId.get(f.following_id) || null })));
      } else {
        setFollowing([]);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (e, followId) => {
    e.preventDefault(); // Prevent navigation if inside Link
    if (!window.confirm('Are you sure you want to unfollow this artist?')) return;
    
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('id', followId);
      if (error) throw error;
      // State update handled by subscription
    } catch (err) {
      console.error('Error unsubscribing:', err);
    }
  };

  const UserListItem = ({ user, followId, isFollowingList }) => {
    if (!user) return null;
    
    return (
      <Link to={`/artist/${user.id}`} className="flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-cyan-500/50 transition-all group relative">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username || 'User'} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white truncate">{user.username || 'Unknown User'}</div>
          <div className="text-xs text-gray-500">View Profile</div>
        </div>
        
        {isFollowingList && followId && (
          <button
            onClick={(e) => handleUnsubscribe(e, followId)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            title="Unsubscribe"
          >
            <UserMinus className="w-5 h-5" />
          </button>
        )}
      </Link>
    );
  };

  return (
    <>
      <Helmet>
        <title>{`${currentUser?.username || 'Profile'} - NovaSound TITAN LUX`}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-cyan-500/10 to-magenta-500/10 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.username}
                  className="w-32 h-32 rounded-full object-cover border-4 border-cyan-400 shadow-lg shadow-cyan-500/50"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center border-4 border-cyan-400 shadow-lg shadow-cyan-500/50">
                  <Music className="w-16 h-16 text-white" />
                </div>
              )}

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold text-white mb-2">{currentUser?.username}</h1>
                <p className="text-gray-400 mb-4">{currentUser?.email}</p>
                
                {currentUser?.bio && (
                  <p className="text-gray-300 mb-6 max-w-2xl">{currentUser.bio}</p>
                )}

                <div className="flex justify-center md:justify-start gap-8 mb-6">
                  <button onClick={() => setActiveTab('songs')} className={`text-center ${activeTab === 'songs' ? 'text-cyan-400' : 'text-gray-400'}`}>
                    <div className="text-2xl font-bold">{userSongs.length}</div>
                    <div className="text-sm">Songs</div>
                  </button>
                  <button onClick={() => setActiveTab('followers')} className={`text-center ${activeTab === 'followers' ? 'text-cyan-400' : 'text-gray-400'}`}>
                    <div className="text-2xl font-bold">{followers.length}</div>
                    <div className="text-sm">Followers</div>
                  </button>
                  <button onClick={() => setActiveTab('following')} className={`text-center ${activeTab === 'following' ? 'text-cyan-400' : 'text-gray-400'}`}>
                    <div className="text-2xl font-bold">{following.length}</div>
                    <div className="text-sm">Following</div>
                  </button>
                </div>

                <Button 
                  onClick={() => setShowEditModal(true)}
                  className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Content Tabs */}
          <div className="mb-6 border-b border-gray-800">
            <div className="flex gap-6">
              {['songs', 'followers', 'following'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                    activeTab === tab ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : (
              <>
                {activeTab === 'songs' && (
                  userSongs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {userSongs.map((song) => (
                        <SongCard 
                          key={song.id} 
                          song={song} 
                          onPlay={setCurrentSong} 
                          isPlaying={currentSong?.id === song.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">No songs uploaded yet.</div>
                  )
                )}

                {activeTab === 'followers' && (
                  followers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {followers.map((item) => (
                        item.follower && <UserListItem key={item.id} user={item.follower} followId={item.id} isFollowingList={false} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">No followers yet.</div>
                  )
                )}

                {activeTab === 'following' && (
                  following.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {following.map((item) => (
                        item.following && <UserListItem key={item.id} user={item.following} followId={item.id} isFollowingList={true} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">Not following anyone yet.</div>
                  )
                )}
              </>
            )}
          </div>
        </main>

        <Footer />
        {currentSong && <AudioPlayer currentSong={currentSong} />}
        
        {/* Edit Profile Modal */}
        <EditProfileModal 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
          user={currentUser}
        />
      </div>
    </>
  );
};

export default UserProfilePage;