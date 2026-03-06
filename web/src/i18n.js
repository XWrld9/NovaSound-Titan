/**
 * NovaSound TITAN LUX — i18n config v410000
 * Auto-détection de la langue du navigateur.
 * Langues supportées : fr · en · it · es · pt
 * 
 * v410000 — Dynamic overrides loading from Supabase (non-blocking)
 *           Admins can update translations via i18n_overrides table
 *           without redeployment.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

// ── Static initialization (instant, blocking) ──────────────────────────────
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
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'it', 'es', 'pt'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'novasound_lang',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// ── Dynamic overrides from Supabase (non-blocking, best-effort) ─────────────
// Called after init so the app renders immediately with static translations.
// Overrides are merged in silently — UI updates reactively via i18next events.
async function loadDynamicOverrides() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const activeLang = (i18n.language || 'fr').slice(0, 2);
    const cacheKey = `novasound_i18n_cache_${activeLang}`;
    const cacheTs  = `novasound_i18n_cache_ts_${activeLang}`;
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

    // Use cached overrides if fresh
    const cached = localStorage.getItem(cacheKey);
    const cachedAt = parseInt(localStorage.getItem(cacheTs) || '0', 10);
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
      applyOverrides(activeLang, JSON.parse(cached));
      return;
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_i18n_overrides`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ p_lang: activeLang }),
      }
    );

    if (!res.ok) return;
    const rows = await res.json(); // [{ key, value }, ...]
    if (!Array.isArray(rows) || rows.length === 0) return;

    // Build overrides map
    const overrides = {};
    rows.forEach(({ key, value }) => {
      // Support dot notation keys: "localPlayer.dragDrop" → { localPlayer: { dragDrop: ... } }
      const parts = key.split('.');
      let obj = overrides;
      parts.forEach((p, i) => {
        if (i === parts.length - 1) obj[p] = value;
        else { obj[p] = obj[p] || {}; obj = obj[p]; }
      });
    });

    // Cache for next 10 minutes
    localStorage.setItem(cacheKey, JSON.stringify(overrides));
    localStorage.setItem(cacheTs, String(Date.now()));

    applyOverrides(activeLang, overrides);
  } catch {
    // Silent fail — static translations always available
  }
}

function applyOverrides(lang, overrides) {
  i18n.addResourceBundle(lang, 'translation', overrides, true, true);
}

// Fire & forget — does not block app startup
loadDynamicOverrides();

export default i18n;
