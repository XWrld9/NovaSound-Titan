import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

/* ──────────────────────────────────────────────────────────────
   Modale de confirmation — Archiver / Désarchiver / Supprimer
   ────────────────────────────────────────────────────────────── */
const ConfirmModal = ({ action, songTitle, onConfirm, onCancel, loading }) => {
  const isDelete = action === 'delete';
  const isArchive = action === 'archive';

  const config = {
    archive:   { color: '#f59e0b', icon: <Archive className="w-7 h-7" />,        label: 'Archiver',      title: 'Archiver ce son ?',          desc: 'Le son sera masqué du public mais conservé. Tu pourras le restaurer à tout moment.' },
    unarchive: { color: '#22d3ee', icon: <ArchiveRestore className="w-7 h-7" />, label: 'Restaurer',     title: 'Restaurer ce son ?',          desc: 'Le son sera de nouveau visible par tout le monde.' },
    delete:    { color: '#ef4444', icon: <Trash2 className="w-7 h-7" />,         label: 'Supprimer',     title: 'Supprimer définitivement ?',  desc: 'Cette action est irréversible. Le son et ses données seront supprimés pour toujours.' },
  }[action];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: '#1a1a2e', border: `1.5px solid ${config.color}40` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icône */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full" style={{ background: config.color + '18', color: config.color }}>
            {config.icon}
          </div>
        </div>

        <h3 className="text-white font-bold text-lg text-center mb-2">{config.title}</h3>
        <p className="text-gray-400 text-sm text-center mb-1 leading-relaxed">{config.desc}</p>
        <p className="text-gray-500 text-xs text-center mb-6 truncate">« {songTitle} »</p>

        {isDelete && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-xs">Cette action ne peut pas être annulée.</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-gray-400 text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{ background: config.color, border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : config.label
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ──────────────────────────────────────────────────────────────
   SongActionsMenu
   Affiché uniquement si currentUser = uploader OR admin
   Props:
     song         — objet song complet
     onArchived   (songId, isArchived) => void
     onDeleted    (songId) => void
   ────────────────────────────────────────────────────────────── */
const SongActionsMenu = ({ song, onArchived, onDeleted }) => {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'archive' | 'unarchive' | 'delete'
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const menuRef = useRef(null);

  // Vérifier droits
  const isOwner = currentUser && song.uploader_id && currentUser.id === song.uploader_id;
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  if (!isOwner && !isAdmin) return null;

  // Fermer le menu si clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const showToast = (msg, color = '#22d3ee') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
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
        showToast('Son restauré — visible par tous.', '#22d3ee');

      } else if (confirm === 'delete') {
        // Supprimer fichier audio du storage
        if (song.audio_url) {
          const parts = song.audio_url.split('/');
          const filePath = parts[parts.length - 1];
          await supabase.storage.from('audio').remove([filePath]);
        }
        // Supprimer pochette du storage
        if (song.cover_url && song.cover_url.includes('supabase')) {
          const parts = song.cover_url.split('/');
          const filePath = parts[parts.length - 1];
          await supabase.storage.from('covers').remove([filePath]);
        }
        // Supprimer en DB
        const { error } = await supabase.from('songs').delete().eq('id', song.id);
        if (error) throw error;
        onDeleted?.(song.id);
        showToast('Son supprimé définitivement.', '#ef4444');
      }
    } catch (err) {
      console.error('[SongActionsMenu]', err);
      showToast('Erreur — réessaie.', '#ef4444');
    } finally {
      setLoading(false);
      setConfirm(null);
      setOpen(false);
    }
  };

  const isArchived = song.is_archived;

  return (
    <>
      {/* Bouton ⋯ */}
      <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          title="Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Menu déroulant */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-50 min-w-[170px] rounded-xl shadow-2xl overflow-hidden"
              style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {/* Archiver / Restaurer */}
              <button
                onClick={(e) => { e.stopPropagation(); setConfirm(isArchived ? 'unarchive' : 'archive'); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-left"
                style={{ color: isArchived ? '#22d3ee' : '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {isArchived
                  ? <><ArchiveRestore className="w-4 h-4 flex-shrink-0" />Restaurer</>
                  : <><Archive className="w-4 h-4 flex-shrink-0" />Archiver</>
                }
              </button>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />

              {/* Supprimer */}
              <button
                onClick={(e) => { e.stopPropagation(); setConfirm('delete'); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                Supprimer
              </button>

              {/* Badge admin */}
              {isAdmin && !isOwner && (
                <div className="px-4 py-1.5 border-t border-white/8">
                  <span className="text-[10px] text-orange-400 font-semibold tracking-wide">⚡ ACTION ADMIN</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[400] px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white"
            style={{ background: toast.color, boxShadow: `0 4px 24px ${toast.color}60`, maxWidth: '90vw', textAlign: 'center' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

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
