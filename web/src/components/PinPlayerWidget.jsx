/**
 * PinPlayerWidget — NovaSound TITAN LUX v1000
 *
 * Permet à l'utilisateur de "épingler" le lecteur sur son écran :
 *  1. Document Picture-in-Picture (Chrome 116+) → mini fenêtre flottante sur TOUS les sites
 *  2. PWA "Ajouter à l'écran d'accueil" → raccourci home screen natif
 *  3. Guide iOS (Partager → Sur l'écran d'accueil)
 *
 * Intégré dans le mode bulle minimisée du AudioPlayer.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X, Smartphone, MonitorSpeaker, Share, ArrowUp, Download, Check } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';

/* ── Détection ───────────────────────────────────────────────────── */
const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

const isMobileDevice = () => isIOS() || isAndroid() || window.innerWidth < 768;

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

/** Document Picture-in-Picture API (Chrome 116+, Edge 116+) */
const pipSupported = () =>
  typeof window !== 'undefined' && 'documentPictureInPicture' in window;

/* ══════════════════════════════════════════════════════════════════
   Composant principal
   ══════════════════════════════════════════════════════════════════ */
const PinPlayerWidget = ({ currentSong, isPlaying, onTogglePlay, onNext, onPrev, audioRef }) => {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [open,      setOpen]      = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [step,      setStep]      = useState('menu'); // 'menu' | 'ios' | 'android' | 'pip'
  const [done,      setDone]      = useState(false);
  const pipWindowRef = useRef(null);

  /* ── Fermer si song change ou player masqué ── */
  useEffect(() => { if (!currentSong) { setOpen(false); setPipActive(false); } }, [currentSong]);

  /* ── Fermer le PiP si on revient dans le tab ── */
  useEffect(() => {
    const onFocus = () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        // PiP toujours ouvert → OK
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /* ── Document Picture-in-Picture ──────────────────────────────── */
  const openPiP = useCallback(async () => {
    if (!pipSupported()) return;
    try {
      if (pipActive && pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        setPipActive(false);
        setOpen(false);
        return;
      }

      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 140,
        disallowReturnToOpener: false,
      });
      pipWindowRef.current = pipWin;
      setPipActive(true);
      setOpen(false);

      // Injecter les styles dans la fenêtre PiP
      const style = pipWin.document.createElement('style');
      style.textContent = `
        *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        body{background:#030712;color:#fff;height:100vh;display:flex;align-items:center;padding:12px;gap:12px;overflow:hidden}
        img{width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,.6)}
        .info{flex:1;min-width:0}
        .title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .artist{font-size:11px;color:#9ca3af;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .controls{display:flex;align-items:center;gap:8px;flex-shrink:0}
        button{background:none;border:none;cursor:pointer;color:#fff;padding:6px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .15s}
        button:hover{background:rgba(255,255,255,.12)}
        .play-btn{width:38px;height:38px;background:linear-gradient(135deg,#06b6d4,#8b5cf6)!important;border-radius:50%!important}
        .play-btn:hover{opacity:.85!important;background:linear-gradient(135deg,#06b6d4,#8b5cf6)!important}
        svg{display:block}
      `;
      pipWin.document.head.appendChild(style);

      const renderPiP = () => {
        if (!pipWin || pipWin.closed) return;
        const cover = currentSong?.cover_url || '';
        const title = currentSong?.title || 'En lecture';
        const artist = currentSong?.artist || '';
        pipWin.document.body.innerHTML = `
          ${cover ? `<img src="${cover}" alt="">` : `<div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);flex-shrink:0"></div>`}
          <div class="info">
            <div class="title">${title}</div>
            <div class="artist">${artist}</div>
          </div>
          <div class="controls">
            <button id="prev" title="Précédent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
            </button>
            <button id="play" class="play-btn" title="${isPlaying ? 'Pause' : 'Lecture'}">
              ${isPlaying
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
            </button>
            <button id="next" title="Suivant">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            </button>
          </div>
        `;
        // Bind controls
        pipWin.document.getElementById('play')?.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('novasound:toggle-play'));
        });
        pipWin.document.getElementById('next')?.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('novasound:pip-next'));
        });
        pipWin.document.getElementById('prev')?.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('novasound:pip-prev'));
        });
      };

      renderPiP();
      pipWin.addEventListener('pagehide', () => {
        setPipActive(false);
        pipWindowRef.current = null;
      });

      // Update PiP when song/state changes
      const observer = new MutationObserver(() => {});
      pipWin._novasoundUpdate = renderPiP;
      window._pipWindow = pipWin;

    } catch (err) {
      console.warn('[PiP] Erreur:', err);
    }
  }, [pipActive, currentSong, isPlaying]);

  /* ── Update PiP quand la chanson ou l'état change ── */
  useEffect(() => {
    if (window._pipWindow && !window._pipWindow.closed && window._pipWindow._novasoundUpdate) {
      window._pipWindow._novasoundUpdate();
    }
  }, [currentSong?.id, isPlaying]);

  /* ── Événements PiP next/prev → relayer au PlayerContext ── */
  useEffect(() => {
    const onNext = () => onNext?.();
    const onPrev = () => onPrev?.();
    window.addEventListener('novasound:pip-next', onNext);
    window.addEventListener('novasound:pip-prev', onPrev);
    return () => {
      window.removeEventListener('novasound:pip-next', onNext);
      window.removeEventListener('novasound:pip-prev', onPrev);
    };
  }, [onNext, onPrev]);

  /* ── Installer PWA ── */
  const handleInstall = useCallback(async () => {
    if (isIOS()) { setStep('ios'); return; }
    if (isAndroid() && canInstall) {
      const ok = await install();
      if (ok) { setDone(true); setTimeout(() => { setOpen(false); setDone(false); }, 2000); }
      return;
    }
    if (isAndroid()) { setStep('android'); return; }
    // Desktop
    if (canInstall) {
      const ok = await install();
      if (ok) { setDone(true); setTimeout(() => { setOpen(false); setDone(false); }, 2000); }
    }
  }, [canInstall, install]);

  if (!currentSong) return null;

  const showPiP = pipSupported() && !isMobileDevice();
  const showInstall = !isInstalled && (canInstall || isIOS() || isAndroid());

  if (!showPiP && !showInstall) return null;

  return (
    <>
      {/* Bouton "Pin" principal */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => { setOpen(v => !v); setStep('menu'); }}
        onPointerDown={e => e.stopPropagation()}
        title="Épingler le lecteur"
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          pipActive || open
            ? 'bg-cyan-500/30 border border-cyan-500/60 text-cyan-400'
            : 'bg-black/60 border border-white/10 text-gray-400 hover:text-white hover:border-white/25'
        }`}
      >
        <Pin className="w-3.5 h-3.5" />
      </motion.button>

      {/* Menu épinglage */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-20 right-2 z-50 w-72 bg-gray-950 border border-white/12 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-bold text-sm">Épingler le lecteur</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-500 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenu selon étape */}
            {step === 'menu' && (
              <div className="p-3 flex flex-col gap-2">
                {/* Option PiP — Desktop seulement */}
                {showPiP && (
                  <button
                    onClick={openPiP}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.05] border border-white/[0.06] text-left transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                      <MonitorSpeaker className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">
                        {pipActive ? 'Fermer la fenêtre flottante' : 'Fenêtre flottante'}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {pipActive ? 'Le lecteur est épinglé' : 'Reste visible sur tous les onglets'}
                      </p>
                    </div>
                    {pipActive && <Check className="w-4 h-4 text-cyan-400 ml-auto flex-shrink-0" />}
                  </button>
                )}

                {/* Option PWA */}
                {showInstall && (
                  <button
                    onClick={handleInstall}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.05] border border-white/[0.06] text-left transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">
                        {done ? '✅ Installé !' : "Ajouter à l'écran d'accueil"}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">Contrôles natifs depuis l'écran</p>
                    </div>
                    {done && <Check className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
                  </button>
                )}

                {/* Note Media Session */}
                <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-gray-500 text-xs leading-relaxed">
                    💡 Les <span className="text-gray-300">contrôles de la barre de notification</span> et de l'écran de verrouillage sont automatiquement actifs pendant la lecture.
                  </p>
                </div>
              </div>
            )}

            {/* Guide iOS */}
            {step === 'ios' && (
              <div className="p-4">
                <p className="text-white font-semibold text-sm mb-3">Guide iOS (Safari)</p>
                <div className="flex flex-col gap-2">
                  {[
                    { n: 1, icon: Share, text: 'Appuie sur le bouton Partager ⬆️ en bas de Safari' },
                    { n: 2, icon: ArrowUp, text: "Fais défiler et appuie sur « Sur l'écran d'accueil »" },
                    { n: 3, icon: Download, text: 'Appuie sur « Ajouter » en haut à droite' },
                  ].map(({ n, icon: Icon, text }) => (
                    <div key={n} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                      <p className="text-gray-300 text-xs leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-[10px] mt-3 leading-relaxed">
                  ⚠️ Doit être fait depuis <strong className="text-gray-400">Safari</strong> — les autres navigateurs iOS ne supportent pas cette fonction.
                </p>
                <button onClick={() => setStep('menu')} className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors text-center">← Retour</button>
              </div>
            )}

            {/* Guide Android manuel */}
            {step === 'android' && (
              <div className="p-4">
                <p className="text-white font-semibold text-sm mb-3">Guide Android (Chrome)</p>
                <div className="flex flex-col gap-2">
                  {[
                    { n: 1, text: 'Appuie sur le menu ⋮ en haut à droite de Chrome' },
                    { n: 2, text: "Sélectionne « Ajouter à l'écran d'accueil »" },
                    { n: 3, text: "Confirme en appuyant sur « Ajouter »" },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
                      <p className="text-gray-300 text-xs leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep('menu')} className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors text-center">← Retour</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PinPlayerWidget;
