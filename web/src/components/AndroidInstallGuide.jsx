/**
 * AndroidInstallGuide — NovaSound TITAN LUX v6000
 * Guide d'installation Android : choix entre APK natif ou PWA écran d'accueil.
 * Instructions ultra-simples, adaptées même aux enfants.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Smartphone, Plus, Check, X, ChevronRight,
  Package, Globe, ArrowRight, Star, Wifi, Bell, Zap
} from 'lucide-react';

const AndroidInstallGuide = ({ onClose }) => {
  const [choice, setChoice] = useState(null); // null | 'apk' | 'pwa'
  const [apkStep, setApkStep] = useState(0);
  const [pwaStep, setPwaStep] = useState(0);
  const [apkDone, setApkDone] = useState(false);
  const [pwaDone, setPwaDone] = useState(false);

  const apkSteps = [
    {
      emoji: '📥',
      title: 'Télécharge le fichier',
      desc: 'Appuie sur le bouton orange ci-dessous. Le fichier NovaSound.apk va se télécharger.',
      action: true,
      actionLabel: '📥 Télécharger NovaSound.apk',
      actionColor: 'from-orange-500 to-amber-500',
    },
    {
      emoji: '🔔',
      title: 'Ouvre le fichier téléchargé',
      desc: 'Une notification apparaît en haut de ton téléphone. Appuie dessus pour l\'ouvrir. Ou va dans tes "Téléchargements" et appuie sur le fichier.',
      hint: '💡 Si Android demande "Autoriser depuis cette source" → Appuie sur OK ou Autoriser.',
    },
    {
      emoji: '📲',
      title: 'Installe l\'application',
      desc: 'Un écran s\'affiche. Appuie sur "INSTALLER" en bas à droite. Attends quelques secondes…',
    },
    {
      emoji: '🎉',
      title: 'C\'est installé !',
      desc: 'NovaSound apparaît sur ton écran d\'accueil comme une vraie appli. Appuie dessus pour l\'ouvrir !',
      done: true,
    },
  ];

  const pwaSteps = [
    {
      emoji: '🌐',
      title: 'Ouvre Chrome sur ton téléphone',
      desc: 'Assure-toi d\'utiliser le navigateur Chrome (le cercle coloré rouge/jaune/vert/bleu).',
      hint: '💡 Si tu n\'as pas Chrome, télécharge-le gratuitement depuis le Play Store.',
    },
    {
      emoji: '⋮',
      title: 'Appuie sur les 3 points en haut à droite',
      desc: 'En haut à droite de Chrome, tu vois 3 petits points ( ⋮ ). Appuie dessus !',
    },
    {
      emoji: '➕',
      title: 'Choisis "Ajouter à l\'écran d\'accueil"',
      desc: 'Dans le menu qui s\'ouvre, cherche "Ajouter à l\'écran d\'accueil" ou "Installer l\'appli". Appuie dessus !',
    },
    {
      emoji: '✅',
      title: 'Confirme l\'ajout',
      desc: 'Une petite fenêtre apparaît. Appuie sur "AJOUTER" ou "INSTALLER". C\'est tout !',
      done: true,
    },
  ];

  const currentSteps = choice === 'apk' ? apkSteps : pwaSteps;
  const currentStep = choice === 'apk' ? apkStep : pwaStep;
  const isDone = choice === 'apk' ? apkDone : pwaDone;

  const handleNext = () => {
    if (choice === 'apk') {
      if (apkStep < apkSteps.length - 1) setApkStep(s => s + 1);
      else setApkDone(true);
    } else {
      if (pwaStep < pwaSteps.length - 1) setPwaStep(s => s + 1);
      else setPwaDone(true);
    }
  };

  const handleBack = () => {
    if (choice === 'apk') {
      if (apkStep > 0) setApkStep(s => s - 1);
      else setChoice(null);
    } else {
      if (pwaStep > 0) setPwaStep(s => s - 1);
      else setChoice(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="w-full max-w-sm bg-gray-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="NovaSound" className="w-10 h-10 rounded-2xl" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">NovaSound TITAN LUX</p>
              <p className="text-gray-400 text-xs">Installation sur Android</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">

            {/* ── Choix initial ── */}
            {!choice && (
              <motion.div key="choice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-white font-bold text-lg mb-1">Comment veux-tu installer ?</p>
                <p className="text-gray-400 text-sm mb-5">Choisis la méthode qui te convient le mieux 👇</p>

                {/* Option APK */}
                <button
                  onClick={() => setChoice('apk')}
                  className="w-full mb-3 p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/15 border border-orange-500/30 hover:border-orange-400/60 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm flex items-center gap-2">
                        📦 Télécharger l'appli (.apk)
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Recommandé</span>
                      </p>
                      <p className="text-gray-400 text-xs mt-1">Installe NovaSound comme une vraie application Android. Fonctionne hors-ligne !</p>
                      <div className="flex gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-green-400"><Check className="w-2.5 h-2.5" />Notifications push</span>
                        <span className="flex items-center gap-1 text-[10px] text-green-400"><Check className="w-2.5 h-2.5" />Mode hors-ligne</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>

                {/* Option PWA */}
                <button
                  onClick={() => setChoice('pwa')}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/25 hover:border-cyan-400/50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">🌐 Ajouter à l'écran d'accueil</p>
                      <p className="text-gray-400 text-xs mt-1">Crée un raccourci depuis Chrome. Rapide et sans téléchargement !</p>
                      <div className="flex gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400"><Check className="w-2.5 h-2.5" />Zéro espace disque</span>
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400"><Check className="w-2.5 h-2.5" />Super rapide</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
              </motion.div>
            )}

            {/* ── Étapes ── */}
            {choice && !isDone && (
              <motion.div key={`step-${choice}-${currentStep}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 mb-5">
                  {currentSteps.map((_, i) => (
                    <div key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === currentStep ? 'w-4 h-2 bg-cyan-400' : i < currentStep ? 'w-2 h-2 bg-cyan-600' : 'w-2 h-2 bg-gray-700'
                      }`}
                    />
                  ))}
                </div>

                {/* Step card */}
                <div className="text-center mb-5">
                  <div className="text-5xl mb-3">{currentSteps[currentStep].emoji}</div>
                  <p className="text-white font-bold text-lg mb-2">{currentSteps[currentStep].title}</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{currentSteps[currentStep].desc}</p>
                  {currentSteps[currentStep].hint && (
                    <p className="mt-3 text-xs text-amber-400/90 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2 leading-relaxed">
                      {currentSteps[currentStep].hint}
                    </p>
                  )}
                </div>

                {/* APK download button sur step 0 */}
                {choice === 'apk' && currentStep === 0 && (
                  <a
                    href="/NovaSound-TITAN-LUX.apk"
                    download="NovaSound-TITAN-LUX.apk"
                    onClick={handleNext}
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400 transition-all active:scale-95 mb-3"
                  >
                    <Download className="w-4 h-4" />
                    📥 Télécharger NovaSound.apk
                  </a>
                )}

                {/* Navigation */}
                <div className="flex gap-2">
                  <button
                    onClick={handleBack}
                    className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    ← Retour
                  </button>
                  {!(choice === 'apk' && currentStep === 0) && (
                    <button
                      onClick={handleNext}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-md hover:from-cyan-400 hover:to-blue-400 transition-all active:scale-95"
                    >
                      {currentStep === currentSteps.length - 1 ? 'Terminé ! 🎉' : 'Étape suivante →'}
                    </button>
                  )}
                </div>

                <p className="text-center text-xs text-gray-600 mt-3">
                  Étape {currentStep + 1} sur {currentSteps.length}
                </p>
              </motion.div>
            )}

            {/* ── Succès ── */}
            {isDone && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, delay: 0.1 }}
                  className="text-6xl mb-4"
                >
                  🎉
                </motion.div>
                <p className="text-white font-bold text-xl mb-2">Félicitations !</p>
                <p className="text-gray-400 text-sm mb-6">
                  {choice === 'apk'
                    ? 'NovaSound TITAN LUX est maintenant installé sur ton téléphone !'
                    : 'NovaSound est maintenant sur ton écran d\'accueil !'}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { icon: <Bell className="w-4 h-4" />, label: 'Notifications' },
                    { icon: <Zap className="w-4 h-4" />, label: 'Ultra rapide' },
                    { icon: <Star className="w-4 h-4" />, label: 'Hors-ligne' },
                  ].map((f, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-2 text-center">
                      <div className="text-cyan-400 flex justify-center mb-1">{f.icon}</div>
                      <p className="text-gray-400 text-[10px]">{f.label}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-bold text-sm shadow-lg"
                >
                  Parfait, allons écouter de la musique ! 🎵
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AndroidInstallGuide;
