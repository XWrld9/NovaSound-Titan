/**
 * 🏆 Achievement Utils - NovaSound TITAN LUX
 * 
 * Système de gamification avec notifications automatiques
 */

import { supabase } from '@/lib/supabaseClient';
import { notifyUser } from '@/lib/notifUtils';

// 📋 Définitions des trophées disponibles
export const ACHIEVEMENTS = {
  // 🎵 Musique
  FIRST_LIKE: {
    code: 'FIRST_LIKE',
    label: 'Premier Like',
    description: 'Recevoir ton premier like sur un son',
    icon: '🎵',
    points: 10,
    rarity: 'common',
    condition: (stats) => stats.totalLikesReceived >= 1
  },
  FIRST_PLAY: {
    code: 'FIRST_PLAY',
    label: 'Première Écoute',
    description: 'Écouter ton premier son',
    icon: '🎧',
    points: 5,
    rarity: 'common',
    condition: (stats) => stats.totalPlays >= 1
  },
  MUSIC_LOVER: {
    code: 'MUSIC_LOVER',
    label: 'Amoureux de la Musique',
    description: 'Écouter 100 sons différents',
    icon: '💖',
    points: 50,
    rarity: 'rare',
    condition: (stats) => stats.uniqueSongsPlayed >= 100
  },
  TRENDING_ARTIST: {
    code: 'TRENDING_ARTIST',
    label: 'Artiste en Tendance',
    description: 'Avoir un son avec 1000+ plays',
    icon: '🔥',
    points: 100,
    rarity: 'epic',
    condition: (stats) => stats.maxSongPlays >= 1000
  },
  
  // 👥 Social
  FIRST_FOLLOWER: {
    code: 'FIRST_FOLLOWER',
    label: 'Premier Abonné',
    description: 'Avoir ton premier abonné',
    icon: '👥',
    points: 20,
    rarity: 'common',
    condition: (stats) => stats.totalFollowers >= 1
  },
  SOCIAL_BUTTERFLY: {
    code: 'SOCIAL_BUTTERFLY',
    label: 'Papillon Social',
    description: 'Avoir 50 abonnés',
    icon: '🦋',
    points: 75,
    rarity: 'rare',
    condition: (stats) => stats.totalFollowers >= 50
  },
  INFLUENCER: {
    code: 'INFLUENCER',
    label: 'Influenceur',
    description: 'Avoir 100 abonnés',
    icon: '⭐',
    points: 150,
    rarity: 'epic',
    condition: (stats) => stats.totalFollowers >= 100
  },
  
  // 💬 Chat
  FIRST_MESSAGE: {
    code: 'FIRST_MESSAGE',
    label: 'Premier Message',
    description: 'Envoyer ton premier message dans le chat',
    icon: '💬',
    points: 5,
    rarity: 'common',
    condition: (stats) => stats.totalChatMessages >= 1
  },
  CHATTERBOX: {
    code: 'CHATTERBOX',
    label: 'Bavard',
    description: 'Envoyer 100 messages dans le chat',
    icon: '🗣️',
    points: 30,
    rarity: 'rare',
    condition: (stats) => stats.totalChatMessages >= 100
  },
  
  // 🎨 Créativité
  FIRST_UPLOAD: {
    code: 'FIRST_UPLOAD',
    label: 'Premier Upload',
    description: 'Uploader ton premier son',
    icon: '📤',
    points: 15,
    rarity: 'common',
    condition: (stats) => stats.totalSongsUploaded >= 1
  },
  PRODUCER: {
    code: 'PRODUCER',
    label: 'Producteur',
    description: 'Uploader 10 sons',
    icon: '🎹',
    points: 60,
    rarity: 'rare',
    condition: (stats) => stats.totalSongsUploaded >= 10
  },
  HITMAKER: {
    code: 'HITMAKER',
    label: 'Créateur de Hits',
    description: 'Uploader 25 sons',
    icon: '🎼',
    points: 100,
    rarity: 'epic',
    condition: (stats) => stats.totalSongsUploaded >= 25
  },
  
  // 🔴 Live
  FIRST_LIVE: {
    code: 'FIRST_LIVE',
    label: 'Premier Live',
    description: 'Démarrer ton premier live',
    icon: '🔴',
    points: 25,
    rarity: 'common',
    condition: (stats) => stats.totalLivesHosted >= 1
  },
  STREAMER: {
    code: 'STREAMER',
    label: 'Streamer',
    description: 'Héberger 10 lives',
    icon: '📺',
    points: 80,
    rarity: 'rare',
    condition: (stats) => stats.totalLivesHosted >= 10
  },
  
  // 🏆 Spéciaux
  EARLY_ADOPTER: {
    code: 'EARLY_ADOPTER',
    label: 'Pionnier',
    description: 'Rejoindre NovaSound dans les premiers 30 jours',
    icon: '🌟',
    points: 100,
    rarity: 'legendary',
    condition: (stats) => stats.isEarlyAdopter
  },
  VETERAN: {
    code: 'VETERAN',
    label: 'Vétéran',
    description: 'Être actif depuis 6 mois',
    icon: '🏅',
    points: 200,
    rarity: 'legendary',
    condition: (stats) => stats.daysActive >= 180
  }
};

