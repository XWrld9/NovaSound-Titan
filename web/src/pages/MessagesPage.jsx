/**
 * MessagesPage — NovaSound TITAN LUX v90
 * FIX CRITIQUE : ConvList et ChatView extraits hors du composant parent
 * → évite le re-montage à chaque frappe (clavier iOS qui disparaît, messages non envoyés)
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/contexts/MessageContext';
import Header from '@/components/Header';
import {
  Send, Search, ArrowLeft, MessageCircle, User, X,
  Trash2, CheckCheck, Check, Loader2
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'maintenant';
  if (diff < 3600)   return `${Math.floor(diff / 60)}min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const fmtTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// ── Avatar ────────────────────────────────────────────────────────
const Avatar = memo(({ user, size = 10 }) => (
  user?.avatar_url
    ? <img src={user.avatar_url} alt={user.username || ''} className={`w-${size} h-${size} rounded-full object-cover border border-white/10 flex-shrink-0`} />
    : <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-white/10 flex items-center justify-center flex-shrink-0`}>
        <User className="w-4 h-4 text-gray-400" />
      </div>
));

// ── ConvList — extrait hors du parent pour éviter re-montage ─────
const ConvList = memo(({
  conversations, currentUserId, selectedConv,
  showSearch, searchQuery, searchResults, searching,
  onSearchToggle, onSearchChange, onSearchClose,
  onSelectConv, onSelectUser,
}) => (
  <div className="flex flex-col h-full">
    {/* Header sidebar */}
    <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-lg">Messages</h2>
        <button
          onClick={onSearchToggle}
          className="w-8 h-8 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 flex items-center justify-center transition-all"
        >
          <Search className="w-4 h-4 text-cyan-400" />
        </button>
      </div>

      {/* Recherche utilisateur */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                id="user-search"
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Chercher un utilisateur…"
                autoComplete="off"
                className="w-full pl-9 pr-8 py-2 bg-gray-800/80 border border-white/[0.07] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40"
              />
              <button onClick={onSearchClose}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="bg-gray-800/90 border border-white/[0.07] rounded-xl overflow-hidden mb-2 max-h-52 overflow-y-auto">
                {searchResults.map(user => (
                  <button key={user.id} onClick={() => onSelectUser(user)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left">
                    <Avatar user={user} size={8} />
                    <span className="text-white text-sm font-medium">{user.username}</span>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-gray-600 text-xs text-center py-2">Recherche…</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Liste des conversations */}
    <div className="flex-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
          <MessageCircle className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune conversation</p>
          <p className="text-gray-700 text-xs mt-1">Cherche un utilisateur pour commencer</p>
        </div>
      ) : (
        conversations.map(conv => {
          const isActive = selectedConv?.other_user_id === conv.other_user_id;
          return (
            <button key={conv.other_user_id} onClick={() => onSelectConv(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] ${isActive ? 'bg-cyan-500/[0.07]' : ''}`}>
              <div className="relative">
                <Avatar user={conv.other_user} size={10} />
                {conv.unread_count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                    {conv.other_user?.username || 'Utilisateur'}
                  </span>
                  {conv.last_message_at && (
                    <span className="text-[10px] text-gray-600 flex-shrink-0 ml-2">{timeAgo(conv.last_message_at)}</span>
                  )}
                </div>
                {conv.last_message && (
                  <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                    {conv.last_message_sender_id === currentUserId ? 'Vous : ' : ''}{conv.last_message}
                  </p>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  </div>
));

// ── ChatView — extrait hors du parent pour éviter re-montage ─────
const ChatView = memo(({
  selectedConv, conversations, messages, loadingMsgs,
  currentUserId, newMsg, sending,
  onBack, onMsgChange, onKeyDown, onSend, onDeleteMsg,
  inputRef, bottomRef,
}) => {
  if (!selectedConv) return (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center px-8 h-full">
      <MessageCircle className="w-16 h-16 text-gray-800 mb-4" />
      <p className="text-gray-600 font-medium">Sélectionne une conversation</p>
      <p className="text-gray-700 text-sm mt-1">ou cherche un utilisateur pour écrire</p>
    </div>
  );

  const other = selectedConv.other_user
    || conversations.find(c => c.other_user_id === selectedConv.other_user_id)?.other_user;

  // Grouper messages par date
  const groupedMessages = messages.reduce((groups, msg) => {
    const day = new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(msg);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header conversation */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0 bg-gray-950/80 backdrop-blur-sm">
        <button onClick={onBack}
          className="md:hidden p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Link to={`/artist/${other?.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
          <Avatar user={other} size={9} />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">
              {other?.username || 'Utilisateur'}
            </p>
            <p className="text-gray-600 text-xs">Voir le profil →</p>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-600 text-sm">Dis bonjour à {other?.username} 👋</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([day, dayMsgs]) => (
            <div key={day}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-gray-700 text-[10px] uppercase tracking-wide flex-shrink-0">{day}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              {dayMsgs.map((msg, idx) => {
                const isMine = msg.sender_id === currentUserId;
                const prevMsg = dayMsgs[idx - 1];
                const nextMsg = dayMsgs[idx + 1];
                const isFirst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                const isLast  = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-3' : 'mt-0.5'}`}
                  >
                    {!isMine && (
                      <div className="w-7 mr-2 flex-shrink-0 self-end">
                        {isLast && <Avatar user={other} size={7} />}
                      </div>
                    )}
                    <div className="group relative max-w-[72%] sm:max-w-[60%]">
                      <div className={`px-3.5 py-2 text-sm leading-relaxed select-text ${
                        isMine
                          ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-2xl rounded-br-md'
                          : 'bg-gray-800/90 border border-white/[0.07] text-gray-200 rounded-2xl rounded-bl-md'
                      } ${msg._pending ? 'opacity-60' : ''}`}>
                        {msg.content}
                      </div>
                      {isLast && (
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-gray-700">{fmtTime(msg.created_at)}</span>
                          {isMine && (
                            msg.is_read
                              ? <CheckCheck className="w-3 h-3 text-cyan-400" />
                              : <Check className="w-3 h-3 text-gray-600" />
                          )}
                        </div>
                      )}
                      {isMine && !msg._pending && (
                        <button
                          onClick={() => onDeleteMsg(msg.id)}
                          className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-gray-700 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie — stable, ne se re-monte pas */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex-shrink-0 bg-gray-950/90">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={newMsg}
            onChange={e => onMsgChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Écrire un message…"
            rows={1}
            style={{ resize: 'none', minHeight: 40, maxHeight: 120 }}
            className="flex-1 bg-gray-800/80 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors overflow-y-auto"
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={onSend}
            disabled={!newMsg.trim() || sending}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all shadow-lg shadow-cyan-500/20"
          >
            {sending
              ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  );
});

// ════════════════════════════════════════════════════════════════════
const MessagesPage = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const { conversations, fetchMessages, sendMessage, markConversationRead, deleteMessage } = useMessages();

  const [selectedConv, setSelectedConv] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [newMsg,       setNewMsg]       = useState('');
  const [sending,      setSending]      = useState(false);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);

  const [mobileView, setMobileView] = useState('list');

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const channelRef = useRef(null);

  // ── Auto-ouvrir depuis ArtistProfilePage ─────────────────────────
  useEffect(() => {
    if (location.state?.openUserId && location.state?.openUser) {
      openConversation({
        other_user_id: location.state.openUserId,
        other_user: location.state.openUser,
        last_message: null, last_message_at: null, unread_count: 0,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ouvrir une conversation ──────────────────────────────────────
  const openConversation = useCallback(async (conv) => {
    setSelectedConv(conv);
    setMobileView('chat');
    setLoadingMsgs(true);
    const msgs = await fetchMessages(conv.other_user_id);
    setMessages(msgs);
    setLoadingMsgs(false);
    await markConversationRead(conv.other_user_id);

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`conv:${[currentUser.id, conv.other_user_id].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${conv.other_user_id}`,
      }, (payload) => {
        if (payload.new.recipient_id === currentUser.id) {
          setMessages(prev => [...prev, payload.new]);
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then(() => {});
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    channelRef.current = channel;
  }, [currentUser?.id, fetchMessages, markConversationRead]);

  // Scroll auto en bas
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [messages.length]);

  // Focus input à l'ouverture d'une conv (desktop)
  useEffect(() => {
    if (selectedConv && window.innerWidth >= 768) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [selectedConv?.other_user_id]);

  useEffect(() => () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  }, []);

  // ── Envoyer un message ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!newMsg.trim() || !selectedConv || sending) return;
    setSending(true);
    const content = newMsg.trim();
    setNewMsg('');
    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      recipient_id: selectedConv.other_user_id,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
      _pending: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    try {
      const sent = await sendMessage(selectedConv.other_user_id, content);
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...sent, _pending: false } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setNewMsg(content);
    } finally {
      setSending(false);
    }
  }, [newMsg, selectedConv, sending, currentUser?.id, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // ── Recherche utilisateurs ───────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', currentUser.id)
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  const handleSelectUser = useCallback((user) => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    const existing = conversations.find(c => c.other_user_id === user.id);
    openConversation(existing || {
      other_user_id: user.id,
      other_user: user,
      last_message: null, last_message_at: null, unread_count: 0,
    });
  }, [conversations, openConversation]);

  const handleSearchToggle = useCallback(() => {
    setShowSearch(true);
    setTimeout(() => document.getElementById('user-search')?.focus(), 100);
  }, []);

  const handleSearchClose = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleDeleteMsg = useCallback(async (msgId) => {
    await deleteMessage(msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  }, [deleteMessage]);

  const handleBack = useCallback(() => {
    setMobileView('list');
    setSelectedConv(null);
  }, []);

  return (
    <>
      <Helmet>
        <title>Messages — NovaSound TITAN LUX</title>
        <meta name="description" content="Messagerie privée NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-0">
        <Header />

        <div className="flex-1 flex" style={{ height: 'calc(100vh - 64px - 80px)' }}>
          {/* ── Sidebar conversations ── */}
          <div className={`
            w-full md:w-80 lg:w-96 flex-shrink-0
            border-r border-white/[0.06] bg-gray-950
            ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} flex-col
          `} style={{ height: '100%' }}>
            <ConvList
              conversations={conversations}
              currentUserId={currentUser?.id}
              selectedConv={selectedConv}
              showSearch={showSearch}
              searchQuery={searchQuery}
              searchResults={searchResults}
              searching={searching}
              onSearchToggle={handleSearchToggle}
              onSearchChange={setSearchQuery}
              onSearchClose={handleSearchClose}
              onSelectConv={openConversation}
              onSelectUser={handleSelectUser}
            />
          </div>

          {/* ── Zone chat ── */}
          <div className={`
            flex-1 flex flex-col min-w-0
            ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
          `} style={{ height: '100%' }}>
            <ChatView
              selectedConv={selectedConv}
              conversations={conversations}
              messages={messages}
              loadingMsgs={loadingMsgs}
              currentUserId={currentUser?.id}
              newMsg={newMsg}
              sending={sending}
              onBack={handleBack}
              onMsgChange={setNewMsg}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              onDeleteMsg={handleDeleteMsg}
              inputRef={inputRef}
              bottomRef={bottomRef}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default MessagesPage;
