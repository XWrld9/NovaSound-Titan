/**
 * LanguageSwitcher — NovaSound TITAN LUX v200000
 * Bouton discret de changement de langue.
 * Se place dans le Header, dropdown avec drapeau + nom.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
];

const LanguageSwitcher = ({ compact = false }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language?.slice(0, 2))
    || LANGUAGES[0];

  // Fermer si clic en dehors
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bouton principal */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Changer de langue / Change language"
        className={`flex items-center gap-1.5 rounded-full border transition-all
          ${open
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
            : 'bg-transparent border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300'
          }
          ${compact ? 'p-1.5' : 'px-2.5 py-1.5'}
        `}
      >
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        {!compact && (
          <span className="text-xs font-semibold uppercase tracking-wide">
            {currentLang.code}
          </span>
        )}
        <span className="text-sm leading-none">{currentLang.flag}</span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-[200] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-1.5 w-40 overflow-hidden"
          >
            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider px-2.5 py-1">
              Langue / Language
            </p>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => changeLang(lang.code)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors
                  ${currentLang.code === lang.code
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
              >
                <span className="text-base leading-none w-5 flex-shrink-0">{lang.flag}</span>
                <span className="flex-1 text-left font-medium">{lang.label}</span>
                {currentLang.code === lang.code && (
                  <Check className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
