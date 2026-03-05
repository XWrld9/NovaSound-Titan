/**
 * LangToggle — NovaSound TITAN LUX V200000
 * Bouton globe discret pour basculer FR ↔ EN
 * Apparaît en overlay discret — utilisé dans les pages sans Header (login, signup, etc.)
 */
import React from 'react';
import { Globe2 } from 'lucide-react';
import { useLang } from '@/contexts/LangContext';

const LangToggle = ({ className = '' }) => {
  const { lang, toggleLang } = useLang();
  return (
    <button
      onClick={toggleLang}
      title={lang === 'fr' ? 'Switch to English' : 'Passer en Français'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs ${className}`}
    >
      <Globe2 size={13} />
      <span>{lang === 'fr' ? 'EN' : 'FR'}</span>
    </button>
  );
};

export default LangToggle;
