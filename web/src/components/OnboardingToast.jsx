/**
 * OnboardingToast — NovaSound TITAN LUX v30
 * Guide d'onboarding pour les nouvelles inscriptions.
 * Apparaît 1 seule fois après la première connexion (stocké localStorage).
 * 4 étapes : Écouter / Explorer / Uploader / Profil
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Search, Upload, User, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    icon: Play,
    color: '#06b6d4',
    title: 'Bienvenue sur NovaSound ! 🎵',
    description: 'Clique sur n\'importe quelle pochette pour lancer la lecture. Le player apparaît en bas de l\'écran.',
    action: null,
    actionLabel: null,
  },
  {
    icon: Search,
    color: '#8b5cf6',
    title: 'Explore la bibliothèque',
    description: 'Filtre par genre, trie par popularité et découvre les sons de la communauté.',
    action: '/explorer',
    actionLabel: 'Explorer →',
  },
  {
    icon: Upload,
    color: '#ec4899',
    title: 'Partage ta musique',
    description: 'Tu es artiste ? Upload tes sons en 2 minutes. MP3, WAV jusqu\'à 50 Mo.',
    action: '/upload',
    actionLabel: 'Uploader →',
  },
  {
    icon: User,
    color: '#f59e0b',
    title: 'Personalise ton profil',
    description: 'Ajoute une photo, une bio et commence à suivre tes artistes préférés.',
    action: '/profile',
    actionLabel: 'Mon profil →',
  },
];

const OnboardingToast = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const key = `novasound.onboarding.${currentUser.id}`;
    try {
      const done = localStorage.getItem(key);
      if (!done) {
        // Délai pour ne pas apparaître immédiatement
        const t = setTimeout(() => setVisible(true), 1800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [isAuthenticated, currentUser]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(`novasound.onboarding.${currentUser?.id}`, '1');
    } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const handleAction = (action) => {
    if (action) navigate(action);
    next();
  };

  if (!visible) return null;

  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <AnimatePresence>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="fixed bottom-28 md:bottom-24 right-4 z-[70] w-72 bg-gray-900/98 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-sm overflow-hidden"
      >
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: s.color }} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="p-2 rounded-xl flex-shrink-0" style={{ background: `${s.color}18` }}>
              <Icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <button onClick={dismiss} className="p-1 text-gray-600 hover:text-white transition-colors rounded-lg hover:bg-white/8 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h4 className="text-white font-bold text-sm mb-1">{s.title}</h4>
          <p className="text-gray-400 text-xs leading-relaxed">{s.description}</p>

          <div className="flex items-center justify-between mt-4">
            {/* Dots */}
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className="rounded-full transition-all"
                  style={{
                    width: i === step ? 14 : 5,
                    height: 5,
                    background: i === step ? s.color : 'rgba(255,255,255,0.15)',
                  }} />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {s.action && (
                <button
                  onClick={() => handleAction(s.action)}
                  className="text-xs font-semibold transition-colors"
                  style={{ color: s.color }}
                >
                  {s.actionLabel}
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                {step < STEPS.length - 1 ? (
                  <><ChevronRight className="w-3.5 h-3.5" />Suivant</>
                ) : (
                  'Terminer'
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingToast;
