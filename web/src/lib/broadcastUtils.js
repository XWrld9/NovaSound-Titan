/**
 * 📢 Broadcast Utils - NovaSound TITAN LUX
 * 
 * Système de diffusion d'annonces administrateur
 */

import { supabase } from '@/lib/supabaseClient';
import { notifyAll } from '@/lib/notifUtils';

/**
 * Types de broadcasts disponibles
 */
export const BROADCAST_TYPES = {
  MAINTENANCE: {
    key: 'MAINTENANCE',
    label: 'Maintenance',
    description: 'Informations sur la maintenance du service',
    icon: '🔧',
    urgency: 'high',
    ttl: 24 * 60 * 60 * 1000, // 24h
  },
  UPDATE: {
    key: 'UPDATE',
    label: 'Mise à jour',
    description: 'Nouvelles fonctionnalités et améliorations',
    icon: '🚀',
    urgency: 'normal',
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },
  EVENT: {
    key: 'EVENT',
    label: 'Événement',
    description: 'Événements spéciaux et concours',
    icon: '🎉',
    urgency: 'high',
    ttl: 3 * 24 * 60 * 60 * 1000, // 3 jours
  },
  ANNOUNCEMENT: {
    key: 'ANNOUNCEMENT',
    label: 'Annonce',
    description: 'Annonces importantes',
    icon: '📢',
    urgency: 'normal',
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 jours
  },
  WARNING: {
    key: 'WARNING',
    label: 'Avertissement',
    description: 'Avertissements et rappels',
    icon: '⚠️',
    urgency: 'high',
    ttl: 24 * 60 * 60 * 1000, // 24h
  },
  FEATURE: {
    key: 'FEATURE',
    label: 'Nouvelle fonctionnalité',
    description: 'Présentation des nouvelles fonctionnalités',
    icon: '✨',
    urgency: 'low',
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 jours
  }
};

/**
 * Vérifie si l'utilisateur est administrateur
 */
export const isAdmin = async (userId) => {
  if (!userId) return false;
  
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .eq('is_active', true)
      .single();
    
    return !!data;
  } catch (error) {
    console.error('[Broadcast] Error checking admin status:', error);
    return false;
  }
};

/**
 * Vérifie si l'utilisateur est modérateur ou admin
 */
export const isModeratorOrAdmin = async (userId) => {
  if (!userId) return false;
  
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'moderator'])
      .eq('is_active', true);
    
    return data && data.length > 0;
  } catch (error) {
    console.error('[Broadcast] Error checking moderator status:', error);
    return false;
  }
};

/**
 * Envoie un broadcast à tous les utilisateurs
 */
export const sendBroadcast = async (adminId, broadcastType, title, body, options = {}) => {
  // Vérifier les permissions
  const hasPermission = await isModeratorOrAdmin(adminId);
  if (!hasPermission) {
    throw new Error('Permission refusée: administrateur requis');
  }
  
  // Vérifier le type de broadcast
  const typeConfig = BROADCAST_TYPES[broadcastType];
  if (!typeConfig) {
    throw new Error(`Type de broadcast invalide: ${broadcastType}`);
  }
  
  try {
    // Récupérer les infos de l'admin
    const { data: adminData } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', adminId)
      .single();
    
    const adminName = adminData?.username || 'Admin';
    const adminAvatar = adminData?.avatar_url || '/icon-192.png';
    
    // Créer le payload de notification
    const notificationPayload = {
      type: 'broadcast',
      title: `${typeConfig.icon} ${title}`,
      body: body,
      url: options.url || '/announcements',
      icon_url: adminAvatar,
      from_user_id: adminId,
      metadata: {
        broadcastType,
        urgency: typeConfig.urgency,
        ttl: typeConfig.ttl,
        adminName,
        sentAt: new Date().toISOString(),
        ...options.metadata
      },
      action_label: options.actionLabel,
      silent: typeConfig.urgency === 'low',
      renotify: typeConfig.urgency === 'high'
    };
    
    // Envoyer à tous les utilisateurs (sauf l'admin)
    const result = await notifyAll(supabase, notificationPayload, [adminId]);
    
    // Logger le broadcast
    await supabase.from('moderation_logs').insert({
      admin_id: adminId,
      action: 'broadcast',
      target_type: 'all_users',
      target_id: 'broadcast',
      reason: `${broadcastType}: ${title}`,
      created_at: new Date().toISOString()
    });
    
    console.log(`📢 Broadcast sent by ${adminName}: ${title} to ${result} users`);
    
    return {
      success: true,
      recipients: result,
      type: broadcastType,
      title,
      body,
      sentAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[Broadcast] Error sending broadcast:', error);
    throw error;
  }
};

/**
 * Envoie un broadcast ciblé à un segment d'utilisateurs
 */
export const sendTargetedBroadcast = async (adminId, broadcastType, title, body, targetCriteria, options = {}) => {
  const hasPermission = await isModeratorOrAdmin(adminId);
  if (!hasPermission) {
    throw new Error('Permission refusée: administrateur requis');
  }
  
  try {
    // Construire la requête pour les utilisateurs ciblés
    let query = supabase.from('users').select('id');
    
    // Appliquer les critères de ciblage
    if (targetCriteria.followersCount) {
      query = query.gte('followers_count', targetCriteria.followersCount);
    }
    
    if (targetCriteria.totalPlays) {
      query = query.gte('total_plays', targetCriteria.totalPlays);
    }
    
    if (targetCriteria.createdAfter) {
      query = query.gte('created_at', targetCriteria.createdAfter);
    }
    
    if (targetCriteria.isEarlyAdopter) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', thirtyDaysAgo);
    }
    
    const { data: targetUsers } = await query;
    
    if (!targetUsers || targetUsers.length === 0) {
      throw new Error('Aucun utilisateur trouvé pour les critères spécifiés');
    }
    
    const targetUserIds = targetUsers.map(u => u.id);
    
    // Récupérer les infos de l'admin
    const { data: adminData } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', adminId)
      .single();
    
    const adminName = adminData?.username || 'Admin';
    const adminAvatar = adminData?.avatar_url || '/icon-192.png';
    
    // Envoyer les notifications
    const notificationPayload = {
      type: 'broadcast',
      title: `${BROADCAST_TYPES[broadcastType]?.icon || '📢'} ${title}`,
      body: body,
      url: options.url || '/announcements',
      icon_url: adminAvatar,
      from_user_id: adminId,
      metadata: {
        broadcastType,
        targetCriteria,
        urgency: BROADCAST_TYPES[broadcastType]?.urgency || 'normal',
        adminName,
        sentAt: new Date().toISOString(),
        ...options.metadata
      }
    };
    
    // Envoyer en batch
    const batchSize = 100;
    let totalSent = 0;
    
    for (let i = 0; i < targetUserIds.length; i += batchSize) {
      const batch = targetUserIds.slice(i, i + batchSize);
      
      for (const userId of batch) {
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            ...notificationPayload
          });
          totalSent++;
        } catch (error) {
          console.error(`[Broadcast] Failed to send to user ${userId}:`, error);
        }
      }
    }
    
    // Logger
    await supabase.from('moderation_logs').insert({
      admin_id: adminId,
      action: 'targeted_broadcast',
      target_type: 'user_segment',
      target_id: JSON.stringify(targetCriteria),
      reason: `${broadcastType}: ${title} (${totalSent} users)`,
      created_at: new Date().toISOString()
    });
    
    return {
      success: true,
      recipients: totalSent,
      totalTargeted: targetUserIds.length,
      type: broadcastType,
      title,
      body,
      criteria: targetCriteria,
      sentAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[Broadcast] Error sending targeted broadcast:', error);
    throw error;
  }
};

