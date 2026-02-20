import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import { Button } from '@/components/ui/button';
import { Music, UserPlus, UserCheck, User } from 'lucide-react';

const ArtistProfilePage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);

  useEffect(() => {
    fetchArtistData();
    fetchFollowers();

    // Real-time subscription for followers
    pb.collection('follows').subscribe('*', (e) => {
      if (e.record.following === id) {
        fetchFollowers();
        // Also update follow status if the current user was involved
        if (currentUser && e.record.follower === currentUser.id) {
          if (e.action === 'create') {
            setIsFollowing(true);
            setFollowId(e.record.id);
          } else if (e.action === 'delete') {
            setIsFollowing(false);
            setFollowId(null);
          }
        }
      }
    });

    return () => {
      pb.collection('follows').unsubscribe('*');
    };
  }, [id, currentUser]);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const artistData = await pb.collection('users').getOne(id, { $autoCancel: false });
      setArtist(artistData);

      const songsData = await pb.collection('songs').getList(1, 50, {
        filter: `uploader.id="${id}"`,
        sort: '-created',
        $autoCancel: false
      });
      setSongs(songsData.items);
    } catch (error) {
      console.error('Error fetching artist data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const result = await pb.collection('follows').getList(1, 50, {
        filter: `following.id="${id}"`,
        expand: 'follower',
        sort: '-created',
        $autoCancel: false
      });
      setFollowers(result.items);
      
      // Check if current user is following
      if (currentUser) {
        const myFollow = result.items.find(item => item.follower === currentUser.id);
        if (myFollow) {
          setIsFollowing(true);
          setFollowId(myFollow.id);
        } else {
          setIsFollowing(false);
          setFollowId(null);
        }
      }
    } catch (error) {
      console.error('Error fetching followers:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) return alert('Please login to follow artists');
    
    try {
      if (isFollowing && followId) {
        await pb.collection('follows').delete(followId);
        // State updates handled by subscription
      } else {
        await pb.collection('follows').create({
          follower: currentUser.id,
          following: id
        });
        // State updates handled by subscription
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400">Loading artist profile...</div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-gray-400">Artist not found</div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${artist.username} - NovaSound TITAN LUX`}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Artist Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 mb-8 border border-gray-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
              {artist.avatar ? (
                <img
                  src={pb.files.getUrl(artist, artist.avatar)}
                  alt={artist.username}
                  className="w-40 h-40 rounded-full object-cover border-4 border-cyan-500 shadow-xl"
                />
              ) : (
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center border-4 border-cyan-500 shadow-xl">
                  <Music className="w-20 h-20 text-white" />
                </div>
              )}

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold text-white mb-2">{artist.username}</h1>
                <p className="text-gray-400 mb-6 max-w-2xl">{artist.bio || 'No bio available'}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-6 mb-6">
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">{songs.length}</div>
                    <div className="text-sm text-gray-400">Songs</div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">{followers.length}</div>
                    <div className="text-sm text-gray-400">Followers</div>
                  </div>
                </div>

                {currentUser && currentUser.id !== artist.id && (
                  <Button 
                    onClick={handleFollow}
                    className={`${isFollowing ? 'bg-gray-700 hover:bg-gray-600' : 'bg-cyan-600 hover:bg-cyan-700'} text-white min-w-[140px]`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Songs Column */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-white mb-6">Popular Tracks</h2>
              {songs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {songs.map((song) => (
                    <SongCard 
                      key={song.id} 
                      song={song} 
                      onPlay={setCurrentSong} 
                      isPlaying={currentSong?.id === song.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No songs uploaded yet.
                </div>
              )}
            </div>

            {/* Followers Column */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Followers</h2>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 max-h-[600px] overflow-y-auto">
                {followers.length > 0 ? (
                  <div className="space-y-4">
                    {followers.map((follow) => {
                      const follower = follow.expand?.follower;
                      if (!follower) return null;
                      return (
                        <div key={follow.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg transition-colors">
                          {follower.avatar ? (
                            <img 
                              src={pb.files.getUrl(follower, follower.avatar)} 
                              alt={follower.username} 
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{follower.username}</div>
                            <div className="text-xs text-gray-500">
                              Followed {new Date(follow.created).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No followers yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <Footer />
        {currentSong && <AudioPlayer currentSong={currentSong} />}
      </div>
    </>
  );
};

export default ArtistProfilePage;