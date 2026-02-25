import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AudioPlayer from '@/components/AudioPlayer';
import SongCard from '@/components/SongCard';
import FollowButton from '@/components/FollowButton';
import { Music, User, Users, Headphones, Calendar } from 'lucide-react';
import { formatPlays } from '@/lib/utils';

const ArtistProfilePage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);

  useEffect(() => {
    if (id) {
      fetchArtistData();
      fetchFollowers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      const [{ data: artistData, error: artistError }, { data: songsData, error: songsError }] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).single(),
        supabase.from('songs').select('*').eq('uploader_id', id).order('plays_count', { ascending: false }).limit(50)
      ]);
      if (artistError) throw artistError;
      if (songsError) throw songsError;
      setArtist(artistData);
      setSongs(songsData || []);
    } catch (error) {
      console.error('Erreur chargement artiste:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const { data: followsData } = await supabase
        .from('follows').select('follower_id, created_at').eq('following_id', id);
      if (!followsData?.length) { setFollowers([]); return; }

      const followerIds = followsData.map(f => f.follower_id);
      const { data: usersData } = await supabase
        .from('users').select('id, username, avatar_url').in('id', followerIds);

      const byId = new Map((usersData || []).map(u => [u.id, u]));
      setFollowers(followsData.map(f => ({ ...f, user: byId.get(f.follower_id) || null })));
    } catch (error) {
      console.error('Erreur chargement abonnés:', error);
    }
  };

  // Calcul total écoutes
  const totalPlays = songs.reduce((sum, s) => sum + (s.plays_count || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Artiste introuvable</p>
            <Link to="/" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">← Retour à l'accueil</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === artist.id;

  return (
    <>
      <Helmet>
        <title>{`${artist.username || 'Artiste'} — NovaSound TITAN LUX`}</title>
        <meta name="description" content={artist.bio || `Découvrez les morceaux de ${artist.username}`} />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">

          {/* ── Header artiste ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-cyan-950/30 rounded-2xl p-6 md:p-8 mb-8 border border-cyan-500/20 overflow-hidden"
          >
            {/* Fond décoratif */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-magenta-500/8 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
              {/* Avatar */}
              {artist.avatar_url ? (
                <img
                  src={artist.avatar_url}
                  alt={artist.username}
                  className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-cyan-500/50 shadow-xl shadow-cyan-500/20 flex-shrink-0"
                />
              ) : (
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center border-4 border-cyan-500/50 shadow-xl flex-shrink-0">
                  <Music className="w-14 h-14 text-white" />
                </div>
              )}

              {/* Infos */}
              <div className="flex-1 text-center md:text-left min-w-0 w-full overflow-hidden">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 break-words truncate">
                  {artist.username || 'Artiste inconnu'}
                </h1>
                {artist.bio && (
                  <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-lg break-words line-clamp-3">{artist.bio}</p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-5 justify-center md:justify-start mb-5">
                  <div className="text-center">
                    <div className="text-xl font-bold text-cyan-400">{songs.length}</div>
                    <div className="text-xs text-gray-500">Morceaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-fuchsia-400">{followers.length}</div>
                    <div className="text-xs text-gray-500">Abonnés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{formatPlays(totalPlays)}</div>
                    <div className="text-xs text-gray-500">Écoutes</div>
                  </div>
                  {artist.created_at && (
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-300 flex items-center gap-1 justify-center">
                        <Calendar className="w-4 h-4" />
                        {new Date(artist.created_at).getFullYear()}
                      </div>
                      <div className="text-xs text-gray-500">Membre depuis</div>
                    </div>
                  )}
                </div>

                {/* Bouton follow — seulement si ce n'est pas son propre profil */}
                {!isOwnProfile && currentUser && (
                  <FollowButton
                    userId={artist.id}
                    initialFollowers={followers.length}
                    onFollowChange={(nowFollowing, newCount) => {
                      // Resynchroniser la liste des abonnés affichée dans le header
                      fetchFollowers();
                    }}
                  />
                )}
                {isOwnProfile && (
                  <Link to="/profile" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white text-sm transition-all">
                    ✏️ Modifier mon profil
                  </Link>
                )}
                {!currentUser && (
                  <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 text-sm transition-all">
                    Se connecter pour s'abonner
                  </Link>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Contenu en 2 colonnes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Morceaux */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Music className="w-5 h-5 text-cyan-400" />
                Morceaux
                <span className="text-sm text-gray-500 font-normal ml-1">({songs.length})</span>
              </h2>

              {songs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {songs.map((song, i) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <SongCard
                        song={song}
                        onPlay={setCurrentSong}
                        isPlaying={currentSong?.id === song.id}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14 bg-gray-900/40 border border-gray-800 rounded-2xl">
                  <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun morceau uploadé pour l'instant.</p>
                </div>
              )}
            </div>

            {/* Abonnés */}
            <div>
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-fuchsia-400" />
                Abonnés
                <span className="text-sm text-gray-500 font-normal ml-1">({followers.length})</span>
              </h2>

              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-3">
                {followers.length > 0 ? (
                  followers.map((follow) => {
                    const u = follow.user;
                    if (!u) return null;
                    return (
                      <Link
                        key={follow.follower_id}
                        to={`/artist/${follow.follower_id}`}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800/60 rounded-xl transition-colors group"
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate group-hover:text-cyan-400 transition-colors">
                            {u.username || 'Utilisateur'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(follow.created_at || Date.now()).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aucun abonné pour l'instant.</p>
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
