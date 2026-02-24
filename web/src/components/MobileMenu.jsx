import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Upload, User, LogOut, LogIn, UserPlus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const MobileMenu = ({ isOpen, onClose }) => {
  const { isAuthenticated, logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  const menuVariants = {
    closed: {
      x: "100%",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 40
      }
    },
    open: {
      x: "0%",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 40
      }
    }
  };

  const overlayVariants = {
    closed: { opacity: 0 },
    open: { opacity: 1 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />

          {/* Drawer */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed right-0 top-0 bottom-0 w-[280px] bg-gray-950 border-l border-cyan-500/30 z-50 md:hidden shadow-2xl shadow-cyan-500/20 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-gray-900/50">
              <span className="font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent">
                Menu
              </span>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-6">
              {/* User Info (if logged in) */}
              {isAuthenticated && currentUser && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white font-bold">
                    {currentUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{currentUser.username}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="space-y-2">
                <Link
                  to="/"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Home className="w-5 h-5 text-cyan-400" />
                  Home
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <User className="w-5 h-5 text-magenta-400" />
                      Profile
                    </Link>
                    <Link
                      to="/upload"
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Upload className="w-5 h-5 text-cyan-400" />
                      Uploader
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <LogIn className="w-5 h-5 text-cyan-400" />
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <UserPlus className="w-5 h-5 text-magenta-400" />
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-cyan-500/20 bg-gray-900/50">
              {isAuthenticated && (
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 justify-start"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;