/**
 * ChatPage — NovaSound TITAN LUX v100
 * Chat Public Global — inspiré Lord Mobile
 * - Boîte commune à tous les utilisateurs
 * - Filtres par période (aujourd'hui / 7j / 30j / tout)
 * - Reply/Tag avec preview du message cité
 * - Réactions emoji flottantes (❤️🔥🎵👏😂)
 * - Realtime Supabase
 * - Présence (compteur en ligne)
 * - Soft delete (auteur + admin)
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, CHAT_PERIODS } from '@/contexts/ChatContext';
import Header from '@/components/Header';
import {
  Send, Reply, Trash2, User, Globe, ChevronUp,
  Loader2, X, Smile, Users, Music,
} from 'lucide-react';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';
const EMOJI_LIST  = ['❤️', '🔥', '🎵', '👏', '😂', '🙌', '💯', '😍'];

// ── Helpers ──────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'maintenant';
  if (diff < 3600)   return `${Math.floor(diff / 60)}min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
};

// ── Avatar ────────────────────────────────────────────────────────
const Avatar = memo(({ user, size = 8 }) => (
  user?.avatar_url
    ? <img src={user.avatar_url} alt={user.username || ''} className={`w-${size} h-${size} rounded-full object-cover border border-white/10 flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-cyan-500/30 to-magenta-500/30 border border-white/10 flex items-center justify-center flex-shrink-0`}>
        <User className="w-3.5 h-3.5 text-gray-400" />
      </div>
));

// ── Picker emoji ─────────────────────────────────────────────────
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

// ── Bubble réactions ─────────────────────────────────────────────
const ReactionBar = memo(({ msgId, reactions, currentUserId, onToggle }) => {
  const msgReactions = reactions[msgId] || {};
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

// ── Message ───────────────────────────────────────────────────────
const ChatMessage = memo(({
  msg, currentUser, currentUserEmail, reactions,
  onReply, onDelete, onToggleReaction, highlightId,
}) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isOwn   = msg.user_id === currentUser?.id;
  const isAdmin = currentUserEmail === ADMIN_EMAIL;
  const canDel  = isOwn || isAdmin;
  const isHighlighted = highlightId === msg.id;
  const user    = msg.users || { username: 'Utilisateur', avatar_url: null };

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`group flex gap-2.5 px-3 py-2 rounded-2xl transition-colors ${
        isHighlighted ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/[0.025]'
      }`}
      onClick={() => setShowActions(v => !v)}
    >
      {/* Avatar */}
      <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()} className="flex-shrink-0 mt-0.5">
        <Avatar user={user} size={8} />
      </Link>

      {/* Corps */}
      <div className="flex-1 min-w-0">
        {/* Header : nom + temps */}
        <div className="flex items-center gap-2 mb-0.5">
          <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 truncate transition-colors">
            {user.username}
          </Link>
          <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.created_at)}</span>
          {isAdmin && !isOwn && (
            <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 rounded-full border border-yellow-500/20 flex-shrink-0">ADMIN</span>
          )}
          {isOwn && (
            <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-full border border-cyan-500/20 flex-shrink-0">Moi</span>
          )}
        </div>

        {/* Message cité (reply) */}
        {msg.reply_to_id && msg.reply_to_content && (
          <div
            className="flex items-start gap-2 mb-1.5 px-2.5 py-1.5 bg-white/[0.04] border-l-2 border-cyan-500/50 rounded-r-xl rounded-l-sm cursor-pointer"
            onClick={e => {
              e.stopPropagation();
              const el = document.getElementById(`msg-${msg.reply_to_id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            <Reply className="w-3 h-3 text-cyan-500/60 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-cyan-400/80 truncate">
                {msg.reply_to_username}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{msg.reply_to_content}</p>
            </div>
          </div>
        )}

        {/* Contenu */}
        <p className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${msg._pending ? 'text-gray-500 italic' : 'text-gray-200'}`}>
          {msg.content}{msg._pending ? ' ···' : ''}
        </p>

        {/* Réactions */}
        <ReactionBar
          msgId={msg.id}
          reactions={reactions}
          currentUserId={currentUser?.id}
          onToggle={onToggleReaction}
        />

        {/* Actions (apparaissent au clic ou hover) */}
        <AnimatePresence>
          {(showActions || showEmoji) && currentUser && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1 mt-1.5"
              onClick={e => e.stopPropagation()}
            >
              {/* Reply */}
              <button onClick={() => { onReply(msg); setShowActions(false); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white text-[11px] transition-all">
                <Reply className="w-3 h-3" /> Répondre
              </button>
              {/* Emoji */}
              <div className="relative">
                <button onClick={() => setShowEmoji(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-yellow-400 text-[11px] transition-all">
                  <Smile className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showEmoji && (
                    <EmojiPicker
                      onPick={(e) => onToggleReaction(msg.id, e)}
                      onClose={() => setShowEmoji(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
              {/* Supprimer */}
              {canDel && (
                <button onClick={() => { onDelete(msg.id); setShowActions(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-600 hover:text-red-400 text-[11px] transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => { setShowActions(false); setShowEmoji(false); }}
                className="p-1 text-gray-700 hover:text-white">
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
  const currentUserEmail = currentUser?.email;
  const {
    messages, reactions, loading, hasMore, period, onlineCount,
    changePeriod, loadMore,
    sendChatMessage, deleteChatMessage, toggleReaction,
  } = useChat();

  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [replyTo,     setReplyTo]     = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [showScroll,  setShowScroll]  = useState(false);

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const scrollRef    = useRef(null);
  const isAtBottom   = useRef(true);

  // ── Scroll auto en bas quand nouveau message ─────────────────────
  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ── Scroll to bottom (initial) ───────────────────────────────────
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 150);
  }, []);

  // ── Détecter si on est en bas ────────────────────────────────────
  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottom.current = atBottom;
    setShowScroll(!atBottom && messages.length > 10);
    // Load more quand on atteint le haut
    if (el.scrollTop < 80 && hasMore && !loading) {
      const prevHeight = el.scrollHeight;
      loadMore();
      // Maintenir la position de scroll après chargement
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }, [hasMore, loading, loadMore, messages.length]);

  // ── Envoyer ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!text.trim() || sending || !currentUser) return;
    setSending(true);
    const content = text.trim();
    setText('');
    const reply = replyTo;
    setReplyTo(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
    // Highlight le message cité
    setHighlightId(msg.id);
    setTimeout(() => setHighlightId(null), 2000);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    isAtBottom.current = true;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScroll(false);
  }, []);

  const MAX = 1000;
  const remaining = MAX - text.length;

  return (
    <>
      <Helmet>
        <title>Chat Global — NovaSound TITAN LUX</title>
        <meta name="description" content="Espace de conversation commun à toute la communauté NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <div className="flex-1 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

          {/* ── Barre supérieure : titre + filtres + présence ── */}
          <div className="flex-shrink-0 border-b border-white/[0.06] bg-gray-950/95 backdrop-blur-sm px-4 py-3">
            <div className="max-w-3xl mx-auto">
              {/* Titre + présence */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-magenta-500/20 border border-white/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-white font-black text-base leading-none">Chat Global</h1>
                    <p className="text-gray-600 text-[11px] mt-0.5">Espace communautaire NovaSound</p>
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

              {/* Filtres de période */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {CHAT_PERIODS.map(p => (
                  <button key={p.key}
                    onClick={() => changePeriod(p.key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      period === p.key
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 text-gray-500 border-white/[0.07] hover:bg-white/10 hover:text-gray-300'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Zone messages ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={handleScroll}
          >
            <div className="max-w-3xl mx-auto py-3 pb-2">

              {/* Bouton charger plus */}
              {hasMore && (
                <div className="flex justify-center py-3">
                  <button onClick={loadMore} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-400 hover:text-white transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4" />}
                    Charger plus
                  </button>
                </div>
              )}

              {/* État chargement initial */}
              {loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mb-3" />
                  <p className="text-gray-600 text-sm">Chargement du chat…</p>
                </div>
              )}

              {/* État vide */}
              {!loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <Music className="w-14 h-14 text-gray-800 mb-4" />
                  <p className="text-gray-500 font-semibold">Aucun message pour cette période</p>
                  <p className="text-gray-700 text-sm mt-1">Sois le premier à écrire !</p>
                </div>
              )}

              {/* Messages */}
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
                    onToggleReaction={toggleReaction}
                    highlightId={highlightId}
                  />
                ))}
              </div>

              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          {/* ── Bouton scroll to bottom ── */}
          <AnimatePresence>
            {showScroll && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleScrollToBottom}
                className="fixed bottom-32 right-4 md:bottom-28 z-40 w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white transition-all"
              >
                <ChevronUp className="w-5 h-5 rotate-180" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Zone de saisie ── */}
          <div className="flex-shrink-0 border-t border-white/[0.06] bg-gray-950/95 backdrop-blur-sm px-4 py-3 pb-safe">
            <div className="max-w-3xl mx-auto">

              {/* Preview reply */}
              <AnimatePresence>
                {replyTo && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-white/[0.04] border border-white/[0.07] border-l-2 border-l-cyan-500 rounded-xl">
                      <Reply className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-cyan-400 truncate">
                          Répondre à {replyTo.users?.username || replyTo.reply_to_username || 'Utilisateur'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{replyTo.content}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="p-1 text-gray-600 hover:text-white transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input + envoyer */}
              {currentUser ? (
                <div className="flex items-end gap-2">
                  <Avatar user={currentUser} size={8} />
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={text}
                      onChange={e => setText(e.target.value.slice(0, MAX))}
                      onKeyDown={handleKeyDown}
                      placeholder="Écrire dans le chat…"
                      rows={1}
                      maxLength={MAX}
                      style={{ resize: 'none', minHeight: 40, maxHeight: 120 }}
                      className="w-full bg-gray-800/80 border border-white/[0.08] rounded-2xl px-4 py-2.5 pr-14 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors overflow-y-auto"
                      onInput={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                    />
                    {/* Compteur caractères */}
                    {text.length > MAX * 0.8 && (
                      <span className={`absolute bottom-2.5 right-14 text-[10px] ${remaining < 50 ? 'text-red-400' : 'text-gray-600'}`}>
                        {remaining}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {sending
                      ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                  <p className="text-gray-500 text-sm">Tu dois être connecté pour participer</p>
                  <Link to="/login" className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold rounded-full transition-all">
                    Connexion
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default ChatPage;
