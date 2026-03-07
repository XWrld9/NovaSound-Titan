// ============================================================
// CORRECTIONS DU LECTEUR AUDIO - AudioPlayer.jsx
// ============================================================

// REMPLACER la fonction handleEnded existante par celle-ci :

const handleEnded = () => {
  console.log('[AudioPlayer] Song ended, repeat:', repeat, 'playlist length:', playlist.length);
  
  if (repeat === 'one') {
    // Recommencer la même chanson
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(err => {
      console.error('[AudioPlayer] Repeat play error:', err);
      // Si erreur, essayer de passer à la suivante
      if (playlist.length > 0) {
        onNext?.();
      }
    });
  } else if (repeat === 'all' || playlist.length > 0) {
    // Passer à la chanson suivante
    onNext?.();
  } else {
    // Lecture terminée, pas de playlist, pas de repeat
    console.log('[AudioPlayer] Playback completed - no more songs');
    setIsPlaying(false);
    // Optionnel : montrer une notification ou recommencer automatiquement
  }
};

// ============================================================
// CORRECTIONS POUR LES ERREURS DE PLAY
// ============================================================

// DANS la fonction togglePlay (autour de la ligne 205-210) :

const togglePlay = () => {
  if (!audioRef.current) return;
  
  if (isPlaying) {
    audioRef.current.pause();
    setIsPlaying(false);
  } else {
    audioRef.current.play().catch(err => {
      console.error('[AudioPlayer] Play error:', err);
      setIsPlaying(false);
      // Essayer de recharger ou passer à une autre chanson
      if (audioRef.current) {
        audioRef.current.load();
      }
    });
    setIsPlaying(true);
    recordPlay();
  }
};

// ============================================================
// CORRECTIONS POUR LE MINI-PLAYER POSITION
// ============================================================

// Vérifier le CSS du mini-player pour s'assurer qu'il est en bas de page

// Dans App.jsx ou le composant parent, s'assurer que le AudioPlayer est correctement positionné
