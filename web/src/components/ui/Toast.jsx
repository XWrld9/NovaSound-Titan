import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

// Styles pour les différents types de toasts - Style NovaSound
const toastStyles = {
  success: {
    bg: 'bg-gradient-to-r from-cyan-500 to-magenta-500',
    icon: 'text-white',
    border: 'border-cyan-500/30'
  },
  error: {
    bg: 'bg-gradient-to-r from-red-500 to-rose-500',
    icon: 'text-white',
    border: 'border-red-500/30'
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    icon: 'text-white',
    border: 'border-amber-500/30'
  },
  info: {
    bg: 'bg-gradient-to-r from-cyan-500 to-magenta-500',
    icon: 'text-white',
    border: 'border-cyan-500/30'
  }
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

export const Toast = ({ 
  message, 
  type = 'info', 
  isVisible, 
  onClose, 
  duration = 3000,
  action = null 
}) => {
  const style = toastStyles[type] || toastStyles.info;
  const Icon = icons[type] || Info;
  
  React.useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.4, 0, 0.2, 1] 
          }}
          className={`fixed top-4 right-4 z-50 ${style.bg} ${style.border} border rounded-xl shadow-2xl backdrop-blur-xl min-w-[320px] max-w-md`}
        >
          <div className="flex items-center gap-3 p-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            
            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium leading-relaxed">
                {message}
              </p>
              {action && (
                <button
                  onClick={action.onClick}
                  className="text-white/80 text-xs underline hover:text-white transition-colors mt-1"
                >
                  {action.label}
                </button>
              )}
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-all"
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
              className="h-1 bg-white/20"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook pour gérer les toasts
export const useToast = () => {
  const [toasts, setToasts] = React.useState([]);
  
  const addToast = (message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const newToast = { 
      id, 
      message, 
      type, 
      isVisible: true,
      ...options 
    };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove
    if (options.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, options.duration || 3000);
    }
    
    return id;
  };
  
  const removeToast = (id) => {
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, isVisible: false } : toast
      )
    );
    
    // Remove from array after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  };
  
  const clearAllToasts = () => {
    setToasts([]);
  };
  
  // Méthodes pratiques
  const success = (message, options = {}) => 
    addToast(message, 'success', options);
    
  const error = (message, options = {}) => 
    addToast(message, 'error', options);
    
  const warning = (message, options = {}) => 
    addToast(message, 'warning', options);
    
  const info = (message, options = {}) => 
    addToast(message, 'info', options);
  
  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info
  };
};

// Container pour les toasts
export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
