/**
 * AdminConfirmDialog — NovaSound TITAN LUX v25000
 * Boîtes de dialogue d'administration premium
 * Design : glassmorphism + gradient + animations spring
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Trash2, Ban, Radio, MessageSquare, X,
  ShieldAlert, UserX, Archive, Flame,
} from 'lucide-react';

const TYPES = {
  danger: {
    gradient: 'from-red-600 to-rose-700',
    glow:     'rgba(239,68,68,0.35)',
    border:   'rgba(239,68,68,0.25)',
    bg:       'rgba(239,68,68,0.07)',
    text:     'text-red-400',
    btn:      'from-red-600 to-rose-600',
    btnHov:   'hover:from-red-500 hover:to-rose-500',
    icon:     Trash2,
    ring:     'rgba(239,68,68,0.15)',
  },
  warning: {
    gradient: 'from-amber-500 to-yellow-600',
    glow:     'rgba(245,158,11,0.3)',
    border:   'rgba(245,158,11,0.2)',
    bg:       'rgba(245,158,11,0.06)',
    text:     'text-amber-400',
    btn:      'from-amber-500 to-yellow-500',
    btnHov:   'hover:from-amber-400 hover:to-yellow-400',
    icon:     AlertTriangle,
    ring:     'rgba(245,158,11,0.12)',
  },
  ban: {
    gradient: 'from-orange-600 to-red-700',
    glow:     'rgba(249,115,22,0.3)',
    border:   'rgba(249,115,22,0.2)',
    bg:       'rgba(249,115,22,0.06)',
    text:     'text-orange-400',
    btn:      'from-orange-600 to-red-600',
    btnHov:   'hover:from-orange-500 hover:to-red-500',
    icon:     UserX,
    ring:     'rgba(249,115,22,0.12)',
  },
  radio: {
    gradient: 'from-purple-600 to-violet-700',
    glow:     'rgba(139,92,246,0.3)',
    border:   'rgba(139,92,246,0.2)',
    bg:       'rgba(139,92,246,0.06)',
    text:     'text-purple-400',
    btn:      'from-purple-600 to-violet-600',
    btnHov:   'hover:from-purple-500 hover:to-violet-500',
    icon:     Radio,
    ring:     'rgba(139,92,246,0.12)',
  },
  chat: {
    gradient: 'from-cyan-600 to-blue-600',
    glow:     'rgba(6,182,212,0.3)',
    border:   'rgba(6,182,212,0.2)',
    bg:       'rgba(6,182,212,0.06)',
    text:     'text-cyan-400',
    btn:      'from-cyan-600 to-blue-600',
    btnHov:   'hover:from-cyan-500 hover:to-blue-500',
    icon:     MessageSquare,
    ring:     'rgba(6,182,212,0.12)',
  },
  archive: {
    gradient: 'from-slate-500 to-gray-600',
    glow:     'rgba(100,116,139,0.3)',
    border:   'rgba(100,116,139,0.2)',
    bg:       'rgba(100,116,139,0.06)',
    text:     'text-slate-400',
    btn:      'from-slate-600 to-gray-600',
    btnHov:   'hover:from-slate-500 hover:to-gray-500',
    icon:     Archive,
    ring:     'rgba(100,116,139,0.12)',
  },
};

const AdminConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText  = 'Annuler',
  type        = 'danger',
  icon: CustomIcon,
}) => {
  const config   = TYPES[type] || TYPES.danger;
  const Icon     = CustomIcon || config.icon;

  // Fermer sur Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          exit={{ opacity:0 }}
          transition={{ duration:.15 }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.75)' }}
          onClick={e => e.target === e.currentTarget && onClose()}>

          {/* Backdrop blur effect */}
          <div className="absolute inset-0 backdrop-blur-[6px]" />

          <motion.div
            initial={{ opacity:0, scale:.92, y:24 }}
            animate={{ opacity:1, scale:1,   y:0 }}
            exit={{   opacity:0, scale:.94, y:16 }}
            transition={{ type:'spring', stiffness:380, damping:28 }}
            className="relative w-full max-w-sm overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #0d0d1f, #111128)',
              border: `1px solid ${config.border}`,
              borderRadius: 24,
              boxShadow: `0 0 0 1px ${config.ring}, 0 24px 60px rgba(0,0,0,0.7), 0 0 60px ${config.glow}`,
            }}>

            {/* Glow top accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
              style={{ background:`linear-gradient(90deg, transparent, ${config.glow}, transparent)` }} />

            {/* Top gradient strip */}
            <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />

            {/* Header */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Icon blob */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${config.bg} 0%, rgba(0,0,0,0) 100%)`,
                        border: `1px solid ${config.border}`,
                      }}>
                      <Icon className={`w-6 h-6 ${config.text}`} />
                    </div>
                    {/* Pulse ring for danger/ban */}
                    {(type === 'danger' || type === 'ban') && (
                      <motion.div
                        animate={{ scale:[1, 1.3, 1], opacity:[0.4, 0, 0.4] }}
                        transition={{ repeat:Infinity, duration:2, ease:'easeInOut' }}
                        className="absolute inset-0 rounded-2xl"
                        style={{ background:`${config.glow}`, filter:'blur(4px)' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-black text-base leading-tight">{title}</h3>
                    <div className={`flex items-center gap-1 mt-0.5`}>
                      <ShieldAlert className={`w-3 h-3 ${config.text} opacity-70`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${config.text} opacity-70`}>
                        {type === 'ban' ? 'Bannissement' : type === 'danger' ? 'Action irréversible' : type === 'chat' ? 'Modération' : type === 'radio' ? 'Live rooms' : 'Confirmation'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/[0.08] transition-all flex-shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="h-px mx-6" style={{ background:`linear-gradient(90deg, ${config.border}, transparent)` }} />

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{message}</p>

              {/* Warning badge for destructive */}
              {(type === 'danger' || type === 'ban') && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                  style={{ background:config.bg, border:`1px solid ${config.border}` }}>
                  <Flame className={`w-3.5 h-3.5 ${config.text} flex-shrink-0 mt-0.5`} />
                  <p className={`text-xs ${config.text} leading-relaxed`}>
                    {type === 'ban' ? "L'utilisateur sera immédiatement bloqué de la plateforme." : 'Cette action est irréversible et ne peut pas être annulée.'}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-400 hover:text-white transition-all"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)' }}>
                {cancelText}
              </button>
              <motion.button
                whileTap={{ scale:.96 }}
                onClick={handleConfirm}
                className={`flex-1 py-3 rounded-2xl text-sm font-black text-white bg-gradient-to-r ${config.btn} ${config.btnHov} transition-all`}
                style={{ boxShadow:`0 4px 20px ${config.glow}` }}>
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminConfirmDialog;
