/**
 * ChatPage — NovaSound TITAN LUX v160
 * Chat Public Global — système de messagerie communautaire
 *
 * NOUVEAUTÉS v160 :
 *  - @tous / @all / @everyone → mentionne tout le monde (multilingue)
 *  - Suppression d'un message par SON AUTEUR (bouton "Suppr." visible pour tous)
 *  - Reply → auto-tag @username de l'auteur cité + notification dans "Mes messages" + "Notifications" + push
 *  - Clic sur notification → ramène au message exact dans le chat (highlight + scroll)
 *  - Onglet "Mes messages" : liste toutes les notifications de type chat (reply, mention, mention_all)
 *  - Compteur badge rouge sur l'onglet "Mes messages" (notifications non lues)
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, CHAT_PERIODS, isMentionAll } from '@/contexts/ChatContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import {
  Send, Reply, Trash2, User, Globe, ChevronUp,
  Loader2, X, Smile, Users, Music, AtSign, Edit2, Check, Bell,
} from 'lucide-react';

const ADMIN_EMAIL    = 'eloadxfamily@gmail.com';
const EMOJI_LIST     = ['❤️', '🔥', '🎵', '👏', '😂', '🙌', '💯', '😍'];
const EDIT_WINDOW_MS = 20 * 60 * 1000;

// Suggestions @tous dans les différentes langues
const MENTION_ALL_SUGGESTIONS = [
  { label: '@tous',      desc: 'Mentionner tout le monde' },
  { label: '@all',       desc: 'Mention everyone' },
  { label: '@everyone',  desc: 'Mention everyone' },
];

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'maintenant';
  if (diff < 3600)   return `${Math.floor(diff / 60)}min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
};

const extractUser = (msg) => {
  if (!msg) return { id: null, username: 'Utilisateur', avatar_url: null };
  const raw = msg.users;
  if (!raw) return { id: msg.user_id || null, username: 'Utilisateur', avatar_url: null };
  if (Array.isArray(raw)) return raw[0] || { id: msg.user_id, username: 'Utilisateur', avatar_url: null };
  return raw;
};

const Avatar = memo(({ user, size = 8 }) => (
  user?.avatar_url
    ? <img src={user.avatar_url} alt={user.username || ''} className={`w-${size} h-${size} rounded-full object-cover border border-white/10 flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-white/10 flex items-center justify-center flex-shrink-0`}>
        <User className="w-3.5 h-3.5 text-gray-400" />
      </div>
));

const EmojiPicker = memo(({ onPick, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.85, y: 6 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.85, y: 6 }}
    transition={{ duration: 0.12 }}
    className="absolute bottom-full mb-2 right-0 z-50 flex gap-1 bg-gray-900 border border-white/10 rounded-2xl p-2 shadow-2xl"
    onClick={e => e.stopPropagation()}
  >
    {EMOJI_LIST.map(e => (
      <button key={e} onClick={() => { onPick(e); onClose(); }}
        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-lg transition-colors">
        {e}
      </button>
    ))}
  </motion.div>
));

const ReactionBar = memo(({ msgId, reactions, currentUserId, onToggle }) => {
  const msgReactions = reactions?.[msgId] || {};
  const entries = Object.entries(msgReactions).filter(([, v]) => v.count > 0);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {entries.map(([emoji, data]) => (
        <button key={emoji}
          onClick={() => onToggle(msgId, emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
            data.users?.includes(currentUserId)
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
          }`}>
          <span>{emoji}</span>
          <span>{data.count}</span>
        </button>
      ))}
    </div>
  );
});

// Rendu du contenu avec mentions colorées
const renderContent = (text) => {
  if (!text) return null;
  const parts = text.split(/(@\w+(?:-\w+)*)/g);
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return <span key={i}>{part}</span>;
    const lower = part.toLowerCase();
    const isAll = ['@tous', '@all', '@everyone', '@todo', '@todos', '@tutti', '@allen', '@alle'].includes(lower);
    return (
      <span key={i} className={`font-bold ${isAll ? 'text-yellow-400' : 'text-cyan-400'}`}>{part}</span>
    );
  });
};

// ── Composant message ─────────────────────────────────────────────
const ChatMessage = memo(({
  msg, currentUser, currentUserEmail, reactions,
  onReply, onDelete, onEdit, onToggleReaction, highlightId,
}) => {
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]    = useState(msg?.content || '');
  const [savingEdit,  setSavingEdit]  = useState(false);
  const editRef = useRef(null);

  const user      = msg ? extractUser(msg) : null;
  const isOwn     = !!(currentUser?.id && msg?.user_id === currentUser.id);
  const isAdmin   = currentUserEmail === ADMIN_EMAIL;
  const canDelete = isAdmin || isOwn;           // ← auteur OU admin peut supprimer
  const ageMs     = msg ? Date.now() - new Date(msg.created_at || 0).getTime() : 0;
  const canEdit   = isOwn && ageMs < EDIT_WINDOW_MS;
  const isHighlighted = highlightId === msg?.id;
  const hasMentionAll = msg?.content && isMentionAll(msg.content);

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === msg?.content) { setEditing(false); return; }
    setSavingEdit(true);
    const ok = await onEdit(msg?.id, editText.trim());
    setSavingEdit(false);
    if (ok) setEditing(false);
  };

  useEffect(() => {
    if (editing) setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 50);
  }, [editing]);

  if (!msg) return null;

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`group flex gap-2.5 px-3 py-2 rounded-2xl transition-colors ${
        isHighlighted
          ? 'bg-cyan-500/10 border border-cyan-500/30'
          : hasMentionAll
            ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
            : 'hover:bg-white/[0.025]'
      }`}
      onClick={() => !editing && setShowActions(v => !v)}
    >
      {user?.id
        ? <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()} className="flex-shrink-0 mt-0.5"><Avatar user={user} size={8} /></Link>
        : <div className="flex-shrink-0 mt-0.5"><Avatar user={user} size={8} /></div>
      }

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {user?.id
            ? <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 truncate transition-colors">
                {user.username || 'Utilisateur'}
              </Link>
            : <span className="text-xs font-bold text-gray-500 truncate">{user?.username || 'Utilisateur'}</span>
          }
          <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.created_at)}</span>
          {msg._edited && <span className="text-[9px] text-gray-600 italic">(modifié)</span>}
          {isAdmin && !isOwn && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 rounded-full border border-yellow-500/20 flex-shrink-0">ADMIN</span>}
          {isOwn && <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-full border border-cyan-500/20 flex-shrink-0">Moi</span>}
          {hasMentionAll && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30 flex-shrink-0">📢 @tous</span>}
        </div>

        {msg.reply_to_id && msg.reply_to_content && (
          <div className="flex items-start gap-2 mb-1.5 px-2.5 py-1.5 bg-white/[0.04] border-l-2 border-cyan-500/50 rounded-r-xl rounded-l-sm cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              document.getElementById(`msg-${msg.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}>
            <Reply className="w-3 h-3 text-cyan-500/60 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-cyan-400/80 truncate">↩ {msg.reply_to_username}</p>
              <p className="text-[11px] text-gray-500 truncate">{msg.reply_to_content}</p>
            </div>
          </div>
        )}

        {editing ? (
          <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
            <input ref={editRef} value={editText}
              onChange={e => setEditText(e.target.value.slice(0, 1000))}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-gray-800 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/70 transition-colors" />
            <button onClick={handleSaveEdit} disabled={savingEdit} className="p-1.5 text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-gray-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <p className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${msg._pending ? 'text-gray-500 italic' : 'text-gray-200'}`}>
            {renderContent(msg.content)}{msg._pending ? ' ···' : ''}
          </p>
        )}

        <ReactionBar msgId={msg.id} reactions={reactions} currentUserId={currentUser?.id} onToggle={onToggleReaction} />

        <AnimatePresence>
          {(showActions || showEmoji) && currentUser && !editing && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1 mt-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
              <button onClick={() => { onReply(msg); setShowActions(false); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/15 text-gray-500 hover:text-cyan-400 text-[11px] transition-all">
                <Reply className="w-3 h-3" /> Répondre
              </button>
              {canEdit && (
                <button onClick={() => { setEditing(true); setEditText(msg.content); setShowActions(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 text-[11px] transition-all">
                  <Edit2 className="w-3 h-3" /> Modifier
                </button>
              )}
              <div className="relative">
                <button onClick={() => setShowEmoji(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-yellow-400 text-[11px] transition-all">
                  <Smile className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showEmoji && <EmojiPicker onPick={(e) => onToggleReaction(msg.id, e)} onClose={() => setShowEmoji(false)} />}
                </AnimatePresence>
              </div>
              {canDelete && (
                <button onClick={() => { onDelete(msg.id); setShowActions(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-600 hover:text-red-400 text-[11px] transition-all">
                  <Trash2 className="w-3 h-3" /> Suppr.
                </button>
              )}
              <button onClick={() => { setShowActions(false); setShowEmoji(false); }} className="p-1 text-gray-700 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// ════════════════════════════════════════════════════════════════════
const ChatPage = () => {
  const { currentUser } = useAuth();
  const currentUserEmail = currentUser?.email || '';
  const navigate  = useNavigate();
  const location  = useLocation();
  const chatCtx   = useChat();
  const notifCtx  = useNotifications();
  const { isVisible: playerVisible } = usePlayer();

  const {
    messages = [], reactions = {}, loading = false, hasMore = false, period = 'today', onlineCount = 0,
    changePeriod = () => {}, loadMore = () => {},
    sendChatMessage = async () => {}, deleteChatMessage = async () => {}, editChatMessage = async () => false, toggleReaction = async () => {},
  } = chatCtx || {};

  const [activeTab,   setActiveTab]   = useState('global');
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [replyTo,     setReplyTo]     = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [showScroll,  setShowScroll]  = useState(false);

  const [mentionUsers,    setMentionUsers]    = useState([]);
  const [showMention,     setShowMention]     = useState(false);
  const [showMentionAll,  setShowMentionAll]  = useState(false); // suggestions @tous
  const mentionDebounce = useRef(null);

  // Mes messages = notifications de type chat (reply, mention, mention_all)
  const [myMessages,  setMyMessages]  = useState([]);
  const [loadingMsg,  setLoadingMsg]  = useState(false);
  const [unreadMsg,   setUnreadMsg]   = useState(0);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const scrollRef  = useRef(null);
  const isAtBottom = useRef(true);

  // ── ?highlight & ?tagger ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hlId   = params.get('highlight');
    const tagger = params.get('tagger');

    if (hlId) {
      setHighlightId(hlId);
      changePeriod('all');
      setTimeout(() => {
        const el = document.getElementById(`msg-${hlId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightId(null), 3000);
      }, 900);
    }

    if (tagger?.trim()) {
      const prefill = `@${tagger.trim()} `;
      setText(prefill);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefill.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 450);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // ── Scroll auto ───────────────────────────────────────────────────
  useEffect(() => {
    if (isAtBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 150);
  }, []);

  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottom.current = atBottom;
    setShowScroll(!atBottom && messages.length > 10);
    if (el.scrollTop < 80 && hasMore && !loading) {
      const prevHeight = el.scrollHeight;
      loadMore();
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
    }
  }, [hasMore, loading, loadMore, messages.length]);

  // ── Charger "Mes messages" (notifications chat) ───────────────────
  const fetchMyMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingMsg(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .in('type', ['chat_reply', 'chat_mention', 'chat_mention_all'])
        .order('created_at', { ascending: false })
        .limit(50);
      setMyMessages(data || []);
      setUnreadMsg((data || []).filter(n => !n.is_read).length);
    } catch (e) {
      console.error('[Chat] fetchMyMessages:', e);
    }
    setLoadingMsg(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'messages' && currentUser) {
      fetchMyMessages();
      // Recharger les notifs depuis le serveur pour avoir les données fraîches
      if (notifCtx?.loadNotifications) notifCtx.loadNotifications();
      // Marquer toutes les notifs chat non lues comme lues
      const chatNotifs = (notifCtx?.notifications || [])
        .filter(n => ['chat_reply', 'chat_mention', 'chat_mention_all'].includes(n.type) && !n.is_read);
      if (chatNotifs.length > 0) {
        chatNotifs.forEach(n => notifCtx.markAsRead(n.id).catch(() => {}));
        setUnreadMsg(0);
      }
    }
  }, [activeTab, currentUser, fetchMyMessages]);

  // Compteur non lus en temps réel via NotificationContext
  // Recalculé à chaque changement des notifications
  useEffect(() => {
    if (!notifCtx?.notifications) return;
    const chatNotifs = notifCtx.notifications.filter(
      n => ['chat_reply', 'chat_mention', 'chat_mention_all'].includes(n.type) && !n.is_read
    );
    // Ne mettre à jour que si on est sur l'onglet global (évite race conditions)
    if (activeTab !== 'messages') {
      setUnreadMsg(chatNotifs.length);
    }
  }, [notifCtx?.notifications, activeTab]);

  // ── @mention autocomplétion ────────────────────────────────────────
  const handleTextChange = useCallback((e) => {
    const val    = e.target.value.slice(0, 1000);
    setText(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);

    if (match) {
      const q = match[1].toLowerCase();
      setShowMention(true);

      // Suggestions @tous si le début match
      const allKeywords = ['tous', 'all', 'every', 'everyone', 'todo', 'tutti', 'allen'];
      const matchesAll  = allKeywords.some(k => k.startsWith(q) || q === '');
      setShowMentionAll(matchesAll && q.length <= 5);

      if (q.length >= 1) {
        clearTimeout(mentionDebounce.current);
        mentionDebounce.current = setTimeout(async () => {
          try {
            const { data } = await supabase.from('users').select('id, username, avatar_url').ilike('username', `${q}%`).limit(5);
            setMentionUsers(data || []);
          } catch { setMentionUsers([]); }
        }, 200);
      } else {
        setMentionUsers([]);
      }
    } else {
      setShowMention(false);
      setShowMentionAll(false);
      setMentionUsers([]);
    }
  }, []);

  const insertMention = useCallback((username) => {
    const cursor    = inputRef.current?.selectionStart || text.length;
    const before    = text.slice(0, cursor);
    const after     = text.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, `@${username} `);
    const newText   = newBefore + after;
    setText(newText);
    setShowMention(false);
    setShowMentionAll(false);
    setMentionUsers([]);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = newBefore.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  }, [text]);

  // ── Envoyer ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!text.trim() || sending || !currentUser) return;
    setSending(true);
    const content = text.trim();
    const reply   = replyTo;
    setText('');
    setReplyTo(null);
    setShowMention(false);
    setShowMentionAll(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      await sendChatMessage(content, reply);
      isAtBottom.current = true;
    } catch (err) {
      console.error('[Chat] send error:', err);
      setText(content);
      setReplyTo(reply);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [text, sending, currentUser, replyTo, sendChatMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    // Highlight le message auquel on répond
    setHighlightId(msg.id);
    setTimeout(() => {
      inputRef.current?.focus();
      setTimeout(() => setHighlightId(null), 2000);
    }, 100);
  }, []);

  // Clic sur une notification "Mes messages" → nav vers le chat au bon message
  const handleNotifClick = useCallback(async (notif) => {
    // Marquer comme lu dans Supabase ET dans l'état local
    if (!notif.is_read && notifCtx?.markAsRead) {
      await notifCtx.markAsRead(notif.id);
      setMyMessages(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadMsg(c => Math.max(0, c - 1));
    }
    // Naviguer vers le chat avec highlight
    if (notif.url) {
      setActiveTab('global');
      navigate(notif.url);
    }
  }, [notifCtx, navigate]);

  const MAX       = 1000;
  const remaining = MAX - text.length;

  if (!chatCtx) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center"><Loader2 className="w-7 h-7 text-cyan-400 animate-spin" /></div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Chat Global — NovaSound TITAN LUX</title>
        <meta name="description" content="Espace de conversation commun à toute la communauté NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <div
          className={`flex-1 flex flex-col overflow-hidden`}
          style={{
            /* On laisse la zone input gérer son propre padding en bas */
            height: 'calc(100dvh - 64px)',
          }}
        >
          {/* Barre supérieure */}
          <div className="flex-shrink-0 border-b border-white/[0.06] bg-gray-950/95 backdrop-blur-sm px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-white font-black text-base leading-none">Chat Global</h1>
                    <p className="text-gray-600 text-[11px] mt-0.5">Communauté NovaSound · @tous pour mentionner tout le monde</p>
                  </div>
                </div>
                {onlineCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <Users className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-[11px] font-semibold">{onlineCount} en ligne</span>
                  </div>
                )}
              </div>

              {/* Onglets */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setActiveTab('global')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    activeTab === 'global'
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-gray-500 border-white/[0.07] hover:bg-white/10 hover:text-gray-300'
                  }`}>
                  <Globe className="w-3 h-3" />Chat global
                </button>
                {currentUser && (
                  <button onClick={() => setActiveTab('messages')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border relative ${
                      activeTab === 'messages'
                        ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white border-transparent'
                        : 'bg-white/5 text-gray-500 border-white/[0.07] hover:bg-white/10 hover:text-gray-300'
                    }`}>
                    <Bell className="w-3 h-3" />Mes messages
                    {unreadMsg > 0 && (
                      <span className="ml-1 min-w-[16px] h-4 text-[9px] bg-pink-500 text-white rounded-full px-1 py-0.5 font-bold flex items-center justify-center">
                        {unreadMsg > 99 ? '99+' : unreadMsg}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Filtres période */}
              {activeTab === 'global' && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                  {CHAT_PERIODS.map(p => (
                    <button key={p.key} onClick={() => changePeriod(p.key)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        period === p.key
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent shadow-lg shadow-cyan-500/20'
                          : 'bg-white/5 text-gray-500 border-white/[0.07] hover:bg-white/10 hover:text-gray-300'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Onglet Mes messages ─────────────────────────────── */}
          {activeTab === 'messages' && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto py-4 px-4">
                {loadingMsg ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                  </div>
                ) : myMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Bell className="w-14 h-14 text-gray-800 mb-4" />
                    <p className="text-gray-500 font-semibold">Aucun message reçu</p>
                    <p className="text-gray-700 text-sm mt-1">Les réponses et mentions dans le chat apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myMessages.map(notif => {
                      let meta = {};
                      try { meta = JSON.parse(notif.metadata || '{}'); } catch {}
                      const isMentionAll = notif.type === 'chat_mention_all';
                      const isReply      = notif.type === 'chat_reply';
                      return (
                        <button key={notif.id}
                          className={`w-full flex items-start gap-3 p-4 border rounded-2xl transition-all text-left ${
                            notif.is_read
                              ? 'bg-gray-900/30 border-white/[0.04] hover:border-cyan-500/10'
                              : 'bg-gray-900/70 border-cyan-500/20 hover:border-cyan-500/40 shadow-sm shadow-cyan-500/5'
                          }`}
                          onClick={() => handleNotifClick(notif)}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                            isMentionAll ? 'bg-yellow-500/15' : isReply ? 'bg-cyan-500/15' : 'bg-fuchsia-500/15'
                          }`}>
                            {isMentionAll ? '📢' : isReply ? '💬' : '@'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-sm font-bold truncate ${notif.is_read ? 'text-gray-400' : 'text-white'}`}>
                                {notif.title}
                              </span>
                              <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(notif.created_at)}</span>
                              {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                            </div>
                            <p className={`text-xs leading-relaxed break-words line-clamp-2 ${notif.is_read ? 'text-gray-600' : 'text-gray-400'}`}>
                              {notif.body}
                            </p>
                          </div>
                          <Reply className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Chat Global ─────────────────────────────────────── */}
          {activeTab === 'global' && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }} onScroll={handleScroll}>
                <div className="max-w-3xl mx-auto py-3 pb-2">
                  {hasMore && (
                    <div className="flex justify-center py-3">
                      <button onClick={loadMore} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-400 hover:text-white transition-all">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4" />}
                        Charger plus
                      </button>
                    </div>
                  )}
                  {loading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mb-3" />
                      <p className="text-gray-600 text-sm">Chargement…</p>
                    </div>
                  )}
                  {!loading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                      <Music className="w-14 h-14 text-gray-800 mb-4" />
                      <p className="text-gray-500 font-semibold">Aucun message pour cette période</p>
                      <p className="text-gray-700 text-sm mt-1">Sois le premier à écrire !</p>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {messages.map(msg => (
                      <ChatMessage
                        key={msg.id}
                        msg={msg}
                        currentUser={currentUser}
                        currentUserEmail={currentUserEmail}
                        reactions={reactions}
                        onReply={handleReply}
                        onDelete={deleteChatMessage}
                        onEdit={editChatMessage}
                        onToggleReaction={toggleReaction}
                        highlightId={highlightId}
                      />
                    ))}
                  </div>
                  <div ref={bottomRef} className="h-2" />
                </div>
              </div>

              <AnimatePresence>
                {showScroll && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => { isAtBottom.current = true; bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScroll(false); }}
                    className=\"fixed right-4 z-40 w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white\"
                    style={{ bottom: `calc(${playerVisible ? '72px + ' : ''}56px + env(safe-area-inset-bottom, 0px) + 72px)` }}>
                    <ChevronUp className=\"w-5 h-5 rotate-180\" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Zone de saisie — grande, confortable sur mobile */}
              <div
                className=\"flex-shrink-0 border-t border-white/[0.06] bg-gray-950/98 backdrop-blur-xl px-3 pt-2 relative\"
                style={{
                  paddingBottom: `calc(${playerVisible ? '72px + ' : ''}56px + env(safe-area-inset-bottom, 8px) + 6px)`,
                }}
              >
                <div className="max-w-3xl mx-auto">
                  {/* Preview réponse */}
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-cyan-500/5 border-l-2 border-l-cyan-500 border border-white/[0.07] rounded-xl">
                          <Reply className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-cyan-400 truncate">
                              ↩ Répondre à <span className="text-white">@{extractUser(replyTo).username || 'Utilisateur'}</span>
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{replyTo.content}</p>
                          </div>
                          <button onClick={() => setReplyTo(null)} className="p-1 text-gray-600 hover:text-white flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Autocomplete mention */}
                  <AnimatePresence>
                    {showMention && (mentionUsers.length > 0 || showMentionAll) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="absolute bottom-full left-4 right-4 mb-1 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                        style={{ maxHeight: 260 }}>
                        <div className="p-1.5 space-y-0.5">
                          {/* Suggestions @tous */}
                          {showMentionAll && MENTION_ALL_SUGGESTIONS.map(s => (
                            <button key={s.label}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-yellow-500/10 transition-colors text-left"
                              onMouseDown={e => { e.preventDefault(); insertMention(s.label.slice(1)); }}>
                              <div className="w-7 h-7 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-sm flex-shrink-0">
                                📢
                              </div>
                              <div className="min-w-0">
                                <span className="text-yellow-400 text-sm font-bold">{s.label}</span>
                                <span className="text-gray-600 text-xs ml-2">{s.desc}</span>
                              </div>
                            </button>
                          ))}
                          {/* Utilisateurs */}
                          {mentionUsers.map(u => (
                            <button key={u.id}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
                              onMouseDown={e => { e.preventDefault(); insertMention(u.username); }}>
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0" />
                                : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-white/10 flex items-center justify-center flex-shrink-0"><User className="w-3.5 h-3.5 text-gray-400" /></div>
                              }
                              <span className="text-white text-sm font-semibold">@{u.username}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {currentUser ? (
                    <div className="flex items-end gap-2">
                      <Avatar user={currentUser} size={8} />
                      <div className="flex-1 relative">
                        <textarea
                          ref={inputRef}
                          value={text}
                          onChange={handleTextChange}
                          onKeyDown={handleKeyDown}
                          placeholder="Écrire dans le chat… @tous pour mentionner tout le monde"
                          rows={1}
                          maxLength={MAX}
                          style={{ resize: 'none', minHeight: 44, maxHeight: 140 }}
                          className="w-full bg-gray-800/90 border border-white/[0.10] rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-gray-800 transition-all overflow-y-auto leading-relaxed"
                          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
                        />
                        {text.length > MAX * 0.8 && (
                          <span className={`absolute bottom-3 right-12 text-[10px] ${remaining < 50 ? 'text-red-400' : 'text-gray-600'}`}>{remaining}</span>
                        )}
                      </div>
                      <button onClick={handleSend} disabled={!text.trim() || sending}
                        className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
                        {sending
                          ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          : <Send className="w-4 h-4 text-white" />
                        }
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 py-3.5 px-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                      <p className="text-gray-500 text-sm">Tu dois être connecté pour participer</p>
                      <Link to="/login" className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold rounded-full transition-all">Connexion</Link>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatPage;
