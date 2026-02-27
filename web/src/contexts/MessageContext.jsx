/**
 * MessageContext — NovaSound TITAN LUX v70
 * Gestion globale de la messagerie directe
 * - Liste des conversations avec badge non-lus
 * - Realtime nouveaux messages via Supabase channel
 * - Marquer comme lu, envoyer, supprimer
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

const MessageContext = createContext(null);
export const useMessages = () => useContext(MessageContext);

// Clé localStorage pour badge total non-lus (persisté entre sessions)
const UNREAD_KEY = (uid) => `novasound.msg.unread.${uid}`;

export const MessageProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [conversations,   setConversations]   = useState([]);
  const [totalUnread,     setTotalUnread]      = useState(0);
  const [loadingConvs,    setLoadingConvs]     = useState(false);
  const channelRef = useRef(null);

  // ── Charger la liste des conversations ─────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingConvs(true);
    try {
      const { data, error } = await supabase.rpc('get_conversations', {
        p_user_id: currentUser.id,
      });
      if (!error && data) {
        setConversations(data);
        const total = data.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
        setTotalUnread(total);
        try { localStorage.setItem(UNREAD_KEY(currentUser.id), String(total)); } catch {}
      }
    } catch {}
    finally { setLoadingConvs(false); }
  }, [currentUser?.id]);

  // ── Charger les messages d'une conversation ─────────────────────
  const fetchMessages = useCallback(async (otherUserId, limit = 50) => {
    if (!currentUser?.id || !otherUserId) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return data || [];
  }, [currentUser?.id]);

  // ── Envoyer un message ───────────────────────────────────────────
  const sendMessage = useCallback(async (recipientId, content) => {
    if (!currentUser?.id || !recipientId || !content.trim()) return null;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id:    currentUser.id,
        recipient_id: recipientId,
        content:      content.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    // Rafraîchir les conversations après envoi
    fetchConversations();
    return data;
  }, [currentUser?.id, fetchConversations]);

  // ── Marquer une conversation comme lue ─────────────────────────
  const markConversationRead = useCallback(async (otherUserId) => {
    if (!currentUser?.id || !otherUserId) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', currentUser.id)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);
    // Mettre à jour le state local immédiatement
    setConversations(prev =>
      prev.map(c =>
        c.other_user_id === otherUserId ? { ...c, unread_count: 0 } : c
      )
    );
    setTotalUnread(prev => {
      const conv = conversations.find(c => c.other_user_id === otherUserId);
      return Math.max(0, prev - Number(conv?.unread_count || 0));
    });
  }, [currentUser?.id, conversations]);

  // ── Supprimer un message (expéditeur uniquement) ─────────────────
  const deleteMessage = useCallback(async (messageId) => {
    await supabase.from('messages').delete().eq('id', messageId);
  }, []);

  // ── Initialisation + realtime ────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) {
      setConversations([]);
      setTotalUnread(0);
      return;
    }

    // Valeur persistée immédiate pour éviter le flash badge=0
    try {
      const persisted = parseInt(localStorage.getItem(UNREAD_KEY(currentUser.id)) || '0', 10);
      if (persisted > 0) setTotalUnread(persisted);
    } catch {}

    fetchConversations();

    // Realtime : nouveaux messages entrants
    const channel = supabase
      .channel(`messages_inbox:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${currentUser.id}`,
      }, () => {
        fetchConversations(); // rafraîchir tout
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${currentUser.id}`,
      }, () => {
        fetchConversations();
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, fetchConversations]);

  return (
    <MessageContext.Provider value={{
      conversations, totalUnread, loadingConvs,
      fetchConversations, fetchMessages,
      sendMessage, markConversationRead, deleteMessage,
    }}>
      {children}
    </MessageContext.Provider>
  );
};
