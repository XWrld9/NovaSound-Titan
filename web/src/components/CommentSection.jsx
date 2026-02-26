import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Heart, Send, Pencil, Trash2,
  Flag, Share2, ChevronDown, ChevronUp, Check, X,
  MoreHorizontal, AlertTriangle, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';
const MAX_CHARS   = 800;

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'À l\'instant';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/* ── Toast ─────────────────────────────────────────────────── */
const Toast = ({ msg, color }) =>
  ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, y: 28, x: '-50%' }}
      animate={{ opacity: 1, y: 0,  x: '-50%' }}
      exit={{ opacity: 0,  y: 14, x: '-50%' }}
      style={{
        position: 'fixed', bottom: 96, left: '50%', zIndex: 10000,
        padding: '11px 22px', borderRadius: 50, background: color,
        boxShadow: `0 4px 28px ${color}70`,
        color: '#fff', fontSize: 13, fontWeight: 600,
        maxWidth: '88vw', textAlign: 'center', whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >{msg}</motion.div>,
    document.body
  );

/* ── Confirm delete modal ───────────────────────────────────── */
const DeleteConfirm = ({ onConfirm, onCancel, loading }) =>
  ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={{ width: '100%', maxWidth: 340, borderRadius: 20, padding: '28px 24px 24px', background: '#13131f', border: '1.5px solid rgba(239,68,68,0.3)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ padding: 14, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <Trash2 style={{ width: 28, height: 28 }} />
          </div>
        </div>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>Supprimer ce commentaire ?</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>Cette action est irréversible.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={loading} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#ef4444', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> : 'Supprimer'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );

/* ── Comment menu portal ────────────────────────────────────── */
const CommentMenu = ({ anchorRef, open, onClose, isAuthor, isAdmin, onEdit, onDelete, onReport, onShare }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const menuH = (isAuthor ? 4 : 3) * 44 + 8;
    const openUp = window.innerHeight - r.bottom < menuH + 12;
    setPos({ top: openUp ? r.top - menuH - 4 : r.bottom + 4, left: Math.max(8, r.right - 168) });
  }, [open]);

  if (!open) return null;

  const item = (icon, label, color, handler) => (
    <button
      onClick={() => { handler(); onClose(); }}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', color: color || 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{icon}{label}</button>
  );
  const sep = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '2px 10px' }} />;

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9998, minWidth: 168, borderRadius: 14, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 8px 32px rgba(0,0,0,0.55)', overflow: 'hidden' }}
      onClick={e => e.stopPropagation()}
    >
      {isAuthor && item(<Pencil style={{ width: 14, height: 14, flexShrink: 0 }} />, 'Modifier', '#22d3ee', onEdit)}
      {sep()}
      {item(<Share2 style={{ width: 14, height: 14, flexShrink: 0 }} />, 'Partager', null, onShare)}
      {!isAuthor && item(<Flag style={{ width: 14, height: 14, flexShrink: 0 }} />, 'Signaler', '#f59e0b', onReport)}
      {sep()}
      {(isAuthor || isAdmin) && item(<Trash2 style={{ width: 14, height: 14, flexShrink: 0 }} />, 'Supprimer', '#f87171', onDelete)}
      {isAdmin && !isAuthor && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '5px 14px' }}>
          <span style={{ fontSize: 10, color: '#fb923c', fontWeight: 700, letterSpacing: '0.06em' }}>⚡ ACTION ADMIN</span>
        </div>
      )}
    </motion.div>,
    document.body
  );
};

