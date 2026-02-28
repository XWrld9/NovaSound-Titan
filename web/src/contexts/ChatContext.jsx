/**
 * ChatContext — NovaSound TITAN LUX v160
 * Chat Public Global
 * NOUVEAU v160 :
 *  - @tous / @everyone / @all / @todos / @tutti / @allen → notifie TOUS les utilisateurs
 *  - Suppression de message par l'AUTEUR lui-même (pas seulement l'admin)
 *  - Reply → auto-tag @username + notification dans "Mes messages" ET "Notifications"
 *  - Notification écran (push) déclenchée pour les réponses et @mention
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);
export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
};

// Filtres de période disponibles
export const CHAT_PERIODS = [
  { key: 'today',   label: "Aujourd'hui",  hours: 24 },
  { key: '7d',      label: '7 jours',      hours: 24 * 7 },
  { key: 'month',   label: 'Ce mois',      hours: null, monthFilter: true },
  { key: 'year',    label: 'Cette année',  hours: null, yearFilter: true },
  { key: 'all',     label: 'Tout',         hours: null },
];

// Détection @tous multilingue
export const MENTION_ALL_PATTERN = /(?:^|\s)@(tous|all|everyone|todo|todos|tutti|allen|alle|everybody|chacun|tout-le-monde|الكل|みんな|全员|全員)(?:\s|$)/i;
export const isMentionAll = (text) => MENTION_ALL_PATTERN.test(text);

const PAGE_SIZE = 40;

// ── Helper : insérer une notification Supabase ───────────────────
const insertNotification = async ({ userId, type, title, body, url, senderId, senderName, msgId }) => {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id:  userId,
      type,
      title,
      body:     body?.slice(0, 200) || '',
      url:      url || '/chat',
      icon_url: '/icon-192.png',
      is_read:  false,
      metadata: JSON.stringify({ msgId, senderId, senderName }),
    });
  } catch (err) {
    console.error('[Chat] insertNotification:', err);
  }
};

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [messages,    setMessages]   = useState([]);
  const [reactions,   setReactions]  = useState({});
  const [loading,     setLoading]    = useState(false);
  const [hasMore,     setHasMore]    = useState(false);
  const [period,      setPeriod]     = useState('today');
  const [onlineCount, setOnlineCount] = useState(0);
  const channelRef = useRef(null);
  const oldestRef  = useRef(null);

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
      } else if (p.monthFilter) {
        const now = new Date();
        query = query
          .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
          .lte('created_at', new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString());
      } else if (p.yearFilter) {
        const now = new Date();
        query = query
          .gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString())
          .lte('created_at', new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString());
      }

      if (!reset && oldestRef.current) query = query.lt('created_at', oldestRef.current);

      const { data, error } = await query;
      if (error) throw error;

      const msgs = (data || []).reverse();
      if (reset) setMessages(msgs);
      else setMessages(prev => [...msgs, ...prev]);
      setHasMore((data || []).length === PAGE_SIZE);
      if (msgs.length > 0) oldestRef.current = msgs[0].created_at;
      if (msgs.length > 0) fetchReactions(msgs.map(m => m.id));
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

  const changePeriod = useCallback((newPeriod) => {
    setPeriod(newPeriod);
    oldestRef.current = null;
    fetchMessages(newPeriod, true);
  }, [fetchMessages]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchMessages(period, false);
  }, [hasMore, loading, period, fetchMessages]);

  // ── Envoyer un message ───────────────────────────────────────────
  const sendChatMessage = useCallback(async (content, replyTo = null) => {
    if (!currentUser?.id || !content.trim()) return null;

    const senderName = currentUser.username
      || currentUser.user_metadata?.username
      || currentUser.email?.split('@')[0]
      || 'Utilisateur';

    // Si c'est une réponse → auto-tag l'auteur du message original
    let finalContent = content.trim();
    let replyTargetId    = null;
    let replyTargetName  = null;

    if (replyTo) {
      const ru = replyTo.users;
      replyTargetName = Array.isArray(ru) ? ru[0]?.username : (ru?.username || replyTo.reply_to_username || 'Utilisateur');
      replyTargetId   = Array.isArray(ru) ? ru[0]?.id       : (ru?.id   || replyTo.user_id || null);
      const autoTag   = `@${replyTargetName} `;
      if (!finalContent.startsWith(`@${replyTargetName}`)) {
        finalContent = autoTag + finalContent;
      }
    }

    const payload = {
      user_id: currentUser.id,
      content: finalContent,
      ...(replyTo ? {
        reply_to_id:       replyTo.id,
        reply_to_content:  replyTo.content?.slice(0, 120),
        reply_to_username: replyTargetName,
      } : {}),
    };

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id:  tempId,
      user_id: currentUser.id,
      content: finalContent,
      reply_to_id:       payload.reply_to_id       || null,
      reply_to_content:  payload.reply_to_content  || null,
      reply_to_username: payload.reply_to_username || null,
      created_at: new Date().toISOString(),
      is_deleted: false,
      _pending: true,
      users: {
        id:         currentUser.id,
        username:   senderName,
        avatar_url: currentUser.avatar_url || currentUser.user_metadata?.avatar_url || null,
      },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
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

      setMessages(prev => prev.map(m => m.id === tempId ? { ...data, _pending: false } : m));

      // ── Post-envoi : notifications ──────────────────────────────

      // 1. Notification de réponse → auteur du message original
      if (replyTo && replyTargetId && replyTargetId !== currentUser.id) {
        await insertNotification({
          userId:     replyTargetId,
          type:       'chat_reply',
          title:      `💬 ${senderName} a répondu à ton message`,
          body:       finalContent,
          url:        `/chat?highlight=${data.id}&tagger=${encodeURIComponent(senderName)}`,
          senderId:   currentUser.id,
          senderName,
          msgId:      data.id,
        });
      }

      // 2. @tous → notifier tout le monde
      if (isMentionAll(finalContent)) {
        const { data: allUsers } = await supabase
          .from('users').select('id').neq('id', currentUser.id).limit(500);
        if (allUsers?.length) {
          const batch = allUsers.map(u => ({
            user_id:  u.id,
            type:     'chat_mention_all',
            title:    `📢 ${senderName} a mentionné @tous dans le chat`,
            body:     finalContent.slice(0, 200),
            url:      `/chat?highlight=${data.id}&tagger=${encodeURIComponent(senderName)}`,
            icon_url: '/icon-192.png',
            is_read:  false,
            metadata: JSON.stringify({ msgId: data.id, senderId: currentUser.id, senderName }),
          }));
          for (let i = 0; i < batch.length; i += 100) {
            await supabase.from('notifications').insert(batch.slice(i, i + 100));
          }
        }
      } else {
        // 3. @username individuels (hors reply déjà notifié)
        const mentions = [...new Set((finalContent.match(/@(\w+)/g) || []).map(m => m.slice(1).toLowerCase()))];
        for (const uname of mentions) {
          if (uname.toLowerCase() === senderName.toLowerCase()) continue;
          if (replyTargetName && uname.toLowerCase() === replyTargetName.toLowerCase()) continue; // déjà notifié via reply
          const { data: targetUser } = await supabase
            .from('users').select('id').ilike('username', uname).single();
          if (targetUser?.id && targetUser.id !== currentUser.id) {
            await insertNotification({
              userId:     targetUser.id,
              type:       'chat_mention',
              title:      `💬 ${senderName} t'a mentionné dans le chat`,
              body:       finalContent,
              url:        `/chat?highlight=${data.id}&tagger=${encodeURIComponent(senderName)}`,
              senderId:   currentUser.id,
              senderName,
              msgId:      data.id,
            });
          }
        }
      }

      return data;
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  }, [currentUser]);

  // ── Supprimer — AUTEUR ou ADMIN ─────────────────────────────────
  const deleteChatMessage = useCallback(async (messageId) => {
    if (!currentUser?.id) return;
    const isAdmin  = currentUser.email === 'eloadxfamily@gmail.com';
    // Trouver le message dans l'état local pour vérifier l'auteur
    const msg      = messages.find(m => m.id === messageId);
    const isAuthor = msg && msg.user_id === currentUser.id;

    if (!isAdmin && !isAuthor) return;

    await supabase.from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, [currentUser, messages]);

  // ── Modifier (auteur, 20min) ─────────────────────────────────────
  const editChatMessage = useCallback(async (messageId, newContent) => {
    if (!currentUser?.id || !newContent.trim()) return false;
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.user_id !== currentUser.id) return false;
    if (Date.now() - new Date(msg.created_at).getTime() > 20 * 60 * 1000) return false;
    const { error } = await supabase
      .from('chat_messages')
      .update({ content: newContent.trim() })
      .eq('id', messageId)
      .eq('user_id', currentUser.id);
    if (error) return false;
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, content: newContent.trim(), _edited: true } : m
    ));
    return true;
  }, [currentUser?.id, messages]);

  // ── Toggle réaction ──────────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser?.id) return;
    const uid        = currentUser.id;
    const hasReacted = reactions[messageId]?.[emoji]?.users?.includes(uid);

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
      await supabase.from('chat_reactions').delete()
        .eq('message_id', messageId).eq('user_id', uid).eq('emoji', emoji);
    } else {
      await supabase.from('chat_reactions').insert({ message_id: messageId, user_id: uid, emoji });
    }
  }, [currentUser?.id, reactions]);

  // ── Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchMessages(period, true);
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel('chat_public_global_v160')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== payload.new.id));
        } else {
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id
              ? { ...m, content: payload.new.content, _edited: true }
              : m
          ));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reactions' }, (payload) => {
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_reactions' }, (payload) => {
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
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUser?.id) {
          await channel.track({ user_id: currentUser.id });
        }
      });

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, period]);

  return (
    <ChatContext.Provider value={{
      messages, reactions, loading, hasMore, period, onlineCount,
      fetchMessages, changePeriod, loadMore,
      sendChatMessage, deleteChatMessage, editChatMessage, toggleReaction,
      isMentionAll,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
