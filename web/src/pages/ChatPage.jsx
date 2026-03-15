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
import NoTranslate from '@/components/NoTranslate';

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

// Styles chat premium + effets mentions
const CHAT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

  /* ══ KEYFRAMES ══ */
  @keyframes mentionPulse{0%,100%{box-shadow:0 0 0 0 rgba(6,182,212,.5)}60%{box-shadow:0 0 0 8px rgba(6,182,212,0)}}
  @keyframes mentionAllPulse{0%,100%{box-shadow:0 0 0 0 rgba(234,179,8,.5)}60%{box-shadow:0 0 0 8px rgba(234,179,8,0)}}
  @keyframes selfMentionShine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
  @keyframes chatFadeIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes chatFadeInOwn{from{opacity:0;transform:translateY(10px) scale(0.97) translateX(10px)}to{opacity:1;transform:translateY(0) scale(1) translateX(0)}}
  @keyframes topBarGlow{0%,100%{box-shadow:0 1px 0 rgba(6,182,212,.12),0 0 30px rgba(6,182,212,.04)}50%{box-shadow:0 1px 0 rgba(168,85,247,.15),0 0 30px rgba(168,85,247,.06)}}
  @keyframes liveRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.4);opacity:0}}
  @keyframes nsGradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  @keyframes nsPulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes floatParticle{0%{transform:translateY(0) scale(1);opacity:0.6}50%{opacity:0.3}100%{transform:translateY(-40px) scale(0.6);opacity:0}}
  @keyframes scanLine{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes inputGlow{0%,100%{box-shadow:0 0 0 3px rgba(6,182,212,.06)}50%{box-shadow:0 0 0 3px rgba(168,85,247,.08)}}
  @keyframes unreadDot{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
  @keyframes msgSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes replyBounce{0%{transform:translateX(0)}30%{transform:translateX(4px)}60%{transform:translateX(-2px)}100%{transform:translateX(0)}}
  @keyframes sendPop{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}

  /* ══ WALLPAPER CHAT ══ */
  .chat-wallpaper {
    position:absolute;inset:0;pointer-events:none;overflow:hidden;
  }
  .chat-wallpaper::before {
    content:'';position:absolute;inset:0;
    background:
      radial-gradient(ellipse 55% 35% at 15% 20%, rgba(6,182,212,.05) 0%, transparent 65%),
      radial-gradient(ellipse 45% 40% at 85% 75%, rgba(168,85,247,.06) 0%, transparent 65%),
      radial-gradient(ellipse 30% 50% at 50% 50%, rgba(6,182,212,.03) 0%, transparent 70%);
    animation:nsPulse 8s ease-in-out infinite;
  }
  .chat-wallpaper::after {
    content:'';position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(6,182,212,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,.025) 1px, transparent 1px);
    background-size:48px 48px;
    mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%);
  }

  /* ══ TOP BAR ══ */
  .chat-top-bar {
    background:rgba(4,4,18,.96);
    backdrop-filter:blur(32px) saturate(2);
    border-bottom:1px solid transparent;
    animation:topBarGlow 5s ease-in-out infinite;
    position:relative;
  }
  .chat-top-bar::after {
    content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent 0%,rgba(6,182,212,.5) 30%,rgba(168,85,247,.4) 70%,transparent 100%);
  }

  /* ══ PERIOD PILLS ══ */
  .chat-period-active {
    background:linear-gradient(135deg,rgba(6,182,212,.18),rgba(168,85,247,.12));
    border-color:rgba(6,182,212,.45) !important;
    color:#22d3ee !important;
    box-shadow:0 0 16px rgba(6,182,212,.12),inset 0 1px 0 rgba(255,255,255,.08);
  }

  /* ══ TABS ══ */
  .chat-tab-global-active {
    background:linear-gradient(135deg,rgba(6,182,212,.2),rgba(168,85,247,.14));
    color:#67e8f9 !important;border-color:rgba(6,182,212,.45) !important;
    box-shadow:0 4px 20px rgba(6,182,212,.15),inset 0 1px 0 rgba(255,255,255,.1);
  }
  .chat-tab-msg-active {
    background:linear-gradient(135deg,rgba(168,85,247,.2),rgba(236,72,153,.12));
    color:#d8b4fe !important;border-color:rgba(168,85,247,.45) !important;
    box-shadow:0 4px 20px rgba(168,85,247,.15),inset 0 1px 0 rgba(255,255,255,.1);
  }

  /* ══ MESSAGE BUBBLES ══ */
  .chat-msg-in { animation:chatFadeIn .22s cubic-bezier(.34,1.56,.64,1) both; }
  .chat-msg-in-own { animation:chatFadeInOwn .22s cubic-bezier(.34,1.56,.64,1) both; }

  .msg-bubble-own {
    background:linear-gradient(135deg,rgba(8,145,178,.95) 0%,rgba(88,28,220,.9) 60%,rgba(124,58,237,.95) 100%) !important;
    box-shadow:0 6px 28px rgba(8,145,178,.3),0 2px 8px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.18) !important;
    border:1px solid rgba(6,182,212,.2) !important;
    backdrop-filter:blur(16px);
    position:relative;overflow:hidden;
  }
  .msg-bubble-own::before {
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,rgba(255,255,255,.2),rgba(255,255,255,.05));
  }
  .msg-bubble-other {
    background:rgba(255,255,255,.055) !important;
    border:1px solid rgba(255,255,255,.09) !important;
    backdrop-filter:blur(16px);
    box-shadow:0 2px 16px rgba(0,0,0,.25);
  }
  .msg-bubble-other:hover {
    background:rgba(255,255,255,.075) !important;
    border-color:rgba(255,255,255,.13) !important;
  }
  .msg-bubble-mention-all {
    background:linear-gradient(135deg,rgba(234,179,8,.13),rgba(251,146,60,.07)) !important;
    border:1px solid rgba(234,179,8,.3) !important;
    box-shadow:0 4px 20px rgba(234,179,8,.1);
  }
  .msg-bubble-mention-self {
    background:linear-gradient(135deg,rgba(168,85,247,.15),rgba(236,72,153,.08)) !important;
    border:1px solid rgba(168,85,247,.3) !important;
    box-shadow:0 4px 20px rgba(168,85,247,.12);
    animation:mentionPulse 2.5s ease-in-out 1;
  }

  /* ══ MENTIONS ══ */
  .chat-mention-user {
    display:inline-flex;align-items:center;
    background:linear-gradient(135deg,rgba(6,182,212,.18),rgba(6,182,212,.08));
    border:1px solid rgba(6,182,212,.35);color:#67e8f9;font-weight:700;
    padding:0 6px 1px;border-radius:7px;font-size:.87em;letter-spacing:.01em;
    transition:all .15s;cursor:pointer;
    animation:mentionPulse 2.5s ease-in-out 1;
    text-decoration:none;
  }
  .chat-mention-user:hover {
    background:linear-gradient(135deg,rgba(6,182,212,.3),rgba(6,182,212,.15));
    border-color:rgba(6,182,212,.6);color:#a5f3fc;
    transform:translateY(-1px);box-shadow:0 4px 12px rgba(6,182,212,.2);
  }
  .chat-mention-all {
    display:inline-flex;align-items:center;gap:3px;
    background:linear-gradient(135deg,rgba(234,179,8,.22),rgba(251,146,60,.12));
    border:1px solid rgba(234,179,8,.4);color:#fde047;font-weight:800;
    padding:0 6px 1px;border-radius:7px;font-size:.87em;
    animation:mentionAllPulse 2s ease-in-out 1;
  }
  .chat-mention-self {
    display:inline-flex;align-items:center;
    background:linear-gradient(90deg,rgba(6,182,212,.3),rgba(168,85,247,.25),rgba(6,182,212,.3));
    background-size:200% 100%;border:1px solid rgba(168,85,247,.45);
    color:#d8b4fe;font-weight:800;padding:0 6px 1px;border-radius:7px;font-size:.87em;
    animation:selfMentionShine 2s linear 3;
  }
  .chat-link{color:#22d3ee;text-decoration:underline;text-underline-offset:3px;word-break:break-all;transition:color .15s;}
  .chat-link:hover{color:#67e8f9;text-shadow:0 0 12px rgba(6,182,212,.5);}
  .chat-live-link {
    display:inline-flex;align-items:center;gap:5px;
    background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
    color:#fca5a5;border-radius:8px;padding:1px 8px;font-size:.85em;font-weight:700;
    transition:all .15s;
  }
  .chat-live-link:hover{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.5);}

  /* ══ INPUT ZONE ══ */
  .chat-input-glass {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    backdrop-filter:blur(24px);
    transition:border-color .2s,box-shadow .2s,background .2s;
  }
  .chat-input-glass:focus-within {
    border-color:rgba(6,182,212,.4);
    box-shadow:0 0 0 3px rgba(6,182,212,.07);
    background:rgba(6,182,212,.025);
    animation:inputGlow 3s ease-in-out infinite;
  }

  /* ══ REPLY PREVIEW ══ */
  .chat-reply-bar {
    background:rgba(6,182,212,.06);
    border-left:2px solid rgba(6,182,212,.6);
    border-radius:0 12px 12px 0;
    border-top:1px solid rgba(6,182,212,.12);
    border-right:1px solid rgba(6,182,212,.12);
    border-bottom:1px solid rgba(6,182,212,.12);
    animation:replyBounce .3s ease;
  }

  /* ══ MENTION POPUP ══ */
  .mention-popup {
    background:linear-gradient(180deg,rgba(8,8,26,.98) 0%,rgba(6,6,20,.99) 100%);
    border:1px solid rgba(255,255,255,.1);
    backdrop-filter:blur(28px) saturate(1.6);
    box-shadow:0 -12px 48px rgba(0,0,0,.7),0 0 0 1px rgba(6,182,212,.07);
  }
  .mention-autocomplete-item:hover{background:rgba(6,182,212,.07) !important;}
  .mention-autocomplete-item:hover .mention-name{color:#67e8f9}
  .mention-all-item:hover{background:rgba(234,179,8,.07) !important;}
  .mention-all-item:hover .mention-all-label{color:#fde047}

  /* ══ REACTIONS ══ */
  .reaction-btn {
    display:flex;align-items:center;gap:3px;
    padding:3px 8px;border-radius:20px;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.08);
    font-size:12px;cursor:pointer;
    transition:all .15s;
  }
  .reaction-btn:hover {
    background:rgba(6,182,212,.1);border-color:rgba(6,182,212,.3);
    transform:scale(1.08);
  }
  .reaction-btn.active {
    background:rgba(6,182,212,.15);border-color:rgba(6,182,212,.4);
    color:#22d3ee;box-shadow:0 2px 12px rgba(6,182,212,.15);
  }

  /* ══ SCROLLBAR ══ */
  .chat-scroll::-webkit-scrollbar{width:3px;}
  .chat-scroll::-webkit-scrollbar-track{background:transparent;}
  .chat-scroll::-webkit-scrollbar-thumb{background:rgba(6,182,212,.2);border-radius:2px;}
  .chat-scroll::-webkit-scrollbar-thumb:hover{background:rgba(6,182,212,.4);}

  /* ══ TITLE ══ */
  .ns-chat-title {
    background:linear-gradient(135deg,#22d3ee 0%,#a855f7 40%,#ec4899 70%,#22d3ee 100%);
    background-size:250% 100%;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    animation:nsGradientShift 4s ease infinite;
    font-family:'Orbitron',monospace;
    letter-spacing:.04em;
  }

  /* ══ LOAD MORE BUTTON ══ */
  .chat-load-more {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);
    border-radius:99px;color:rgba(255,255,255,.4);
    transition:all .18s;
  }
  .chat-load-more:hover {
    background:rgba(6,182,212,.08);border-color:rgba(6,182,212,.25);
    color:#22d3ee;box-shadow:0 4px 16px rgba(6,182,212,.1);
  }

  /* ══ SEND BUTTON ANIM ══ */
  .chat-send-pop { animation:sendPop .25s ease; }

  /* ══ ONLINE DOT ══ */
  .chat-online-dot { animation:unreadDot 2s ease-in-out infinite; }

  /* ══ RIGHT CONTEXT PANEL ══ */
  .chat-ctx-panel {
    background:rgba(4,4,18,.94);
    backdrop-filter:blur(28px) saturate(1.6);
    border-left:1px solid rgba(255,255,255,.06);
  }
  .chat-ctx-panel::before {
    content:'';position:absolute;top:0;left:0;bottom:0;width:1px;
    background:linear-gradient(180deg,transparent,rgba(6,182,212,.3) 30%,rgba(168,85,247,.3) 70%,transparent);
  }
``;

// Rendu du contenu avec mentions colorées premium
const renderContent = (text, currentUserId, msgUserId) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|#\/live\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part) || part.startsWith('#/live/')) {
      if (part.includes('/live/')) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-live-link" onClick={e => e.stopPropagation()}>🔴 Rejoindre le live</a>;
      }
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link" onClick={e => e.stopPropagation()}>{part}</a>;
    }
    // Découper les @mentions dans cette partie
    const mentionRegex = /(@[\w-]+)/g;
    const subParts = part.split(mentionRegex);
    return subParts.map((sub, j) => {
      if (!sub.startsWith('@')) return <span key={`${i}-${j}`}>{sub}</span>;
      const lower = sub.toLowerCase();
      const isAll = ['@tous','@all','@everyone','@todo','@todos','@tutti','@allen','@alle'].includes(lower);
      if (isAll) return <span key={`${i}-${j}`} className="chat-mention-all">📢{sub}</span>;
      return <span key={`${i}-${j}`} className="chat-mention-user">{sub}</span>;
    });
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
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ willChange: 'auto' }}
      className={`group flex flex-col px-2 py-0.5 ${isOwn ? 'items-end chat-msg-in-own' : 'items-start chat-msg-in'} ${
        isHighlighted ? 'bg-cyan-500/8 rounded-2xl' : ''
      }`}
      onClick={() => !editing && setShowActions(v => !v)}
    >
      {/* ── Rangée principale : avatar + bulle ── */}
      <div className={`flex items-end gap-2 max-w-[82%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar — masqué pour ses propres messages */}
        {!isOwn && (
          user?.id
            ? <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()} className="flex-shrink-0 mb-0.5">
                <Avatar user={user} size={7} />
              </Link>
            : <div className="flex-shrink-0 mb-0.5"><Avatar user={user} size={7} /></div>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} min-w-0`}>

          {/* Nom + badges — uniquement pour les messages des autres */}
          {!isOwn && (
            <div className="flex items-center gap-1.5 mb-1 px-1">
              {user?.id
                ? <Link to={`/artist/${user.id}`} onClick={e => e.stopPropagation()}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 truncate transition-colors">
                    <NoTranslate>{user.username || 'Utilisateur'}</NoTranslate>
                  </Link>
                : <span className="text-[11px] font-bold text-gray-500 truncate"><NoTranslate>{user?.username || 'Utilisateur'}</NoTranslate></span>
              }
              {isAdmin && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">ADMIN</span>}
              {hasMentionAll && <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">📢 @tous</span>}
            </div>
          )}

          {/* Citation reply */}
          {msg.reply_to_id && msg.reply_to_content && (
            <div
              className={`flex items-start gap-2 mb-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer max-w-full ${
                isOwn
                  ? 'bg-cyan-500/15 border border-cyan-500/30 self-end'
                  : 'bg-white/[0.08] border border-white/[0.12]'
              }`}
              onClick={e => {
                e.stopPropagation();
                document.getElementById(`msg-${msg.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}>
              <Reply className="w-3 h-3 text-cyan-500/60 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-cyan-400/80 truncate">↩ <NoTranslate tag="span">{msg.reply_to_username}</NoTranslate></p>
                <p className="text-[11px] text-gray-400 truncate">{msg.reply_to_content}</p>
              </div>
            </div>
          )}

          {/* Bulle principale */}
          {editing ? (
            <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
              <input ref={editRef} id={`edit-msg-${msg?.id}`} name="chat-edit" value={editText}
                onChange={e => setEditText(e.target.value.slice(0, 1000))}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 bg-[#080818] border border-cyan-500/40 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/60 transition-colors" />
              <button onClick={handleSaveEdit} disabled={savingEdit} className="p-1.5 text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-gray-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className={`relative px-3.5 py-2.5 rounded-2xl max-w-full break-words ${
              isOwn
                ? 'msg-bubble-own text-white rounded-br-sm'
                : hasMentionAll
                  ? 'msg-bubble-mention-all text-gray-100 rounded-bl-sm'
                  : 'msg-bubble-other text-gray-100 rounded-bl-sm'
            } ${msg._pending ? 'opacity-55' : ''}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderContent(msg.content, currentUser?.id, msg.user_id)}{msg._pending ? <span className="opacity-50"> ···</span> : ''}
              </p>
              {msg.is_edited && (
                <span className={`text-[9px] italic mt-0.5 block ${isOwn ? 'text-cyan-100/60' : 'text-gray-600'}`}>modifié</span>
              )}
            </div>
          )}

          {/* Heure + statut — sous la bulle */}
          <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[10px] text-gray-500">{timeAgo(msg.created_at)}</span>
            {isOwn && msg._pending && <span className="text-[10px] text-gray-600">•••</span>}
          </div>
        </div>
      </div>

      {/* Reactions */}
      <div className={`mt-0.5 ${isOwn ? 'pr-2' : 'pl-9'}`}>
        <ReactionBar msgId={msg.id} reactions={reactions} currentUserId={currentUser?.id} onToggle={onToggleReaction} />
      </div>

        <AnimatePresence>
          {(showActions || showEmoji) && currentUser && !editing && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className={`flex items-center gap-1 mt-1.5 flex-wrap ${isOwn ? 'justify-end pr-2' : 'justify-start pl-9'}`}
              onClick={e => e.stopPropagation()}>
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

  // ── {'Nettoyer'} les messages du chat (ADMIN ONLY) avec sélection de durée ─
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
        <title>{'Chat Global'} — NovaSound TITAN LUX</title>
        <meta name="description" content="Espace de conversation commun à toute la communauté NovaSound" />
      </Helmet>
      <style>{CHAT_STYLES}</style>

      <div className="min-h-screen bg-[#03030d] flex flex-col">
        <Header />

        <div
          className="flex-1 flex flex-col overflow-hidden relative"
          style={{
            height: 'calc(100dvh - 64px)',
          }}
        >
          {/* ── Background premium — particules + gradient animé ── */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Base gradient */}
            <div className="absolute inset-0" style={{background:'linear-gradient(135deg,#03030d 0%,#060618 40%,#080820 70%,#03030d 100%)'}}/>
            {/* Glow orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{background:'radial-gradient(circle,rgba(6,182,212,.5) 0%,transparent 70%)',filter:'blur(40px)',animation:'nsPulse 6s ease-in-out infinite'}}/>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15" style={{background:'radial-gradient(circle,rgba(168,85,247,.5) 0%,transparent 70%)',filter:'blur(40px)',animation:'nsPulse 8s ease-in-out infinite reverse'}}/>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{background:'radial-gradient(circle,rgba(6,182,212,.3) 0%,transparent 70%)',filter:'blur(60px)'}}/>
            {/* Subtle grid */}
            <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>
          </div>

          {/* ── Barre supérieure ── */}
          <div className="flex-shrink-0 chat-top-bar px-4 py-3 relative z-10">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                {/* Titre premium */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{background:'linear-gradient(135deg,rgba(6,182,212,.25),rgba(168,85,247,.2))',border:'1px solid rgba(6,182,212,.25)',boxShadow:'0 0 20px rgba(6,182,212,.15)'}}>
                      <Globe className="w-5 h-5 text-cyan-400" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-[#03030d] flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-ping"/>
                    </span>
                  </div>
                  <div>
                    <h1 className="font-black text-base leading-none tracking-tight ns-chat-title">Chat Global</h1>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Communauté NovaSound · <span className="text-amber-400/80 font-semibold">@tous</span> pour tout le monde
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Compteur en ligne */}
                  {onlineCount > 0 && (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${isAdmin ? 'cursor-pointer hover:bg-green-500/15' : ''}`}
                      style={{background:'rgba(34,197,94,.06)',border:'1px solid rgba(34,197,94,.18)'}}
                      onClick={() => isAdmin && setShowOnlinePanel(v => !v)}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                      </span>
                      <Users className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-[11px] font-bold">{onlineCount}</span>
                      {isAdmin && <span className="text-green-500/50 text-[9px]">▼</span>}
                    </div>
                  )}
                  {/* Bouton nettoyer (admin) */}
                  {isAdmin && (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-red-500/15 transition-colors"
                      style={{background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.18)'}}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400 text-[11px] font-semibold hidden sm:inline">Nettoyer</span>
                    </button>
                  )}
                </div>

                {/* Panel admin en ligne */}
                <AnimatePresence>
                  {isAdmin && showOnlinePanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-16 right-4 z-50 w-72 bg-gray-950/98 border border-green-500/25 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-white font-bold text-sm">{onlineCount} connecté{onlineCount > 1 ? 's' : ''}</span>
                        </div>
                        <button onClick={() => setShowOnlinePanel(false)} className="p-1 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {onlineUsers.length === 0 ? (
                          <p className="text-gray-500 text-xs text-center py-4">Aucun utilisateur tracé</p>
                        ) : (
                          onlineUsers.map((u, idx) => (
                            <div key={u.user_id + idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-green-500/30 flex-shrink-0" />
                                : <div className="w-8 h-8 rounded-full bg-gray-900 border border-green-500/20 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 text-gray-500" /></div>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate"><NoTranslate>{u.username || 'Anonyme'}</NoTranslate></p>
                                {u.email && <p className="text-gray-500 text-[10px] truncate">{u.email}</p>}
                              </div>
                              <a href={"mailto:" + (u.email || '')} className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-4 py-2 border-t border-white/[0.05]">
                        <p className="text-[10px] text-gray-600 text-center">Visible uniquement par l'administrateur</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Onglets ── */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setActiveTab('global')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    activeTab === 'global'
                      ? 'chat-tab-global-active text-white border-transparent'
                      : 'bg-white/[0.04] text-gray-500 border-white/[0.07] hover:bg-white/8 hover:text-gray-300'
                  }`}>
                  <Globe className="w-3 h-3" />Chat global
                </button>
                {currentUser && (
                  <button onClick={() => setActiveTab('messages')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border relative ${
                      activeTab === 'messages'
                        ? 'chat-tab-msg-active text-white border-transparent'
                        : 'bg-white/[0.04] text-gray-500 border-white/[0.07] hover:bg-white/8 hover:text-gray-300'
                    }`}>
                    <Bell className="w-3 h-3" />Mes messages
                    {unreadMsg > 0 && (
                      <span className="ml-1 min-w-[16px] h-4 text-[9px] bg-pink-500 text-white rounded-full px-1 font-black flex items-center justify-center">
                        {unreadMsg > 99 ? '99+' : unreadMsg}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Filtres période */}
              {activeTab === 'global' && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                  {[
                    { key:'today',  label:"Aujourd'hui", icon:'⚡' },
                    { key:'7d',     label:'7 jours',     icon:'📅' },
                    { key:'month',  label:'Ce mois',     icon:'🗓' },
                    { key:'year',   label:'Cette année', icon:'🏆' },
                    { key:'all',    label:'Tout',        icon:'🌐' },
                  ].map(p => (
                    <motion.button key={p.key} onClick={() => changePeriod(p.key)}
                      whileTap={{ scale: 0.93 }}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        period === p.key
                          ? 'chat-period-active'
                          : 'bg-white/[0.03] text-gray-600 border-white/[0.06] hover:bg-white/[0.07] hover:text-gray-400'
                      }`}>
                      <span className="text-[11px]">{p.icon}</span>{p.label}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Onglet Mes messages ─────────────────────── */}
          {activeTab === 'messages' && (
            /* bg-gray-950 solide : bloque le wallpaper derrière */
            <div className="flex-1 overflow-y-auto bg-gray-950 relative z-10">
              <div className="max-w-3xl mx-auto py-4 px-4">

                {/* En-tête */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
                  <Bell className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-sm font-semibold text-gray-300">Mes notifications de chat</span>
                  {myMessages.length > 0 && (
                    <span className="ml-auto text-xs text-gray-600">{myMessages.length} message{myMessages.length > 1 ? 's' : ''}</span>
                  )}
                </div>

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
                        <motion.button
                          key={notif.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`w-full flex items-start gap-3 p-4 rounded-2xl transition-all text-left border ${
                            notif.is_read
                              ? 'bg-gray-900 border-gray-800 hover:bg-gray-800/80 hover:border-cyan-500/30'
                              : 'bg-gray-900 border-cyan-500/50 hover:border-cyan-400/80 shadow-lg shadow-cyan-500/10'
                          }`}
                          onClick={() => handleNotifClick(notif)}>

                          {/* Icône type */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl border ${
                            isMentionAll
                              ? 'bg-yellow-500/20 border-yellow-500/30'
                              : isReply
                              ? 'bg-cyan-500/20 border-cyan-500/30'
                              : 'bg-fuchsia-500/20 border-fuchsia-500/30'
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
                                <span className="text-[11px] text-gray-400">{timeAgo(notif.created_at)}</span>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed break-words text-gray-200">
                              {notif.body}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                isMentionAll
                                  ? 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400'
                                  : isReply
                                  ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400'
                                  : 'bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-400'
                              }`}>
                                {isMentionAll ? '@tous' : isReply ? 'réponse' : 'mention'}
                              </span>
                              {notif.is_read && (
                                <span className="text-[10px] text-gray-600 inline-flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Lu
                                </span>
                              )}
                            </div>
                          </div>
                          <Reply className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 flex-shrink-0 mt-1 transition-colors" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* ─── Chat Global ─────────────────────────────────────── */}
          {activeTab === 'global' && (
            <div className="flex-1 flex overflow-hidden relative z-10">
              {/* ── Zone principale messages ── */}
              <div className="flex-1 flex flex-col min-w-0">
              <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll" style={{ WebkitOverflowScrolling: 'touch' }} onScroll={handleScroll}>
              {/* Wallpaper atmosphérique */}
              <div className="chat-wallpaper" aria-hidden="true"/>
                <div className="max-w-3xl mx-auto py-3 pb-2">
                  {hasMore && (
                    <div className="flex justify-center py-3">
                      <button onClick={loadMore} disabled={loading}
                        className="chat-load-more flex items-center gap-2 px-5 py-2 text-xs font-semibold transition-all">
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronUp className="w-3.5 h-3.5" />}
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
                    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.2}}
                      className="flex flex-col items-center justify-center py-24 text-center px-6">
                      <motion.div
                        animate={{scale:[1,1.08,1],rotate:[0,3,-3,0]}}
                        transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}
                        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                        style={{background:'linear-gradient(135deg,rgba(6,182,212,.12),rgba(168,85,247,.1))',border:'1px solid rgba(6,182,212,.2)',boxShadow:'0 0 40px rgba(6,182,212,.08)'}}>
                        <Music className="w-9 h-9 text-cyan-400/70" />
                      </motion.div>
                      <p className="text-white font-bold text-lg mb-2">Silence… pour l'instant</p>
                      <p className="text-gray-500 text-sm max-w-xs">Sois le premier à briser la glace ! Envoie un message ou mentionne <span className="text-amber-400/80 font-semibold">@tous</span> 🎵</p>
                    </motion.div>
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

              {/* Zone de saisie */}
              <div
                className="flex-shrink-0 px-3 py-2.5"
                style={{
                  background: 'rgba(5,5,18,.97)',
                  borderTop: '1px solid rgba(255,255,255,.06)',
                  backdropFilter: 'blur(28px)',
                  paddingBottom: `calc(${playerVisible ? '72px + ' : ''}56px + env(safe-area-inset-bottom, 6px) + 6px)`,
                }}
              >
                <div className="max-w-3xl mx-auto w-full">
                  {/* Preview réponse */}
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="chat-reply-bar flex items-center gap-2 px-3 py-2 mb-2">
                          <Reply className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-cyan-400 truncate">
                              ↩ Répondre à <span className="text-white"><NoTranslate>@{extractUser(replyTo).username || 'Utilisateur'}</NoTranslate></span>
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{replyTo.content}</p>
                          </div>
                          <button onClick={() => setReplyTo(null)} className="p-1 text-gray-600 hover:text-white flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Autocomplete mention — popup premium */}
                  <AnimatePresence>
                    {showMention && (mentionUsers.length > 0 || showMentionAll) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.14 }}
                        className="mention-popup absolute bottom-full left-3 right-3 mb-2 rounded-2xl overflow-hidden z-50"
                        style={{ maxHeight: 280 }}
                      >
                        {/* Header popup */}
                        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)' }}>
                          <AtSign className="w-3 h-3 text-cyan-400/70" />
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Mentions</span>
                        </div>
                        <div className="p-1.5 space-y-0.5 overflow-y-auto" style={{ maxHeight: 220 }}>
                          {/* @tous */}
                          {showMentionAll && MENTION_ALL_SUGGESTIONS.map(s => (
                            <button key={s.label}
                              className="mention-all-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                              style={{ background: 'transparent' }}
                              onMouseDown={e => { e.preventDefault(); insertMention(s.label.slice(1)); }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0" style={{ background: 'rgba(234,179,8,.15)', border: '1px solid rgba(234,179,8,.3)' }}>
                                📢
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mention-all-label text-yellow-300 text-sm font-black">{s.label}</div>
                                <div className="text-gray-500 text-[11px]">{s.desc}</div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-yellow-400" style={{ background: 'rgba(234,179,8,.12)', border: '1px solid rgba(234,179,8,.2)' }}>TOUS</span>
                            </button>
                          ))}
                          {/* Séparateur si les deux */}
                          {showMentionAll && mentionUsers.length > 0 && (
                            <div style={{ height: 1, background: 'rgba(255,255,255,.05)', margin: '4px 8px' }} />
                          )}
                          {/* Utilisateurs */}
                          {mentionUsers.map(u => (
                            <button key={u.id}
                              className="mention-autocomplete-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                              style={{ background: 'transparent' }}
                              onMouseDown={e => { e.preventDefault(); insertMention(u.username); }}>
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(6,182,212,.25)' }} />
                                : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(6,182,212,.12)', border: '1px solid rgba(6,182,212,.2)' }}>
                                    <User className="w-3.5 h-3.5 text-cyan-400/60" />
                                  </div>
                              }
                              <div className="min-w-0 flex-1">
                                <div className="mention-name text-white text-sm font-bold transition-colors"><NoTranslate>@{u.username}</NoTranslate></div>
                              </div>
                              <Reply className="w-3 h-3 text-gray-600 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {currentUser ? (
                    <div className="flex items-end gap-2.5">
                      <Avatar user={currentUser} size={8} />
                      <div className="flex-1 relative flex items-end gap-2 px-4 py-2.5 chat-input-glass rounded-2xl" style={{ minHeight: 48 }}>
                        <textarea
                          ref={inputRef}
                          id="chat-input"
                          name="chat-message"
                          value={text}
                          onChange={handleTextChange}
                          onKeyDown={handleKeyDown}
                          placeholder="Message… (@nom pour mentionner)"
                          maxLength={MAX}
                          rows={1}
                          style={{ resize: 'none', minHeight: 26, maxHeight: 120, overflowY: 'auto', lineHeight: '1.5' }}
                          className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none leading-relaxed self-center"
                          onInput={e => {
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                          }}
                        />
                        {text.length > MAX * 0.8 && (
                          <span className={`text-[10px] flex-shrink-0 self-end pb-0.5 ${remaining < 50 ? 'text-red-400' : 'text-gray-600'}`}>{remaining}</span>
                        )}
                      </div>
                      <motion.button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        whileTap={{ scale: 0.88 }}
                        whileHover={{ scale: text.trim() ? 1.06 : 1 }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-25 transition-all"
                        style={{
                          background: text.trim() ? 'linear-gradient(135deg,#0891b2,#7c3aed)' : 'rgba(255,255,255,.06)',
                          boxShadow: text.trim() ? '0 4px 24px rgba(8,145,178,.45),inset 0 1px 0 rgba(255,255,255,.15)' : 'none',
                          border: text.trim() ? '1px solid rgba(6,182,212,.2)' : '1px solid rgba(255,255,255,.08)',
                          marginBottom: 2,
                          transition: 'background .2s, box-shadow .2s',
                        }}>
                        <AnimatePresence mode="wait">
                          {sending ? (
                            <motion.div key="spin" initial={{scale:0,rotate:-90}} animate={{scale:1,rotate:0}} exit={{scale:0}}>
                              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                            </motion.div>
                          ) : (
                            <motion.div key="send" initial={{scale:0,rotate:20}} animate={{scale:1,rotate:0}} exit={{scale:0,rotate:-20}}>
                              <Send className="w-4 h-4 text-white"/>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 py-4 px-4 rounded-2xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <p className="text-gray-500 text-sm">Tu dois être connecté pour participer</p>
                      <Link to="/login" className="px-4 py-1.5 text-white text-sm font-bold rounded-full transition-all" style={{ background: 'linear-gradient(135deg,#0891b2,#7c3aed)' }}>Connexion</Link>
                    </div>
                  )}
                </div>
              </div>
              </div>{/* end main column */}

              {/* ── Panneau droit desktop ── */}
              <div className="hidden xl:flex flex-col w-72 flex-shrink-0 chat-ctx-panel relative overflow-y-auto" style={{scrollbarWidth:'none'}}>
                {/* Gradient accent vertical */}
                <div className="absolute top-0 left-0 bottom-0 w-px" style={{background:'linear-gradient(180deg,transparent,rgba(6,182,212,.3) 30%,rgba(168,85,247,.3) 70%,transparent)'}}/>

                {/* En ligne */}
                <div className="px-4 pt-5 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">En ligne</p>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{background:'rgba(34,197,94,.06)',border:'1px solid rgba(34,197,94,.15)'}}>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"/>
                      </span>
                      <span className="text-green-400 text-[11px] font-bold">{onlineCount}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {onlineUsers.length === 0 ? (
                      <div className="flex flex-col items-center py-6 text-center">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2" style={{background:'rgba(34,197,94,.05)',border:'1px solid rgba(34,197,94,.1)'}}>
                          <Users className="w-4 h-4 text-green-500/40"/>
                        </div>
                        <p className="text-gray-700 text-xs">Aucun utilisateur tracé</p>
                      </div>
                    ) : onlineUsers.slice(0,8).map((u,idx) => (
                      <motion.div key={u.user_id+idx}
                        initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} transition={{delay:idx*0.04}}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer group"
                        style={{background:'rgba(255,255,255,.02)',border:'1px solid transparent'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(34,197,94,.05)';e.currentTarget.style.borderColor='rgba(34,197,94,.1)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.02)';e.currentTarget.style.borderColor='transparent';}}>
                        <div className="relative flex-shrink-0">
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" style={{border:'1px solid rgba(34,197,94,.3)'}}/>
                            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{background:'linear-gradient(135deg,rgba(6,182,212,.3),rgba(168,85,247,.3))'}}>{(u.username||'?')[0].toUpperCase()}</div>
                          }
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#04041a]"/>
                        </div>
                        <NoTranslate className="text-white text-xs font-semibold truncate flex-1">{u.username||'Anonyme'}</NoTranslate>
                      </motion.div>
                    ))}
                    {onlineUsers.length > 8 && (
                      <p className="text-center text-gray-700 text-[10px] pt-1">+{onlineUsers.length-8} autres</p>
                    )}
                  </div>
                </div>

                {/* Séparateur */}
                <div className="mx-4 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)'}}/>

                {/* Stats rapides */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-3">Activité</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {label:'Messages',value:messages.length,color:'rgba(6,182,212,.15)',border:'rgba(6,182,212,.2)',text:'#22d3ee',icon:'💬'},
                      {label:'Actifs',value:onlineCount,color:'rgba(34,197,94,.1)',border:'rgba(34,197,94,.2)',text:'#4ade80',icon:'👥'},
                    ].map(s=>(
                      <div key={s.label} className="rounded-2xl px-3 py-3 text-center" style={{background:s.color,border:`1px solid ${s.border}`}}>
                        <p className="text-lg">{s.icon}</p>
                        <p className="font-black text-base leading-tight" style={{color:s.text}}>{s.value}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Séparateur */}
                <div className="mx-4 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)'}}/>

                {/* Raccourcis */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-3">Raccourcis</p>
                  <div className="space-y-2">
                    {[
                      {key:'Enter','desc':'Envoyer'},
                      {key:'Shift+Enter','desc':'Nouvelle ligne'},
                      {key:'@','desc':'Mentionner'},
                      {key:'@tous','desc':'Tout le monde'},
                    ].map(r=>(
                      <div key={r.key} className="flex items-center justify-between">
                        <span className="text-gray-600 text-[11px]">{r.desc}</span>
                        <kbd className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold text-cyan-300" style={{background:'rgba(6,182,212,.08)',border:'1px solid rgba(6,182,212,.15)'}}>{r.key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Règles de la communauté */}
                <div className="px-4 pb-5 mt-auto">
                  <div className="rounded-2xl px-3 py-3" style={{background:'rgba(168,85,247,.05)',border:'1px solid rgba(168,85,247,.1)'}}>
                    <p className="text-[10px] font-black text-fuchsia-400/80 uppercase tracking-widest mb-2">Règles</p>
                    <ul className="space-y-1.5">
                      {['Respecte tout le monde 🤝','Pas de spam 🚫','Musique & bonne humeur 🎵'].map(r=>(
                        <li key={r} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                          <span className="text-fuchsia-500/50 mt-0.5">›</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              {/* end right panel */}

            </div>
          )}{/* end activeTab global */}
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

                  <h2 className="text-white font-black text-xl mb-2">{'Nettoyer'} le Chat ?</h2>
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