/* ── CommentRow ─────────────────────────────────────────────── */
const CommentRow = ({ comment, currentUser, songUploaderEmail, onDeleted, onUpdated, showToast }) => {
  const isAuthor = currentUser && (currentUser.id === comment.user_id || currentUser.id === String(comment.user_id));
  const isAdmin  = currentUser?.email === ADMIN_EMAIL;

  const [liked, setLiked]           = useState(comment._liked || false);
  const [likes, setLikes]           = useState(comment.likes_count || 0);
  const [editing, setEditing]       = useState(false);
  const [editVal, setEditVal]       = useState(comment.content);
  const [editLoading, setEditLoading] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reported, setReported]     = useState(false);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuBtnRef.current && !menuBtnRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h, true);
    document.addEventListener('touchstart', h, true);
    return () => { document.removeEventListener('mousedown', h, true); document.removeEventListener('touchstart', h, true); };
  }, [menuOpen]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser) { showToast('Connecte-toi pour liker', '#6366f1'); return; }
    const was = liked;
    setLiked(!was); setLikes(l => Math.max(0, was ? l - 1 : l + 1));
    if (was) await supabase.from('comment_likes').delete().eq('user_id', currentUser.id).eq('comment_id', comment.id);
    else     await supabase.from('comment_likes').insert({ user_id: currentUser.id, comment_id: comment.id });
  };

  const handleEdit = async () => {
    const trimmed = editVal.trim();
    if (!trimmed || trimmed === comment.content) { setEditing(false); return; }
    setEditLoading(true);
    const { error } = await supabase.from('song_comments').update({ content: trimmed, is_edited: true }).eq('id', comment.id);
    setEditLoading(false);
    if (!error) { onUpdated(comment.id, trimmed); setEditing(false); showToast('Commentaire modifié ✓', '#22d3ee'); }
    else showToast('Erreur modification', '#ef4444');
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.from('song_comments').delete().eq('id', comment.id);
    setDeleteLoading(false);
    setConfirmDelete(false);
    if (!error) { onDeleted(comment.id); showToast('Commentaire supprimé', '#ef4444'); }
    else showToast('Erreur suppression', '#ef4444');
  };

  const handleReport = async () => {
    if (reported || !currentUser) return;
    await supabase.from('reports').insert({ reporter_id: currentUser.id, content_type: 'comment', content_id: String(comment.id), reason: 'Contenu inapproprié' });
    setReported(true); showToast('Commentaire signalé', '#f59e0b');
  };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
    navigator.clipboard?.writeText(url).then(() => showToast('Lien copié ✓', '#22d3ee')).catch(() => showToast('Impossible de copier', '#ef4444'));
  };

  const authorName = comment.user?.username || comment._username || 'Utilisateur';
  const authorAvatar = comment.user?.avatar_url || comment._avatar || null;

  return (
    <motion.div
      id={`comment-${comment.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 py-3 group"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Link to={`/artist/${comment.user_id}`} className="flex-shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
        {authorAvatar
          ? <img src={authorAvatar} alt={authorName} className="w-8 h-8 rounded-full object-cover border border-gray-700/80" />
          : <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700/80 flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
        }
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link to={`/artist/${comment.user_id}`} className="text-sm font-semibold text-white hover:text-cyan-400 transition-colors truncate" onClick={e => e.stopPropagation()}>
            {authorName}
          </Link>
          <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(comment.created_at)}</span>
          {comment.is_edited && <span className="text-xs text-gray-600 flex-shrink-0 italic">(modifié)</span>}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              value={editVal}
              onChange={e => setEditVal(e.target.value.slice(0, MAX_CHARS))}
              autoFocus rows={3}
              className="w-full bg-gray-800/80 border border-cyan-500/40 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-cyan-400 transition-colors"
              style={{ fontSize: 13 }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-600">{editVal.length}/{MAX_CHARS}</span>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setEditVal(comment.content); }} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"><X className="w-4 h-4" /></button>
                <button onClick={handleEdit} disabled={editLoading || !editVal.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-400 transition-colors disabled:opacity-50">
                  {editLoading ? <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed break-words" style={{ wordBreak: 'break-word' }}>{comment.content}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-3 mt-2">
            <motion.button
              onClick={handleLike} whileTap={{ scale: 0.85 }}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default', color: liked ? '#f43f5e' : 'rgba(156,163,175,0.8)', padding: 0 }}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
              {likes > 0 && <span>{likes}</span>}
            </motion.button>

            {/* Menu ⋯ — toujours visible sur mobile, hover sur desktop */}
            <div ref={menuBtnRef} className="relative ml-auto opacity-100 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <CommentMenu
                    anchorRef={menuBtnRef} open={menuOpen} onClose={() => setMenuOpen(false)}
                    isAuthor={!!isAuthor} isAdmin={!!isAdmin}
                    onEdit={() => setEditing(true)}
                    onDelete={() => setConfirmDelete(true)}
                    onReport={handleReport}
                    onShare={handleShare}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirmDelete && <DeleteConfirm onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} loading={deleteLoading} />}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── CommentSection ─────────────────────────────────────────── */
const CommentSection = ({ songId, songUploaderEmail }) => {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText]         = useState('');
  const [toast, setToast]       = useState(null);
  const textareaRef             = useRef(null);

  const showToast = (msg, color = '#22d3ee') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Chargement : 2 requêtes séparées pour éviter le join manquant ── */
  const loadComments = useCallback(async () => {
    if (!songId) return;
    try {
      // 1. Récupérer les commentaires sans join
      const { data: rows, error } = await supabase
        .from('song_comments')
        .select('*')
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) { console.error('[loadComments]', error); setLoading(false); return; }
      if (!rows || rows.length === 0) { setComments([]); setLoading(false); return; }

      // 2. Récupérer les profils des auteurs séparément
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      // 3. Récupérer les likes de l'utilisateur courant
      let likedSet = new Set();
      if (currentUser) {
        const ids = rows.map(r => r.id);
        const { data: cl } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', currentUser.id)
          .in('comment_id', ids);
        (cl || []).forEach(r => likedSet.add(r.comment_id));
      }

      // 4. Assembler
      setComments(rows.map(r => ({
        ...r,
        _liked: likedSet.has(r.id),
        user: profileMap[r.user_id] || null,
      })));
    } catch (e) {
      console.error('[CommentSection]', e);
    } finally {
      setLoading(false);
    }
  }, [songId, currentUser]);

  useEffect(() => { loadComments(); }, [loadComments]);

  /* ── Realtime — nouveaux commentaires d'autres utilisateurs ── */
  useEffect(() => {
    if (!songId) return;
    const channel = supabase
      .channel(`comments-rt:${songId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'song_comments', filter: `song_id=eq.${songId}` },
        async (payload) => {
          const newRow = payload.new;
          if (!newRow) return;
          // Ne pas dupliquer si c'est notre propre commentaire (déjà affiché en optimiste)
          setComments(prev => {
            if (prev.some(c => c.id === newRow.id)) return prev;
            // Récupérer le profil de l'auteur
            supabase.from('users').select('id, username, avatar_url').eq('id', newRow.user_id).single()
              .then(({ data: profile }) => {
                setComments(p => p.map(c => c.id === newRow.id ? { ...c, user: profile || null } : c));
              });
            return [{ ...newRow, _liked: false, user: null }, ...prev];
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [songId]);

  /* ── Soumission ── */
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUser || submitting) return;
    setSubmitting(true);
    setText('');

    // Affichage optimiste immédiat
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      song_id: songId,
      user_id: currentUser.id,
      content: trimmed,
      likes_count: 0,
      is_edited: false,
      created_at: new Date().toISOString(),
      _liked: false,
      _username: currentUser.username || currentUser.email?.split('@')[0] || 'Moi',
      _avatar: currentUser.avatar_url || null,
      user: {
        id: currentUser.id,
        username: currentUser.username || currentUser.email?.split('@')[0] || 'Moi',
        avatar_url: currentUser.avatar_url || null,
      },
    };
    setComments(prev => [tempComment, ...prev]);

    const { data, error } = await supabase
      .from('song_comments')
      .insert({ song_id: songId, user_id: currentUser.id, content: trimmed })
      .select()
      .single();

    setSubmitting(false);

    if (!error && data) {
      // Remplacer le temporaire par le vrai ID
      setComments(prev => prev.map(c =>
        c.id === tempId
          ? { ...data, _liked: false, user: tempComment.user }
          : c
      ));
      showToast('Commentaire publié ✓', '#22d3ee');
    } else {
      // Rollback
      setComments(prev => prev.filter(c => c.id !== tempId));
      setText(trimmed);
      console.error('[CommentSection submit]', error);
      showToast(error?.message ? `Erreur : ${error.message}` : 'Erreur — réessaie.', '#ef4444');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const onDeleted = (id) => setComments(prev => prev.filter(c => c.id !== id));
  const onUpdated = (id, content) => setComments(prev => prev.map(c => c.id === id ? { ...c, content, is_edited: true } : c));

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <MessageCircle className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-bold text-white">
          Commentaires
          {comments.length > 0 && <span className="text-gray-500 font-normal text-sm ml-2">({comments.length})</span>}
        </h2>
      </div>

      {/* Zone de saisie */}
      {currentUser ? (
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-1">
              {currentUser.avatar_url
                ? <img src={currentUser.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                : <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
              }
            </div>
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                placeholder="Laisse ton avis… (Ctrl+Entrée pour envoyer)"
                rows={2}
                className="w-full bg-gray-800/70 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-cyan-500/60 transition-colors"
                style={{ fontSize: 13, lineHeight: 1.5 }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${text.length > MAX_CHARS * 0.9 ? 'text-amber-400' : 'text-gray-600'}`}>
                  {text.length}/{MAX_CHARS}
                </span>
                <motion.button
                  onClick={handleSubmit}
                  disabled={!text.trim() || submitting}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: text.trim() && !submitting ? 'linear-gradient(90deg,#06b6d4,#a855f7)' : 'rgba(255,255,255,0.08)',
                    color: text.trim() && !submitting ? '#fff' : 'rgba(255,255,255,0.3)',
                    border: 'none', cursor: text.trim() && !submitting ? 'pointer' : 'default',
                  }}
                >
                  {submitting
                    ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <><Send className="w-3.5 h-3.5" />Publier</>
                  }
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3.5 text-sm text-gray-400 text-center">
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">Connecte-toi</Link>
          {' '}pour laisser un commentaire
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun commentaire — sois le premier !</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {comments.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              currentUser={currentUser}
              songUploaderEmail={songUploaderEmail}
              onDeleted={onDeleted}
              onUpdated={onUpdated}
              showToast={showToast}
            />
          ))}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} color={toast.color} />}
      </AnimatePresence>
    </section>
  );
};

export default CommentSection;