/**
 * Vérifie et débloque les trophées pour un utilisateur
 */
export const checkAndUnlockAchievements = async (userId, userStats) => {
  if (!userId || !userStats) return [];
  
  const newlyUnlocked = [];
  
  try {
    // Récupérer les trophées déjà débloqués
    const { data: existingAchievements } = await supabase
      .from('user_achievements')
      .select('achievement')
      .eq('user_id', userId);
    
    const unlockedCodes = new Set(existingAchievements?.map(a => a.achievement) || []);
    
    // Vérifier chaque trophée
    for (const [code, achievement] of Object.entries(ACHIEVEMENTS)) {
      // Skip si déjà débloqué
      if (unlockedCodes.has(code)) continue;
      
      // Vérifier la condition
      if (achievement.condition(userStats)) {
        // Débloquer le trophée
        const { error } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement: code,
            unlocked_at: new Date().toISOString()
          });
        
        if (!error) {
          newlyUnlocked.push(achievement);
          
          // Envoyer la notification de trophée
          await notifyUser(supabase, userId, {
            type: 'achievement',
            title: `🏆 ${achievement.label} débloqué !`,
            body: achievement.description,
            url: '/profile?tab=achievements',
            icon_url: '/icon-192.png',
            metadata: { 
              achievementCode: code,
              points: achievement.points,
              rarity: achievement.rarity
            }
          });
        }
      }
    }
    
    return newlyUnlocked;
  } catch (error) {
    console.error('[Achievements] Error checking achievements:', error);
    return [];
  }
};

/**
 * Récupère les statistiques d'un utilisateur pour les trophées
 */
export const getUserStats = async (userId) => {
  if (!userId) return null;
  
  try {
    // Récupérer les stats de base depuis la table users
    const { data: userData } = await supabase
      .from('users')
      .select('created_at, total_plays, total_likes, xp_points')
      .eq('id', userId)
      .single();
    
    if (!userData) return null;
    
    // Calculer les stats supplémentaires
    const [
      { count: totalFollowers },
      { count: totalSongsUploaded },
      { count: totalChatMessages },
      { count: totalLivesHosted },
      { count: uniqueSongsPlayed },
      { data: maxSongPlays }
    ] = await Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('songs').select('id', { count: 'exact', head: true }).eq('uploader_id', userId),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      // ✅ FIX v2.0.1 : is_active=true ne compte que les rooms en cours → trophées jamais débloqués
      // On utilise live_room_history qui conserve l'historique complet des sessions terminées
      supabase.from('live_room_history').select('id', { count: 'exact', head: true }).eq('host_id', userId),
      // ✅ FIX v2.0.1 : song_plays_history.user_id est de type uuid alors que users.id est text
      // On utilise ::uuid cast via rpc ou on filtre en tolérant le cast implicite de PostgREST
      // Le cast explicite via .eq() est suffisant car PostgREST accepte la comparaison uuid/text
      supabase.from('song_plays_history').select('song_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('songs').select('plays_count').eq('uploader_id', userId).order('plays_count', { ascending: false }).limit(1).single()
    ]);
    
    const daysActive = Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const isEarlyAdopter = daysActive <= 30;
    
    return {
      totalLikesReceived: userData.total_likes || 0,
      totalPlays: userData.total_plays || 0,
      uniqueSongsPlayed: uniqueSongsPlayed || 0,
      maxSongPlays: maxSongPlays?.plays_count || 0,
      totalFollowers: totalFollowers || 0,
      totalChatMessages: totalChatMessages || 0,
      totalSongsUploaded: totalSongsUploaded || 0,
      totalLivesHosted: totalLivesHosted || 0,
      daysActive,
      isEarlyAdopter,
      xpPoints: userData.xp_points || 0
    };
  } catch (error) {
    console.error('[Achievements] Error getting user stats:', error);
    return null;
  }
};

