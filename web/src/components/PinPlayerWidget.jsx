/**
 * PinPlayerWidget — NovaSound TITAN LUX v2000
 * Mobile  → Widget écran d'accueil + contrôles notification
 * Desktop → Document Picture-in-Picture
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X, Smartphone, MonitorSpeaker, Share, ArrowUp, Download, Check, Bell, LayoutGrid } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';

const isIOS     = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
const isMobile  = () => typeof window !== 'undefined' && (isIOS() || isAndroid() || window.innerWidth < 768);
const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;

const PinPlayerWidget = ({ currentSong, isPlaying, onTogglePlay, onNext, onPrev }) => {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [open,      setOpen]      = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [step,      setStep]      = useState('menu');
  const [done,      setDone]      = useState(false);
  const pipWindowRef = useRef(null);

  useEffect(() => { if (!currentSong) { setOpen(false); setPipActive(false); } }, [currentSong]);

  /* PiP desktop */
  const openPiP = useCallback(async () => {
    if (!pipSupported()) return;
    try {
      if (pipActive && pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close(); setPipActive(false); setOpen(false); return;
      }
      const pipWin = await window.documentPictureInPicture.requestWindow({ width: 320, height: 140, disallowReturnToOpener: false });
      pipWindowRef.current = pipWin; setPipActive(true); setOpen(false);
      const style = pipWin.document.createElement('style');
      style.textContent = `*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,sans-serif}body{background:#030712;color:#fff;height:100vh;display:flex;align-items:center;padding:12px;gap:12px;overflow:hidden}img{width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0}.info{flex:1;min-width:0}.title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:11px;color:#9ca3af;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.controls{display:flex;align-items:center;gap:8px;flex-shrink:0}button{background:none;border:none;cursor:pointer;color:#fff;padding:6px;border-radius:50%;display:flex;align-items:center;justify-content:center}.play-btn{width:38px;height:38px;background:linear-gradient(135deg,#06b6d4,#8b5cf6)!important;border-radius:50%!important}`;
      pipWin.document.head.appendChild(style);
      const renderPiP = () => {
        if (!pipWin || pipWin.closed) return;
        pipWin.document.body.innerHTML = `
          ${currentSong?.cover_url ? `<img src="${currentSong.cover_url}" alt="">` : `<div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);flex-shrink:0"></div>`}
          <div class="info"><div class="title">${currentSong?.title||'En lecture'}</div><div class="artist">${currentSong?.artist||''}</div></div>
          <div class="controls">
            <button id="prev"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg></button>
            <button id="play" class="play-btn">${isPlaying?`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}</button>
            <button id="next"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg></button>
          </div>`;
        pipWin.document.getElementById('play')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('novasound:toggle-play')));
        pipWin.document.getElementById('next')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('novasound:pip-next')));
        pipWin.document.getElementById('prev')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('novasound:pip-prev')));
      };
      renderPiP();
      pipWin.addEventListener('pagehide', () => { setPipActive(false); pipWindowRef.current = null; });
      pipWin._novasoundUpdate = renderPiP;
      window._pipWindow = pipWin;
    } catch (err) { console.warn('[PiP]', err); }
  }, [pipActive, currentSong, isPlaying]);

  useEffect(() => {
    if (window._pipWindow && !window._pipWindow.closed && window._pipWindow._novasoundUpdate)
      window._pipWindow._novasoundUpdate();
  }, [currentSong?.id, isPlaying]);

  useEffect(() => {
    const nxt = () => onNext?.(); const prv = () => onPrev?.();
    window.addEventListener('novasound:pip-next', nxt);
    window.addEventListener('novasound:pip-prev', prv);
    return () => { window.removeEventListener('novasound:pip-next', nxt); window.removeEventListener('novasound:pip-prev', prv); };
  }, [onNext, onPrev]);

  const handleInstall = useCallback(async () => {
    if (isIOS()) { setStep('ios'); return; }
    if (isAndroid() && !canInstall) { setStep('android'); return; }
    if (canInstall) {
      const ok = await install();
      if (ok) { setDone(true); setTimeout(() => { setOpen(false); setDone(false); setStep('menu'); }, 2500); }
      else setStep(isAndroid() ? 'android' : 'menu');
    }
  }, [canInstall, install]);

  if (!currentSong) return null;
  const onMob  = isMobile();
  const showPiP = pipSupported() && !onMob;

  return (
    <>
      <motion.button whileTap={{ scale: 0.88 }}
        onClick={() => { setOpen(v => !v); setStep('menu'); }}
        onPointerDown={e => e.stopPropagation()}
        title="Widget / Épingler le lecteur"
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${pipActive||open ? 'bg-cyan-500/30 border border-cyan-500/60 text-cyan-400' : 'bg-black/60 border border-white/10 text-gray-400 hover:text-white hover:border-white/25'}`}>
        <Pin className="w-3.5 h-3.5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0,scale:0.88,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.88,y:8}} transition={{duration:0.18}}
            className="absolute bottom-20 right-2 z-50 w-72 bg-gray-950 border border-white/12 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
            onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-bold text-sm">Widget Lecteur</span>
              </div>
              <button onClick={()=>setOpen(false)} className="p-1 text-gray-500 hover:text-white rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {/* ── MENU ── */}
            {step==='menu' && (
              <div className="p-3 flex flex-col gap-2">
                {showPiP && (
                  <button onClick={openPiP} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.05] border border-white/[0.06] text-left transition-all">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
                      <MonitorSpeaker className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{pipActive?'Fermer la fenêtre flottante':'Fenêtre flottante (PiP)'}</p>
                      <p className="text-gray-500 text-xs mt-0.5">Reste visible sur tous les onglets</p>
                    </div>
                    {pipActive && <Check className="w-4 h-4 text-cyan-400 ml-auto flex-shrink-0" />}
                  </button>
                )}
                {onMob && (
                  <button onClick={()=>setStep('widget')} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.05] border border-cyan-500/20 text-left transition-all">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0">
                      <LayoutGrid className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Widget écran d'accueil</p>
                      <p className="text-gray-500 text-xs mt-0.5">Comme Spotify · contrôle depuis le bureau</p>
                    </div>
                  </button>
                )}
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20">
                  <Bell className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-400 text-xs leading-relaxed">
                    <span className="text-green-400 font-semibold">✅ Actif</span> — Contrôles automatiques dans la barre de notification et sur l'écran de verrouillage.
                  </p>
                </div>
              </div>
            )}

            {/* ── WIDGET GUIDE ── */}
            {step==='widget' && (
              <div className="p-4 flex flex-col gap-3">
                <p className="text-white font-semibold text-sm">Widget sur l'écran d'accueil</p>
                <p className="text-gray-400 text-xs leading-relaxed">Pour avoir un widget lecteur comme Spotify, installez d'abord <span className="text-cyan-300 font-medium">NovaSound</span> comme application puis ajoutez le widget.</p>

                {/* Étape 1 */}
                <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                  <div className="px-3 py-2 bg-white/[0.04] flex items-center gap-2 border-b border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <p className="text-white text-xs font-semibold">Installer NovaSound</p>
                  </div>
                  <button onClick={handleInstall} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.03] transition-all text-left">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{done?'✅ Installé !':isInstalled?'✅ Déjà installée':"Ajouter à l'écran d'accueil"}</p>
                      <p className="text-gray-500 text-[10px]">{isAndroid()?'Android Chrome / Samsung Internet':'Safari iOS'}</p>
                    </div>
                  </button>
                </div>

                {/* Étape 2 */}
                <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                  <div className="px-3 py-2 bg-white/[0.04] flex items-center gap-2 border-b border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <p className="text-white text-xs font-semibold">Ajouter le widget</p>
                  </div>
                  <div className="p-3 flex flex-col gap-1.5">
                    {isAndroid() ? (
                      <>
                        {[
                          "Maintenez le doigt sur une zone vide de l'écran d'accueil",
                          'Appuyez sur "Widgets"',
                          'Cherchez "NovaSound" dans la liste',
                          "Maintenez le widget et déposez-le sur l'écran",
                        ].map((t,i)=><Step key={i} n={String.fromCharCode(97+i)} text={t}/>)}
                        <p className="text-gray-600 text-[10px] mt-1">⚠️ Samsung Internet ou Chrome Android 120+</p>
                      </>
                    ) : (
                      <>
                        {[
                          "Maintenez le doigt sur l'écran d'accueil iOS",
                          'Appuyez sur le "+" en haut à gauche',
                          'Cherchez "NovaSound" dans la liste',
                          'Choisissez la taille et ajoutez-le',
                        ].map((t,i)=><Step key={i} n={String.fromCharCode(97+i)} text={t}/>)}
                        <p className="text-gray-600 text-[10px] mt-1">⚠️ iOS 16+, app installée via Safari</p>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={()=>setStep('menu')} className="text-xs text-gray-500 hover:text-white transition-colors text-center py-1">← Retour</button>
              </div>
            )}

            {/* ── GUIDE iOS install ── */}
            {step==='ios' && (
              <div className="p-4">
                <p className="text-white font-semibold text-sm mb-3">Installer sur iPhone (Safari)</p>
                {[
                  'Appuie sur le bouton Partager ⬆️ en bas de Safari',
                  "Fais défiler et appuie sur « Sur l'écran d'accueil »",
                  "Appuie sur « Ajouter » en haut à droite",
                ].map((t,i)=>(
                  <div key={i} className="flex items-start gap-2.5 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                    <p className="text-gray-300 text-xs leading-relaxed">{t}</p>
                  </div>
                ))}
                <p className="text-gray-500 text-[10px] mt-2">⚠️ Doit être fait depuis <strong className="text-gray-400">Safari</strong></p>
                <button onClick={()=>setStep('widget')} className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors text-center">← Retour</button>
              </div>
            )}

            {/* ── GUIDE Android install ── */}
            {step==='android' && (
              <div className="p-4">
                <p className="text-white font-semibold text-sm mb-3">Installer sur Android (Chrome)</p>
                {[
                  'Appuie sur le menu ⋮ en haut à droite de Chrome',
                  "Sélectionne « Ajouter à l'écran d'accueil »",
                  "Confirme en appuyant sur « Ajouter »",
                ].map((t,i)=>(
                  <div key={i} className="flex items-start gap-2.5 mb-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                    <p className="text-gray-300 text-xs leading-relaxed">{t}</p>
                  </div>
                ))}
                <button onClick={()=>setStep('widget')} className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors text-center">← Retour</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const Step = ({ n, text }) => (
  <div className="flex items-start gap-2">
    <span className="text-gray-600 text-[10px] font-bold flex-shrink-0 mt-0.5">{n}.</span>
    <p className="text-gray-300 text-xs leading-relaxed">{text}</p>
  </div>
);

export default PinPlayerWidget;
