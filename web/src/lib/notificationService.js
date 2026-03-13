/**
 * 📱 Notification Service - NovaSound TITAN LUX v1000000
 * 
 * Service pour gérer les notifications côté client
 * Marquer comme lu, supprimer, et autres opérations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tleuzlyfelrnykpbwhkc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODY4OTUsImV4cCI6MjA4NzE2Mjg5NX0.PEXcdsykNhIhtXOmprBkshqZfZ9qkc8WKmFbBNSn-II';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────────────────────────────────────
// Marquer une notification comme lue
// ─────────────────────────────────────────────────────────────────────────────
export const markAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] markAsRead error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[NotificationService] markAsRead failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Marquer toutes les notifications comme lues pour un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export const markAllAsRead = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('[NotificationService] markAllAsRead error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[NotificationService] markAllAsRead failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Supprimer une notification
// ─────────────────────────────────────────────────────────────────────────────
export const deleteNotification = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] deleteNotification error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[NotificationService] deleteNotification failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Récupérer les notifications d'un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications = async (userId, options = {}) => {
  try {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type = null
    } = options;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[NotificationService] getNotifications error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[NotificationService] getNotifications failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Compter les notifications non lues
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadCount = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('[NotificationService] getUnreadCount error:', error);
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('[NotificationService] getUnreadCount failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Créer une nouvelle notification
// ─────────────────────────────────────────────────────────────────────────────
export const createNotification = async (notification) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        ...notification,
        created_at: new Date().toISOString(),
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] createNotification error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[NotificationService] createNotification failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service complet exporté
// ─────────────────────────────────────────────────────────────────────────────
export default {
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  createNotification
};
