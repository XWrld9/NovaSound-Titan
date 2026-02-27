/**
 * ArtistStatsCard — NovaSound TITAN LUX v30
 * Carte de statistiques visuelles pour le profil artiste.
 * Affiche plays total, likes total, sons publiés, abonnés — avec animations.
 */
import React from 'react';
import { Headphones, Heart, Music, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const Stat = ({ icon: Icon, value, label, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
    className="flex flex-col items-center gap-1 p-4 rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm"
  >
    <div className="p-2.5 rounded-xl mb-1" style={{ background: `${color}18` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <span className="text-white font-black text-xl md:text-2xl tabular-nums leading-none">
      {value >= 1000000
        ? `${(value / 1000000).toFixed(1)}M`
        : value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value}
    </span>
    <span className="text-gray-500 text-xs font-medium text-center leading-tight">{label}</span>
  </motion.div>
);

const ArtistStatsCard = ({ songs = [], followersCount = 0 }) => {
  const totalPlays = songs.reduce((acc, s) => acc + (s.plays_count || 0), 0);
  const totalLikes = songs.reduce((acc, s) => acc + (s.likes_count || 0), 0);
  const publishedCount = songs.filter(s => !s.is_archived).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat icon={Headphones} value={totalPlays}   label="Écoutes totales" color="#06b6d4" delay={0}    />
      <Stat icon={Heart}      value={totalLikes}   label="Likes totaux"    color="#ec4899" delay={0.06} />
      <Stat icon={Music}      value={publishedCount} label="Sons publiés"  color="#8b5cf6" delay={0.12} />
      <Stat icon={Users}      value={followersCount} label="Abonnés"       color="#f59e0b" delay={0.18} />
    </div>
  );
};

export default ArtistStatsCard;