/**
 * Récupère l'historique des broadcasts
 */
export const getBroadcastHistory = async (limit = 50) => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        users!notifications_from_user_id_fkey(username, avatar_url)
      `)
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return data || [];
  } catch (error) {
    console.error('[Broadcast] Error getting history:', error);
    return [];
  }
};

/**
 * Récupère les statistiques de broadcasts
 */
export const getBroadcastStats = async () => {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('metadata, created_at')
      .eq('type', 'broadcast')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    if (!data) return {};
    
    const stats = {
      total: data.length,
      byType: {},
      byUrgency: {},
      recent: data.filter(n => new Date(n.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length
    };
    
    data.forEach(notification => {
      const metadata = notification.metadata || {};
      const type = metadata.broadcastType || 'unknown';
      const urgency = metadata.urgency || 'normal';
      
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.byUrgency[urgency] = (stats.byUrgency[urgency] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('[Broadcast] Error getting stats:', error);
    return {};
  }
};

/**
 * Crée un broadcast prédéfini
 */
export const createPresetBroadcast = async (adminId, presetKey, customOptions = {}) => {
  const presets = {
    WELCOME_NEW_FEATURES: {
      type: 'UPDATE',
      title: 'Nouvelles fonctionnalités disponibles !',
      body: 'Découvrez les dernières nouveautés de NovaSound : nouveaux trophées, améliorations du chat, et bien plus encore !',
      url: '/whats-new',
      actionLabel: 'Découvrir'
    },
    MAINTENANCE_SCHEDULED: {
      type: 'MAINTENANCE',
      title: 'Maintenance programmée',
      body: 'NovaSound sera en maintenance pour améliorer nos services. Durée estimée : 2 heures.',
      url: '/status',
      urgency: 'high'
    },
    WEEKEND_EVENT: {
      type: 'EVENT',
      title: '🎉 Week-end spécial NovaSound !',
      body: 'Participez à notre événement du week-end : partagez vos meilleurs sons et gagnez des trophées exclusifs !',
      url: '/events/weekend-special',
      actionLabel: 'Participer'
    },
    NEW_ACHIEVEMENTS: {
      type: 'FEATURE',
      title: '🏆 Nouveaux trophées disponibles !',
      body: 'Débloquez de nouveaux trophées en explorant NovaSound : Vétéran, Producteur, Influenceur et bien d autres !',
      url: '/profile?tab=achievements',
      actionLabel: 'Voir mes trophées'
    }
  };
  
  const preset = presets[presetKey];
  if (!preset) {
    throw new Error(`Preset de broadcast invalide: ${presetKey}`);
  }
  
  return await sendBroadcast(adminId, preset.type, preset.title, preset.body, {
    url: preset.url,
    actionLabel: preset.actionLabel,
    ...customOptions
  });
};
