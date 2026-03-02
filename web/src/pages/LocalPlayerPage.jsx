/**
 * LocalPlayerPage — NovaSound TITAN LUX v8000
 * Page dédiée au lecteur hors-ligne (fichiers locaux de l'appareil).
 * Route : /#/local-player
 */
import React from 'react';
import { motion } from 'framer-motion';
import { HardDrive, WifiOff, ShieldCheck, Smartphone } from 'lucide-react';
import LocalFilePicker from '@/components/LocalFilePicker';

const LocalPlayerPage = () => (
  <div className="min-h-screen bg-[#050510] flex flex-col items-center px-5 py-10"
    style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 24px)' }}>

    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm flex flex-col items-center gap-8"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)' }}>
          <HardDrive className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-white text-2xl font-black">Lecteur Local</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Lis tes fichiers audio directement depuis ton iPhone, Android ou PC — sans connexion internet.
        </p>
      </div>

      {/* Picker */}
      <LocalFilePicker />

      {/* Feature badges */}
      <div className="w-full grid grid-cols-1 gap-3 mt-2">
        {[
          { icon: WifiOff,     color: '#22d3ee', label: '100% hors-ligne', desc: 'Aucune donnée mobile utilisée' },
          { icon: ShieldCheck, color: '#4ade80', label: 'Privé',           desc: 'Aucun fichier envoyé vers un serveur' },
          { icon: Smartphone,  color: '#a855f7', label: 'Tous appareils',  desc: 'iPhone · Android · PC · Mac' },
        ].map(({ icon: Icon, color, label, desc }) => (
          <div key={label} className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: color + '22' }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-white text-xs font-semibold">{label}</p>
              <p className="text-gray-500 text-[11px]">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Formats */}
      <div className="w-full bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.05]">
        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">Formats supportés</p>
        <div className="flex flex-wrap gap-1.5">
          {['MP3','M4A','WAV','FLAC','AAC','OGG','OPUS','AIFF'].map(fmt => (
            <span key={fmt} className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  </div>
);

export default LocalPlayerPage;
