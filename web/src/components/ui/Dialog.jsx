import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';

const DialogContext = createContext(null);

const dialogStyles = {
  success: { bg: 'bg-gray-900', border: 'border-cyan-500/30', icon: 'text-cyan-400', iconBg: 'bg-cyan-500/20', title: 'text-cyan-400' },
  error:   { bg: 'bg-gray-900', border: 'border-red-500/30',  icon: 'text-red-400',  iconBg: 'bg-red-500/20',  title: 'text-red-400'  },
  warning: { bg: 'bg-gray-900', border: 'border-amber-500/30',icon: 'text-amber-400',iconBg: 'bg-amber-500/20', title: 'text-amber-400'},
  info:    { bg: 'bg-gray-900', border: 'border-cyan-500/30', icon: 'text-cyan-400', iconBg: 'bg-cyan-500/20', title: 'text-cyan-400' },
  loading: { bg: 'bg-gray-900', border: 'border-cyan-500/30', icon: 'text-cyan-400', iconBg: 'bg-cyan-500/20', title: 'text-cyan-400' },
};

const icons = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info, loading: Loader2 };

// ─── Provider ─────────────────────────────────────────────────────────────────
export const DialogProvider = ({ children }) => {
  const [dialogs, setDialogs] = useState([]);

  const showDialog = (config) => {
    const id = Date.now() + Math.random();
    setDialogs(prev => [...prev, { ...config, id }]);
    if (!config.actions?.length && config.duration !== 0) {
      setTimeout(() => closeDialog(id), config.duration ?? 4000);
    }
    return id;
  };

  const closeDialog = (id) => setDialogs(prev => prev.filter(d => d.id !== id));
  const closeAll = () => setDialogs([]);

  const api = {
    success: (title, message, opts) => showDialog({ title, message, type: 'success', ...opts }),
    error:   (title, message, opts) => showDialog({ title, message, type: 'error',   ...opts }),
    warning: (title, message, opts) => showDialog({ title, message, type: 'warning', ...opts }),
    info:    (title, message, opts) => showDialog({ title, message, type: 'info',    ...opts }),
    loading: (title, message, opts) => showDialog({ title, message, type: 'loading', showCloseButton: false, duration: 0, ...opts }),
    closeDialog,
    closeAll,
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {dialogs.map(dialog => (
          <DialogItem key={dialog.id} {...dialog} onClose={() => closeDialog(dialog.id)} />
        ))}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
};

// ─── Dialog item ──────────────────────────────────────────────────────────────
const DialogItem = ({ title, message, type = 'info', actions = [], showCloseButton = true, onClose }) => {
  const style = dialogStyles[type] || dialogStyles.info;
  const Icon  = icons[type] || Info;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={showCloseButton ? onClose : undefined}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className={`relative w-full max-w-md ${style.bg} ${style.border} border rounded-2xl shadow-2xl backdrop-blur-xl`}
      >
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${style.iconBg}`}>
              <Icon className={`w-5 h-5 ${style.icon} ${type === 'loading' ? 'animate-spin' : ''}`} />
            </div>
            <h3 className={`text-lg font-semibold ${style.title}`}>{title}</h3>
          </div>
          {showCloseButton && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-6 pb-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
          {actions.length > 0 && (
            <div className="flex gap-3 mt-5 justify-end">
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick || onClose}
                  className={`px-5 py-2 rounded-xl font-medium transition-all ${
                    action.primary
                      ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-90'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DialogItem;
