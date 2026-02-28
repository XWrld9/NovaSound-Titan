/**
 * NewsCommentSection — NovaSound TITAN LUX v160
 * Système de commentaires sur les publications (news)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageCircle, Send, Heart, Trash2, Edit2, Check,
  X, Loader2, User, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';
const EDIT_WINDOW_MS = 20 * 60 * 1000;

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return "A l'instant";
  if (diff < 3600)   return Math.floor(diff / 60) + ' min';
  if (diff < 86400)  return Math.floor(diff / 3600) + ' h';
  if (diff < 604800) return Math.floor(diff / 86400) + ' j';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
};

const NewsComment = ({ comment, currentUser, currentUserEmail, onDelete, onEdit, onLike }) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content || '');
  const [saving, setSaving] = useState(false);
  const editRef = useRef(null);

  const user = comment.users || {};
  const isOwn = !!(currentUser?.id && comment.user_id === currentUser.id);
  const isAdmin = currentUserEmail === ADMIN_EMAIL;
  const canEdit = isOwn && (Date.now() - new Date(comment.created_at).getTime()) < EDIT_WINDOW_MS;
  const canDelete = isOwn || isAdmin;
  const liked = comment._liked || false;

  useEffect(() => {
    if (editing) setTimeout(() => { if (editRef.current) { editRef.current.focus(); editRef.current.select(); } }, 50);
  }, [editing]);

  const handleSave = async () => {
    if (!editText.trim() || editText.trim() === comment.content) { setEditing(false); return; }
    setSaving(true);
    const ok = await onEdit(comment.id, editText.trim());
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <motion.div
      id={'nc-' + comment.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex gap-3 py-3 border-b border-white/[0.04] last:border-0 group"
    >
      <div className="flex-shrink-0">
        {user.id ? (
          <Link to={'/artist/' + user.id}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover border border-white/10" />
              : <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-gray-500" /></div>
            }
          </Link>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-gray-500" /></div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {user.id
            ? <Link to={'/artist/' + user.id} className="text-xs font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors truncate">{user.username || 'Utilisateur'}</Link>
            : <span className="text-xs font-bold text-gray-500">{user.username || 'Utilisateur'}</span>
          }
          <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(comment.created_at)}</span>
          {comment._edited && <span className="text-[9px] text-gray-600 italic">(modifie)</span>}
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-gray-800 border border-fuchsia-500/40 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-fuchsia-400 transition-colors"
            />
            <button onClick={handleSave} disabled={saving} className="p-1.5 text-fuchsia-400 hover:text-fuchsia-300 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 text-gray-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed break-words whitespace-pre-wrap">{comment.content}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={() => onLike(comment.id)} className={'flex items-center gap-1 text-[11px] transition-colors ' + (liked ? 'text-pink-400' : 'text-gray-600 hover:text-pink-400')}>
              <Heart className={'w-3 h-3 ' + (liked ? 'fill-current' : '')} />
              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
            </button>
            {canEdit && (
              <button onClick={() => { setEditing(true); setEditText(comment.content); }} className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
                <Edit2 className="w-3 h-3" />
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const NewsCommentSection = ({ newsId, newsAuthorId }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const currentUserEmail = currentUser?.email || '';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [likedIds, setLikedIds] = useState(new Set());
  const inputRef = useRef(null);
  const PAGE = 5;

  const fetchComments = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('news_comments')
        .select('*, users:user_id(id, username, avatar_url), likes_count')
        .eq('news_id', newsId)
        .order('created_at', { ascending: true });
      if (data) setComments(data);
    } catch (e) { console.error('[NewsComments]', e); }
    setLoading(false);
  }, [newsId]);

  const fetchUserLikes = useCallback(async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('news_comment_likes')
      .select('comment_id')
      .eq('user_id', currentUser.id);
    if (data) setLikedIds(new Set(data.map(l => l.comment_id)));
  }, [currentUser?.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => { if (currentUser?.id) fetchUserLikes(); }, [fetchUserLikes]);

  useEffect(() => {
    const channel = supabase
      .channel('news_comments_' + newsId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_comments', filter: 'news_id=eq.' + newsId },
        async (payload) => {
          const { data } = await supabase.from('news_comments').select('*, users:user_id(id, username, avatar_url), likes_count').eq('id', payload.new.id).single();
          if (data) setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data]);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'news_comments', filter: 'news_id=eq.' + newsId },
        (payload) => { setComments(prev => prev.filter(c => c.id !== payload.old.id)); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [newsId]);

  const handleSend = async () => {
    if (!text.trim() || sending || !currentUser) return;
    setSending(true);
    const content = text.trim();
    setText('');
    try {
      const { data, error } = await supabase
        .from('news_comments')
        .insert({ news_id: newsId, user_id: currentUser.id, content })
        .select('*, users:user_id(id, username, avatar_url), likes_count')
        .single();
      if (error) throw error;
      setComments(prev => prev.find(c => c.id === data.id) ? prev : [...prev, data]);
      setExpanded(true);
      if (newsAuthorId && newsAuthorId !== currentUser.id) {
        const senderName = currentUser.username || currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu_un';
        supabase.from('notifications').insert({
          user_id: newsAuthorId,
          type: 'comment',
          title: senderName + ' a commente ta publication',
          body: content.slice(0, 120),
          icon_url: currentUser.avatar_url || currentUser.user_metadata?.avatar_url || null,
          url: '#/news',
          is_read: false,
        }).catch(() => {});
      }
    } catch { setText(content); }
    setSending(false);
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
  };

  const handleDelete = async (commentId) => {
    await supabase.from('news_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleEdit = async (commentId, newContent) => {
    const { error } = await supabase.from('news_comments').update({ content: newContent }).eq('id', commentId);
    if (error) return false;
    setComments(prev => prev.map(c => c.id === commentId ? Object.assign({}, c, { content: newContent, _edited: true }) : c));
    return true;
  };

  const handleLike = async (commentId) => {
    if (!currentUser?.id) return;
    const uid = currentUser.id;
    const wasLiked = likedIds.has(commentId);
    setLikedIds(prev => { const n = new Set(prev); wasLiked ? n.delete(commentId) : n.add(commentId); return n; });
    setComments(prev => prev.map(c => c.id === commentId ? Object.assign({}, c, { likes_count: Math.max(0, (c.likes_count || 0) + (wasLiked ? -1 : 1)), _liked: !wasLiked }) : c));
    if (wasLiked) {
      await supabase.from('news_comment_likes').delete().eq('comment_id', commentId).eq('user_id', uid);
    } else {
      await supabase.from('news_comment_likes').insert({ comment_id: commentId, user_id: uid });
    }
  };

  const enriched = comments.map(c => Object.assign({}, c, { _liked: likedIds.has(c.id) }));
  const shown = expanded ? enriched : enriched.slice(-PAGE);
  const hidden = Math.max(0, enriched.length - PAGE);
  const total = comments.length;

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.05]">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4 text-fuchsia-400" />
        <span className="text-sm font-bold text-white">
          {total > 0 ? total + ' commentaire' + (total > 1 ? 's' : '') : 'Commentaires'}
        </span>
        {total > PAGE && (
          <button onClick={() => setExpanded(v => !v)} className="ml-auto flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Reduire</> : <><ChevronDown className="w-3.5 h-3.5" />Voir {hidden} de plus</>}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
        </div>
      )}

      {!loading && (
        <AnimatePresence initial={false}>
          {total === 0 && (
            <p className="text-xs text-gray-600 text-center py-3 italic">Aucun commentaire - sois le premier !</p>
          )}
          {shown.map(c => (
            <NewsComment
              key={c.id}
              comment={c}
              currentUser={currentUser}
              currentUserEmail={currentUserEmail}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onLike={handleLike}
            />
          ))}
        </AnimatePresence>
      )}

      {isAuthenticated ? (
        <div className="flex gap-2 mt-3">
          <div className="flex-shrink-0">
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
              : <div className="w-7 h-7 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-gray-500" /></div>
            }
          </div>
          <div className="flex-1 flex gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ajouter un commentaire..."
              className="flex-1 bg-gray-800/60 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500/40 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center disabled:opacity-40 transition-all hover:opacity-90"
            >
              {sending
                ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center mt-3">
          <Link to="/login" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">Connecte-toi</Link> pour commenter
        </p>
      )}
    </div>
  );
};

export default NewsCommentSection;
