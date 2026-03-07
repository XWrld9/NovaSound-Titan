/**
 * EXTRAITS DE CODE POUR LiveListPage.jsx - v700000
 * Remplacer les sections correspondantes dans le fichier original
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: IMPORTS (Ligne ~14-29)
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER cet import:
import { ALL_GENRES, GENRE_THEMES_MAP } from '@/hooks/useGenreTheme';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: GENRES (Ligne ~31-46) - REMPLACER COMPLÈTEMENT
// ═══════════════════════════════════════════════════════════════════════════
const GENRES = [
  { id: 'all', name: 'Tous', color: 'from-cyan-500 to-purple-500' },
  // Genres camerounais en premier
  { id: 'bikutsi', name: 'Bikutsi', color: 'from-red-600 to-red-800' },
  { id: 'makossa', name: 'Makossa', color: 'from-yellow-600 to-yellow-800' },
  { id: 'assiko', name: 'Assiko', color: 'from-green-600 to-green-800' },
  { id: 'ambas-bay', name: 'Ambas-Bay', color: 'from-blue-600 to-blue-800' },
  { id: 'benskin', name: 'Benskin', color: 'from-purple-600 to-purple-800' },
  { id: 'mbole', name: 'Mbolé', color: 'from-orange-600 to-orange-800' },
  // Genres africains et mondiaux
  { id: 'afrobeats', name: 'Afrobeats', color: 'from-amber-600 to-amber-800' },
  { id: 'hip-hop', name: 'Hip-Hop', color: 'from-violet-600 to-violet-800' },
  { id: 'r&b', name: 'R&B', color: 'from-pink-600 to-pink-800' },
  { id: 'pop', name: 'Pop', color: 'from-cyan-600 to-cyan-800' },
  { id: 'electronique', name: 'Électronique', color: 'from-emerald-600 to-emerald-800' },
  { id: 'trap', name: 'Trap', color: 'from-red-600 to-red-800' },
  { id: 'gospel', name: 'Gospel', color: 'from-orange-600 to-orange-800' },
  { id: 'jazz', name: 'Jazz', color: 'from-violet-600 to-violet-800' },
  { id: 'reggae', name: 'Reggae', color: 'from-lime-600 to-lime-800' },
  { id: 'dancehall', name: 'Dancehall', color: 'from-yellow-600 to-yellow-800' },
  { id: 'amapiano', name: 'Amapiano', color: 'from-emerald-600 to-emerald-800' },
  { id: 'coupe-decale', name: 'Coupé-Décalé', color: 'from-pink-600 to-pink-800' },
  { id: 'rock', name: 'Rock', color: 'from-orange-600 to-orange-800' },
  { id: 'classique', name: 'Classique', color: 'from-yellow-600 to-yellow-800' },
  { id: 'folk', name: 'Folk', color: 'from-green-600 to-green-800' },
  { id: 'country', name: 'Country', color: 'from-amber-600 to-amber-800' },
  { id: 'latin', name: 'Latin', color: 'from-red-600 to-red-800' },
  { id: 'drill', name: 'Drill', color: 'from-slate-600 to-slate-800' },
  { id: 'outro', name: 'Outro', color: 'from-purple-600 to-purple-800' },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: FONCTION DE FILTRAGE (Ligne ~92-117) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// Dans la fonction filteredRooms, REMPLACER la ligne qui vérifie le genre:

// AVANT:
// const matchesGenre = selectedGenre === 'all' || room.genre === selectedGenre;

// APRÈS:
const matchesGenre = selectedGenre === 'all' || 
  room.genre?.toLowerCase().replace(/[é&\s]/g, (m) => 
    ({é:'e','&':'','  ':' ',' ':'-'})[m]||m
  ) === selectedGenre;

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: STYLE PRINCIPAL (Ligne ~145-150) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// REMPLACER:
// <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">

// PAR:
<div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a18] to-[#050510]">

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: HEADER STYLE (Ligne ~155-165) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// CHERCHER le header et REMPLACER son background:

// AVANT:
// <div className="bg-gray-900/95 backdrop-blur-xl border-b border-white/10">

// APRÈS:
<div className="bg-[#0a0a18]/95 backdrop-blur-xl border-b border-white/[0.07]">

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: CARDS DE ROOM STYLE (Ligne ~250-300) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// CHERCHER les cartes de room et AMÉLIORER le style:

// AVANT:
// className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6"

// APRÈS:
className="bg-[#0a0a18]/80 backdrop-blur-xl rounded-2xl border border-white/[0.07] p-6 hover:border-white/[0.12] transition-all duration-300"

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: BOUTONS STYLE (Ligne ~280-320) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// Pour les boutons "Rejoindre":

// AVANT:
// className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500"

// APRÈS:
className="px-6 py-3 bg-gradient-to-r from-cyan-500/90 to-purple-500/90 hover:from-cyan-500 hover:to-purple-500 transition-all duration-300"

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: GENRE BADGES (Ligne ~260-275) - AMÉLIORER
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER une fonction helper au début du composant:

const getGenreColor = (genre: string) => {
  const genreObj = GENRES.find(g => 
    g.name.toLowerCase() === genre?.toLowerCase() || 
    g.id === genre?.toLowerCase().replace(/[é&\s]/g, (m) => 
      ({é:'e','&':'','  ':' ',' ':'-'})[m]||m
    )
  );
  return genreObj?.color || 'from-gray-500 to-gray-600';
};

// Puis utiliser dans le badge de genre:
<div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getGenreColor(room.genre)} text-white`}>
  {room.genre || 'Autre'}
</div>

// ═══════════════════════════════════════════════════════════════════════════
// FIN DES EXTRAITS LiveListPage.jsx
// ═══════════════════════════════════════════════════════════════════════════
