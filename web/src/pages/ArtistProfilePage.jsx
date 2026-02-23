import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import { Button } from '@/components/ui/button';
import FollowButton from '@/components/FollowButton';
import { Music, UserPlus, UserCheck, User } from 'lucide-react';

const ArtistProfilePage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);

  useEffect(() => {
    fetchArtistData();
    fetchFollowers();
  }, [id, currentUser]);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const [{ data: artistData, error: artistError }, { data: songsData, error: songsError }] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('songs')
          .select('*')
          .eq('uploader_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);
      if (artistError) throw artistError;
      if (songsError) throw songsError;
      setArtist(artistData);
      setSongs(songsData || []);
    } catch (error) {
      console.error('Error fetching artist data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('*')
        .eq('following_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (followsError) throw followsError;

      const followerIds = (followsData || []).map((f) => f.follower_id);
      if (followerIds.length === 0) {
        setFollowers([]);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', followerIds);
      if (usersError) throw usersError;

      const byId = new Map((usersData || []).map((u) => [u.id, u]));
      const merged = (followsData || []).map((f) => ({
        ...f,
        follower: byId.get(f.follower_id) || null,
      }));
      setFollowers(merged);
    } catch (error) {
      console.error('Error fetching followers:', error);
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
              {artist?.avatar_url ? (
                <img
                  src={artist.avatar_url}
                  alt={artist.username || 'Artist'}
                  className="w-40 h-40 rounded-full object-cover border-4 border-cyan-500 shadow-xl"
                />
              ) : (
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center border-4 border-cyan-500 shadow-xl">
                  <Music className="w-20 h-20 text-white" />
                </div>
              )}

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold text-white mb-2">{artist?.username || 'Unknown Artist'}</h1>
                <p className="text-gray-400 mb-6 max-w-2xl">{artist?.bio || 'No bio available'}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-6 mb-6">
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">{songs?.length || 0}</div>
                    <div className="text-sm text-gray-400">Songs</div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">{followers?.length || 0}</div>
                    <div className="text-sm text-gray-400">Followers</div>
                  </div>
                </div>

                {currentUser && currentUser.id !== artist?.id && (
                  <FollowButton 
                    userId={artist?.id}
                    initialFollowers={artist?.followers_count || followers?.length || 0}
                  />
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
                      const follower = follow.follower;
                      if (!follower) return null;
                      return (
                        <div key={follow.id} className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg transition-colors">
                          {follower.avatar_url ? (
                            <img 
                              src={follower.avatar_url} 
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
                              Followed {new Date(follow.created_at || Date.now()).toLocaleDateString()}
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