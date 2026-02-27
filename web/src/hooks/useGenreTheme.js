/**
 * useGenreTheme — NovaSound TITAN LUX v30
 * Fournit une palette de couleurs dynamique selon le genre musical en lecture.
 * Utilisé par AudioPlayer pour l'accentuation couleur du player.
 */

const GENRE_THEMES = {
  'Afrobeats':      { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245,158,11,0.35)', bg: 'from-amber-950/40 to-gray-950' },
  'Hip-Hop':        { primary: '#8b5cf6', secondary: '#7c3aed', glow: 'rgba(139,92,246,0.35)', bg: 'from-violet-950/40 to-gray-950' },
  'R&B':            { primary: '#ec4899', secondary: '#db2777', glow: 'rgba(236,72,153,0.35)', bg: 'from-pink-950/40 to-gray-950' },
  'Pop':            { primary: '#06b6d4', secondary: '#0891b2', glow: 'rgba(6,182,212,0.35)',  bg: 'from-cyan-950/40 to-gray-950'  },
  'Électronique':   { primary: '#00ffcc', secondary: '#10b981', glow: 'rgba(0,255,204,0.35)',  bg: 'from-emerald-950/40 to-gray-950' },
  'Trap':           { primary: '#ef4444', secondary: '#dc2626', glow: 'rgba(239,68,68,0.35)',  bg: 'from-red-950/40 to-gray-950'   },
  'Gospel':         { primary: '#f97316', secondary: '#ea580c', glow: 'rgba(249,115,22,0.35)', bg: 'from-orange-950/40 to-gray-950' },
  'Jazz':           { primary: '#a78bfa', secondary: '#8b5cf6', glow: 'rgba(167,139,250,0.35)',bg: 'from-violet-950/40 to-gray-950' },
  'Reggae':         { primary: '#84cc16', secondary: '#65a30d', glow: 'rgba(132,204,22,0.35)', bg: 'from-lime-950/40 to-gray-950'  },
  'Dancehall':      { primary: '#fbbf24', secondary: '#f59e0b', glow: 'rgba(251,191,36,0.35)', bg: 'from-yellow-950/40 to-gray-950' },
  'Amapiano':       { primary: '#34d399', secondary: '#10b981', glow: 'rgba(52,211,153,0.35)', bg: 'from-emerald-950/40 to-gray-950' },
  'Coupé-Décalé':   { primary: '#f472b6', secondary: '#ec4899', glow: 'rgba(244,114,182,0.35)',bg: 'from-pink-950/40 to-gray-950'  },
  'Rock':           { primary: '#fb923c', secondary: '#f97316', glow: 'rgba(251,146,60,0.35)', bg: 'from-orange-950/40 to-gray-950' },
  'Classique':      { primary: '#e2c37b', secondary: '#ca9a4f', glow: 'rgba(226,195,123,0.35)',bg: 'from-yellow-950/30 to-gray-950' },
  'Folk':           { primary: '#86efac', secondary: '#4ade80', glow: 'rgba(134,239,172,0.35)',bg: 'from-green-950/40 to-gray-950'  },
  'Latin':          { primary: '#f87171', secondary: '#ef4444', glow: 'rgba(248,113,113,0.35)',bg: 'from-red-950/40 to-gray-950'   },
  'Drill':          { primary: '#94a3b8', secondary: '#64748b', glow: 'rgba(148,163,184,0.35)',bg: 'from-slate-900/60 to-gray-950'  },
  'Country':        { primary: '#d4a574', secondary: '#b07d4a', glow: 'rgba(212,165,116,0.35)',bg: 'from-amber-950/30 to-gray-950' },
  'Outro':          { primary: '#c084fc', secondary: '#a855f7', glow: 'rgba(192,132,252,0.35)',bg: 'from-purple-950/40 to-gray-950' },
};

const DEFAULT_THEME = {
  primary: '#06b6d4',
  secondary: '#0891b2',
  glow: 'rgba(6,182,212,0.35)',
  bg: 'from-cyan-950/30 to-gray-950',
};

export const useGenreTheme = (genre) => {
  if (!genre) return DEFAULT_THEME;
  return GENRE_THEMES[genre] || DEFAULT_THEME;
};

export default useGenreTheme;
