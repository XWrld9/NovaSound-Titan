import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Music, ChevronUp, ChevronDown, Heart, Download, Share2, UserPlus, UserCheck, ExternalLink } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LottieAnimation from '@/components/LottieAnimation';
import playAnimation from '@/animations/play-animation.json';
import { useNavigate } from 'react-router-dom';

const AudioPlayer = ({ currentSong, playlist = [], onNext, onPrevious }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [isExpanded, setIsExpanded] = useState(false);
  const [playRecorded, setPlayRecorded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeId, setLikeId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);

  // Synchroniser le volume avec l'élément audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current && currentSong?.audio_url) {
      audioRef.current.src = currentSong.audio_url;
      audioRef.current.load();
      setPlayRecorded(false);
      setIsPlaying(false); // Reset isPlaying pour éviter la confusion d'état

      if (currentUser) {
        checkLikeStatus();
        checkFollowStatus();
      } else {
        setIsLiked(false);
        setLikeId(null);
        setIsFollowing(false);
        setFollowId(null);
      }
    }
  }, [currentSong]);

  const checkLikeStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('song_id', currentSong.id)
        .maybeSingle();
      if (error) throw error;
      setIsLiked(!!data);
      setLikeId(data?.id || null);
    } catch (err) {
      console.error('Error checking like status:', err);
    }
  };

  const checkFollowStatus = async () => {
    const uploaderId = currentSong?.uploader_id;
    if (!uploaderId) return;
    
    // Don't check if user is the uploader
    if (uploaderId === currentUser.id) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', uploaderId)
        .maybeSingle();
      if (error) throw error;
      setIsFollowing(!!data);
      setFollowId(data?.id || null);
    } catch (err) {
      console.error('Error checking follow status:', err);
    }
  };

  const handleLike = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;

    try {
      if (isLiked && likeId) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('id', likeId);
        if (error) throw error;
        setIsLiked(false);
        setLikeId(null);
      } else {
        const { data, error } = await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            song_id: currentSong.id
          })
          .select('id')
          .single();
        if (error) throw error;
        setIsLiked(true);
        setLikeId(data?.id || null);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleFollow = async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;

    const uploaderId = currentSong?.uploader_id;
    if (!uploaderId) return;
    if (uploaderId === currentUser.id) return;

    try {
      if (isFollowing && followId) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('id', followId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowId(null);
      } else {
        const { data, error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: uploaderId
          })
          .select('id')
          .single();
        if (error) throw error;
        setIsFollowing(true);
        setFollowId(data?.id || null);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleDownload = (e) => {
    e?.stopPropagation();
    if (!currentSong.audio_url) return;
    const url = currentSong.audio_url;
    const link = document.createElement('a');
    link.href = url;
    link.download = currentSong.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (e) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/#/song/${currentSong.id}`;
    const shareData = {
      title: currentSong.title,
      text: `🎵 Écoute "${currentSong.title}" par ${currentSong.artist} sur NovaSound TITAN LUX`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
    // Fallback clipboard
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // execCommand fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-cyan-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 font-medium text-sm';
    toast.textContent = '🔗 Lien copié !';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  };

  const recordPlay = async () => {
    if (playRecorded || !currentSong?.id) return;
    setPlayRecorded(true); // Bloquer immédiatement pour éviter les doublons
    try {
      // Incrémentation atomique via RPC (pas de race condition)
      const { error } = await supabase.rpc('increment_plays', { song_id_param: currentSong.id });
      if (error) {
        // Fallback si la fonction RPC n'existe pas encore dans Supabase
        await supabase
          .from('songs')
          .update({ plays_count: (currentSong.plays_count || 0) + 1 })
          .eq('id', currentSong.id);
      }
    } catch (err) {
      console.error('Erreur enregistrement écoute:', err);
    }
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!audioRef.current || !currentSong) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error('Play error:', err));
      recordPlay(); // Record play when user explicitly plays
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      // Also record play if listened for more than 10 seconds
      if (!playRecorded && audioRef.current.currentTime > 10) {
        recordPlay();
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value) => {
    setVolume(value[0]);
    if (value[0] === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else if (repeat === 'all' || playlist.length > 0) {
      onNext?.();
    } else {
      setIsPlaying(false);
    }
  };

  const cycleRepeat = (e) => {
    e?.stopPropagation();
    const modes = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeat);
    setRepeat(modes[(currentIndex + 1) % modes.length]);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  // Determine if we should show follow button (not own song, authenticated)
  const showFollowButton = currentUser && currentSong?.uploader_id && currentSong.uploader_id !== currentUser.id;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-500/30 shadow-2xl transition-all duration-300 ${
          isExpanded ? 'h-full flex flex-col justify-center' : 'h-auto'
        }`}
        style={{
          backgroundColor: 'rgb(3 7 18 / 0.99)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          paddingBottom: isExpanded ? undefined : 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        <button 
          className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-cyan-500/30 rounded-full p-1 z-10"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronUp className="w-4 h-4 text-cyan-400" />}
        </button>

        <div className={`container mx-auto px-4 py-4 ${isExpanded ? 'flex flex-col h-full justify-center gap-8' : ''}`}>
          
          {isExpanded && (
            <div className="w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20 border border-cyan-500/20">
              {currentSong.cover_url ? (
                <img
                  src={currentSong.cover_url}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center">
                  <Music className="w-24 h-24 text-white" />
                </div>
              )}
            </div>
          )}

          <div className={`mb-2 ${isExpanded ? 'w-full max-w-md mx-auto' : ''}`}>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer py-2"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className={`flex items-center justify-between gap-4 ${isExpanded ? 'flex-col' : ''}`}>
            <div className={`flex items-center gap-4 flex-1 min-w-0 ${isExpanded ? 'flex-col text-center w-full' : ''}`}>
              {!isExpanded && (
                currentSong.cover_url ? (
                  <img
                    src={currentSong.cover_url}
                    alt={currentSong.title}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover shadow-lg"
                    onClick={() => setIsExpanded(true)}
                  />
                ) : (
                  <div 
                    className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center"
                    onClick={() => setIsExpanded(true)}
                  >
                    <Music className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                )
              )}
              <div className="min-w-0 flex-1" onClick={() => !isExpanded && setIsExpanded(true)}>
                {/* Titre avec défilement si trop long */}
                <div className={`text-white font-semibold ${isExpanded ? 'text-2xl mb-1 text-center' : ''} flex items-center gap-2 overflow-hidden`}>
                  {!isExpanded ? (
                    <div className="overflow-hidden flex-1 min-w-0">
                      <div
                        className="whitespace-nowrap"
                        style={{
                          display: 'inline-block',
                          animation: currentSong.title?.length > 22
                            ? 'marquee 8s linear infinite'
                            : 'none',
                          paddingRight: currentSong.title?.length > 22 ? '3rem' : '0'
                        }}
                      >
                        {currentSong.title}
                      </div>
                    </div>
                  ) : (
                    <span className="break-words w-full">{currentSong.title}</span>
                  )}
                  {isPlaying && (
                    <LottieAnimation
                      animationData={playAnimation}
                      width={isExpanded ? 28 : 20}
                      height={isExpanded ? 28 : 20}
                      loop={true}
                      autoplay={true}
                      className="flex-shrink-0 opacity-90"
                    />
                  )}
                </div>
                <div className={`flex items-center gap-2 ${isExpanded ? 'justify-center flex-wrap' : ''}`}>
                  <div className={`text-gray-400 text-sm truncate ${isExpanded ? 'text-lg' : ''}`}>{currentSong.artist}</div>
                  
                  {/* Bouton Abonner dans le player */}
                  {showFollowButton && (
                    <button
                      onClick={handleFollow}
                      className={`ml-2 px-2 py-0.5 text-xs rounded-full border transition-all flex items-center gap-1 ${
                        isFollowing 
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 hover:bg-red-500/20 hover:border-red-500 hover:text-red-400' 
                          : 'bg-transparent border-gray-600 text-gray-400 hover:border-cyan-500 hover:text-cyan-400'
                      }`}
                      title={isFollowing ? "Se désabonner" : "S'abonner"}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span className="hidden sm:inline">Abonné</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span className="hidden sm:inline">S'abonner</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
                    <button onClick={handleLike} className={`${isLiked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'} transition-colors`}>
                      <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={handleDownload} className="text-gray-400 hover:text-cyan-400 transition-colors">
                      <Download className="w-6 h-6" />
                    </button>
                    <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors">
                      <Share2 className="w-6 h-6" />
                    </button>
                    {/* Bouton Voir le profil de l'artiste */}
                    {currentSong?.uploader_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/artist/${currentSong.uploader_id}`); setIsExpanded(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 transition-all text-xs font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Voir le profil
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`flex items-center gap-4 md:gap-6 ${isExpanded ? 'w-full justify-center py-4' : ''}`}>
              <button
                onClick={(e) => { e.stopPropagation(); setShuffle(!shuffle); }}
                className={`p-2 rounded-full transition-all ${
                  shuffle ? 'text-cyan-400 bg-cyan-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Shuffle className={`${isExpanded ? 'w-6 h-6' : 'w-5 h-5'}`} />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onPrevious?.(); }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={!onPrevious}
              >
                <SkipBack className={`${isExpanded ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>

              <button
                onClick={togglePlay}
                className={`rounded-full bg-gradient-to-r from-cyan-500 to-magenta-500 hover:from-cyan-600 hover:to-magenta-600 text-white shadow-lg shadow-cyan-500/50 transition-all transform hover:scale-105 flex items-center justify-center ${
                  isExpanded ? 'w-16 h-16' : 'w-12 h-12 p-3'
                }`}
              >
                {isPlaying ? 
                  <Pause className={`${isExpanded ? 'w-8 h-8' : 'w-6 h-6'}`} /> : 
                  <Play className={`${isExpanded ? 'w-8 h-8 ml-1' : 'w-6 h-6 ml-1'}`} />
                }
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={!onNext}
              >
                <SkipForward className={`${isExpanded ? 'w-8 h-8' : 'w-6 h-6'}`} />
              </button>

              <button
                onClick={cycleRepeat}
                className={`p-2 rounded-full transition-all relative ${
                  repeat !== 'off' ? 'text-cyan-400 bg-cyan-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Repeat className={`${isExpanded ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {repeat === 'one' && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-cyan-400 font-bold leading-none">
                    1
                  </span>
                )}
              </button>
            </div>

            <div className={`flex items-center gap-3 flex-1 justify-end ${isExpanded ? 'w-full max-w-md mx-auto' : 'hidden md:flex'}`}>
              {!isExpanded && (
                <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
                  <button onClick={handleLike} className={`${isLiked ? 'text-magenta-500' : 'text-gray-400 hover:text-magenta-500'}`}>
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={handleDownload} className="text-gray-400 hover:text-cyan-400">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={handleShare} className="text-gray-400 hover:text-white">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <div className="w-24 md:w-32">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AudioPlayer;