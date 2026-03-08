/**
<<<<<<< HEAD
 * AdminPanel — NovaSound TITAN LUX v20000 - VERSION PARFAITE FUSIONNÉE
 * Panneau d'administration premium — redesign complet
 * ✅ Fusion de la version fonctionnelle (301dc90) avec la version améliorée
 * ✅ Structure ES module compliant
 * ✅ Toutes les fonctionnalités admin préservées
 * ✅ Design moderne et complet
 * ✅ Synchronisé avec la database NovaSound Titan
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Shield, Trash2, Settings, CheckCircle, Music,
  MessageSquare, Radio, RefreshCw, XCircle, Search,
  Ban, Home, ArrowLeft, Activity, TrendingUp, Eye,
  Clock, Star, Zap, AlertTriangle, ChevronRight,
  MoreVertical, UserX, UserCheck, Archive, Volume2,
  Mic, Wifi, WifiOff, BarChart2, Filter, Download,
  X, Info
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
=======
 * AdminPanel — NovaSound TITAN LUX v20000 - VERSION SIMPLIFIÉE
 * Structure corrigée pour éviter les erreurs ES module
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
>>>>>>> 4f0155984be34a96acffcd4d806f341585483f2e
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

<<<<<<< HEAD
  const unarchiveSong = async (song) => {
    try {
      await supabase.from('songs').update({ is_archived:false }).eq('id', song.id);
      addToast(`✅ "${song.title}" remis en ligne`);
      loadSongs();
    } catch (e) { addToast(e.message,'error'); }
  };

  const deleteSong = (song) => confirm({
    type:'danger', title:'Supprimer définitivement',
    message:`Supprimer DÉFINITIVEMENT "${song.title}" de ${song.artist} ?\n\n⚠️ Cette action est irréversible. Toutes les données seront perdues.`,
    confirmText:'Supprimer définitivement', onConfirm: async () => {
      try {
        await supabase.from('songs').delete().eq('id', song.id);
        addToast(`🗑️ "${song.title}" supprimé définitivement`);
        loadSongs(); loadStats();
      } catch (e) { addToast(e.message,'error'); }
    }
  });

  const deleteMsg = async (id) => {
    try {
      await supabase.from('chat_messages').update({ is_deleted:true }).eq('id', id);
      setChatMsgs(p => p.filter(m => m.id !== id));
    } catch {}
  };

  const resolveReport = async (report, action) => {
    try {
      await supabase.from('reports').update({
        status: action,
        admin_id: currentUser?.id,
        admin_notes: `${action === 'resolved' ? 'Résolu' : 'Ignoré'} le ${new Date().toLocaleDateString('fr-FR')}`,
        updated_at: new Date().toISOString(),
      }).eq('id', report.id);
      addToast(action === 'resolved' ? '✅ Signalement résolu' : '🚫 Signalement ignoré');
      loadReports(); loadStats();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const grantAdmin = (user) => confirm({
    type:'info', title:'Promouvoir administrateur',
    message:`Donner les droits admin à ${user.username || user.email} ?

Il pourra accéder au panneau d'administration.`,
    confirmText:'Promouvoir', onConfirm: async () => {
      try {
        await supabase.from('user_roles').upsert({ user_id: user.id, role: 'admin', is_active: true, granted_by: currentUser?.id }, { onConflict: 'user_id,role' });
        addToast(`⭐ ${user.username} promu administrateur`);
        loadAdminRoles(); loadUsers();
      } catch (e) { addToast(e.message, 'error'); }
    }
  });

  const revokeAdmin = (role) => confirm({
    type:'danger', title:'Révoquer les droits admin',
    message:`Retirer les droits admin à ${role.user?.username || role.user_id} ?`,
    confirmText:'Révoquer', onConfirm: async () => {
      try {
        await supabase.from('user_roles').update({ is_active: false }).eq('id', role.id);
        addToast(`🔒 Droits admin révoqués`);
        loadAdminRoles(); loadUsers();
      } catch (e) { addToast(e.message, 'error'); }
    }
  });

  const clearChat = () => confirm({
    type:'chat', title:'Vider le chat global',
    message:'Effacer TOUS les messages du chat global ?\n\nAction irréversible.',
    confirmText:'Tout vider', onConfirm: async () => {
      try {
        await supabase.from('chat_messages').update({ is_deleted:true }).eq('is_deleted', false);
        addToast('🧹 Chat vidé');
        loadChat(); loadStats();
      } catch (e) { addToast(e.message,'error'); }
    }
  });

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase();
  const filteredUsers = users.filter(u => !q || (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  const filteredSongs = songs.filter(s => !q || (s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q));

  // ── TABS config ───────────────────────────────────────────────────────────────
  const TABS = [
    { k:'overview', l:'Vue d\'ensemble', icon:BarChart2 },
    { k:'live',     l:'Lives',           icon:Radio,          badge:stats.liveRooms > 0 ? stats.liveRooms : null },
    { k:'users',    l:'Utilisateurs',    icon:Users,          badge:users.filter(u=>u.is_banned).length || null },
    { k:'songs',    l:'Musiques',        icon:Music },
    { k:'chat',     l:'Chat',            icon:MessageSquare },
    { k:'reports',  l:'Signalements',   icon:AlertTriangle,  badge:stats.reports > 0 ? stats.reports : null },
    { k:'admins',   l:'Admins',          icon:Shield },
  ];

  // ══ Loading ═══════════════════════════════════════════════════════════════════
=======
  // Loading
>>>>>>> 4f0155984be34a96acffcd4d806f341585483f2e
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

<<<<<<< HEAD
  // ══ Accès refusé ══════════════════════════════════════════════════════════════
=======
  // Accès refusé
>>>>>>> 4f0155984be34a96acffcd4d806f341585483f2e
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
<<<<<<< HEAD
          <h1 className="text-2xl font-black text-white mb-2">Accès refusé</h1>
          <p className="text-gray-500 text-sm">Réservé aux administrateurs NovaSound.</p>
        </div>
        <button onClick={() => navigate('/')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.07] text-gray-300 hover:text-white border border-white/[0.1] transition-all">
          <Home className="w-4 h-4" /> Retour à l'accueil
        </button>
=======
          <p className="text-red-400 font-bold text-lg mb-2">Accès refusé</p>
          <p className="text-gray-600 text-sm mb-4">Seuls les administrateurs peuvent accéder à ce panneau.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
            <Home className="w-4 h-4" /> Retour à l'accueil
          </button>
        </div>
>>>>>>> 4f0155984be34a96acffcd4d806f341585483f2e
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
<<<<<<< HEAD

        {/* ── Search bar ─────────────────────────────────────────────────────── */}
        {['users','songs'].includes(activeTab) && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab==='users' ? 'Rechercher par nom ou email…' : 'Rechercher par titre ou artiste…'}
              className="w-full pl-11 pr-5 py-3.5 bg-[#0a0a18] border border-white/[0.08] rounded-2xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* VUE D'ENSEMBLE */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users}         label="Utilisateurs"    value={stats.users}     color="#60a5fa" sub={`${users.filter(u=>u.is_banned).length} banni(s)`} />
              <StatCard icon={Music}         label="Musiques"        value={stats.songs}     color="#34d399" sub={`${songs.filter(s=>s.is_archived).length} archivé(s)`} />
              <StatCard icon={Radio}         label="Lives actifs"    value={stats.liveRooms} color="#f87171" sub="En ce moment" pulse={stats.liveRooms > 0} />
              <StatCard icon={MessageSquare} label="Messages chat"   value={stats.messages}  color="#a78bfa" />
            </div>

            {/* Admin info */}
            <div className="bg-[#0a0a18] border border-white/[0.07] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-white font-bold text-sm">Actions rapides</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { label:'Nettoyer lives inactifs', icon:WifiOff,  color:'red',    fn:cleanInactiveRooms },
                  { label:'Vider le chat',           icon:MessageSquare, color:'orange', fn:clearChat },
                  { label:'Actualiser tout',         icon:RefreshCw,color:'cyan',   fn:refreshAll },
                ].map(({ label, icon:Icon, color, fn }) => (
                  <button key={label} onClick={fn}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      color==='red'    ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' :
                      color==='orange' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20' :
                      'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent live rooms preview */}
            {liveRooms.filter(r=>r.is_active).length > 0 && (
              <div className="bg-[#0a0a18] border border-red-500/15 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h3 className="text-white font-bold text-sm">Lives en cours</h3>
                </div>
                <div className="space-y-2">
                  {liveRooms.filter(r=>r.is_active).slice(0,3).map(room => (
                    <div key={room.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{room.title || room.name || 'Sans nom'}</p>
                        <p className="text-gray-600 text-[10px]">{room.host?.username} · {room.participants_count} participant(s)</p>
                      </div>
                      <button onClick={() => stopLiveRoom(room)} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold border border-red-500/20 hover:bg-red-500/25 transition-all">
                        Stopper
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* LIVES */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
            <SectionHeader title="Salles Live" count={liveRooms.length}
              action={cleanInactiveRooms} actionLabel="Nettoyer inactives" actionIcon={Trash2} />
            {liveRooms.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <Radio className="w-10 h-10 text-gray-700" />
                <p className="text-gray-600 text-sm">Aucune salle live.</p>
              </div>
            )}
            {liveRooms.map(room => (
              <motion.div key={room.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                className={`bg-[#0a0a18] rounded-2xl p-4 border transition-all hover:border-white/[0.12] ${
                  room.is_active ? 'border-red-500/20' : 'border-white/[0.07]'
                }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${room.is_active ? 'bg-red-500/15 border border-red-500/20' : 'bg-white/[0.05] border border-white/[0.07]'}`}>
                    {room.is_active ? <Wifi className="w-5 h-5 text-red-400" /> : <WifiOff className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {room.is_active && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
                      <p className="text-white font-semibold text-sm truncate">{room.title || room.name || 'Sans nom'}</p>
                    </div>
                    <p className="text-gray-500 text-xs">
                      Hôte : {room.host?.username || '?'} · {room.participants_count || 0} participant(s) · {new Date(room.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {room.is_active && (
                      <button onClick={() => stopLiveRoom(room)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/15 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/25 transition-all">
                        <XCircle className="w-3.5 h-3.5" />Stopper
                      </button>
                    )}
                    <button onClick={() => deleteLiveRoom(room)} className="p-2 rounded-xl text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* UTILISATEURS */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
            <SectionHeader title="Utilisateurs" count={filteredUsers.length} />
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>{users.filter(u=>u.is_banned).length} banni(s)</span>
              <span>·</span>
              <span>{users.filter(u=>u.email===ADMIN_EMAIL).length} admin(s)</span>
            </div>
            {filteredUsers.length === 0 && <p className="text-gray-600 text-sm py-10 text-center">Aucun résultat.</p>}
            <div className="space-y-2">
              {filteredUsers.map(user => (
                <motion.div key={user.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                  className={`bg-[#0a0a18] rounded-2xl p-4 border transition-all hover:border-white/[0.12] ${
                    user.is_banned ? 'border-red-500/20' : user.email===ADMIN_EMAIL ? 'border-cyan-500/15' : 'border-white/[0.07]'
                  }`}>
                  <div className="flex items-center gap-3">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-white/[0.08]" />
                      : <div className="w-11 h-11 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0 text-gray-400 font-bold text-base">
                          {(user.username||'?')[0].toUpperCase()}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-semibold text-sm truncate">{user.username || '—'}</span>
                        {user.is_banned && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-black">BANNI</span>}
                        {user.email===ADMIN_EMAIL && <span className="text-[9px] bg-gradient-to-r from-cyan-500/25 to-purple-600/25 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-black">ADMIN</span>}
                      </div>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                      <p className="text-gray-700 text-[10px] mt-0.5">Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {user.email !== ADMIN_EMAIL && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!adminRoles.find(r=>r.user_id===user.id && r.is_active) && (
                          <button onClick={() => grantAdmin(user)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all">
                              <Shield className="w-3.5 h-3.5" />Admin
                          </button>
                        )}
                        <button onClick={() => toggleBan(user)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            user.is_banned
                              ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                              : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                          }`}>
                          {user.is_banned ? <><UserCheck className="w-3.5 h-3.5" />Débannir</> : <><UserX className="w-3.5 h-3.5" />Bannir</>}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* MUSIQUES */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'songs' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
            <SectionHeader title="Musiques" count={filteredSongs.length} />
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <span>{songs.filter(s=>s.is_archived).length} archivée(s)</span>
              <span>·</span>
              <span>{songs.filter(s=>!s.is_archived).length} en ligne</span>
            </div>
            {filteredSongs.length === 0 && <p className="text-gray-600 text-sm py-10 text-center">Aucun résultat.</p>}
            <div className="space-y-2">
              {filteredSongs.map(song => (
                <motion.div key={song.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                  className={`bg-[#0a0a18] rounded-2xl p-3.5 border transition-all hover:border-white/[0.12] ${song.is_archived ? 'border-white/[0.04] opacity-60' : 'border-white/[0.07]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-white/[0.05] border border-white/[0.07]">
                      {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-gray-700" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-white font-semibold text-sm truncate">{song.title}</p>
                        {song.is_archived && <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full font-black flex-shrink-0">ARCHIVÉ</span>}
                      </div>
                      <p className="text-gray-500 text-xs">{song.artist} · <span className="text-gray-600">{(song.plays_count||0).toLocaleString()} écoutes</span></p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {song.is_archived
                        ? <button onClick={() => unarchiveSong(song)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all"><CheckCircle className="w-3.5 h-3.5" />Remettre</button>
                        : <button onClick={() => archiveSong(song)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all"><Archive className="w-3.5 h-3.5" />Archiver</button>
                      }
                      <button onClick={() => deleteSong(song)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"><Trash2 className="w-3.5 h-3.5" />Supprimer</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* CHAT */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
            <SectionHeader title="Chat Global" count={chatMsgs.length}
              action={clearChat} actionLabel="Tout vider" actionIcon={Trash2} />
            {chatMsgs.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <MessageSquare className="w-10 h-10 text-gray-700" />
                <p className="text-gray-600 text-sm">Aucun message.</p>
              </div>
            )}
            <div className="space-y-2">
              {chatMsgs.map(msg => (
                <div key={msg.id} className="bg-[#0a0a18] rounded-2xl p-3.5 border border-white/[0.07] flex items-start gap-3 hover:border-white/[0.12] transition-all group">
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.07] flex items-center justify-center text-sm font-bold text-gray-400">
                    {msg.user?.avatar_url ? <img src={msg.user.avatar_url} alt="" className="w-full h-full object-cover" /> : (msg.user?.username||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-cyan-400 text-xs font-bold">{msg.user?.username||'?'}</span>
                      <span className="text-gray-700 text-[10px]">{new Date(msg.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="text-gray-300 text-sm break-words leading-relaxed">{msg.content}</p>
                  </div>
                  <button onClick={() => deleteMsg(msg.id)}
                    className="p-1.5 rounded-xl text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SIGNALEMENTS */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-4">
            <SectionHeader title="Signalements" count={reports.length}
              action={loadReports} actionLabel="Actualiser" actionIcon={RefreshCw} />
            {reports.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <AlertTriangle className="w-10 h-10 text-gray-700" />
                <p className="text-gray-600 text-sm">Aucun signalement en attente. 🎉</p>
              </div>
            )}
            <div className="space-y-2">
              {reports.map(report => (
                <motion.div key={report.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                  className={`bg-[#0a0a18] rounded-2xl p-4 border transition-all hover:border-white/[0.12] ${
                    report.status === 'pending' ? 'border-orange-500/20' :
                    report.status === 'resolved' ? 'border-green-500/10 opacity-60' : 'border-white/[0.07] opacity-60'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      report.status === 'pending' ? 'bg-orange-500/15 border border-orange-500/20' : 'bg-white/[0.05] border border-white/[0.07]'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${report.status === 'pending' ? 'text-orange-400' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-semibold text-sm">{report.reason || 'Contenu inapproprié'}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black border ${
                          report.status === 'pending'  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          report.status === 'resolved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>{report.status?.toUpperCase() || 'EN ATTENTE'}</span>
                      </div>
                      <p className="text-gray-500 text-xs">
                        Signalé par <span className="text-gray-400">{report.reporter?.username || '?'}</span>
                        {report.reported_user && <> · contre <span className="text-gray-400">{report.reported_user?.username}</span></>}
                        {report.song && <> · musique : <span className="text-gray-400">"{report.song?.title}"</span></>}
                      </p>
                      {report.description && <p className="text-gray-600 text-xs mt-1 italic">"{report.description}"</p>}
                      <p className="text-gray-700 text-[10px] mt-1">{new Date(report.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                    {report.status === 'pending' && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => resolveReport(report, 'resolved')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all">
                          <CheckCircle className="w-3.5 h-3.5" />Résoudre
                        </button>
                        <button onClick={() => resolveReport(report, 'dismissed')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-gray-500/20 transition-all">
                          <XCircle className="w-3.5 h-3.5" />Ignorer
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ADMINS */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'admins' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-6">
            {/* Admins actifs */}
            <div>
              <SectionHeader title="Administrateurs actifs" count={adminRoles.filter(r=>r.is_active).length} />
              {adminRoles.filter(r=>r.is_active).length === 0 && (
                <p className="text-gray-600 text-sm py-6 text-center">Aucun admin supplémentaire (seul l'email principal est admin).</p>
              )}
              <div className="space-y-2">
                {adminRoles.filter(r=>r.is_active).map(role => (
                  <motion.div key={role.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="bg-[#0a0a18] rounded-2xl p-4 border border-cyan-500/15 hover:border-cyan-500/25 transition-all">
                    <div className="flex items-center gap-3">
                      {role.user?.avatar_url
                        ? <img src={role.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/[0.08]" />
                        : <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0 text-cyan-400 font-bold">{(role.user?.username||'?')[0].toUpperCase()}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm truncate">{role.user?.username || role.user_id}</span>
                          <span className="text-[9px] bg-gradient-to-r from-cyan-500/25 to-purple-600/25 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-full font-black">ADMIN</span>
                        </div>
                        <p className="text-gray-500 text-xs">{role.user?.email}</p>
                        <p className="text-gray-700 text-[10px] mt-0.5">Accordé le {new Date(role.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      {role.user?.email !== ADMIN_EMAIL && (
                        <button onClick={() => revokeAdmin(role)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0">
                          <XCircle className="w-3.5 h-3.5" />Révoquer
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Promouvoir un utilisateur */}
            <div>
              <SectionHeader title="Promouvoir un utilisateur" />
              <p className="text-gray-600 text-xs mb-4">Cherchez un utilisateur dans l'onglet Utilisateurs et cliquez sur "Promouvoir admin".</p>
              <div className="space-y-2">
                {users.filter(u => u.email !== ADMIN_EMAIL && !adminRoles.find(r=>r.user_id===u.id && r.is_active)).slice(0,10).map(user => (
                  <div key={user.id} className="bg-[#0a0a18] rounded-2xl p-3.5 border border-white/[0.07] flex items-center gap-3 hover:border-white/[0.12] transition-all">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/[0.08]" />
                      : <div className="w-9 h-9 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0 text-gray-400 font-bold text-sm">{(user.username||'?')[0].toUpperCase()}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{user.username || '—'}</p>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>
                    <button onClick={() => grantAdmin(user)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" />Promouvoir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

=======
        <p className="text-center text-gray-400 mb-8">
          Panneau d'administration temporairement simplifié pour résoudre les erreurs de build.
        </p>
>>>>>>> 4f0155984be34a96acffcd4d806f341585483f2e
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
