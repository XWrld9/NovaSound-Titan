/**
 * EXTRAITS DE CODE POUR LiveRoomPage.jsx - v700000
 * Remplacer les sections correspondantes dans le fichier original
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: IMPORTS (Ligne ~1-50)
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER après les autres imports:
import { ALL_GENRES, GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: GENRE DESCRIPTIONS (Ligne ~60 - APRÈS LES IMPORTS)
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER cette constante:
const GENRE_DESCRIPTIONS: Record<string, string> = {
  'Bikutsi': 'Venez vibrer au rythme du Bikutsi authentique 🔥🇨🇲',
  'Makossa': 'Découvrez le Makossa, la fierté musicale camerounaise 🎵🇨🇲',
  'Assiko': 'Plongez dans les sonorités traditionnelles de l\'Assiko 🌿🇨🇲',
  'Ambas-Bay': 'Explorez le folklore unique d\'Ambas-Bay 🌊🇨🇲',
  'Benskin': 'Savourez les mélodies envoûtantes du Benskin 🎶🇨🇲',
  'Mbolé': 'Ressentez l\'énergie du Mbolé de la forêt équatoriale 🌳🇨🇲',
  'Afrobeats': 'Vibrez sur les meilleurs Afrobeats du moment ! 🔥',
  'Hip-Hop': 'Les flows les plus chauds du Hip-Hop ! 🎤',
  'R&B': 'Détendez-vous avec les meilleures vibes R&B 💫',
  'Pop': 'Les hits Pop qui font vibrer la planète ! 🌟',
  'Électronique': 'Plongez dans l\'univers électronique ! ⚡',
  'Trap': 'Les bangers Trap qui secouent ! 💥',
  'Gospel': 'Louez avec les meilleurs Gospel ! 🙏✨',
  'Jazz': 'Savourez la sophistication du Jazz 🎷',
  'Reggae': 'One Love, One Heart - Vibes Reggae ! 🌴',
  'Dancehall': 'Bougez sur les riddims Dancehall ! 🔊',
  'Amapiano': 'Les pianos d\'Afrique du Sud qui font danser ! 🎹',
  'Coupé-Décalé': 'L\'énergie ivoirienne du Coupé-Décalé ! 🎉',
  'Rock': 'Headbang sur les meilleurs rocks ! 🤘',
  'Classique': 'Appréciez la beauté intemporelle du classique 🎻',
  'Folk': 'Retour aux sources avec le Folk authentique 🌾',
  'Country': 'Les histoires du Country américain ! 🤠',
  'Latin': 'Dansez sur les rythmes latins ! 💃',
  'Drill': 'L\'intensité brute du Drill ! ⚔️',
  'Outro': 'Découvrez des sons uniques et variés ! 🎵',
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: FONCTION createRoom (Ligne ~395-457)
// ═══════════════════════════════════════════════════════════════════════════
// REMPLACER la fonction createRoom complète:

const createRoom = useCallback(async () => {
  if (!currentUser || !roomName.trim() || creatingRoom) return;
  
  setCreatingRoom(true);
  setPhase('creating');
  
  try {
    // Utiliser la description personnalisée ou celle du genre
    const finalDescription = roomDescription?.trim() || 
      (roomGenre && GENRE_DESCRIPTIONS[roomGenre] ? GENRE_DESCRIPTIONS[roomGenre] : 
       'Rejoignez ce live pour découvrir de la musique incroyable !');

    // Créer la salle avec toutes les options
    const { data: roomData, error } = await supabase
      .from('live_rooms')
      .insert({
        name: roomName.trim(),
        description: finalDescription,
        genre: roomGenre || null,
        max_participants: maxParticipants,
        host_id: currentUser.id,
        is_active: true,
        is_private: isPrivate,
        participants_count: 1,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Ajouter l'hôte comme participant avec is_host=true
    await supabase
      .from('live_room_participants')
      .insert({
        room_id: roomData.id,
        user_id: currentUser.id,
        joined_at: new Date().toISOString(),
        is_host: true
      });
    
    // Notifier les followers si public
    if (!isPrivate && currentUser.followers_count > 0) {
      try {
        await supabase.rpc('notify_followers_live_start', {
          p_user_id: currentUser.id,
          p_room_id: roomData.id,
          p_room_name: roomName.trim()
        });
      } catch (notifErr) {
        console.warn('Notification followers échouée:', notifErr);
      }
    }
    
    // Rediriger vers la salle
    navigate(`/live/${roomData.id}`);
    
  } catch (error) {
    console.error('Erreur création salle:', error);
    setPhase('lobby');
    alert(`Impossible de créer le live: ${error.message}`);
  } finally {
    setCreatingRoom(false);
    // Réinitialiser le formulaire
    setRoomName('');
    setRoomDescription('');
    setRoomGenre('');
    setMaxParticipants(20);
    setIsPrivate(false);
  }
}, [currentUser, roomName, roomDescription, roomGenre, maxParticipants, isPrivate, creatingRoom, navigate]);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: STYLE PRINCIPAL (Ligne ~600-650)
// ═══════════════════════════════════════════════════════════════════════════
// CHERCHER toutes les occurrences de backgrounds et REMPLACER:

// AVANT:
// bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900

// APRÈS:
bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510]

// AVANT:
// bg-gray-900/95

// APRÈS:
bg-[#0a0a18]/95

// AVANT:
// bg-white/5

// APRÈS:
bg-[#0a0a18]/50

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: FORMULAIRE CRÉATION - SELECT GENRE (Ligne ~950-1050)
// ═══════════════════════════════════════════════════════════════════════════
// CHERCHER le select de genre et REMPLACER complètement:

<div className="space-y-2">
  <label className="text-sm font-semibold text-gray-300">
    Genre musical
  </label>
  <select
    value={roomGenre}
    onChange={(e) => {
      setRoomGenre(e.target.value);
      // Auto-remplir la description selon le genre si vide
      if (!roomDescription && e.target.value && GENRE_DESCRIPTIONS[e.target.value]) {
        setRoomDescription(GENRE_DESCRIPTIONS[e.target.value]);
      }
    }}
    className="w-full px-4 py-3 bg-[#0a0a18]/70 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
  >
    <option value="">Tous genres</option>
    {ALL_GENRES.map(genre => (
      <option key={genre} value={genre} className="bg-[#0a0a18]">
        {genre}
      </option>
    ))}
  </select>
  {roomGenre && GENRE_DESCRIPTIONS[roomGenre] && (
    <p className="text-xs text-cyan-400/80 mt-1">
      💡 Suggestion: {GENRE_DESCRIPTIONS[roomGenre]}
    </p>
  )}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: TEXTAREA DESCRIPTION (Ligne ~1000-1020)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le textarea de description:

<div className="space-y-2">
  <label className="text-sm font-semibold text-gray-300">
    Description (optionnelle)
  </label>
  <textarea
    value={roomDescription}
    onChange={(e) => setRoomDescription(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        createRoom();
      }
    }}
    placeholder={
      roomGenre && GENRE_DESCRIPTIONS[roomGenre] 
        ? GENRE_DESCRIPTIONS[roomGenre]
        : "Décrivez votre live en quelques mots..."
    }
    rows={3}
    maxLength={200}
    className="w-full px-4 py-3 bg-[#0a0a18]/70 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
  />
  <div className="flex items-center justify-between text-xs">
    <span className="text-gray-500">
      {roomDescription.length}/200 caractères
    </span>
    {!roomDescription && roomGenre && GENRE_DESCRIPTIONS[roomGenre] && (
      <button
        type="button"
        onClick={() => setRoomDescription(GENRE_DESCRIPTIONS[roomGenre])}
        className="text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        Utiliser la suggestion
      </button>
    )}
  </div>
</div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: BOUTON CRÉER LE LIVE (Ligne ~1040-1060)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le bouton:

<button
  onClick={createRoom}
  disabled={!roomName.trim() || creatingRoom}
  className={`
    w-full px-6 py-4 rounded-xl font-bold text-white text-lg
    transition-all duration-300 transform
    ${!roomName.trim() || creatingRoom
      ? 'bg-gray-700 cursor-not-allowed opacity-50'
      : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/30'
    }
  `}
>
  {creatingRoom ? (
    <div className="flex items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      <span>Création en cours...</span>
    </div>
  ) : (
    <div className="flex items-center justify-center gap-2">
      <Radio className="w-5 h-5" />
      <span>Créer le Live</span>
    </div>
  )}
</button>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: CARTES DE ROOM DANS LE LOBBY (Ligne ~700-850)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le style des cartes de room:

<motion.div
  key={room.id}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-[#0a0a18]/80 backdrop-blur-xl rounded-2xl border border-white/[0.07] hover:border-white/[0.12] p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
  onClick={() => joinRoom(room.id)}
>
  {/* Contenu de la carte... */}
  
  {/* Badge de genre */}
  {room.genre && (
    <div className={`
      inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
      bg-gradient-to-r ${GENRE_THEMES_MAP[room.genre]?.bg || 'from-gray-500 to-gray-600'}
      text-white
    `}>
      {room.genre}
    </div>
  )}
  
  {/* Description */}
  <p className="text-gray-400 text-sm mt-2 line-clamp-2">
    {room.description || GENRE_DESCRIPTIONS[room.genre] || 'Rejoignez ce live !'}
  </p>
