/**
 * 🏆 Achievement Notification - NovaSound TITAN LUX
 * 
 * Composant spécialisé pour les notifications de trophées
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, Crown, Gem } from 'lucide-react';

const AchievementNotification = ({ notification, onClick }) => {
  const metadata = typeof notification.metadata === 'string' 
    ? JSON.parse(notification.metadata) 
    : (notification.metadata || {});
  
  const { achievementCode, points, rarity } = metadata;
  
  // Configuration par rareté
  const rarityConfig = {
    common: {
      icon: Trophy,
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.15)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      label: 'Commun'
    },
    rare: {
      icon: Star,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      label: 'Rare'
    },
    epic: {
      icon: Zap,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.15)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      label: 'Épique'
    },
    legendary: {
      icon: Crown,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      label: 'Légendaire'
    }
  };
  
  const config = rarityConfig[rarity] || rarityConfig.common;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      className="relative"
    >
      {/* Effet de brillance pour les trophées rares */}
      {(rarity === 'epic' || rarity === 'legendary') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-xl"
        />
      )}
      
      <div
        className={`relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${config.bg} ${config.borderColor}`}
        onClick={onClick}
      >
        {/* Header avec icône et rareté */}
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bg} border ${config.borderColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Badge de rareté */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${config.bg} ${config.color} border ${config.borderColor}`}>
                {config.label}
              </span>
              {points && (
                <span className="text-xs text-gray-400">
                  +{points} pts
                </span>
              )}
            </div>
            
            {/* Titre */}
            <h4 className="text-white font-semibold text-sm leading-tight mb-1">
              {notification.title}
            </h4>
            
            {/* Description */}
            <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
              {notification.body}
            </p>
          </div>
        </div>
        
        {/* Animation spéciale pour légendaire */}
        {rarity === 'legendary' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute top-2 right-2"
          >
            <Gem className="w-4 h-4 text-yellow-400" />
          </motion.div>
        )}
        
        {/* Particules pour épique/légendaire */}
        {(rarity === 'epic' || rarity === 'legendary') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 0,
                  scale: 0,
                  x: Math.random() * 100,
                  y: Math.random() * 100
                }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  y: -20
                }}
                transition={{ 
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 2,
                  repeat: Infinity,
                  repeatDelay: 3 + Math.random() * 2
                }}
                className="absolute w-1 h-1 bg-current rounded-full"
                style={{
                  color: config.color,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AchievementNotification;
