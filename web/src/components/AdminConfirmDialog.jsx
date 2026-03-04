import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Ban, Radio, MessageSquare, X } from 'lucide-react';

const AdminConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirmer", 
  cancelText = "Annuler",
  type = "danger", // danger, warning, info
  icon 
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'danger': return <Trash2 className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'ban': return <Ban className="w-5 h-5" />;
      case 'radio': return <Radio className="w-5 h-5" />;
      case 'chat': return <MessageSquare className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          icon: 'text-red-400',
          button: 'bg-red-500 hover:bg-red-600',
          iconBg: 'bg-red-500/20'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          icon: 'text-yellow-400',
          button: 'bg-yellow-500 hover:bg-yellow-600',
          iconBg: 'bg-yellow-500/20'
        };
      case 'ban':
        return {
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/30',
          icon: 'text-orange-400',
          button: 'bg-orange-500 hover:bg-orange-600',
          iconBg: 'bg-orange-500/20'
        };
      case 'radio':
        return {
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/30',
          icon: 'text-purple-400',
          button: 'bg-purple-500 hover:bg-purple-600',
          iconBg: 'bg-purple-500/20'
        };
      case 'chat':
        return {
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/30',
          icon: 'text-cyan-400',
          button: 'bg-cyan-500 hover:bg-cyan-600',
          iconBg: 'bg-cyan-500/20'
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          icon: 'text-gray-400',
          button: 'bg-gray-500 hover:bg-gray-600',
          iconBg: 'bg-gray-500/20'
        };
    }
  };

  const colors = getColors();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className={`flex items-center gap-3 ${colors.icon} ${colors.bg} ${colors.border} px-3 py-2 rounded-lg border`}>
                <div className={`${colors.iconBg} p-2 rounded-lg`}>
                  {getIcon()}
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              <p className="text-gray-300 leading-relaxed">{message}</p>
              
              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 px-4 py-2.5 ${colors.button} text-white rounded-lg font-medium transition-all`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminConfirmDialog;
