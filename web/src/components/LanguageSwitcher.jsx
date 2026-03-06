/**
 * LanguageSwitcher — NovaSound TITAN LUX v410000
 * Modes : 'dropdown' | 'inline' | 'compact' | 'grid'
 * Sync avec Supabase preferred_lang (optionnel, non-bloquant)
 */
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

const LanguageSwitcher = ({ mode = 'dropdown', compact = false, inline = false }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === (i18n.language || 'fr').slice(0, 2)) || LANGUAGES[0];

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

  // ── Mode grid : grille 2×3 compacte (mobile drawer footer) ──
  if (mode === 'grid') {
    return (
      <div>
        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Globe className="w-3 h-3" />{t('language.select')}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => changeLang(lang.code)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-[11px] font-medium transition-all border ${
                currentLang.code === lang.code
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'border-white/[0.07] text-gray-500 hover:border-white/20 hover:text-gray-300'
              }`}>
              <span className="text-lg leading-none">{lang.flag}</span>
              <span className="truncate w-full text-center">{lang.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Mode inline : liste horizontale (mobile menu) ──
  if (mode === 'inline' || inline) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => changeLang(lang.code)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              currentLang.code === lang.code
                ? 'bg-cyan-500/20 border-cyan-500/35 text-cyan-300'
                : 'border-white/[0.08] text-gray-500 hover:border-white/20 hover:text-gray-300'
            }`}>
            <span className="text-sm leading-none">{lang.flag}</span>
            <span>{lang.label}</span>
            {currentLang.code === lang.code && <Check className="w-3 h-3 text-cyan-400" />}
          </button>
        ))}
      </div>
    );
  }

  // ── Mode compact : icon seul dans un dropdown (dropdown header) ──
  if (mode === 'compact' || compact) {
    return (
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(v => !v)} title={t('language.select')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium ${
            open ? 'text-cyan-300' : 'text-gray-500 hover:text-gray-300'
          }`}>
          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('language.select')}</span>
          <span className="text-sm leading-none ml-1">{currentLang.flag}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-[300] bg-gray-900 border border-white/10 rounded-xl shadow-2xl p-1 w-40">
              {LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => changeLang(lang.code)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    currentLang.code === lang.code ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                  }`}>
                  <span className="text-sm leading-none">{lang.flag}</span>
                  <span className="flex-1 text-left font-medium">{lang.label}</span>
                  {currentLang.code === lang.code && <Check className="w-3 h-3 text-cyan-400" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Default dropdown ──
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} title={t('language.select')}
        className={`flex items-center gap-1.5 rounded-full border transition-all px-2.5 py-1.5 ${
          open ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-transparent border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300'
        }`}>
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">{currentLang.code}</span>
        <span className="text-sm leading-none">{currentLang.flag}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-[300] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-1.5 w-44">
            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider px-2.5 py-1">
              {t('language.select')}
            </p>
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => changeLang(lang.code)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                  currentLang.code === lang.code ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                }`}>
                <span className="text-base leading-none w-5 flex-shrink-0">{lang.flag}</span>
                <span className="flex-1 text-left font-medium">{lang.label}</span>
                {currentLang.code === lang.code && <Check className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
