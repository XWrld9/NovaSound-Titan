import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Flag, X, AlertTriangle, CheckCircle2, ShieldAlert, Info } from 'lucide-react';

const REASONS = [
  { value: 'spam',           label: '📢 Spam',                 desc: 'Publicité non sollicitée, contenu répétitif' },
  { value: 'inappropriate',  label: '🔞 Contenu inapproprié',  desc: 'Contenu choquant, haineux ou offensant' },
  { value: 'copyright',      label: '©️  Droits d\'auteur',     desc: 'Utilisation non autorisée d\'une œuvre' },
  { value: 'harassment',     label: '😡 Harcèlement',          desc: 'Intimidation, menaces, cyberharcèlement' },
  { value: 'misinformation', label: '🚫 Désinformation',       desc: 'Fausses informations trompeuses' },
  { value: 'other',          label: '💬 Autre',                desc: 'Autre raison non listée' },
];

const ReportButton = ({ contentType, contentId, onReported }) => {
  const [isOpen, setIsOpen]           = useState(false);
  const [step, setStep]               = useState('warn');  // 'warn' | 'form' | 'success'
  const [reason, setReason]           = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout                = useRef(null);
  const { currentUser }               = useAuth();

  // Tooltip au hover — afficher brièvement l'info
  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 400);
  };
  const handleMouseLeave = () => {
    clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };
  useEffect(() => () => clearTimeout(tooltipTimeout.current), []);

  const open  = () => { setStep('warn'); setReason(''); setDescription(''); setError(''); setIsOpen(true); };
  const close = () => setIsOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !reason) return;
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('report_content', {
        content_type_param: contentType,
        content_id_param:   contentId,
        reporter_id_param:  currentUser.id,
        reason_param:       reason,
        description_param:  description || null,
      });
      if (rpcError) throw rpcError;
      setStep('success');
      setTimeout(close, 2500);
      if (onReported) onReported();
    } catch {
      setError('Une erreur est survenue. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Bouton déclencheur avec tooltip ── */}
      <div className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <motion.button
          onClick={open}
          whileHover={{ scale: 1.15, rotate: -8 }}
          whileTap={{ scale: 0.9 }}
          className="group relative p-1.5 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
          aria-label="Signaler ce contenu"
        >
          <Flag className="w-4 h-4 group-hover:fill-red-400/20 transition-all" />
          <span className="absolute inset-0 rounded-lg bg-red-500/0 group-hover:bg-red-500/10 transition-all" />
        </motion.button>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full right-0 mb-2 w-52 z-50 pointer-events-none"
            >
              <div className="bg-gray-800 border border-red-500/30 rounded-xl px-3 py-2.5 shadow-lg shadow-black/40">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Signaler un contenu <span className="text-red-400 font-medium">abusif ou inapproprié.</span>
                    <br />
                    <span className="text-gray-500">Usage abusif sanctionné.</span>
                  </p>
                </div>
                {/* Flèche du tooltip */}
                <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-gray-800 border-r border-b border-red-500/30 rotate-45" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 w-full max-w-md pointer-events-auto overflow-hidden"
                onClick={e => e.stopPropagation()}
              >

                {/* ── ÉTAPE 1 : Avertissement ── */}
                {step === 'warn' && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
                          <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">Avant de signaler...</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Lis attentivement ce qui suit</p>
                        </div>
                      </div>
                      <button onClick={close} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Message d'avertissement */}
                    <div className="space-y-3 mb-6">
                      <div className="bg-red-950/40 border border-red-500/25 rounded-xl p-4">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          🚩 Le signalement sert à protéger la communauté contre les contenus <span className="text-red-300 font-medium">réellement abusifs</span> : spam, harcèlement, contenus illégaux ou choquants.
                        </p>
                      </div>

                      <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-amber-200/80 leading-relaxed">
                            <span className="font-semibold text-amber-300">Ne pas utiliser</span> pour exprimer un simple désaccord ou parce que le contenu ne te plaît pas. Les signalements abusifs sont tracés et peuvent entraîner une <span className="text-amber-300 font-medium">suspension de compte.</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-400 leading-relaxed">
                            Chaque signalement est examiné par notre équipe de modération. Merci d'aider à garder NovaSound sain ! 💪
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Boutons */}
                    <div className="flex gap-3">
                      <button
                        onClick={close}
                        className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all text-sm font-medium"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => setStep('form')}
                        className="flex-1 px-4 py-2.5 bg-red-500/90 hover:bg-red-500 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Flag className="w-4 h-4" />
                        Continuer quand même
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── ÉTAPE 2 : Formulaire ── */}
                {step === 'form' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {/* Header */}
                    <div className="relative bg-gradient-to-r from-red-950/60 to-gray-900 px-6 pt-5 pb-4 border-b border-red-500/20">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="flex items-start justify-between relative">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">Signaler ce contenu</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Ton signalement sera examiné par la modération</p>
                          </div>
                        </div>
                        <button onClick={close} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      {/* Raisons */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          Raison du signalement <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {REASONS.map((r) => (
                            <label
                              key={r.value}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                reason === r.value
                                  ? 'bg-red-500/15 border-red-500/50 text-white'
                                  : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                              }`}
                            >
                              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="sr-only" />
                              <div className="flex-1 min-w-0">
                                <span className="block text-sm font-medium">{r.label}</span>
                                <span className="block text-xs text-gray-500 mt-0.5">{r.desc}</span>
                              </div>
                              {reason === r.value && (
                                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Détails <span className="text-gray-500 font-normal">(optionnel)</span>
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Explique brièvement ce qui te dérange..."
                          rows={2}
                          maxLength={300}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 resize-none transition-all"
                        />
                        <p className="text-xs text-gray-600 mt-1 text-right">{description.length}/300</p>
                      </div>

                      {error && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                      )}

                      {!currentUser && (
                        <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          Connecte-toi pour pouvoir signaler du contenu.
                        </p>
                      )}

                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => setStep('warn')} className="px-4 py-2.5 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-600 transition-all text-sm">
                          ← Retour
                        </button>
                        <button
                          type="submit"
                          disabled={loading || !reason || !currentUser}
                          className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          {loading
                            ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Envoi...</>
                            : <><Flag className="w-4 h-4" /> Envoyer le signalement</>
                          }
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* ── ÉTAPE 3 : Succès ── */}
                {step === 'success' && (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                      className="p-4 rounded-full bg-green-500/20 border border-green-500/30 mb-4"
                    >
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-2">Signalement envoyé !</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Merci de contribuer à la sécurité de la communauté.<br />
                      Notre équipe va examiner ce contenu. 🛡️
                    </p>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ReportButton;
