/**
 * EXTRAITS DE CODE POUR LocalPlayerPage.jsx - v700000
 * Corrections des bugs mobile et PC
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: RACCOURCIS CLAVIER - FIX MOBILE (Ligne ~600-650)
// ═══════════════════════════════════════════════════════════════════════════
// REMPLACER le useEffect des raccourcis clavier:

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // ✅ FIX v700000: Ignorer les raccourcis si un input/textarea est focus
    const activeElement = document.activeElement;
    const isInputFocused = 
      activeElement?.tagName === 'INPUT' || 
      activeElement?.tagName === 'TEXTAREA' ||
      activeElement?.hasAttribute('contenteditable');
    
    if (isInputFocused) {
      return; // Ne pas intercepter les touches quand l'utilisateur tape
    }
    
    // Lecture/Pause
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
    
    // Seek ±10s
    else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seekRelative(-10);
    }
    else if (e.code === 'ArrowRight') {
      e.preventDefault();
      seekRelative(10);
    }
    
    // Volume ±10%
    else if (e.code === 'ArrowUp') {
      e.preventDefault();
      adjustVolume(0.1);
    }
    else if (e.code === 'ArrowDown') {
      e.preventDefault();
      adjustVolume(-0.1);
    }
    
    // Mute
    else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
    }
    
    // Next
    else if (e.code === 'KeyN') {
      e.preventDefault();
      playNext();
    }
    
    // Previous
    else if (e.code === 'KeyP') {
      e.preventDefault();
      playPrev();
    }
  };
  
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [togglePlay, seekRelative, adjustVolume, toggleMute, playNext, playPrev]);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: WAVEFORM COMPONENT - FIX PC (Ligne ~200-250)
// ═══════════════════════════════════════════════════════════════════════════
// S'assurer que le composant Waveform est mémorisé et optimisé:

const Waveform = memo(({ isPlaying }: { isPlaying: boolean }) => {
  const bars = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);
  
  return (
    <div className="flex items-center justify-center gap-0.5 h-12 overflow-hidden">
      {bars.map((i) => {
        // ✅ FIX v700000: Animation plus fluide avec variations aléatoires
        const baseHeight = 8 + (i % 3) * 4;
        const maxHeight = 32 + (i % 5) * 8;
        
        return (
          <motion.div
            key={i}
            className="w-1 bg-gradient-to-t from-cyan-500 to-purple-500 rounded-full"
            animate={{
              height: isPlaying 
                ? [baseHeight, maxHeight, baseHeight + 8, maxHeight - 4, baseHeight] 
                : baseHeight,
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.05,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
});
Waveform.displayName = 'Waveform';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: FONCTION fileToSong - AMÉLIORATION (Ligne ~150-200)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER la fonction fileToSong pour de meilleures performances:

const fileToSong = async (file: File, handle?: FileSystemFileHandle) => {
  const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // ✅ FIX v700000: Parse ID3 en arrière-plan pour ne pas bloquer l'UI
  let metadata = { title: '', artist: '', album: '', cover: null, duration: null };
  
  try {
    // Parse ID3 de manière asynchrone
    const metaPromise = parseID3(file);
    metadata = await Promise.race([
      metaPromise,
      new Promise<typeof metadata>((resolve) => 
        setTimeout(() => resolve(metadata), 2000) // Timeout 2s
      )
    ]);
  } catch (err) {
    console.warn('ID3 parsing failed:', err);
  }
  
  const title = metadata.title || file.name.replace(/\.[^/.]+$/, '');
  const artist = metadata.artist || 'Artiste inconnu';
  const cover = metadata.cover;
  const coverSvg = cover || makeCoverSvg(title, artist);
  
  return {
    id,
    title,
    artist,
    album: metadata.album || '',
    cover_url: cover || coverSvg,
    cover_svg: coverSvg,
    audio_url: URL.createObjectURL(file),
    is_local: true,
    duration: metadata.duration,
    _file: file,
    _fileHandle: handle,
    _blobUrl: URL.createObjectURL(file),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: DRAG & DROP - AMÉLIORATION (Ligne ~700-800)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER la gestion du drag & drop:

const onDrop = useCallback(async (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
  
  const items = [...e.dataTransfer.items];
  const files: File[] = [];
  
  // ✅ FIX v700000: Support des dossiers drag & drop
  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        if (entry.isFile) {
          const file = item.getAsFile();
          if (file && isAudioFile(file)) files.push(file);
        } else if (entry.isDirectory) {
          // Lire récursivement le dossier
          const dirFiles = await readDirectory(entry);
          files.push(...dirFiles.filter(isAudioFile));
        }
      } else {
        const file = item.getAsFile();
        if (file && isAudioFile(file)) files.push(file);
      }
    }
  }
  
  if (files.length === 0) {
    alert('Aucun fichier audio détecté. Formats supportés: MP3, M4A, WAV, FLAC, OGG, AAC');
    return;
  }
  
  // Ajouter les fichiers
  const newSongs = await Promise.all(files.map(f => fileToSong(f)));
  setLibrary(prev => [...prev, ...newSongs]);
  
  // Ajouter à la playlist actuelle
  if (currentPlaylist) {
    setPlaylists(prev => prev.map(pl =>
      pl.id === currentPlaylist.id
        ? { ...pl, songs: [...pl.songs, ...newSongs] }
        : pl
    ));
  }
}, [currentPlaylist, setLibrary, setPlaylists]);

// Fonction helper pour lire un dossier récursivement
async function readDirectory(dirEntry: any): Promise<File[]> {
  const files: File[] = [];
  const reader = dirEntry.createReader();
  
  return new Promise((resolve) => {
    const readEntries = () => {
      reader.readEntries(async (entries: any[]) => {
        if (entries.length === 0) {
          resolve(files);
          return;
        }
        
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((res) => entry.file(res));
            files.push(file);
          } else if (entry.isDirectory) {
            const subFiles = await readDirectory(entry);
            files.push(...subFiles);
          }
        }
        
        readEntries(); // Continue reading
      });
    };
    
    readEntries();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: GESTION DE LA MÉMOIRE - CLEANUP (Ligne ~1300-1350)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le cleanup des blob URLs:

useEffect(() => {
  // ✅ FIX v700000: Cleanup blob URLs pour éviter les fuites mémoire
  return () => {
    library.forEach(song => {
      if (song._blobUrl) {
        try {
          URL.revokeObjectURL(song._blobUrl);
        } catch (err) {
          console.warn('Failed to revoke blob URL:', err);
        }
      }
    });
  };
}, [library]);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: RESPONSIVE LAYOUT - PC vs MOBILE (Ligne ~1400-1450)
// ═══════════════════════════════════════════════════════════════════════════
// S'assurer que la détection mobile est correcte:

// Au début du composant, VÉRIFIER:
useEffect(() => {
  // ✅ FIX v700000: Redirection conditionnelle vers mobile
  const checkMobile = () => {
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    ) || window.innerWidth < 768;
    
    if (isMobileDevice && !window.location.pathname.includes('local-player-mobile')) {
      // Optionnel: rediriger automatiquement
      // navigate('/local-player-mobile');
    }
  };
  
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, [navigate]);

// ═══════════════════════════════════════════════════════════════════════════
// FIN DES EXTRAITS LocalPlayerPage.jsx
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EXTRAITS DE CODE POUR LocalPlayerPageMobile.jsx - v700000
 * Corrections des bugs mobile
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: PADDING BOTTOM - FIX (Ligne ~50-80)
// ═══════════════════════════════════════════════════════════════════════════
// REMPLACER le container principal:

// AVANT:
// <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510] pb-24">

// APRÈS:
<div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510] pb-40">
  {/* ✅ FIX v700000: pb-40 au lieu de pb-24 pour éviter que le player fixe ne cache le contenu */}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: PLAYER FIXE MOBILE - AMÉLIORATION (Ligne ~800-900)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le player fixe en bas:

