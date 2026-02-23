import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';

// Styles pour les différents types de dialogues - Style NovaSound
const dialogStyles = {
  success: {
    bg: 'bg-gradient-to-r from-cyan-500/10 to-magenta-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
    title: 'text-cyan-400'
  },
  error: {
    bg: 'bg-gradient-to-r from-red-500/10 to-rose-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    iconBg: 'bg-red-500/20',
    title: 'text-red-400'
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    title: 'text-amber-400'
  },
  info: {
    bg: 'bg-gradient-to-r from-cyan-500/10 to-magenta-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
    title: 'text-cyan-400'
  },
  loading: {
    bg: 'bg-gradient-to-r from-cyan-500/10 to-magenta-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
    title: 'text-cyan-400'
  }
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2
};

export const Dialog = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', 
  actions = [],
  showCloseButton = true,
  size = 'md'
}) => {
  const style = dialogStyles[type] || dialogStyles.info;
  const Icon = icons[type] || Info;
  
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.4, 0, 0.2, 1] 
          }}
          className={`relative w-full ${sizeStyles[size]} ${style.bg} ${style.border} border rounded-2xl shadow-2xl backdrop-blur-xl`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${style.iconBg}`}>
                <Icon className={`w-5 h-5 ${style.icon} ${type === 'loading' ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${style.title}`}>
                  {title}
                </h3>
                {type === 'loading' && (
                  <p className="text-sm text-gray-400 mt-1">
                    Veuillez patienter...
                  </p>
                )}
              </div>
            </div>
            
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-gray-300 leading-relaxed">
              {message}
            </p>
            
            {/* Actions */}
            {actions.length > 0 && (
              <div className="flex gap-3 mt-6 justify-end">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick || onClose}
                    className={`px-6 py-2.5 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg ${
                      action.primary
                        ? 'bg-gradient-to-r from-cyan-500 to-magenta-500 text-white hover:from-cyan-600 hover:to-magenta-600 shadow-cyan-500/25'
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
    </AnimatePresence>
  );
};

// Hook pour gérer les dialogues
export const useDialog = () => {
  const [dialogs, setDialogs] = React.useState([]);
  
  const showDialog = (config) => {
    const id = Date.now() + Math.random();
    const newDialog = { ...config, id };
    
    setDialogs(prev => [...prev, newDialog]);
    
    // Auto-close pour les messages sans actions
    if (!config.actions || config.actions.length === 0) {
      setTimeout(() => {
        closeDialog(id);
      }, config.duration || 3000);
    }
    
    return id;
  };
  
  const closeDialog = (id) => {
    setDialogs(prev => prev.filter(dialog => dialog.id !== id));
  };
  
  const closeAllDialogs = () => {
    setDialogs([]);
  };
  
  // Méthodes pratiques
  const success = (title, message, options = {}) => 
    showDialog({ title, message, type: 'success', ...options });
    
  const error = (title, message, options = {}) => 
    showDialog({ title, message, type: 'error', ...options });
    
  const warning = (title, message, options = {}) => 
    showDialog({ title, message, type: 'warning', ...options });
    
  const info = (title, message, options = {}) => 
    showDialog({ title, message, type: 'info', ...options });
    
  const loading = (title, message, options = {}) => 
    showDialog({ title, message, type: 'loading', showCloseButton: false, ...options });
  
  return {
    dialogs,
    showDialog,
    closeDialog,
    closeAllDialogs,
    success,
    error,
    warning,
    info,
    loading
  };
};

// Provider pour les dialogues globaux
export const DialogProvider = ({ children }) => {
  const { dialogs, closeDialog } = useDialog();
  
  return (
    <>
      {children}
      <AnimatePresence>
        {dialogs.map((dialog) => (
          <Dialog
            key={dialog.id}
            {...dialog}
            onClose={() => closeDialog(dialog.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
};
