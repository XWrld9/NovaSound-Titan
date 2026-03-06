import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail, Music, Heart, X, ExternalLink, Smartphone, Globe, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Modal soutien discret ───────────────────────────────────────────────────────
const SupportModal = ({ onClose }) => (
  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
    className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    onClick={e => e.target === e.currentTarget && onClose()}>
    <motion.div initial={{ y:40, scale:.97 }} animate={{ y:0, scale:1 }} exit={{ y:40, opacity:0 }}
      className="w-full max-w-sm rounded-3xl overflow-hidden"
      style={{ background:'linear-gradient(145deg,#0a0a1a,#0f0f22)', border:'1px solid rgba(255,255,255,0.08)' }}>

      {/* Header */}
      <div className="relative px-6 pt-6 pb-4" style={{ background:'linear-gradient(135deg,rgba(6,182,212,0.1),rgba(124,58,237,0.08))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-base leading-tight">Soutenir NovaSound</h3>
              <p className="text-gray-500 text-xs">Un geste compte, merci 🙏</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-3 pt-2">
        <p className="text-gray-400 text-sm leading-relaxed">
          NovaSound est un projet indépendant, développé avec passion. Si la plateforme te plaît, tu peux soutenir son développement.
        </p>

        {/* PayPal */}
        <a href="https://paypal.me/tetangtanekoumorel" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.02] group"
          style={{ background:'rgba(0,112,243,0.12)', border:'1px solid rgba(0,112,243,0.25)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#003087,#009cde)' }}>
            <span className="text-white font-black text-sm">PP</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">PayPal</p>
            <p className="text-blue-400/70 text-xs truncate">Paiement sécurisé international</p>
          </div>
          <ExternalLink className="w-4 h-4 text-blue-400/50 group-hover:text-blue-400 transition-colors" />
        </a>

        {/* Orange Money */}
        <div className="flex items-center gap-4 p-4 rounded-2xl"
          style={{ background:'rgba(255,100,0,0.1)', border:'1px solid rgba(255,100,0,0.2)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#ff6400,#ff8c00)' }}>
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Orange Money</p>
            <p className="text-orange-400/70 text-xs font-mono">+237 658 165 505</p>
          </div>
          <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full font-bold">CM</span>
        </div>

        <p className="text-center text-gray-700 text-[11px] pt-1">Toute contribution, même modeste, est précieuse ❤️</p>
      </div>
    </motion.div>
  </motion.div>
);

// ── À propos modal ──────────────────────────────────────────────────────────────
const AboutModal = ({ onClose }) => (
  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
    className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    onClick={e => e.target === e.currentTarget && onClose()}>
    <motion.div initial={{ y:40, scale:.97 }} animate={{ y:0, scale:1 }} exit={{ y:40, opacity:0 }}
      className="w-full max-w-md rounded-3xl overflow-hidden"
      style={{ background:'linear-gradient(145deg,#0a0a1a,#0f0f22)', border:'1px solid rgba(255,255,255,0.08)' }}>

      <div className="relative px-6 pt-6 pb-4" style={{ background:'linear-gradient(135deg,rgba(6,182,212,0.1),rgba(124,58,237,0.08))' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png"
              alt="Logo" className="w-10 h-10 rounded-2xl border border-cyan-400/30 object-cover" />
            <div>
              <h3 className="text-white font-black text-base leading-tight">NovaSound TITAN LUX</h3>
              <p className="text-cyan-400/70 text-xs">v300.0.0 — 2026</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4 pt-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-white">NovaSound TITAN LUX</strong> est une plateforme musicale nouvelle génération conçue pour streamer, partager et découvrir de la musique — même hors-ligne.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label:'Streaming',    val:'Haute qualité' },
            { label:'Hors-ligne',   val:'Lecteur local' },
            { label:'Live rooms',   val:'Temps réel' },
            { label:'Communauté',   val:'Chat & partage' },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white/[0.04] rounded-xl px-3 py-2.5 border border-white/[0.06]">
              <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider">{label}</p>
              <p className="text-white text-xs font-bold mt-0.5">{val}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/[0.06] space-y-2">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Créateur</p>
          <div className="flex items-center gap-3">
            <img src="/logo_eloadxfamily.png"
              alt="Logo ELOADXFAMILY" className="w-9 h-9 rounded-full border border-cyan-400/30 object-cover" />
            <div>
              <p className="text-white text-sm font-bold">ELOADXFAMILY</p>
              <p className="text-gray-600 text-xs">Développeur & fondateur</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-700">© 2026 NovaSound TITAN LUX</span>
          <div className="flex gap-3">
            <Link to="/privacy" onClick={onClose} className="text-gray-600 hover:text-cyan-400 transition-colors">Confidentialité</Link>
            <Link to="/terms"   onClick={onClose} className="text-gray-600 hover:text-cyan-400 transition-colors">CGU</Link>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ══════════════════════════════════════════════════════════════════════════════
const Footer = () => {
  const { t } = useTranslation();
  const [showSupport, setShowSupport] = useState(false);
  const [showAbout,   setShowAbout]   = useState(false);

  return (
    <>
      <footer className="bg-gray-950 border-t border-white/[0.06] mt-auto relative overflow-hidden">
        {/* Glow bg */}
        <div className="absolute top-0 left-1/4 w-96 h-48 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-48 bg-fuchsia-500/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-5 py-10 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">

            {/* ── Brand ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col items-center md:items-start space-y-3 sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <img src="/icon-512.png"
                  alt="Logo NovaSound" className="w-9 h-9 rounded-xl border border-cyan-400/30 object-cover" />
                <span className="text-base font-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
                  NovaSound TITAN LUX
                </span>
              </div>
              <p className="text-gray-500 text-xs max-w-xs leading-relaxed text-center md:text-left">
                La plateforme musicale nouvelle génération. Streamez, uploadez et connectez-vous avec des artistes du monde entier.
              </p>
              {/* Soutenir — bouton discret */}
              <button onClick={() => setShowSupport(true)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-pink-400 transition-colors group">
                <Heart className="w-3.5 h-3.5 group-hover:fill-pink-400 transition-all" />
                <span>Soutenir le projet</span>
              </button>
            </div>

            {/* ── Découvrir ──────────────────────────────────────────────────── */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-white font-bold text-sm mb-4 relative">
                Découvrir
                <span className="absolute -bottom-1 left-0 right-0 md:right-auto h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
              </h3>
              <ul className="space-y-2.5">
                {[
                  { to:'/explorer', label:'Explorer' },
                  { to:'/trending', label:'Tendances' },
                  { to:'/news',     label:'Actualités' },
                  { to:'/upload',   label:'Uploader' },
                  { to:'/local-player', label:'Lecteur hors-ligne' },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-gray-500 hover:text-cyan-400 transition-colors text-xs">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── À propos & Légal ───────────────────────────────────────────── */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-white font-bold text-sm mb-4 relative">
                À propos
                <span className="absolute -bottom-1 left-0 right-0 md:right-auto h-px bg-gradient-to-r from-fuchsia-500/50 to-transparent" />
              </h3>
              <ul className="space-y-2.5">
                <li>
                  <button onClick={() => setShowAbout(true)} className="text-gray-500 hover:text-fuchsia-400 transition-colors text-xs flex items-center gap-1.5">
                    <Info className="w-3 h-3" />NovaSound TITAN LUX
                  </button>
                </li>
                {[
                  { to:'/privacy',   label:'Confidentialité' },
                  { to:'/terms',     label:"Conditions d'utilisation" },
                  { to:'/copyright', label:"Droits d'auteur" },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-gray-500 hover:text-fuchsia-400 transition-colors text-xs">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Contact ────────────────────────────────────────────────────── */}
            <div className="flex flex-col items-center md:items-start">
              <h3 className="text-white font-bold text-sm mb-4 relative">
                Contact
                <span className="absolute -bottom-1 left-0 right-0 md:right-auto h-px bg-gradient-to-r from-purple-500/50 to-transparent" />
              </h3>
              <div className="space-y-3 w-full">
                <a href="mailto:eloadxfamily@gmail.com"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all group text-xs w-full">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">eloadxfamily@gmail.com</span>
                </a>
                <button onClick={() => setShowSupport(true)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full transition-all group text-xs"
                  style={{ background:'linear-gradient(135deg,rgba(6,182,212,0.08),rgba(124,58,237,0.08))', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <Heart className="w-4 h-4 text-pink-400 group-hover:fill-pink-400 transition-all flex-shrink-0" />
                  <span className="text-gray-400 group-hover:text-white transition-colors">Faire un don</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Bottom bar ──────────────────────────────────────────────────── */}
          <div className="border-t border-white/[0.05] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-gray-700 text-xs font-mono">
              © 2026 <span className="text-gray-600">NovaSound TITAN LUX</span> — ELOADXFAMILY · v300.0.0
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowAbout(true)} className="text-gray-700 hover:text-gray-500 text-xs transition-colors flex items-center gap-1">
                <Globe className="w-3 h-3" />À propos
              </button>
              <span className="text-gray-800">·</span>
              <button onClick={() => setShowSupport(true)} className="text-gray-700 hover:text-pink-400 text-xs transition-colors flex items-center gap-1">
                <Heart className="w-3 h-3" />Soutenir
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}
        {showAbout   && <AboutModal   onClose={() => setShowAbout(false)} />}
      </AnimatePresence>
    </>
  );
};

export default Footer;