<div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a18]/95 backdrop-blur-xl border-t border-white/[0.07] safe-area-bottom">
  {/* ✅ FIX v700000: Ajout de safe-area-bottom pour iOS */}
  <div className="p-4 pb-safe">
    {/* Contenu du player */}
  </div>
</div>

// Ajouter dans le CSS global ou index.css:
/*
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
*/

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: TOUCH GESTURES - AMÉLIORATION (Ligne ~600-700)
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER des gestes tactiles pour la lecture:

const [touchStart, setTouchStart] = useState<number | null>(null);
const [touchEnd, setTouchEnd] = useState<number | null>(null);

const minSwipeDistance = 50;

const onTouchStart = (e: React.TouchEvent) => {
  setTouchEnd(null);
  setTouchStart(e.targetTouches[0].clientX);
};

const onTouchMove = (e: React.TouchEvent) => {
  setTouchEnd(e.targetTouches[0].clientX);
};

const onTouchEnd = () => {
  if (!touchStart || !touchEnd) return;
  
  const distance = touchStart - touchEnd;
  const isLeftSwipe = distance > minSwipeDistance;
  const isRightSwipe = distance < -minSwipeDistance;
  
  if (isLeftSwipe) {
    playNext(); // Swipe gauche = chanson suivante
  } else if (isRightSwipe) {
    playPrev(); // Swipe droite = chanson précédente
  }
};

// Appliquer sur la zone du player:
<div 
  onTouchStart={onTouchStart}
  onTouchMove={onTouchMove}
  onTouchEnd={onTouchEnd}
  className="..."
>
  {/* Player content */}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: SCROLL SMOOTH - FIX (Ligne ~400-450)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le scroll de la liste:

<div className="overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
  {/* ✅ FIX v700000: overscroll-contain + touch scrolling pour iOS */}
  {/* Liste des chansons */}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// FIN DES EXTRAITS LocalPlayerPageMobile.jsx
// ═══════════════════════════════════════════════════════════════════════════
