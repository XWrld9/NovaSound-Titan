import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Archive, ArchiveRestore, Trash2, AlertTriangle, Edit2, Check, X as XIcon, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import CommentSection from '@/components/CommentSection';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

/* ─────────────────────────────────────────────────────────────
   Modale de confirmation — portail sur document.body
   ───────────────────────────────────────────────────────────── */
const ConfirmModal = ({ action, songTitle, onConfirm, onCancel, loading }) => {
  const config = {
    archive:   {
      color: '#f59e0b',
      icon: <Archive className="w-7 h-7" />,
      label: 'Archiver',
      title: 'Archiver ce son ?',
      desc: 'Le son sera masqué du public mais conservé. Tu pourras le restaurer à tout moment depuis ton profil.',
    },
    unarchive: {
      color: '#22d3ee',
      icon: <ArchiveRestore className="w-7 h-7" />,
      label: 'Restaurer',
      title: 'Restaurer ce son ?',
      desc: 'Le son sera de nouveau visible par tout le monde.',
    },
    delete: {
      color: '#ef4444',
      icon: <Trash2 className="w-7 h-7" />,
      label: 'Supprimer',
      title: 'Supprimer définitivement ?',
      desc: 'Cette action est irréversible. Le son et ses fichiers seront supprimés pour toujours.',
    },
  }[action];

  if (!config) return null;

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={{
          width: '100%', maxWidth: 360,
          borderRadius: 20, padding: '28px 24px 24px',
          background: '#13131f',
          border: `1.5px solid ${config.color}35`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${config.color}18`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icône colorée */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            padding: 14, borderRadius: '50%',
            background: config.color + '18',
            color: config.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {config.icon}
          </div>
        </div>

        <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, textAlign: 'center', marginBottom: 8 }}>
          {config.title}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.5, marginBottom: 6 }}>
          {config.desc}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, textAlign: 'center', marginBottom: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          « {songTitle} »
        </p>

        {action === 'delete' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 20,
          }}>
            <AlertTriangle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0 }} />
            <span style={{ color: '#fca5a5', fontSize: 12 }}>Cette action ne peut pas être annulée.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel} disabled={loading}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm} disabled={loading}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: config.color, border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {loading
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              : config.label
            }
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ─────────────────────────────────────────────────────────────
   Dropdown menu — portail sur document.body, positionné
   dynamiquement au-dessus ou en-dessous selon l'espace disponible
   ───────────────────────────────────────────────────────────── */
const DropdownMenu = ({ anchorRef, open, onClose, isArchived, isAdmin, isOwner, onAction }) => {
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = 155; // hauteur estimée du menu (4 items)
    const openUp = spaceBelow < menuH + 12;
    setPos({
      top: openUp ? rect.top - menuH - 4 : rect.bottom + 4,
      left: rect.right - 176, // aligner à droite du bouton
      openUp,
    });
  }, [open, anchorRef]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: pos.openUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: pos.openUp ? 6 : -6 }}
      transition={{ duration: 0.13, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: pos.top,
        left: Math.max(8, pos.left),
        zIndex: 9998,
        minWidth: 176,
        borderRadius: 14,
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Commentaires - visible pour tout le monde */}
      <button
        onClick={() => { onAction('comments'); onClose(); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', background: 'none', border: 'none',
          color: '#34d399',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(52,211,153,0.10)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
      >
        <MessageCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
        Commentaires
      </button>

      {/* Séparateur - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 10px' }} />
      )}

      {/* Modifier - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <button
          onClick={() => { onAction('edit'); onClose(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: 'none', border: 'none',
            color: '#60a5fa',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(96,165,250,0.10)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <Edit2 style={{ width: 15, height: 15, flexShrink: 0 }} />
          Modifier
        </button>
      )}

      {/* Séparateur - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 10px' }} />
      )}

      {/* Archiver / Restaurer - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <button
          onClick={() => { onAction(isArchived ? 'unarchive' : 'archive'); onClose(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: 'none', border: 'none',
            color: isArchived ? '#22d3ee' : '#f59e0b',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          {isArchived ? (
            <>
              <ArchiveRestore style={{ width: 15, height: 15, flexShrink: 0 }} />
              Restaurer
            </>
          ) : (
            <>
              <Archive style={{ width: 15, height: 15, flexShrink: 0 }} />
              Archiver
            </>
          )}
        </button>
      )}

      {/* Séparateur - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 10px' }} />
      )}

      {/* Supprimer - seulement si propriétaire/admin */}
      {(isOwner || isAdmin) && (
        <button
          onClick={() => { onAction('delete'); onClose(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: 'none', border: 'none',
            color: '#f87171', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <Trash2 style={{ width: 15, height: 15, flexShrink: 0 }} />
          Supprimer
        </button>
      )}

      {/* Badge admin */}
      {isAdmin && !isOwner && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 16px' }}>
          <span style={{ fontSize: 10, color: '#fb923c', fontWeight: 700, letterSpacing: '0.06em' }}>⚡ ACTION ADMIN</span>
        </div>
      )}
    </motion.div>,
    document.body
  );
};


/* ─────────────────────────────────────────────────────────────
   EditSongModal — modifier titre, nom artiste, description
   ───────────────────────────────────────────────────────────── */
const EditSongModal = ({ song, onSaved, onCancel }) => {
  const [title,       setTitle]       = React.useState(song.title || '');
  const [artist,      setArtist]      = React.useState(song.artist || '');
  const [description, setDescription] = React.useState(song.description || '');
  const [saving,      setSaving]      = React.useState(false);
  const [error,       setError]       = React.useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('Le titre est obligatoire'); return; }
    if (!artist.trim()) { setError("Le nom d'artiste est obligatoire"); return; }
    setSaving(true);
    setError('');
    try {
      const updates = {};
      if (title.trim()       !== song.title)       updates.title       = title.trim();
      if (artist.trim()      !== song.artist)       updates.artist      = artist.trim();
      if (description.trim() !== (song.description || '')) updates.description = description.trim();

      if (Object.keys(updates).length === 0) { onCancel(); return; }

      const { error: err } = await supabase.from('songs').update(updates).eq('id', song.id);
      if (err) throw err;
      onSaved({ ...song, ...updates });
    } catch (e) {
      setError('Erreur lors de la sauvegarde — réessaie.');
      console.error('[EditSongModal]', e);
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={{
          width: '100%', maxWidth: 400,
          borderRadius: 20, padding: '24px',
          background: '#13131f',
          border: '1.5px solid rgba(96,165,250,0.25)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: '50%', background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
              <Edit2 style={{ width: 16, height: 16 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Modifier la publication</span>
          </div>
          <button
            onClick={onCancel} disabled={saving}
            style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'rgba(156,163,175,1)', cursor: 'pointer' }}
          >
            <XIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: 'rgba(156,163,175,1)', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Titre du morceau *
            </label>
            <input
              ref={el => el && setTimeout(() => el.focus(), 50)}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre"
              maxLength={120}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>
          <div>
            <label style={{ color: 'rgba(156,163,175,1)', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Nom d'artiste *
            </label>
            <input
              type="text"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="Nom d'artiste"
              maxLength={80}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>
          <div>
            <label style={{ color: 'rgba(156,163,175,1)', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Description <span style={{ color: 'rgba(107,114,128,1)', fontWeight: 400 }}>(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décris ton morceau…"
              rows={3}
              maxLength={500}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff', fontSize: 14,
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onCancel} disabled={saving}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1,
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave} disabled={saving || !title.trim() || !artist.trim()}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: saving || !title.trim() || !artist.trim() ? 'rgba(96,165,250,0.4)' : '#3b82f6',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: (saving || !title.trim() || !artist.trim()) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              : <><Check style={{ width: 14, height: 14 }} />Enregistrer</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ─────────────────────────────────────────────────────────────
   SongActionsMenu — composant principal
   ───────────────────────────────────────────────────────────── */
const SongActionsMenu = ({ song, onArchived, onDeleted }) => {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const btnRef = useRef(null);

  const isOwner = currentUser && song.uploader_id && (currentUser.id === song.uploader_id || currentUser.id === String(song.uploader_id));
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

  // Fermer dropdown si clic dehors — useEffect AVANT tout return conditionnel
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [open]);

  // Seul le bouton commentaires est visible pour tout le monde
  // Les autres actions (éditer, archiver, supprimer) sont réservées au propriétaire/admin

  const showToast = (msg, color) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3200);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (confirm === 'archive') {
        const { error } = await supabase.from('songs').update({ is_archived: true }).eq('id', song.id);
        if (error) throw error;
        onArchived?.(song.id, true);
        showToast('Son archivé — masqué du public.', '#f59e0b');

      } else if (confirm === 'unarchive') {
        const { error } = await supabase.from('songs').update({ is_archived: false }).eq('id', song.id);
        if (error) throw error;
        onArchived?.(song.id, false);
        showToast('Son restauré — visible par tous ✓', '#22d3ee');

      } else if (confirm === 'delete') {
        // Supprimer fichiers du storage
        if (song.audio_url) {
          const filePath = decodeURIComponent(song.audio_url.split('/').pop().split('?')[0]);
          await supabase.storage.from('audio').remove([filePath]);
        }
        if (song.cover_url && song.cover_url.includes('supabase')) {
          const filePath = decodeURIComponent(song.cover_url.split('/').pop().split('?')[0]);
          await supabase.storage.from('covers').remove([filePath]);
        }
        const { error } = await supabase.from('songs').delete().eq('id', song.id);
        if (error) throw error;
        onDeleted?.(song.id);
        showToast('Son supprimé définitivement.', '#ef4444');
      }
    } catch (err) {
      console.error('[SongActionsMenu]', err);
      showToast('Erreur — réessaie dans un instant.', '#ef4444');
    } finally {
      setLoading(false);
      setConfirm(null);
    }
  };

  return (
    <>
      {/* Bouton ⋯ */}
      <div ref={btnRef} style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          style={{
            padding: 6, borderRadius: '50%', background: 'none', border: 'none',
            color: open ? '#fff' : 'rgba(156,163,175,1)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = open ? '#fff' : 'rgba(156,163,175,1)'; e.currentTarget.style.background = 'none'; }}
          title="Actions"
          aria-label="Actions sur ce son"
        >
          <MoreVertical style={{ width: 16, height: 16 }} />
        </button>

        <AnimatePresence>
          {open && (
            <DropdownMenu
              anchorRef={btnRef}
              open={open}
              onClose={() => setOpen(false)}
              isArchived={!!song.is_archived}
              isAdmin={isAdmin}
              isOwner={isOwner}
              onAction={(action) => {
                if (action === 'edit')     { setShowEdit(true); }
                else if (action === 'comments') { setShowComments(true); }
                else { setConfirm(action); }
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && ReactDOM.createPortal(
          <motion.div
            initial={{ opacity: 0, y: 32, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            style={{
              position: 'fixed', bottom: 88, left: '50%',
              zIndex: 10000, pointerEvents: 'none',
              padding: '12px 22px', borderRadius: 50,
              background: toast.color,
              boxShadow: `0 4px 28px ${toast.color}70`,
              color: '#fff', fontSize: 13, fontWeight: 600,
              maxWidth: '88vw', textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.msg}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Modale d'édition */}
      <AnimatePresence>
        {showEdit && (
          <EditSongModal
            song={song}
            onSaved={(updated) => {
              setShowEdit(false);
              showToast('Publication modifiée ✓', '#60a5fa');
              // Notifier le parent pour rafraîchir si nécessaire
              window.dispatchEvent(new CustomEvent('novasound:song-updated', { detail: updated }));
              onArchived?.(song.id, !!song.is_archived); // force re-render trick
            }}
            onCancel={() => setShowEdit(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer Commentaires — portal direct, sans AnimatePresence */}
      {showComments && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowComments(false)}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              width: '100%', maxWidth: 640, margin: '0 auto',
              maxHeight: '82vh',
              background: '#0d1117',
              borderRadius: '20px 20px 0 0',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MessageCircle style={{ width: 18, height: 18, color: '#34d399' }} />
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>Commentaires</p>
                  <p style={{ color: 'rgba(156,163,175,1)', fontSize: 12, margin: 0 }}>{song.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowComments(false)}
                style={{
                  padding: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                  border: 'none', color: 'rgba(156,163,175,1)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <XIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
              <CommentSection songId={song.id} />
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Modale de confirmation */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            action={confirm}
            songTitle={song.title}
            onConfirm={handleConfirm}
            onCancel={() => setConfirm(null)}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default SongActionsMenu;
