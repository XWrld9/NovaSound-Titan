/**
 * 📱 Notification Service - NovaSound TITAN LUX v1000001
 *
 * Service pour gérer les notifications côté client.
 * ✅ FIX B2 : suppression du champ 'read_at' inexistant dans la DB
 * ✅ FIX B3 : utilisation du client Supabase partagé (plus de doublon)
 */

import { supabase } from '@/lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Marquer une notification comme lue
// ─────────────────────────────────────────────────────────────────────────────
export const markAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })   // ✅ FIX : 'read_at' n'existe pas dans la DB
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[NotificationService] markAsRead failed:', error?.message);
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
      .update({ is_read: true })   // ✅ FIX : 'read_at' n'existe pas dans la DB
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[NotificationService] markAllAsRead failed:', error?.message);
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

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[NotificationService] deleteNotification failed:', error?.message);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Récupérer les notifications d'un utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0, unreadOnly = false, type = null } = options;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('is_read', false);
    if (type)       query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[NotificationService] getNotifications failed:', error?.message);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Compter les notifications non lues
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.warn('[NotificationService] getUnreadCount failed:', error?.message);
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
      .insert({ ...notification, is_read: false })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[NotificationService] createNotification failed:', error?.message);
    throw error;
  }
};

export default {
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  createNotification,
};
