/**
 * NovaSound TITAN LUX — i18n config v200000
 * Auto-détection de la langue du navigateur.
 * Langues supportées : fr · en · it · es · pt
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      it: { translation: it },
      es: { translation: es },
      pt: { translation: pt },
    },
    // Langue de repli si la langue détectée n'est pas supportée
    fallbackLng: 'fr',
    // Langues supportées
    supportedLngs: ['fr', 'en', 'it', 'es', 'pt'],
    // Options de détection
    detection: {
      // Ordre de détection : localStorage → navigator → htmlTag
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Stocker le choix dans localStorage
      caches: ['localStorage'],
      lookupLocalStorage: 'novasound_lang',
    },
    interpolation: {
      escapeValue: false, // React gère déjà l'échappement XSS
    },
    // Pas de suspense : afficher immédiatement avec la langue par défaut
    react: {
      useSuspense: false,
    },
  });

export default i18n;
