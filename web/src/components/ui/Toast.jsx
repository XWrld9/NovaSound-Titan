import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const toastStyles = {
  success: { bg: 'bg-gradient-to-r from-cyan-500 to-cyan-600', border: 'border-cyan-400/30' },
  error:   { bg: 'bg-gradient-to-r from-red-500 to-rose-600',  border: 'border-red-400/30'  },
  warning: { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', border: 'border-amber-400/30' },
  info:    { bg: 'bg-gradient-to-r from-cyan-500 to-magenta-500', border: 'border-cyan-400/30' }
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

// ─── Provider (wraps the app) ─────────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, ...options }]);
    const duration = options.duration ?? 3500;
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const api = {
    success: (msg, opts) => addToast(msg, 'success', opts),
    error:   (msg, opts) => addToast(msg, 'error',   opts),
    warning: (msg, opts) => addToast(msg, 'warning', opts),
    info:    (msg, opts) => addToast(msg, 'info',    opts),
    remove:  removeToast,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// ─── Toast item ───────────────────────────────────────────────────────────────
const ToastItem = ({ id, message, type = 'info', duration = 3500, action, onClose }) => {
  const style = toastStyles[type] || toastStyles.info;
  const Icon  = icons[type] || Info;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`${style.bg} ${style.border} border rounded-xl shadow-2xl min-w-[300px] max-w-sm overflow-hidden`}
    >
      <div className="flex items-center gap-3 p-4">
        <Icon className="w-5 h-5 text-white flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-relaxed">{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="text-white/80 text-xs underline hover:text-white mt-1"
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-all flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-1 bg-white/25"
        />
      )}
    </motion.div>
  );
};

// ─── Container (rendered inside Provider) ─────────────────────────────────────
export const ToastContainer = ({ toasts = [], onClose }) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
    <AnimatePresence mode="popLayout">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem {...toast} onClose={onClose} />
        </div>
      ))}
    </AnimatePresence>
  </div>
);

export default ToastItem;
