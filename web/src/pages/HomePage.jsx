import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Music, Play, TrendingUp, Newspaper } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import { Button } from '@/components/ui/button';

const HomePage = () => {
  const [featuredSongs, setFeaturedSongs] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Timeout de sécurité pour éviter le loading infini
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000); // 5 secondes max

    try {
      const [{ data: songs, error: songsError }, { data: news, error: newsError }] = await Promise.all([
        supabase
          .from('songs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('news')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(6)
      ]);

      if (songsError) throw songsError;
      if (newsError) {
        setNewsItems([]);
      } else {
        setNewsItems(news || []);
      }

      setFeaturedSongs(songs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      // En cas d'erreur, afficher quand même les données vides
      setFeaturedSongs([]);
      setNewsItems([]);
    } finally {
      clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const playSong = (song) => {
    setCurrentSong(song);
  };

  return (
    <>
      <Helmet>
        <title>NovaSound-Titan - Discover Amazing Music</title>
        <meta name="description" content="Stream and discover the latest music on NovaSound-Titan. Upload your tracks and connect with music lovers worldwide." />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32 relative overflow-x-hidden">
        {/* Background personnalisé */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{
            backgroundImage: 'url(/background.png)',
            zIndex: -1
          }}
        />
        <div className="absolute inset-0 bg-gray-950/80" /> {/* Overlay pour lisibilité */}
        
        <Header />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[500px] md:h-[600px] overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950 bg-cover bg-center"
              style={{
                backgroundImage: 'url(https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/e8ebebbd32c0e37f6ab462c275dd560a.jpg)'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-magenta-500/20" />
            
            <div className="relative container mx-auto px-4 h-full flex items-center justify-center md:justify-start text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-3xl"
              >
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-cyan-400 via-white to-magenta-500 bg-clip-text text-transparent leading-tight">
                  Feel the Sound Wave
                </h1>
                <p className="text-lg md:text-2xl text-gray-300 mb-6 md:mb-8 max-w-xl mx-auto md:mx-0">
                  Discover, stream, and share music that moves you. Join the revolution.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white text-lg px-8 py-6 font-semibold shadow-lg shadow-cyan-500/30">
                      Get Started
                    </Button>
                  </Link>
                  <Link to="/upload" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-lg px-8 py-6 font-semibold">
                      Upload Music
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Featured Songs */}
          <section className="container mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                Featured Tracks
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin"></div>
                  <div className="text-cyan-400 text-lg">Chargement des morceaux...</div>
                </div>
              </div>
            ) : featuredSongs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {featuredSongs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl overflow-hidden hover:border-cyan-400 transition-all group"
                  >
                    <div className="relative aspect-square">
                      {song.cover_url ? (
                        <img
                          src={song.cover_url}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
                          <Music className="w-16 h-16 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => playSong(song)}
                          className="p-4 rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 transform hover:scale-110 transition-all shadow-lg shadow-cyan-500/50"
                        >
                          <Play className="w-6 h-6 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-semibold truncate">{song.title}</h3>
                      <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                      {song.uploader_id && (
                        <p className="text-gray-500 text-xs mt-1 truncate">
                          by {song.uploader_id}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl">
                <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No songs available yet</p>
              </div>
            )}
          </section>

          {/* News Feed */}
          <section className="container mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                <Newspaper className="w-6 h-6 md:w-8 md:h-8 text-magenta-400" />
                Latest News
              </h2>
            </div>

            {newsItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsItems.map((news, index) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-900/50 backdrop-blur-xl border border-magenta-500/30 rounded-xl p-6 hover:border-magenta-400 transition-all"
                  >
                    <h3 className="text-xl font-bold text-white mb-3">{news.title}</h3>
                    <p className="text-gray-400 mb-4 line-clamp-3">{news.content}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {news.author_id || 'Anonymous'}
                      </span>
                      <span className="text-gray-500">
                        {new Date(news.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-magenta-400">
                      <span>❤️ {news.likes_count || 0} likes</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-900/50 backdrop-blur-xl border border-magenta-500/30 rounded-xl">
                <Newspaper className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No news available yet</p>
              </div>
            )}
          </section>
        </main>

        <Footer />
        {currentSong && <AudioPlayer currentSong={currentSong} />}
      </div>
    </>
  );
};

export default HomePage;