</motion.div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: CHAT ZONE (Ligne ~1200-1400)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER le style du chat:

<div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#0a0a18]/30 backdrop-blur-sm">
  {messages.map((msg, idx) => (
    <motion.div
      key={msg.id || idx}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        flex items-start gap-3 p-3 rounded-xl
        ${msg.user_id === currentUser?.id 
          ? 'bg-cyan-500/10 border border-cyan-500/20' 
          : 'bg-[#0a0a18]/50 border border-white/[0.05]'
        }
      `}
    >
      {/* Contenu du message... */}
    </motion.div>
  ))}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: INPUT MESSAGE (Ligne ~1400-1450)
// ═══════════════════════════════════════════════════════════════════════════
// AMÉLIORER l'input de message:

<div className="p-4 border-t border-white/[0.07] bg-[#0a0a18]/50 backdrop-blur-xl">
  <form onSubmit={sendMessage} className="flex items-center gap-3">
    <textarea
      value={messageInput}
      onChange={(e) => setMessageInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(e);
        }
      }}
      placeholder="Écrivez votre message..."
      maxLength={500}
      rows={1}
      className="flex-1 px-4 py-3 bg-[#0a0a18]/70 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
    />
    <button
      type="submit"
      disabled={!messageInput.trim()}
      className={`
        px-5 py-3 rounded-xl font-semibold transition-all
        ${messageInput.trim()
          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white'
          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }
      `}
    >
      Envoyer
    </button>
  </form>
</div>

// ═══════════════════════════════════════════════════════════════════════════
// FIN DES EXTRAITS LiveRoomPage.jsx
// ═══════════════════════════════════════════════════════════════════════════
