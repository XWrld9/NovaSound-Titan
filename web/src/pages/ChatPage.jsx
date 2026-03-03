/**
 * ChatPage — NovaSound TITAN LUX v1500
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
  Loader2, X, Smile, Users, Music, AtSign, Edit2, Check, Bell, Mail,
  Sparkles, AlertTriangle, Zap,
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      style={{ willChange: 'auto' }}
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
          {msg.is_edited && <span className="text-[9px] text-gray-600 italic">(modifié)</span>}
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
            <input ref={editRef} id={`edit-msg-${msg?.id}`} name="chat-edit" value={editText}
              onChange={e => setEditText(e.target.value.slice(0, 1000))}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-gray-800 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/70 transition-colors" />
            <button onClick={handleSaveEdit} disabled={savingEdit} className="p-1.5 text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-gray-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div>
            <p className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${msg._pending ? 'text-gray-500 italic' : 'text-gray-200'}`}>
              {renderContent(msg.content)}{msg._pending ? ' ···' : ''}
            </p>
            {msg.is_edited && (
              <span className="text-[10px] text-gray-600 italic ml-2">modifié</span>
            )}
          </div>
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
    messages = [], reactions = {}, loading = false, hasMore = false, period = 'today', onlineCount = 0, onlineUsers = [],
    changePeriod = () => {}, loadMore = () => {},
    sendChatMessage = async () => {}, deleteChatMessage = async () => {}, editChatMessage = async () => false, toggleReaction = async () => {},
  } = chatCtx || {};

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing,         setClearing]         = useState(false);
  const [clearSuccess,     setClearSuccess]      = useState(false);
  const [clearDuration,    setClearDuration]    = useState('all'); // '1h','24h','7d','30d','all'
  const [activeTab,   setActiveTab]   = useState('global');
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);
  const isAdmin = currentUserEmail === ADMIN_EMAIL; // Admin visible partout dans ChatPage
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
      setActiveTab('global');
      changePeriod('all');
      // Retry jusqu'à ce que l'élément soit dans le DOM
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById('msg-' + hlId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => setHighlightId(null), 3500);
        } else if (attempts < 20) {
          attempts++;
          setTimeout(tryScroll, 300);
        } else {
          setHighlightId(null);
        }
      };
      setTimeout(tryScroll, 500);
    }

    if (tagger?.trim()) {
      const prefill = '@' + tagger.trim() + ' ';
      setText(prefill);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefill.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 600);
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
    const match  = before.match(/@([\w-]*)$/);

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
    const newBefore = before.replace(/@([\w-]*)$/, `@${username} `);
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

  // ── Nettoyer les messages du chat (ADMIN ONLY) avec sélection de durée ─
  const CLEAR_DURATIONS = [
    { key: '1h',   label: 'Dernière heure',   hours: 1 },
    { key: '24h',  label: 'Dernières 24h',    hours: 24 },
    { key: '7d',   label: '7 derniers jours', hours: 24 * 7 },
    { key: '30d',  label: '30 derniers jours',hours: 24 * 30 },
    { key: 'all',  label: 'Tout l\'historique', hours: null },
  ];

  const handleClearChat = useCallback(async () => {
    if (!isAdmin) return;
    setClearing(true);
    try {
      const durObj = CLEAR_DURATIONS.find(d => d.key === clearDuration);
      const since = durObj?.hours
        ? new Date(Date.now() - durObj.hours * 3_600_000).toISOString()
        : null;
      // Utilise la RPC SECURITY DEFINER qui bypass RLS proprement
      const { error } = await supabase.rpc('clear_chat_messages_admin', {
        admin_user_id: currentUser.id,
        since_date:    since,
      });
      if (error) throw error;
      setClearSuccess(true);
      setTimeout(() => {
        changePeriod(period);
        setClearSuccess(false);
        setShowClearConfirm(false);
      }, 2200);
    } catch (err) {
      console.error('[Chat] clearChat error:', err);
      setClearing(false);
    } finally {
      setClearing(false);
    }
  }, [isAdmin, period, changePeriod, clearDuration, currentUser?.id]);

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
          className={`flex-1 flex flex-col overflow-hidden relative`}
          style={{
            height: 'calc(100dvh - 64px)',
            backgroundImage: 'url(/chat-wallpaper.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
        >
          {/* Overlay pour lisibilité du chat — sans blur pour garder les textes nets */}
          <div className="absolute inset-0 bg-gray-950/85 pointer-events-none z-0" />
          {/* Barre supérieure */}
          <div className="flex-shrink-0 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-md px-4 py-3 relative z-10">
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
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full ${isAdmin ? 'cursor-pointer hover:bg-green-500/20 transition-colors' : ''}`}
                    onClick={() => isAdmin && setShowOnlinePanel(v => !v)}
                    title={isAdmin ? 'Voir les utilisateurs connectés' : undefined}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <Users className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-[11px] font-semibold">{onlineCount} en ligne</span>
                    {isAdmin && <span className="text-green-500 text-[9px] ml-0.5">▼</span>}
                  </div>
                )}
                {/* Bouton nettoyer le chat — ADMIN ONLY */}
                {isAdmin && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-colors"
                    title="Nettoyer le chat (Admin)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400 text-[11px] font-semibold hidden sm:inline">Nettoyer</span>
                  </button>
                )}
                {/* Panel admin — utilisateurs connectés */}
                <AnimatePresence>
                  {isAdmin && showOnlinePanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-16 right-4 z-50 w-72 bg-gray-900 border border-green-500/30 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-white font-bold text-sm">{onlineCount} connecté{onlineCount > 1 ? 's' : ''}</span>
                        </div>
                        <button onClick={() => setShowOnlinePanel(false)} className="p-1 text-gray-500 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {onlineUsers.length === 0 ? (
                          <p className="text-gray-500 text-xs text-center py-4">Aucun utilisateur tracé</p>
                        ) : (
                          onlineUsers.map((u, idx) => (
                            <div key={u.user_id + idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-green-500/30 flex-shrink-0" />
                                : <div className="w-8 h-8 rounded-full bg-gray-800 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-3.5 h-3.5 text-gray-500" />
                                  </div>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{u.username || 'Anonyme'}</p>
                                {u.email && <p className="text-gray-500 text-[10px] truncate">{u.email}</p>}
                                {u.joined_at && <p className="text-gray-600 text-[9px]">Connecté {new Date(u.joined_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>}
                              </div>
                              <a
                                href={"mailto:" + (u.email || '')}
                                className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex-shrink-0"
                                title={"Contacter " + (u.username || 'cet utilisateur')}
                                onClick={e => e.stopPropagation()}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-4 py-2 border-t border-white/[0.06] bg-gray-950/50">
                        <p className="text-[10px] text-gray-600 text-center">Visible uniquement par l'administrateur</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

          {/* ─── Onglet Mes messages v7000 ─────────────────────── */}
          {activeTab === 'messages' && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto py-4 px-4">
                {loadingMsg ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                  </div>
                ) : myMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-fuchsia-400" />
                    </div>
                    <p className="text-gray-300 font-semibold text-lg">Aucun message reçu</p>
                    <p className="text-gray-500 text-sm mt-2 max-w-xs">Les réponses et mentions dans le chat apparaîtront ici dès que quelqu'un te répond.</p>
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
                              ? 'bg-[#1e1e35] border-white/[0.12] hover:bg-[#252540] hover:border-cyan-500/30'
                              : 'bg-[#1a2744] border-cyan-500/50 hover:border-cyan-400/80 shadow-lg shadow-cyan-500/15'
                          }`}
                          onClick={() => handleNotifClick(notif)}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl border ${
                            isMentionAll
                              ? 'bg-yellow-500/15 border-yellow-500/25'
                              : isReply
                              ? 'bg-cyan-500/15 border-cyan-500/25'
                              : 'bg-fuchsia-500/15 border-fuchsia-500/25'
                          }`}>
                            {isMentionAll ? '📢' : isReply ? '💬' : '@'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-sm font-bold text-white break-words leading-tight flex-1">
                                {notif.title}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {!notif.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                                <span className="text-[10px] text-gray-400">{timeAgo(notif.created_at)}</span>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed break-words text-gray-100">
                              {notif.body}
                            </p>
                            {notif.is_read && (
                              <span className="text-[10px] text-gray-500 mt-1 inline-flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Lu
                              </span>
                            )}
                          </div>
                          <Reply className="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" />
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
              <div ref={scrollRef} className="flex-1 overflow-y-auto relative z-10" style={{ WebkitOverflowScrolling: 'touch' }} onScroll={handleScroll}>
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
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-fuchsia-500/15 border border-cyan-500/15 flex items-center justify-center mb-4">
                        <Music className="w-8 h-8 text-cyan-400/60" />
                      </div>
                      <p className="text-gray-300 font-semibold">Aucun message pour cette période</p>
                      <p className="text-gray-500 text-sm mt-1.5">Sois le premier à écrire ! 🎵</p>
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
                    className="fixed right-4 z-40 w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white"
                    style={{ bottom: `calc(${playerVisible ? '72px + ' : ''}56px + env(safe-area-inset-bottom, 0px) + 72px)` }}>
                    <ChevronUp className="w-5 h-5 rotate-180" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Zone de saisie — grande, confortable sur mobile */}
              <div
                className="flex-shrink-0 border-t border-white/[0.06] bg-gray-950/95 backdrop-blur-xl px-3 pt-2 relative z-10"
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
                          id="chat-input"
                          name="chat-message"
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

      {/* ══ MODALE NETTOYER LE CHAT — Admin only, grande pompe ══ */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={() => !clearing && setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-gray-900 to-gray-950 border border-red-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-red-500/20"
              onClick={e => e.stopPropagation()}
            >
              {/* Glow top */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />

              {!clearSuccess ? (
                <div className="p-8 text-center">
                  {/* Icône animée */}
                  <motion.div
                    animate={{ rotate: [0, -8, 8, -6, 6, 0], scale: [1, 1.08, 1] }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center"
                  >
                    <Trash2 className="w-9 h-9 text-red-400" />
                  </motion.div>

                  <h2 className="text-white font-black text-xl mb-2">Nettoyer le Chat ?</h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-3">
                    Sélectionne la période à supprimer :
                  </p>

                  {/* Sélecteur de durée */}
                  <div className="grid grid-cols-1 gap-1.5 mb-4 text-left">
                    {CLEAR_DURATIONS.map(d => (
                      <button
                        key={d.key}
                        onClick={() => setClearDuration(d.key)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          clearDuration === d.key
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:bg-white/[0.07] hover:text-white'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${clearDuration === d.key ? 'bg-red-400 border-red-400' : 'border-gray-600'}`} />
                        {d.label}
                        {d.key === 'all' && <span className="ml-auto text-[10px] text-red-400/70">⚠ Tout</span>}
                      </button>
                    ))}
                  </div>

                  <p className="text-red-400/80 text-xs mb-5 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Cette action est irréversible pour tous les utilisateurs.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      disabled={clearing}
                      className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleClearChat}
                      disabled={clearing}
                      className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 text-white font-black text-sm transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {clearing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Nettoyage…</>
                        : <><Trash2 className="w-4 h-4" /> Confirmer</>
                      }
                    </button>
                  </div>
                </div>
              ) : (
                /* Animation succès — grande pompe */
                <div className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                    className="w-24 h-24 mx-auto mb-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-cyan-500/40 flex items-center justify-center"
                  >
                    <Sparkles className="w-11 h-11 text-cyan-400" />
                  </motion.div>

                  {/* Particules */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ['#06b6d4','#a855f7','#f43f5e','#f59e0b','#10b981','#3b82f6','#ec4899','#84cc16'][i],
                        top: '50%', left: '50%',
                      }}
                      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                      animate={{
                        x: [0, (Math.cos(i * 45 * Math.PI / 180) * 80)],
                        y: [0, (Math.sin(i * 45 * Math.PI / 180) * 80)],
                        scale: [0, 1.5, 0],
                        opacity: [1, 1, 0],
                      }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                    />
                  ))}

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-white font-black text-xl mb-2"
                  >
                    Chat nettoyé ! ✨
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-gray-400 text-sm"
                  >
                    Tous les messages ont été supprimés avec succès.
                  </motion.p>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.2, duration: 1.8, ease: 'linear' }}
                    className="mt-5 h-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-full"
                    style={{ transformOrigin: 'left' }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatPage;
