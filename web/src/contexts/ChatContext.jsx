/**
 * ChatContext — NovaSound TITAN LUX v100
 * Chat Public Global — boîte commune à tous les utilisateurs
 * - Chargement paginé par période (aujourd'hui / 7j / 30j / tout)
 * - Realtime INSERT + UPDATE (réactions)
 * - Envoi de messages avec reply (tagage)
 * - Toggle réactions emoji
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

// Filtres de période disponibles
export const CHAT_PERIODS = [
  { key: 'today',   label: "Aujourd'hui",  hours: 24 },
  { key: '7d',      label: '7 derniers jours', hours: 24 * 7 },
  { key: '30d',     label: '30 derniers jours', hours: 24 * 30 },
  { key: 'all',     label: 'Tout voir',    hours: null },
];

const PAGE_SIZE = 40;

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [messages,     setMessages]     = useState([]);
  const [reactions,    setReactions]    = useState({}); // { messageId: [{emoji, count, userReacted}] }
  const [loading,      setLoading]      = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [period,       setPeriod]       = useState('today');
  const [onlineCount,  setOnlineCount]  = useState(0);
  const channelRef  = useRef(null);
  const oldestRef   = useRef(null);

  // ── Charger les messages ─────────────────────────────────────────
  const fetchMessages = useCallback(async (periodKey = period, reset = true) => {
    setLoading(true);
    try {
      const p = CHAT_PERIODS.find(x => x.key === periodKey) || CHAT_PERIODS[0];
      let query = supabase
        .from('chat_messages')
        .select(`
          id, user_id, content, reply_to_id, reply_to_content, reply_to_username,
          created_at, is_deleted,
          users!chat_messages_user_id_fkey(id, username, avatar_url)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (p.hours) {
        const since = new Date(Date.now() - p.hours * 3_600_000).toISOString();
        query = query.gte('created_at', since);
      }

      if (!reset && oldestRef.current) {
        query = query.lt('created_at', oldestRef.current);
      }

      const { data, error } = await query;
      if (error) throw error;

      const msgs = (data || []).reverse(); // chronologique
      if (reset) {
        setMessages(msgs);
      } else {
        setMessages(prev => [...msgs, ...prev]);
      }
      setHasMore((data || []).length === PAGE_SIZE);
      if (msgs.length > 0) oldestRef.current = msgs[0].created_at;

      // Charger les réactions pour ces messages
      if (msgs.length > 0) {
        const ids = msgs.map(m => m.id);
        fetchReactions(ids);
      }
    } catch (err) {
      console.error('[Chat] fetchMessages:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // ── Charger les réactions ────────────────────────────────────────
  const fetchReactions = useCallback(async (messageIds) => {
    if (!messageIds?.length) return;
    const { data } = await supabase
      .from('chat_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);

    if (!data) return;
    const map = {};
    for (const r of data) {
      if (!map[r.message_id]) map[r.message_id] = {};
      if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { count: 0, users: [] };
      map[r.message_id][r.emoji].count++;
      map[r.message_id][r.emoji].users.push(r.user_id);
    }
    setReactions(prev => ({ ...prev, ...map }));
  }, []);

  // ── Changer de période ───────────────────────────────────────────
  const changePeriod = useCallback((newPeriod) => {
    setPeriod(newPeriod);
    oldestRef.current = null;
    fetchMessages(newPeriod, true);
  }, [fetchMessages]);

  // ── Charger plus (pagination remontante) ─────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchMessages(period, false);
  }, [hasMore, loading, period, fetchMessages]);

  // ── Envoyer un message ───────────────────────────────────────────
  const sendChatMessage = useCallback(async (content, replyTo = null) => {
    if (!currentUser?.id || !content.trim()) return null;
    const payload = {
      user_id: currentUser.id,
      content: content.trim(),
    };
    if (replyTo) {
      payload.reply_to_id       = replyTo.id;
      payload.reply_to_content  = replyTo.content?.slice(0, 120);
      payload.reply_to_username = replyTo.users?.username || replyTo.username || 'Utilisateur';
    }
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(payload)
      .select(`
        id, user_id, content, reply_to_id, reply_to_content, reply_to_username,
        created_at, is_deleted,
        users!chat_messages_user_id_fkey(id, username, avatar_url)
      `)
      .single();
    if (error) throw error;
    return data;
  }, [currentUser?.id]);

  // ── Supprimer (soft delete) ──────────────────────────────────────
  const deleteChatMessage = useCallback(async (messageId) => {
    await supabase
      .from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // ── Toggle réaction emoji ────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser?.id) return;
    const uid = currentUser.id;
    const msgReactions = reactions[messageId]?.[emoji];
    const hasReacted = msgReactions?.users?.includes(uid);

    // Optimistic update
    setReactions(prev => {
      const cur = { ...(prev[messageId] || {}) };
      if (hasReacted) {
        if (cur[emoji]) {
          cur[emoji] = { count: cur[emoji].count - 1, users: cur[emoji].users.filter(u => u !== uid) };
          if (cur[emoji].count <= 0) delete cur[emoji];
        }
      } else {
        cur[emoji] = { count: (cur[emoji]?.count || 0) + 1, users: [...(cur[emoji]?.users || []), uid] };
      }
      return { ...prev, [messageId]: cur };
    });

    if (hasReacted) {
      await supabase.from('chat_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', uid)
        .eq('emoji', emoji);
    } else {
      await supabase.from('chat_reactions')
        .insert({ message_id: messageId, user_id: uid, emoji });
    }
  }, [currentUser?.id, reactions]);

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchMessages(period, true);

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel('chat_public_global')
      // Nouveau message
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, async (payload) => {
        // Récupérer les infos user du nouveau message
        const { data } = await supabase
          .from('chat_messages')
          .select(`
            id, user_id, content, reply_to_id, reply_to_content, reply_to_username,
            created_at, is_deleted,
            users!chat_messages_user_id_fkey(id, username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();
        if (data && !data.is_deleted) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }
      })
      // Soft delete
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_messages',
      }, (payload) => {
        if (payload.new.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== payload.new.id));
        }
      })
      // Réaction ajoutée
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_reactions',
      }, (payload) => {
        const { message_id, user_id, emoji } = payload.new;
        setReactions(prev => {
          const cur = { ...(prev[message_id] || {}) };
          if (!cur[emoji]) cur[emoji] = { count: 0, users: [] };
          if (!cur[emoji].users.includes(user_id)) {
            cur[emoji] = { count: cur[emoji].count + 1, users: [...cur[emoji].users, user_id] };
          }
          return { ...prev, [message_id]: cur };
        });
      })
      // Réaction supprimée
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'chat_reactions',
      }, (payload) => {
        const { message_id, user_id, emoji } = payload.old;
        setReactions(prev => {
          const cur = { ...(prev[message_id] || {}) };
          if (cur[emoji]) {
            cur[emoji] = { count: Math.max(0, cur[emoji].count - 1), users: cur[emoji].users.filter(u => u !== user_id) };
            if (cur[emoji].count <= 0) delete cur[emoji];
          }
          return { ...prev, [message_id]: cur };
        });
      })
      // Présence (compteur en ligne)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUser?.id) {
          await channel.track({ user_id: currentUser.id });
        }
      });

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, period]);

  return (
    <ChatContext.Provider value={{
      messages, reactions, loading, hasMore, period, onlineCount,
      fetchMessages, changePeriod, loadMore,
      sendChatMessage, deleteChatMessage, toggleReaction,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
