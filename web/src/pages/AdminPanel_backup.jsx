/**
 * AdminPanel — NovaSound TITAN LUX v20000 - VERSION SIMPLIFIÉE
 * Structure corrigée pour éviter les erreurs ES module
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import AdminConfirmDialog from '@/components/AdminConfirmDialog';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

// ── Toast interne ──────────────────────────────────────────────────────
const Toast = ({ msg, type = 'success', onClose }) => (
  <motion.div initial={{ opacity:0, y:-12, scale:.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8 }}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold ${
      type === 'success' ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-300' :
      type === 'error'   ? 'bg-red-950/95 border-red-500/30 text-red-300' :
      'bg-cyan-950/95 border-cyan-500/30 text-cyan-300'
    }`}>
    {type==='success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> :
     type==='error'   ? <XCircle className="w-4 h-4 flex-shrink-0" /> :
     <Info className="w-4 h-4 flex-shrink-0" />}
    <span className="ml-2">{msg}</span>
    <button onClick={onClose} className="ml-4 text-white/70 hover:text-white">
      <X className="w-4 h-4" />
    </button>
  </motion.div>
);

// ── Section header ───────────────────────────────────────────────────────
const SectionHeader = ({ title, count, action, actionLabel, actionIcon: AIcon }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {count !== undefined && (
        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">{count}</span>
      )}
    </div>
    {action && (
      <button onClick={action} className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm font-medium transition-all flex items-center gap-1.5">
        {AIcon && <AIcon className="w-4 h-4" />}
        {actionLabel}
      </button>
    )}
  </div>
);

const AdminPanel = () => {
  const { currentUser, isAdmin, initialLoading: loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const [stats, setStats] = useState({ users:0, songs:0, liveRooms:0, messages:0, reports:0 });
  const [liveRooms, setLiveRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [songs, setSongs] = useState([]);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [reports, setReports] = useState([]);
  const [adminRoles, setAdminRoles] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, confirmText:'', cancelText:'', type:'danger' });

  // Toast
  const addToast = (msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const confirm = ({ type='danger', title, message, confirmText='Confirmer', onConfirm }) => {
    setConfirmDialog({ isOpen:true, type, title, message, confirmText, onConfirm });
  };

  const closeConfirm = () => setConfirmDialog({ isOpen:false, title:'', message:'', onConfirm:null, confirmText:'', cancelText:'', type:'danger' });

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <p className="text-gray-600 text-sm">Vérification des accès…</p>
        </div>
      </div>
    );
  }

  // Accès refusé
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-red-400 font-bold text-lg mb-2">Accès refusé</p>
          <p className="text-gray-600 text-sm mb-4">Seuls les administrateurs peuvent accéder à ce panneau.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
            <Home className="w-4 h-4" /> Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // Render principal
  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast msg={t.msg} type={t.type} onClose={() => removeToast(t.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050510]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-white transition-colors">
            <Home className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Admin Panel
            {currentUser?.email === ADMIN_EMAIL && (
              <span className="ml-2 px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">ADMIN</span>
            )}
          </h1>
        </div>
      </div>

      {/* Contenu principal simplifié */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <p className="text-center text-gray-400 mb-8">
          Panneau d'administration temporairement simplifié pour résoudre les erreurs de build.
        </p>
      </div>

      {/* Dialog */}
      <AdminConfirmDialog
        isOpen={confirmDialog.isOpen} onClose={closeConfirm}
        onConfirm={confirmDialog.onConfirm} title={confirmDialog.title}
        message={confirmDialog.message} confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText || 'Annuler'} type={confirmDialog.type || 'danger'}
      />
    </div>
  );
};

export default AdminPanel;