/**
 * Déclenche une vérification de trophées après une action
 */
export const triggerAchievementCheck = async (userId, actionType, actionData = {}) => {
  if (!userId) return;
  
  try {
    // Récupérer les stats actuelles
    const stats = await getUserStats(userId);
    if (!stats) return;
    
    // Mettre à jour les stats basées sur l'action
    switch (actionType) {
      case 'LIKE_RECEIVED':
        stats.totalLikesReceived = (stats.totalLikesReceived || 0) + 1;
        break;
      case 'SONG_PLAYED':
        stats.totalPlays = (stats.totalPlays || 0) + 1;
        stats.uniqueSongsPlayed = Math.max(stats.uniqueSongsPlayed || 0, actionData.uniqueCount);
        stats.maxSongPlays = Math.max(stats.maxSongPlays || 0, actionData.songPlays);
        break;
      case 'NEW_FOLLOWER':
        stats.totalFollowers = (stats.totalFollowers || 0) + 1;
        break;
      case 'CHAT_MESSAGE':
        stats.totalChatMessages = (stats.totalChatMessages || 0) + 1;
        break;
      case 'SONG_UPLOADED':
        stats.totalSongsUploaded = (stats.totalSongsUploaded || 0) + 1;
        break;
      case 'LIVE_STARTED':
        stats.totalLivesHosted = (stats.totalLivesHosted || 0) + 1;
        break;
    }
    
    // Vérifier et débloquer les trophées
    const newlyUnlocked = await checkAndUnlockAchievements(userId, stats);
    
    // Afficher les notifications de trophées
    if (newlyUnlocked.length > 0) {
      console.info(`🏆 ${newlyUnlocked.length} achievement(s) unlocked for user ${userId}`);
    }
  } catch (error) {
    console.error('[Achievements] Error triggering check:', error);
  }
};

/**
 * Récupère tous les trophées d'un utilisateur
 */
export const getUserAchievements = async (userId) => {
  if (!userId) return [];
  
  try {
    const { data } = await supabase
      .from('user_achievements')
      .select(`
        achievement,
        unlocked_at,
        achievement_definitions(*)
      `)
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });
    
    return data || [];
  } catch (error) {
    console.error('[Achievements] Error getting user achievements:', error);
    return [];
  }
};

/**
 * Récupère le classement des trophées
 * Syntaxe PostgREST correcte : embedded join via FK implicite
 */
export const getAchievementsLeaderboard = async (limit = 10) => {
  try {
    // Récupérer tous les achievements avec les infos liées via FK PostgREST
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        user_id,
        unlocked_at,
        achievement_definitions:achievement(points, rarity),
        users!user_achievements_user_id_fkey(username, avatar_url)
      `)
      .order('unlocked_at', { ascending: false })
      .limit(limit * 20); // On récupère plus pour grouper ensuite

    if (error) throw error;
    if (!data?.length) return [];

    // Grouper par utilisateur et calculer le total de points côté JS
    const userPoints = {};
    data.forEach(item => {
      const userId = item.user_id;
      if (!userPoints[userId]) {
        userPoints[userId] = {
          userId,
          username:            item.users?.username,
          avatar_url:          item.users?.avatar_url,
          totalPoints:         0,
          achievementsCount:   0,
          rareAchievements:    0,
          epicAchievements:    0,
          legendaryAchievements: 0,
        };
      }
      userPoints[userId].totalPoints    += item.achievement_definitions?.points || 0;
      userPoints[userId].achievementsCount += 1;

      const rarity = item.achievement_definitions?.rarity;
      if (rarity === 'rare')      userPoints[userId].rareAchievements      += 1;
      if (rarity === 'epic')      userPoints[userId].epicAchievements      += 1;
      if (rarity === 'legendary') userPoints[userId].legendaryAchievements += 1;
    });

    return Object.values(userPoints)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  } catch (error) {
    console.error('[Achievements] Error getting leaderboard:', error);
    return [];
  }
};
